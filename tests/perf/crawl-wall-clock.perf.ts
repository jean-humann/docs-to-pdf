import { performance } from 'perf_hooks';
import * as puppeteer from 'puppeteer-core';
import { acquire, crawlParallel, CrawlPagePool } from '../../src/acquire';
import { chromeExecPath } from '../../src/browser';
import { describeIfChrome } from '../helpers/chromeGuard';
import {
  startFixture,
  stopDocusaurusServer,
  v3Options,
  ServerInstance,
} from '../helpers/fixtureServer';

/**
 * Crawl wall-clock benchmarks. Run explicitly (NOT part of `yarn test`):
 *   REBUILD_THRESHOLD_MINUTES=0 npx jest --config jest.perf.config.ts
 *
 * Assertions are RELATIVE (parallel vs serial on the SAME page set), never
 * absolute, so they're portable. They guard against catastrophic regressions
 * and demonstrate the parallel-fetch speedup; the precise ratios are logged.
 */
async function timeIt<T>(fn: () => Promise<T>): Promise<[number, T]> {
  const t0 = performance.now();
  const result = await fn();
  return [performance.now() - t0, result];
}

describeIfChrome('Phase 0 perf: crawl wall-clock', () => {
  let server: ServerInstance;
  let browser: puppeteer.Browser;
  let introURL: string;

  beforeAll(async () => {
    server = await startFixture();
    introURL = `http://127.0.0.1:${server.port}/docs/intro`;
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }, 120000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await stopDocusaurusServer(server);
  });

  it('parallel fetch is faster than serial on the SAME page set', async () => {
    // Same (deterministic) next-link frontier, fetched 1-wide vs 8-wide. Both
    // pay the identical serial discovery pass, so the wall-clock difference
    // isolates the parallel fetch win.
    const opts = v3Options([introURL], { concurrency: 8 });

    const pool1 = new CrawlPagePool(browser, opts, 1);
    const [ms1, chunks1] = await timeIt(() => crawlParallel(pool1, opts));
    await pool1.closeAll();

    const pool8 = new CrawlPagePool(browser, opts, 8);
    const [ms8, chunks8] = await timeIt(() => crawlParallel(pool8, opts));
    await pool8.closeAll();

    const speedup = ms1 / ms8;
    console.log(
      `[perf] same-set fetch  serial=${ms1.toFixed(0)}ms  8-wide=${ms8.toFixed(
        0,
      )}ms  speedup=${speedup.toFixed(2)}x  (${chunks8.length} pages)`,
    );

    expect(chunks8.length).toBe(chunks1.length);
    expect(chunks8.length).toBeGreaterThan(3);
    // 8-wide must be meaningfully faster on a multi-page, network-bound crawl.
    expect(ms8).toBeLessThan(ms1 * 0.85);
  }, 600000);

  it('end-to-end acquire timings (informational, non-regression guard)', async () => {
    const [serialMs, serialIr] = await timeIt(() =>
      acquire(v3Options([introURL], { concurrency: 1 })),
    );
    const [nextlinkMs, nextlinkIr] = await timeIt(() =>
      acquire(v3Options([introURL], { concurrency: 4 })),
    );
    const [sitemapMs, sitemapIr] = await timeIt(() =>
      acquire(v3Options([introURL], { concurrency: 4, seedFrom: 'sitemap' })),
    );

    console.log(
      `[perf] acquire  serial=${serialMs.toFixed(0)}ms (${
        serialIr.chunks.length
      }p)  par4/next-link=${nextlinkMs.toFixed(0)}ms (${
        nextlinkIr.chunks.length
      }p)  par4/sitemap=${sitemapMs.toFixed(0)}ms (${sitemapIr.chunks.length}p)`,
    );
    console.log(
      '[perf] note: next-link parallel needs a serial discovery pass, so its ' +
        'wall-clock win is modest; --seedFrom sitemap skips discovery for the real speedup.',
    );

    expect(serialIr.chunks.length).toBeGreaterThan(1);
    expect(nextlinkIr.chunks.length).toBe(serialIr.chunks.length);
    // Non-regression guard: next-link parallel must not be catastrophically slow.
    expect(nextlinkMs).toBeLessThan(serialMs * 3);
  }, 600000);
});
