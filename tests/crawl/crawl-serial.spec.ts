import * as puppeteer from 'puppeteer-core';
import { crawlSerial, PagePool } from '../../src/acquire';
import * as utils from '../../src/utils';
import type { GeneratePDFOptions } from '../../src/core';

jest.mock('../../src/utils');

const mockedUtils = utils as jest.Mocked<typeof utils>;

/**
 * A fake page whose `goto` is a shared jest.fn so tests can assert exactly which
 * URLs were navigated to (and how many times). The crawler only ever calls
 * `goto` on the page; everything else (isPageKept, getHtmlContent, findNextUrl,
 * openDetails, delay) goes through the mocked utils module.
 */
function makeFakePage(): puppeteer.Page {
  return {
    goto: jest.fn().mockResolvedValue(undefined),
  } as unknown as puppeteer.Page;
}

/**
 * A fake pool that hands the SAME fake page to every withPage call, so a single
 * shared goto mock records the full navigation history of the serial crawl.
 */
function makeFakePool(page: puppeteer.Page): PagePool {
  return {
    withPage: <T>(fn: (p: puppeteer.Page) => Promise<T>): Promise<T> =>
      fn(page),
  };
}

function makeOptions(
  overrides: Partial<GeneratePDFOptions> = {},
): GeneratePDFOptions {
  return {
    initialDocURLs: ['http://x/p1'],
    contentSelector: '.c',
    paginationSelector: '.n',
    excludeURLs: [],
    excludePaths: [],
    filterKeyword: '',
    restrictPaths: false,
    waitForRender: 0,
    ...overrides,
  } as unknown as GeneratePDFOptions;
}

describe('crawlSerial', () => {
  beforeEach(() => {
    mockedUtils.isPageKept.mockResolvedValue(true);
    mockedUtils.openDetails.mockResolvedValue(undefined as never);
    mockedUtils.delay.mockResolvedValue(undefined as never);
    mockedUtils.getHtmlContent.mockResolvedValue('<html/>');
    mockedUtils.findNextUrl.mockResolvedValue('');
  });

  it('follows a single-seed next-link chain p1->p2->p3 in dense order', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p3')
      .mockResolvedValueOnce('');
    mockedUtils.getHtmlContent
      .mockResolvedValueOnce('<h1/>')
      .mockResolvedValueOnce('<h2/>')
      .mockResolvedValueOnce('<h3/>');

    const chunks = await crawlSerial(pool, makeOptions());

    expect(chunks).toEqual([
      { order: 0, url: 'http://x/p1', html: '<h1/>' },
      { order: 1, url: 'http://x/p2', html: '<h2/>' },
      { order: 2, url: 'http://x/p3', html: '<h3/>' },
    ]);
  });

  it('treats a trailing-slash variant as a different URL (raw-string visited, NOT normalized)', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    // seed 'http://x/a' -> 'http://x/a/' -> stop. Both must be crawled.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/a/')
      .mockResolvedValueOnce('');

    const chunks = await crawlSerial(
      pool,
      makeOptions({ initialDocURLs: ['http://x/a'] }),
    );

    expect(chunks.map((c) => c.url)).toEqual(['http://x/a', 'http://x/a/']);
    expect(chunks.map((c) => c.order)).toEqual([0, 1]);
  });

  it('breaks on circular pagination and logs a yellow warning without duplicating a chunk', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // p1 -> p2 -> back to p1 (already visited) => loop breaks.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p1');

    const chunks = await crawlSerial(pool, makeOptions());

    expect(chunks.map((c) => c.url)).toEqual(['http://x/p1', 'http://x/p2']);
    const warned = logSpy.mock.calls.some((call) =>
      String(call[0]).includes('circular pagination detected'),
    );
    expect(warned).toBe(true);

    logSpy.mockRestore();
  });

  it('shares the visited set across seeds: a second seed chain stops at a seed-1 url', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    // seed1: p1 -> p2 -> stop. seed2: s2 -> p1 (already visited) => stops.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2') // from p1
      .mockResolvedValueOnce('') // from p2
      .mockResolvedValueOnce('http://x/p1'); // from s2 -> dup

    const chunks = await crawlSerial(
      pool,
      makeOptions({ initialDocURLs: ['http://x/p1', 'http://x/s2'] }),
    );

    expect(chunks.map((c) => c.url)).toEqual([
      'http://x/p1',
      'http://x/p2',
      'http://x/s2',
    ]);
    expect(chunks.map((c) => c.order)).toEqual([0, 1, 2]);
  });

  it('omits a kept=false page but keeps order dense (no gap)', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    // p1 (kept) -> p2 (dropped) -> p3 (kept) -> stop.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p3')
      .mockResolvedValueOnce('');
    mockedUtils.isPageKept
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mockedUtils.getHtmlContent
      .mockResolvedValueOnce('<h1/>')
      .mockResolvedValueOnce('<h3/>');

    const chunks = await crawlSerial(pool, makeOptions());

    expect(chunks).toEqual([
      { order: 0, url: 'http://x/p1', html: '<h1/>' },
      { order: 1, url: 'http://x/p3', html: '<h3/>' },
    ]);
  });

  it('does not call openDetails when openDetail=false', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('');

    await crawlSerial(pool, makeOptions({ openDetail: false }));

    expect(mockedUtils.openDetails).not.toHaveBeenCalled();
  });

  it('calls openDetails once per kept page when openDetail=true', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    // p1 (kept) -> p2 (dropped) -> p3 (kept) -> stop. openDetails twice.
    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p3')
      .mockResolvedValueOnce('');
    mockedUtils.isPageKept
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await crawlSerial(pool, makeOptions({ openDetail: true }));

    expect(mockedUtils.openDetails).toHaveBeenCalledTimes(2);
  });

  it('threads the extractIframes flag into getHtmlContent (3rd arg)', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    await crawlSerial(
      pool,
      makeOptions({ extractIframes: true, contentSelector: '.body' }),
    );

    expect(mockedUtils.getHtmlContent).toHaveBeenCalledWith(
      page,
      '.body',
      true,
    );
  });

  it('awaits utils.delay with the configured ms when waitForRender>0', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    await crawlSerial(pool, makeOptions({ waitForRender: 250 }));

    expect(mockedUtils.delay).toHaveBeenCalledWith(250);
  });

  it('does not call utils.delay when waitForRender is 0', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    await crawlSerial(pool, makeOptions({ waitForRender: 0 }));

    expect(mockedUtils.delay).not.toHaveBeenCalled();
  });

  it('navigates each visited url exactly once (findNextUrl read off the same loaded page)', async () => {
    const page = makeFakePage();
    const pool = makeFakePool(page);

    mockedUtils.findNextUrl
      .mockResolvedValueOnce('http://x/p2')
      .mockResolvedValueOnce('http://x/p3')
      .mockResolvedValueOnce('');

    await crawlSerial(pool, makeOptions());

    const goto = page.goto as jest.Mock;
    expect(goto).toHaveBeenCalledTimes(3);
    expect(goto.mock.calls.map((c) => c[0])).toEqual([
      'http://x/p1',
      'http://x/p2',
      'http://x/p3',
    ]);
  });
});
