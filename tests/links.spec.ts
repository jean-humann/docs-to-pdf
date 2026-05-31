import {
  slugify,
  normalizePageKey,
  buildPageSlug,
  rewriteContentLinks,
  PageAnchorMap,
} from '../src/links';

describe('slugify', () => {
  it('lowercases and dashes non-alphanumerics', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });
  it('collapses repeats and trims dashes', () => {
    expect(slugify('  Foo / Bar  ')).toBe('foo-bar');
  });
  it('caps the length', () => {
    expect(slugify('a'.repeat(100), 10).length).toBeLessThanOrEqual(10);
  });
});

describe('normalizePageKey', () => {
  const base = 'http://127.0.0.1:3001/docs/start';

  it('strips trailing slash', () => {
    expect(normalizePageKey('/docs/intro/', base)).toBe('/docs/intro');
  });
  it('strips .html extension', () => {
    expect(normalizePageKey('/docs/intro.html', base)).toBe('/docs/intro');
  });
  it('strips /index suffix', () => {
    expect(normalizePageKey('/docs/index', base)).toBe('/docs');
  });
  it('lowercases the path', () => {
    expect(normalizePageKey('/Docs/Intro', base)).toBe('/docs/intro');
  });
  it('drops the query string', () => {
    expect(normalizePageKey('/docs/intro?tab=npm', base)).toBe('/docs/intro');
  });
  it('resolves relative hrefs against the page URL', () => {
    expect(normalizePageKey('./api', base)).toBe('/docs/api');
    expect(normalizePageKey('../api', base)).toBe('/api');
  });
  it('resolves absolute same-origin URLs', () => {
    expect(normalizePageKey('http://127.0.0.1:3001/docs/api#x', base)).toBe(
      '/docs/api',
    );
  });
  it('returns the root key for /', () => {
    expect(normalizePageKey('/', base)).toBe('/');
  });
  it('returns null for cross-origin links', () => {
    expect(normalizePageKey('https://other.io/x', base)).toBeNull();
  });
  it('returns null for mailto:', () => {
    expect(normalizePageKey('mailto:a@b.com', base)).toBeNull();
  });
  it('returns null for bare fragments', () => {
    expect(normalizePageKey('#section', base)).toBeNull();
  });
});

describe('buildPageSlug', () => {
  it('turns a path into a slug', () => {
    expect(buildPageSlug('/docs/intro')).toBe('docs-intro');
  });
  it('maps the root to "root"', () => {
    expect(buildPageSlug('/')).toBe('root');
  });
});

describe('rewriteContentLinks', () => {
  const base = 'http://127.0.0.1:3001/docs/start';
  const anchorMap: PageAnchorMap = {
    '/docs/intro': {
      pageTopId: 'page-top-docs-intro',
      headings: { installation: 'docs-intro--installation-0' },
    },
    '/docs/api': { pageTopId: 'page-top-docs-api', headings: {} },
  };

  it('rewrites a cross-page fragment link to the heading anchor', () => {
    const html =
      '<a href="http://127.0.0.1:3001/docs/intro#installation">see</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(
      '<a href="#docs-intro--installation-0">see</a>',
    );
  });
  it('rewrites a whole-page link to the page-top anchor', () => {
    const html = '<a href="/docs/api">API</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(
      '<a href="#page-top-docs-api">API</a>',
    );
  });
  it('falls back to the page-top anchor for an unknown fragment', () => {
    const html = '<a href="/docs/intro#nope">x</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(
      '<a href="#page-top-docs-intro">x</a>',
    );
  });
  it('preserves other attributes on the anchor', () => {
    const html = '<a class="c" data-x="1" href="/docs/api">API</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(
      '<a class="c" data-x="1" href="#page-top-docs-api">API</a>',
    );
  });
  it('leaves external links unchanged', () => {
    const html = '<a href="https://github.com/x">gh</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(html);
  });
  it('leaves links to pages not in the export unchanged', () => {
    const html = '<a href="/docs/not-exported">x</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(html);
  });
  it('leaves bare same-page fragments unchanged', () => {
    const html = '<a href="#local">x</a>';
    expect(rewriteContentLinks(html, anchorMap, base)).toBe(html);
  });
});
