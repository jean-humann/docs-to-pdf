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
