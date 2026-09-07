import * as puppeteer from 'puppeteer-core';
import { CrawlPagePool } from '../../src/acquire';
import type { GeneratePDFOptions } from '../../src/core';

/**
 * Unit tests for CrawlPagePool. These exercise the pool with plain-object
 * mock puppeteer Browser/Page instances (no real Chromium), so they verify
 * the auth/request-interception wiring, request dedup, slot reuse, release
 * on error, and closeAll behaviour deterministically.
 */

type RequestHandler = (request: puppeteer.HTTPRequest) => void;

interface FakePage {
  authenticate: jest.Mock;
  setRequestInterception: jest.Mock;
  on: jest.Mock;
  close: jest.Mock;
  goto: jest.Mock;
  /** The 'request' handler captured from page.on('request', ...). */
  requestHandler?: RequestHandler;
}

function makeFakePage(): FakePage {
  const page: FakePage = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn().mockResolvedValue(undefined),
  };
  page.on.mockImplementation((evt: string, handler: RequestHandler) => {
    if (evt === 'request') {
      page.requestHandler = handler;
    }
    return page;
  });
  return page;
}

function makeFakeBrowser(pages: FakePage[]): puppeteer.Browser {
  return {
    newPage: jest.fn(async () => {
      const p = makeFakePage();
      pages.push(p);
      return p as unknown as puppeteer.Page;
    }),
  } as unknown as puppeteer.Browser;
}

function makeFakeRequest(url: string): {
  url: () => string;
  abort: jest.Mock;
  continue: jest.Mock;
} {
  return {
    url: () => url,
    abort: jest.fn().mockResolvedValue(undefined),
    continue: jest.fn().mockResolvedValue(undefined),
  };
}

const baseOptions = {
  initialDocURLs: ['http://x/p1'],
  contentSelector: '.c',
  paginationSelector: '.n',
  excludeURLs: [],
  excludePaths: [],
  filterKeyword: '',
  restrictPaths: false,
  waitForRender: 0,
} as unknown as GeneratePDFOptions;

describe('CrawlPagePool', () => {
  describe('configurePage wiring', () => {
    it('calls page.authenticate once when both creds are set', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const options = {
        ...baseOptions,
        httpAuthUser: 'user',
        httpAuthPassword: 'pass',
      } as unknown as GeneratePDFOptions;
      const pool = new CrawlPagePool(browser, options, 1);

      await pool.withPage(async () => undefined);

      const page = pages[0];
      expect(page.authenticate).toHaveBeenCalledTimes(1);
      expect(page.authenticate).toHaveBeenCalledWith({
        username: 'user',
        password: 'pass',
      });
    });

    it('does not call authenticate when no creds are provided', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);

      expect(pages[0].authenticate).not.toHaveBeenCalled();
    });

    it('does not call authenticate when only one cred is set', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const options = {
        ...baseOptions,
        httpAuthUser: 'user',
      } as unknown as GeneratePDFOptions;
      const pool = new CrawlPagePool(browser, options, 1);

      await pool.withPage(async () => undefined);

      expect(pages[0].authenticate).not.toHaveBeenCalled();
    });

    it('always enables request interception', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);

      expect(pages[0].setRequestInterception).toHaveBeenCalledWith(true);
    });
  });

  describe('request handler', () => {
    it('aborts .pdf requests and continues everything else', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);
      const handler = pages[0].requestHandler!;
      expect(handler).toBeDefined();

      const pdfReq = makeFakeRequest('http://x/file.pdf');
      handler(pdfReq as unknown as puppeteer.HTTPRequest);
      expect(pdfReq.abort).toHaveBeenCalledTimes(1);
      expect(pdfReq.continue).not.toHaveBeenCalled();

      const htmlReq = makeFakeRequest('http://x/page.html');
      handler(htmlReq as unknown as puppeteer.HTTPRequest);
      expect(htmlReq.continue).toHaveBeenCalledTimes(1);
      expect(htmlReq.abort).not.toHaveBeenCalled();
    });

    it('dedups via WeakSet so the same request is handled once', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);
      const handler = pages[0].requestHandler!;

      const pdfReq = makeFakeRequest('http://x/file.pdf');
      handler(pdfReq as unknown as puppeteer.HTTPRequest);
      handler(pdfReq as unknown as puppeteer.HTTPRequest);
      expect(pdfReq.abort).toHaveBeenCalledTimes(1);

      const htmlReq = makeFakeRequest('http://x/page.html');
      handler(htmlReq as unknown as puppeteer.HTTPRequest);
      handler(htmlReq as unknown as puppeteer.HTTPRequest);
      expect(htmlReq.continue).toHaveBeenCalledTimes(1);
    });
  });

  describe('slot management', () => {
    it('reuses slots: newPage is called at most concurrency times across sequential withPage calls', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 2);

      for (let i = 0; i < 5; i++) {
        await pool.withPage(async () => undefined);
      }

      expect(
        (browser.newPage as jest.Mock).mock.calls.length,
      ).toBeLessThanOrEqual(2);
      // Sequential calls each release before the next acquires, so a single
      // slot is enough to satisfy all of them.
      expect(browser.newPage).toHaveBeenCalledTimes(1);
    });

    it('releases the slot even when fn throws, and reuses it afterwards', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await expect(
        pool.withPage(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      // A subsequent call must still succeed (permit + slot were freed) and
      // reuse the same page rather than creating a new one.
      let usedPage: unknown;
      await pool.withPage(async (p) => {
        usedPage = p;
      });

      expect(browser.newPage).toHaveBeenCalledTimes(1);
      expect(usedPage).toBe(pages[0]);
    });
  });

  describe('closeAll', () => {
    it('closes every created page and a later withPage creates a fresh page', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);
      expect(pages).toHaveLength(1);
      const firstPage = pages[0];

      await pool.closeAll();
      expect(firstPage.close).toHaveBeenCalledTimes(1);

      // Slots were cleared, so the next withPage must allocate a new page.
      await pool.withPage(async () => undefined);
      expect(browser.newPage).toHaveBeenCalledTimes(2);
      expect(pages).toHaveLength(2);
      expect(pages[1]).not.toBe(firstPage);
    });

    it('ignores errors thrown by page.close during teardown', async () => {
      const pages: FakePage[] = [];
      const browser = makeFakeBrowser(pages);
      const pool = new CrawlPagePool(browser, baseOptions, 1);

      await pool.withPage(async () => undefined);
      pages[0].close.mockRejectedValueOnce(new Error('close failed'));

      await expect(pool.closeAll()).resolves.toBeUndefined();
    });
  });
});
