import chalk from 'chalk';
import * as puppeteer from 'puppeteer-core';
import * as fs from 'fs-extra';
import { chromeExecPath } from './browser';
import * as utils from './utils';
import { delay } from './utils';
import { normalizePageKey } from './links';
import { AcquireIR, ContentChunk, CoverImage } from './ir';
import type { GeneratePDFOptions } from './core';

/**
 * A counting semaphore. acquire() resolves with a release function once a permit
 * is free; release() returns the permit and wakes the next FIFO waiter. Used to
 * bound how many heavy Chromium pages are open at once during a parallel crawl.
 */
export class Semaphore {
  private count: number;
  private readonly queue: Array<() => void> = [];

  constructor(count: number) {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(
        `Semaphore count must be a positive integer, got ${count}`,
      );
    }
    this.count = count;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grab = () => {
        if (this.count > 0) {
          this.count--;
          let released = false;
          resolve(() => {
            // Idempotent: a double release must not over-grant permits.
            if (released) return;
            released = true;
            this.count++;
            const next = this.queue.shift();
            if (next) next();
          });
        } else {
          this.queue.push(grab);
        }
      };
      grab();
    });
  }
}

/**
 * Configure a fresh page exactly as the v1 single-page crawl did: optional HTTP
 * Basic Auth, plus request interception that aborts `.pdf` requests (puppeteer
 * cannot render them) and continues everything else. Must run before the first
 * navigation. Shared by the crawl pool and the render page so the two browsers
 * behave identically.
 */
export async function configurePage(
  page: puppeteer.Page,
  options: Pick<GeneratePDFOptions, 'httpAuthUser' | 'httpAuthPassword'>,
): Promise<puppeteer.Page> {
  const { httpAuthUser, httpAuthPassword } = options;
  if (httpAuthUser && httpAuthPassword) {
    await page.authenticate({
      username: httpAuthUser,
      password: httpAuthPassword,
    });
  }
  await page.setRequestInterception(true);
  const handledRequests = new WeakSet<puppeteer.HTTPRequest>();
  page.on('request', (request) => {
    if (handledRequests.has(request)) {
      return;
    }
    handledRequests.add(request);
    if (request.url().endsWith('.pdf')) {
      console.log(chalk.yellowBright(`ignore pdf: ${request.url()}`));
      request.abort().catch((err) => {
        console.debug(
          `Request abort error (usually safe to ignore): ${err.message}`,
        );
      });
    } else {
      request.continue().catch((err) => {
        console.debug(
          `Request continue error (usually safe to ignore): ${err.message}`,
        );
      });
    }
  });
  return page;
}

/** Minimal page-pool surface, so crawlers can be unit-tested with a fake pool. */
export interface PagePool {
  withPage<T>(fn: (page: puppeteer.Page) => Promise<T>): Promise<T>;
}

interface Slot {
  page: puppeteer.Page;
  busy: boolean;
}

/**
 * A bounded pool of reused Chromium pages. At most `concurrency` pages are open
 * and busy at once (enforced by the Semaphore); slots are reused rather than
 * churned, keeping memory bounded under parallel crawling.
 */
export class CrawlPagePool implements PagePool {
  private slots: Slot[] = [];
  private readonly sem: Semaphore;

  constructor(
    private readonly browser: puppeteer.Browser,
    private readonly options: GeneratePDFOptions,
    concurrency: number,
  ) {
    this.sem = new Semaphore(concurrency);
  }

  async withPage<T>(fn: (page: puppeteer.Page) => Promise<T>): Promise<T> {
    const release = await this.sem.acquire();
    let slot = this.slots.find((s) => !s.busy);
    if (!slot) {
      const page = await configurePage(
        await this.browser.newPage(),
        this.options,
      );
      slot = { page, busy: true };
      this.slots.push(slot);
    } else {
      slot.busy = true;
    }
    try {
      return await fn(slot.page);
    } finally {
      slot.busy = false;
      release();
    }
  }

  async closeAll(): Promise<void> {
    for (const s of this.slots) {
      await s.page.close().catch(() => {
        // ignore close errors during teardown
      });
    }
    this.slots = [];
  }
}

/**
 * Navigate to one page and extract its content HTML, applying the same
 * keep/drop, details-expansion, and iframe rules as the v1 crawl. Returns
 * `kept: false` (and empty html) for pages filtered out by isPageKept.
 */
export async function crawlOnePage(
  page: puppeteer.Page,
  url: string,
  urlPath: string,
  options: GeneratePDFOptions,
): Promise<{ kept: boolean; html: string }> {
  const {
    waitForRender,
    contentSelector,
    extractIframes = false,
    openDetail = true,
    excludeURLs,
    filterKeyword,
    excludePaths,
    restrictPaths,
  } = options;
  console.log(chalk.cyan(`Retrieving html from ${url}`));
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 0 });
  if (waitForRender) {
    console.log(chalk.green('Waiting for render...'));
    await delay(waitForRender);
  }
  const kept = await utils.isPageKept(
    page,
    url,
    urlPath,
    excludeURLs,
    filterKeyword,
    excludePaths,
    restrictPaths,
  );
  if (!kept) {
    return { kept: false, html: '' };
  }
  if (openDetail) {
    await utils.openDetails(page);
  }
  const html = await utils.getHtmlContent(
    page,
    contentSelector,
    extractIframes,
  );
  console.log(chalk.green('Success'));
  return { kept: true, html };
}

