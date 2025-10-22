/**
 * @jest-environment jsdom
 */

import {
  getUrlFromSelector,
  getHtmlFromSelector,
  concatHtml,
  removeElementFromSelector,
} from '../src/utils';

describe('getUrlFromSelector', () => {
  beforeEach(() => {
    // Set up the document and element for testing
    document.body.innerHTML = `
        <div>
          <a id="link1" href="https://example.com/page1">Link 1</a>
          <a id="link2" href="https://example.com/page2">Link 2</a>
        </div>
      `;
  });

  it('should return the URL from the selector', () => {
    const selector = '#link1';
    const result = getUrlFromSelector(selector);
    expect(result).toBe('https://example.com/page1');
  });

  it('should return an empty string if the selector does not exist', () => {
    const selector = '#link3'; // Non-existent selector
    const result = getUrlFromSelector(selector);
    expect(result).toBe('');
  });
});

describe('getHtmlFromSelector', () => {
  beforeEach(() => {
    // Set up any necessary mock or setup before each test
  });

  afterEach(() => {
    // Clean up any resources after each test
  });

  test('should return the HTML content of the matched element', () => {
    // Mock the document and the queried element
    const mockElement = document.createElement('div');
    mockElement.innerHTML = '<p>This is the content</p>';
    jest.spyOn(document, 'querySelector').mockReturnValue(mockElement);

    // Call the function with the selector
    const selector = '#content';
    const result = getHtmlFromSelector(selector);

    // Assert the expected result
    expect(result).toBe(
      '<div style="break-after: always;"><p>This is the content</p></div>',
    );
  });

  test('should return an empty string if no element is found', () => {
    // Mock the document to return null for the queried element
    jest.spyOn(document, 'querySelector').mockReturnValue(null);

    // Call the function with the selector
    const selector = '#nonexistent';
    const result = getHtmlFromSelector(selector);

    // Assert the expected result
    expect(result).toBe('');
  });
});

describe('concatHtml', () => {
  const cover = '<div class="cover">Cover</div>';
  const toc = '<ul><li>TOC</li></ul>';
  const content = '<div class="content">Content</div>';
  const disable = false;

  it('should concatenate the HTML elements correctly', () => {
    const baseUrl = 'http://example.com/';
    const result = concatHtml(cover, toc, content, disable, baseUrl);

    expect(result).toBe(
      `<base href="http://example.com/"><div class="cover">Cover</div><ul><li>TOC</li></ul><div class="content">Content</div>`,
    );
  });

  it('should not add base when no baseUrl given', () => {
    const baseUrl = '';
    const result = concatHtml(cover, toc, content, disable, baseUrl);

    expect(result).toBe(
      `<div class="cover">Cover</div><ul><li>TOC</li></ul><div class="content">Content</div>`,
    );
  });
});

describe('removeElementFromSelector', () => {
  beforeEach(() => {
    // Set up any necessary mock or setup before each test
  });

  afterEach(() => {
    // Clean up any resources after each test
  });

  test('should remove all elements that match the selector', () => {
    // Create a mock DOM structure
    document.body.innerHTML = `
        <div id="element1">Element 1</div>
        <div class="element">Element 2</div>
        <div class="element">Element 3</div>
      `;

    // Call the function with the selector
    const selector = '.element';
    removeElementFromSelector(selector);

    // Assert that the matched elements are removed
    const matchedElements = document.querySelectorAll(selector);
    expect(matchedElements.length).toBe(0);
  });

  test('should not throw an error if no elements match the selector', () => {
    // Create a mock DOM structure
    document.body.innerHTML = `
        <div id="element1">Element 1</div>
        <div class="element">Element 2</div>
        <div class="element">Element 3</div>
      `;

    // Call the function with a non-matching selector
    const selector = '.nonexistent';
    expect(() => removeElementFromSelector(selector)).not.toThrow();
  });
});
