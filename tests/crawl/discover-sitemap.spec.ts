import * as puppeteer from 'puppeteer-core';
import { discoverSitemapURLs } from '../../src/acquire';

/**
 * Build a fake puppeteer Page whose `goto` resolves the given response and
 * whose `evaluate` resolves the raw sitemap XML text. `discoverSitemapURLs`
 * only ever touches `page.goto` and `page.evaluate`, so this minimal surface
 * is enough to unit-test it without a real browser.
 */
function makeFakePage(opts: {
  response: { ok: () => boolean } | null;
  xml?: string;
}): puppeteer.Page {
  return {
    goto: jest.fn().mockResolvedValue(opts.response),
    evaluate: jest.fn().mockResolvedValue(opts.xml ?? ''),
  } as unknown as puppeteer.Page;
}

describe('discoverSitemapURLs', () => {
  it('returns the <loc> URLs in document order for a 200 + valid XML', async () => {
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset>',
      '  <url><loc>https://site/a</loc></url>',
      '  <url><loc>https://site/b</loc></url>',
      '  <url><loc>https://site/c</loc></url>',
      '</urlset>',
    ].join('\n');
    const page = makeFakePage({ response: { ok: () => true }, xml });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toEqual([
      'https://site/a',
      'https://site/b',
      'https://site/c',
    ]);
  });

  it('requests ${baseOrigin}/sitemap.xml', async () => {
    const page = makeFakePage({
      response: { ok: () => true },
      xml: '<loc>https://site/a</loc>',
    });

    await discoverSitemapURLs(page, 'https://site');

    expect(page.goto).toHaveBeenCalledWith(
      'https://site/sitemap.xml',
      expect.objectContaining({
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      }),
    );
  });

  it('returns null when the response is not ok', async () => {
    const page = makeFakePage({
      response: { ok: () => false },
      xml: '<loc>https://site/a</loc>',
    });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toBeNull();
    // Should short-circuit before reading the document body.
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  it('returns null when goto resolves null (no response)', async () => {
    const page = makeFakePage({ response: null });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toBeNull();
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  it('returns null when the XML contains zero <loc> entries', async () => {
    const page = makeFakePage({
      response: { ok: () => true },
      xml: '<?xml version="1.0"?><urlset></urlset>',
    });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toBeNull();
  });

  it('returns null when page.goto rejects (error is caught)', async () => {
    const page = {
      goto: jest.fn().mockRejectedValue(new Error('navigation timeout')),
      evaluate: jest.fn(),
    } as unknown as puppeteer.Page;

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toBeNull();
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  it('returns null when page.evaluate rejects (error is caught)', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue({ ok: () => true }),
      evaluate: jest.fn().mockRejectedValue(new Error('detached frame')),
    } as unknown as puppeteer.Page;

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toBeNull();
  });

  it('trims whitespace and newlines inside <loc>', async () => {
    const xml = [
      '<urlset>',
      '  <url><loc>',
      '    https://site/spaced',
      '  </loc></url>',
      '  <url><loc>\thttps://site/tabbed\t</loc></url>',
      '</urlset>',
    ].join('\n');
    const page = makeFakePage({ response: { ok: () => true }, xml });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toEqual(['https://site/spaced', 'https://site/tabbed']);
  });

  it('matches <loc> case-insensitively', async () => {
    const xml =
      '<urlset><url><LOC>https://site/upper</LOC></url>' +
      '<url><Loc>https://site/mixed</Loc></url></urlset>';
    const page = makeFakePage({ response: { ok: () => true }, xml });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toEqual(['https://site/upper', 'https://site/mixed']);
  });

  it('matches <loc> entries spread across multiple lines', async () => {
    const xml =
      '<urlset>\n' +
      '<url>\n<loc>https://site/one</loc>\n</url>\n' +
      '<url>\n<loc>https://site/two</loc>\n</url>\n' +
      '</urlset>';
    const page = makeFakePage({ response: { ok: () => true }, xml });

    const result = await discoverSitemapURLs(page, 'https://site');

    expect(result).toEqual(['https://site/one', 'https://site/two']);
  });
});