/**
 * Serial-only helper: read the pagination next-link from the SAME already-loaded
 * DOM (no second navigation), so the next-link chain is followed exactly as v1.
 */
export async function crawlOnePageWithNext(
  page: puppeteer.Page,
  url: string,
  urlPath: string,
  options: GeneratePDFOptions,
): Promise<{ kept: boolean; html: string; nextURL: string }> {
  const { kept, html } = await crawlOnePage(page, url, urlPath, options);
  const nextURL = await utils.findNextUrl(page, options.paginationSelector);
  return { kept, html, nextURL };
}

/**
 * Serial crawl (concurrency === 1) — a faithful reproduction of the v1 inline
 * loop. Dedup stays raw-string (matching v1's visitedURLs), and chunk order is
 * insertion order, so the IR is identical to v1's contentChunks mapping.
 */
export async function crawlSerial(
  pool: PagePool,
  options: GeneratePDFOptions,
): Promise<ContentChunk[]> {
  const { initialDocURLs } = options;
  const chunks: ContentChunk[] = [];
  const visitedURLs = new Set<string>();
  let order = 0;
  for (const url of initialDocURLs) {
    let nextPageURL = url;
    const urlPath = new URL(url).pathname;
    while (nextPageURL) {
      if (visitedURLs.has(nextPageURL)) {
        console.log(
          chalk.yellow(
            `Skipping already visited URL (circular pagination detected): ${nextPageURL}`,
          ),
        );
        break;
      }
      visitedURLs.add(nextPageURL);
      const current = nextPageURL;
      const { kept, html, nextURL } = await pool.withPage((p) =>
        crawlOnePageWithNext(p, current, urlPath, options),
      );
      if (kept) {
        chunks.push({ order: order++, url: current, html });
      }
      nextPageURL = nextURL;
    }
  }
  return chunks;
}

/**
 * Fetch and parse `${baseOrigin}/sitemap.xml`, returning the list of <loc> URLs
 * in document order, or null if the sitemap is missing/empty/unreachable.
 */
export async function discoverSitemapURLs(
  page: puppeteer.Page,
  baseOrigin: string,
): Promise<string[] | null> {
  const sitemapURL = `${baseOrigin}/sitemap.xml`;
  try {
    // A sitemap is a static XML file: 'domcontentloaded' is reliable, whereas
    // 'networkidle0' can hang/timeout on Chrome's built-in XML viewer.
    const res = await page.goto(sitemapURL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    if (!res || !res.ok()) {
      return null;
    }
    const text = await page.evaluate(
      () => document.documentElement.textContent ?? '',
    );
    const locs = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi), (m) =>
      m[1].trim(),
    );
    return locs.length ? locs : null;
  } catch {
    return null;
  }
}

/**
 * Default discovery for parallel mode: walk the next-link chain serially but
 * cheaply (goto + isPageKept + findNextUrl only — no details/iframes/autoscroll)
 * to materialize the exact next-link ordered, filtered URL list. The expensive
 * content extraction then runs in parallel over this frontier.
 */
export async function buildFrontierByNextLink(
  pool: PagePool,
  options: GeneratePDFOptions,
): Promise<string[]> {
  const ordered: string[] = [];
  const visited = new Set<string>();
  for (const url of options.initialDocURLs) {
    let next = url;
    const urlPath = new URL(url).pathname;
    while (next) {
      if (visited.has(next)) {
        break;
      }
      visited.add(next);
      const current = next;
      const { kept, nextURL } = await pool.withPage(async (p) => {
        await p.goto(current, { waitUntil: 'networkidle0', timeout: 0 });
        if (options.waitForRender) {
          await delay(options.waitForRender);
        }
        const keep = await utils.isPageKept(
          p,
          current,
          urlPath,
          options.excludeURLs,
          options.filterKeyword,
          options.excludePaths,
          options.restrictPaths,
        );
        const nxt = await utils.findNextUrl(p, options.paginationSelector);
        return { kept: keep, nextURL: nxt };
      });
      if (kept) {
        ordered.push(current);
      }
      next = nextURL;
    }
  }
  return ordered;
}

/**
 * Parallel crawl (concurrency > 1). Builds an ordered frontier (next-link
 * discovery by default, or sitemap order when --seedFrom=sitemap), dedupes it
 * synchronously by normalized page key, then fetches content into a PRE-SIZED
 * array indexed by frontier position — assembly order is the frontier index,
 * never the completion order, so the global heading counter stays stable.
 */
