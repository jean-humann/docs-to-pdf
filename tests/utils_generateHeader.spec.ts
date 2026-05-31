/**
 * @jest-environment jsdom
 */

import { generateHeader } from '../src/utils';

describe('generateHeader', () => {
  it('should generate the header information correctly', () => {
    const headers: Array<{
      header: string;
      level: number;
      id: string;
    }> = [];
    const matchedStr = '<h1 class="title">Title</h1>';
    const { headerText, headerId, level } = generateHeader(headers, matchedStr);

    expect(headerText).toBe('Title');
    expect(headerId).toMatch(/[a-z0-9]{3}-\d+/);
    expect(level).toBe(1);
  });

  it('should handle complex HTML with multiple tags', () => {
    const headers: Array<{
      header: string;
      level: number;
      id: string;
    }> = [];
    const matchedStr = '<h2><a href="#">#</a><span>Complex</span> Header</h2>';
    const { headerText, headerId, level } = generateHeader(headers, matchedStr);

    expect(headerText).toBe('#Complex Header');
    expect(headerId).toMatch(/[a-z0-9]{3}-\d+/);
    expect(level).toBe(2);
  });

  it('should extract text from Docusaurus-style headers with anchor tags', () => {
    const headers: Array<{
      header: string;
      level: number;
      id: string;
    }> = [];
    const matchedStr = '<h3><a href="#test">#</a> Test Header</h3>';
    const { headerText, headerId, level } = generateHeader(headers, matchedStr);

    expect(headerText).toBe('# Test Header');
    expect(headerId).toMatch(/[a-z0-9]{3}-\d+/);
    expect(level).toBe(3);
  });
});

describe('generateHeader with pageSlug (deterministic ids)', () => {
  it('namespaces the original heading id with the page slug', () => {
    const { headerId, originalId } = generateHeader(
      [],
      '<h1 id="my-section">Title</h1>',
      'docs-intro',
    );
    expect(originalId).toBe('my-section');
    expect(headerId).toBe('docs-intro--my-section-0');
  });

  it('derives the id from the heading text when the tag has no id', () => {
    const { headerId, originalId } = generateHeader(
      [],
      '<h2>Getting Started</h2>',
      'docs-intro',
    );
    expect(originalId).toBe('getting-started');
    expect(headerId).toBe('docs-intro--getting-started-0');
  });

  it('appends a counter so ids stay unique across pages', () => {
    const headers = [{ header: 'X', level: 1, id: 'docs-intro--foo-0' }];
    const { headerId } = generateHeader(
      headers,
      '<h1 id="foo">Foo</h1>',
      'docs-intro',
    );
    expect(headerId).toBe('docs-intro--foo-1');
  });
});
