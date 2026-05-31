import { generateTocFromChunks } from '../src/utils';

describe('generateTocFromChunks', () => {
  const chunks = [
    {
      url: 'http://127.0.0.1:3001/docs/intro',
      html: '<h1 id="intro">Intro</h1><p>See <a href="/docs/api#auth">auth</a> and <a href="/docs/api">the API</a>.</p>',
    },
    {
      url: 'http://127.0.0.1:3001/docs/api',
      html: '<h1 id="api">API</h1><h2 id="auth">Auth</h2><p><a href="https://example.com">external</a></p>',
    },
  ];

  const result = generateTocFromChunks(chunks);

  it('assigns deterministic, page-namespaced heading ids', () => {
    expect(result.anchorMap['/docs/intro'].headings.intro).toBe(
      'docs-intro--intro-0',
    );
    expect(result.anchorMap['/docs/api'].headings.api).toBe('docs-api--api-1');
    expect(result.anchorMap['/docs/api'].headings.auth).toBe(
      'docs-api--auth-2',
    );
    expect(result.modifiedContentHTML).toContain('id="docs-intro--intro-0"');
  });

  it('injects a per-page top anchor', () => {
    expect(result.modifiedContentHTML).toContain(
      '<a id="page-top-docs-intro">',
    );
    expect(result.modifiedContentHTML).toContain('<a id="page-top-docs-api">');
  });

  it('rewrites a cross-page fragment link to the target heading anchor', () => {
    expect(result.modifiedContentHTML).toContain('href="#docs-api--auth-2"');
  });

  it('rewrites a whole-page link to the page-top anchor', () => {
    expect(result.modifiedContentHTML).toContain('href="#page-top-docs-api"');
  });

  it('leaves external links untouched', () => {
    expect(result.modifiedContentHTML).toContain('href="https://example.com"');
  });

  it('still produces a TOC listing the headings', () => {
    expect(result.tocHTML).toContain('Intro');
    expect(result.tocHTML).toContain('Auth');
    expect(result.tocHTML).toContain('#docs-intro--intro-0');
  });
});