export async function crawlParallel(
  pool: PagePool,
  options: GeneratePDFOptions,
): Promise<ContentChunk[]> {
  const baseOrigin = new URL(options.initialDocURLs[0]).origin;
  const urlPaths = options.initialDocURLs.map((u) => new URL(u).pathname);

  // 1. Choose the ordered frontier source.
  let frontier: string[];
  if (options.seedFrom === 'sitemap') {
    const sitemap = await pool.withPage((p) =>
      discoverSitemapURLs(p, baseOrigin),
    );
    if (!sitemap) {
      console.log(
        chalk.yellow(
          `[acquire] --seedFrom=sitemap requested but ${baseOrigin}/sitemap.xml unavailable; falling back to next-link discovery`,
        ),
      );
      frontier = await buildFrontierByNextLink(pool, options);
    } else {
      console.log(
        chalk.yellow(
          `[acquire] --seedFrom=sitemap: included-page SET differs from the next-link chain (sitemap order). Found ${sitemap.length} URLs.`,
        ),
      );
      frontier = sitemap
        .map((loc) => {
          // Remap each sitemap entry's PATH onto the crawl origin. Docusaurus
          // sitemaps carry the production siteUrl, so this makes sitemap
          // seeding work both for live sites (same origin, no-op) and for
          // locally-served builds (origin becomes 127.0.0.1:PORT).
          try {
            return new URL(new URL(loc).pathname, baseOrigin).href;
          } catch {
            return null;
          }
        })
        .filter((u): u is string => u !== null)
        .filter((u) => {
          if (options.excludeURLs?.includes(u)) return false;
          if (options.excludePaths?.some((x) => u.includes(x))) return false;
          if (options.restrictPaths && !urlPaths.some((up) => u.includes(up)))
            return false;
          return true;
        });
      // Always include the initial URLs even if absent from the sitemap.
      for (const u of options.initialDocURLs) {
        if (!frontier.includes(u)) {
          frontier.unshift(u);
        }
      }
    }
  } else {
    frontier = await buildFrontierByNextLink(pool, options);
  }

  // 2. Normalize-dedup the frontier synchronously. The stable index is the
  //    position in this deduped list — assigned before any parallelism.
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const u of frontier) {
    const key = normalizePageKey(u, u) ?? u;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ordered.push(u);
  }

  // 3. Fetch content into a PRE-SIZED array indexed by frontier position. The
  //    pool's semaphore bounds simultaneity; we never push on completion.
  const results: Array<ContentChunk | null> = new Array(ordered.length).fill(
    null,
  );
  await Promise.all(
    ordered.map(async (url, idx) => {
      // Single-seed-correct; multi-seed parallel uses the first seed path
      // (documented limitation, matches the common single-seed case).
      const urlPath = urlPaths[0];
      const { kept, html } = await pool.withPage((p) =>
        crawlOnePage(p, url, urlPath, options),
      );
      if (kept) {
        results[idx] = { order: idx, url, html };
      }
    }),
  );

  // 4. Compact (drop filtered-out) preserving index order; renumber densely.
  return results
    .filter((c): c is ContentChunk => c !== null)
    .map((c, i) => ({ ...c, order: i }));
}

/**
 * ACQUISITION stage (v2): launch a browser, crawl the documentation site into
 * the intermediate representation (deterministically-ordered content chunks +
 * cover image + base metadata), and return it. concurrency === 1 (default) runs
 * the unchanged serial loop for IR-identity with v1; concurrency > 1 enables the
 * parallel crawler.
 */
/* c8 ignore start */
export async function acquire(options: GeneratePDFOptions): Promise<AcquireIR> {
  const concurrency = options.concurrency ?? 1;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError(
      `--concurrency must be a positive integer, got ${concurrency}`,
    );
  }
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  console.debug(chalk.cyan(`[acquire] Using Chromium from ${execPath}`));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath,
    args: options.puppeteerArgs,
    protocolTimeout: options.protocolTimeout,
  });
  const chromeTmpDataDir = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
    ?.split('=')[1] as string | undefined;
  console.debug(
    chalk.cyan(`[acquire] Chrome user data dir: ${chromeTmpDataDir}`),
  );

  const pool = new CrawlPagePool(browser, options, concurrency);
  try {
    console.debug(`InitialDocURLs: ${options.initialDocURLs}`);
    const chunks =
      concurrency > 1
        ? await crawlParallel(pool, options)
        : await crawlSerial(pool, options);

    let coverImage: CoverImage | null = null;
    if (options.coverImage) {
      console.log(chalk.cyan('[acquire] Fetching cover image...'));
      coverImage = await pool.withPage((p) =>
        utils.getCoverImage(p, options.coverImage),
      );
    }

    return {
      chunks,
      baseOrigin: new URL(options.initialDocURLs[0]).origin,
      firstInitialURL: options.initialDocURLs[0],
      coverImage,
    };
  } finally {
    await pool.closeAll();
    await browser.close();
    console.log(chalk.green('[acquire] Browser closed'));
    if (chromeTmpDataDir) {
      fs.removeSync(chromeTmpDataDir);
      console.debug(chalk.cyan('[acquire] Chrome user data dir removed'));
    }
  }
}
/* c8 ignore stop */
