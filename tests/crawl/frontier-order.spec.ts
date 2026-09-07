import { crawlParallel } from '../../src/acquire';
import * as utils from '../../src/utils';
import type { GeneratePDFOptions } from '../../src/core';

jest.mock('../../src/utils');
const mockedUtils = utils as jest.Mocked<typeof utils>;

/**
 * A fake page. goto records the URL it navigated to (so getHtmlContent's mock
 * can key off it), and returns a response object for discoverSitemapURLs. When
 * the URL is the sitemap, it serves the configured XML (or a non-ok response).
 */
function makeFakePage(sitemapXml?: string | null) {
  const page: Record<string, unknown> = {};
  page.goto = jest.fn(async (url: string) => {
    page.__url = url;
    if (url.endsWith('/sitemap.xml')) {
      return { ok: () => sitemapXml !== null && sitemapXml !== undefined };
    }
    return { ok: () => true };
  });
  page.evaluate = jest.fn(async () => sitemapXml ?? '');
  return page;
}

/** Pool that hands every withPage call its own fresh fake page. */
function fakePool(sitemapXml?: string | null) {
  return {
    withPage: <T>(fn: (page: never) => Promise<T>): Promise<T> =>
      fn(makeFakePage(sitemapXml) as never),
  };
}

function opts(over: Partial<GeneratePDFOptions> = {}): GeneratePDFOptions {
  return {
    initialDocURLs: ['http://x/p0'],
    excludeURLs: [],
    contentSelector: '.content',
    paginationSelector: '.next',
    filterKeyword: '',
    excludePaths: [],
    restrictPaths: false,
    waitForRender: 0,
    openDetail: true,
    extractIframes: false,
    ...over,
  } as GeneratePDFOptions;
}

beforeEach(() => {
  // resetAllMocks (not just clear) so queued mockResolvedValueOnce values never
  // leak between tests — a chain that breaks early can leave the queue non-empty.
  jest.resetAllMocks();
  mockedUtils.isPageKept.mockResolvedValue(true);
  mockedUtils.openDetails.mockResolvedValue(undefined as never);
  mockedUtils.delay.mockResolvedValue(undefined as never);
  mockedUtils.getHtmlContent.mockResolvedValue('html');
});

describe('crawlParallel — deterministic frontier-indexed assembly (S2)', () => {
  it('assembles by frontier index even when later pages complete FIRST', async () => {
    // Next-link discovery builds the frontier p0 -> p1 -> p2 -> p3.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p1')
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p3')
      .mockResolvedValueOnce('');
    // Reverse completion: p3 resolves fastest, p0 slowest. If assembly were
    // by completion order the result would be [p3,p2,p1,p0]; it must be frontier order.
    mockedUtils.getHtmlContent.mockImplementation((page: never) => {
      const url = (page as Record<string, string>).__url;
      const idx = Number(url.slice(-1)); // p0..p3
      const delayMs = (4 - idx) * 25;
      return new Promise((res) =>
        setTimeout(() => res(`html:${url}`), delayMs),
      );
    });

    const chunks = await crawlParallel(fakePool(), opts({ concurrency: 4 }));

    expect(chunks.map((c) => c.url)).toEqual([
      'http://x/p0',
      'http://x/p1',
      'http://x/p2',
      'http://x/p3',
    ]);
    expect(chunks.map((c) => c.order)).toEqual([0, 1, 2, 3]);
    expect(chunks.map((c) => c.html)).toEqual([
      'html:http://x/p0',
      'html:http://x/p1',
      'html:http://x/p2',
      'html:http://x/p3',
    ]);
  });

  it('default seedFrom (next-link) frontier equals the serial chain order', async () => {
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/a')
      .mockResolvedValueOnce('http://x/b')
      .mockResolvedValueOnce('');
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    const chunks = await crawlParallel(fakePool(), opts());

    expect(chunks.map((c) => c.url)).toEqual([
      'http://x/p0',
      'http://x/a',
      'http://x/b',
    ]);
  });

  it('collapses /x and /x/ to ONE frontier slot via normalized-key dedup (S5)', async () => {
    // Discovery (raw-string) keeps both; crawlParallel normalizes and dedupes.
    // Chain: page -> page/ -> end (page and page/ are distinct raw strings).
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/docs/page/')
      .mockResolvedValueOnce('');
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    const chunks = await crawlParallel(
      fakePool(),
      opts({ initialDocURLs: ['http://x/docs/page'] }),
    );

    // initial + the two are all the same normalized key -> a single chunk.
    expect(chunks).toHaveLength(1);
    expect(chunks[0].order).toBe(0);
  });

  it('drops isPageKept=false pages in the fetch phase and renumbers densely', async () => {
    // Sitemap seeding: frontier comes straight from the sitemap (no discovery
    // isPageKept), so isPageKept runs only in the parallel fetch phase.
    const xml = `<urlset>
      <url><loc>https://site.example/a</loc></url>
      <url><loc>https://site.example/b</loc></url>
      <url><loc>https://site.example/c</loc></url>
    </urlset>`;
    // Drop /b during fetch.
    mockedUtils.isPageKept.mockImplementation(
      async (_page: never, url: string) => !url.endsWith('/b'),
    );
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    const chunks = await crawlParallel(
      fakePool(xml),
      opts({ initialDocURLs: ['http://127.0.0.1:9/a'], seedFrom: 'sitemap' }),
    );

    // /a and /c kept (initial /a already in sitemap); /b dropped. Order dense.
    expect(chunks.map((c) => c.url)).toEqual([
      'http://127.0.0.1:9/a',
      'http://127.0.0.1:9/c',
    ]);
    expect(chunks.map((c) => c.order)).toEqual([0, 1]);
  });

  it('remaps sitemap loc paths onto the crawl origin (works for served builds)', async () => {
    const xml = `<urlset>
      <url><loc>https://prod.example.com/docs/intro</loc></url>
      <url><loc>https://prod.example.com/docs/next</loc></url>
    </urlset>`;
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    const chunks = await crawlParallel(
      fakePool(xml),
      opts({
        initialDocURLs: ['http://127.0.0.1:1234/docs/intro'],
        seedFrom: 'sitemap',
      }),
    );

    expect(chunks.map((c) => c.url)).toEqual([
      'http://127.0.0.1:1234/docs/intro',
      'http://127.0.0.1:1234/docs/next',
    ]);
  });

  it('falls back to next-link discovery when the sitemap is unavailable', async () => {
    const warn = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p1')
      .mockResolvedValueOnce('');
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    // sitemapXml = null -> goto(sitemap) returns ok()=false -> discover returns null.
    const chunks = await crawlParallel(
      fakePool(null),
      opts({ seedFrom: 'sitemap' }),
    );

    expect(chunks.map((c) => c.url)).toEqual(['http://x/p0', 'http://x/p1']);
    expect(
      warn.mock.calls.flat().some((a) => String(a).includes('falling back')),
    ).toBe(true);
    warn.mockRestore();
  });

  it('always includes the initial URLs even if absent from the sitemap', async () => {
    const xml = `<urlset><url><loc>https://site/other</loc></url></urlset>`;
    mockedUtils.getHtmlContent.mockResolvedValue('h');

    const chunks = await crawlParallel(
      fakePool(xml),
      opts({ initialDocURLs: ['http://x/start'], seedFrom: 'sitemap' }),
    );

    expect(chunks.map((c) => c.url)).toContain('http://x/start');
    expect(chunks.map((c) => c.url)).toContain('http://x/other');
  });
});
