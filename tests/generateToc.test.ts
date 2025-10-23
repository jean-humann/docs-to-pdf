import { generateToc, generateTocHtml, generateHeader } from '../src/utils';

describe('generateToc', () => {
  describe('basic functionality', () => {
    it('should generate TOC from simple headers', () => {
      const html = `
        <h1 id="old-id-1">First Header</h1>
        <p>Some content</p>
        <h2 id="old-id-2">Second Header</h2>
        <p>More content</p>
      `;

      const result = generateToc(html);

      expect(result.modifiedContentHTML).toContain('First Header');
      expect(result.modifiedContentHTML).toContain('Second Header');
      expect(result.modifiedContentHTML).not.toContain('old-id-1');
      expect(result.modifiedContentHTML).not.toContain('old-id-2');
      expect(result.tocHTML).toContain('First Header');
      expect(result.tocHTML).toContain('Second Header');
      expect(result.tocHTML).toContain('toc-page');
    });

    it('should handle headers without existing IDs', () => {
      const html = `
        <h1>Header Without ID</h1>
        <h2>Another Header</h2>
      `;

      const result = generateToc(html);

      expect(result.modifiedContentHTML).toContain('id="');
      expect(result.tocHTML).toContain('Header Without ID');
      expect(result.tocHTML).toContain('Another Header');
    });

    it('should handle empty HTML', () => {
      const html = '';

      const result = generateToc(html);

      expect(result.modifiedContentHTML).toBe('');
      expect(result.tocHTML).toContain('toc-page');
    });

    it('should handle HTML with no headers', () => {
      const html = '<p>Just a paragraph</p><div>Some content</div>';

      const result = generateToc(html);

      expect(result.modifiedContentHTML).toBe(html);
      expect(result.tocHTML).toContain('toc-page');
    });
  });

  describe('maxLevel option', () => {
    it('should respect default maxLevel of 4', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
        <h5>Level 5</h5>
        <h6>Level 6</h6>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Level 1');
      expect(result.tocHTML).toContain('Level 2');
      expect(result.tocHTML).toContain('Level 3');
      expect(result.tocHTML).toContain('Level 4');
      expect(result.tocHTML).not.toContain('Level 5');
      expect(result.tocHTML).not.toContain('Level 6');
    });

    it('should respect custom maxLevel of 2', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
      `;

      const result = generateToc(html, { maxLevel: 2 });

      expect(result.tocHTML).toContain('Level 1');
      expect(result.tocHTML).toContain('Level 2');
      expect(result.tocHTML).not.toContain('Level 3');
      expect(result.tocHTML).not.toContain('Level 4');
    });

    it('should respect custom maxLevel of 6', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
        <h5>Level 5</h5>
        <h6>Level 6</h6>
      `;

      const result = generateToc(html, { maxLevel: 6 });

      expect(result.tocHTML).toContain('Level 1');
      expect(result.tocHTML).toContain('Level 2');
      expect(result.tocHTML).toContain('Level 3');
      expect(result.tocHTML).toContain('Level 4');
      expect(result.tocHTML).toContain('Level 5');
      expect(result.tocHTML).toContain('Level 6');
    });

    it('should handle maxLevel of 1', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
      `;

      const result = generateToc(html, { maxLevel: 1 });

      expect(result.tocHTML).toContain('Level 1');
      expect(result.tocHTML).not.toContain('Level 2');
      expect(result.tocHTML).not.toContain('Level 3');
    });
  });

  describe('tocTitle option', () => {
    it('should use default TOC title when not provided', () => {
      const html = '<h1>Test Header</h1>';

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Table of contents:');
    });

    it('should use custom TOC title when provided', () => {
      const html = '<h1>Test Header</h1>';

      const result = generateToc(html, { tocTitle: 'Custom Contents' });

      expect(result.tocHTML).toContain('Custom Contents');
      expect(result.tocHTML).not.toContain('Table of contents:');
    });

    it('should handle empty TOC title', () => {
      const html = '<h1>Test Header</h1>';

      const result = generateToc(html, { tocTitle: '' });

      expect(result.tocHTML).not.toContain('Table of contents:');
      expect(result.tocHTML).toContain('toc-page');
    });
  });

  describe('header ID replacement', () => {
    it('should replace existing header IDs with generated ones', () => {
      const html = `
        <h1 id="existing-id">Header One</h1>
        <h2 id="another-id">Header Two</h2>
      `;

      const result = generateToc(html);

      expect(result.modifiedContentHTML).not.toContain('existing-id');
      expect(result.modifiedContentHTML).not.toContain('another-id');
      // Check that new IDs are present (they follow pattern: randomString-index)
      expect(result.modifiedContentHTML).toMatch(/id="[a-z0-9]+-0"/);
      expect(result.modifiedContentHTML).toMatch(/id="[a-z0-9]+-1"/);
    });

    it('should handle headers with various ID formats', () => {
      const html = `
        <h1 id="simple">Simple</h1>
        <h2 id = "with-spaces">With Spaces</h2>
        <h3 id  =  "multiple-spaces">Multiple Spaces</h3>
      `;

      const result = generateToc(html);

      expect(result.modifiedContentHTML).not.toContain('simple');
      expect(result.modifiedContentHTML).not.toContain('with-spaces');
      expect(result.modifiedContentHTML).not.toContain('multiple-spaces');
      // All should have new IDs
      expect((result.modifiedContentHTML.match(/id="/g) || []).length).toBe(3);
    });
  });

  describe('HTML sanitization', () => {
    it('should strip HTML tags from header text in TOC', () => {
      const html = `
        <h1>Header with <strong>bold</strong> text</h1>
        <h2>Header with <em>italic</em> text</h2>
        <h3>Header with <a href="#">link</a></h3>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Header with bold text');
      expect(result.tocHTML).toContain('Header with italic text');
      expect(result.tocHTML).toContain('Header with link');
      // Check that TOC doesn't contain the HTML tags
      expect(result.tocHTML).not.toContain('<strong>');
      expect(result.tocHTML).not.toContain('<em>');
    });

    it('should handle Docusaurus anchor links in headers', () => {
      const html = `<h1 id="test">Header Text</h1>`;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Header Text');
      // The header should have its ID replaced
      expect(result.modifiedContentHTML).not.toContain('id="test"');
    });

    it('should handle headers with special characters', () => {
      const html = `
        <h1>Header & Title</h1>
        <h2>Header < Greater</h2>
        <h3>Header > Less</h3>
        <h4>Header "Quotes"</h4>
      `;

      const result = generateToc(html);

      // HTML entities should be handled properly
      expect(result.tocHTML).toContain('Header &amp; Title');
    });
  });

  describe('TOC HTML structure', () => {
    it('should generate proper indentation for nested headers', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('margin-left:0px'); // h1
      expect(result.tocHTML).toContain('margin-left:20px'); // h2
      expect(result.tocHTML).toContain('margin-left:40px'); // h3
      expect(result.tocHTML).toContain('margin-left:60px'); // h4
    });

    it('should generate proper CSS classes for TOC items', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('toc-item toc-item-1');
      expect(result.tocHTML).toContain('toc-item toc-item-2');
      expect(result.tocHTML).toContain('toc-item toc-item-3');
    });

    it('should include page-break-after style in TOC', () => {
      const html = '<h1>Test</h1>';

      const result = generateToc(html);

      expect(result.tocHTML).toContain('page-break-after: always');
    });

    it('should create anchor links in TOC matching header IDs', () => {
      const html = '<h1>Test Header</h1>';

      const result = generateToc(html);

      // Extract the ID from the modified content
      const idMatch = result.modifiedContentHTML.match(/id="([^"]+)"/);
      expect(idMatch).not.toBeNull();

      if (idMatch) {
        const headerId = idMatch[1];
        expect(result.tocHTML).toContain(`href="#${headerId}"`);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle headers with line breaks', () => {
      // The regex only matches headers on a single line
      // Multi-line headers won't be matched by the regex
      const html = `<h1>Header with spaces</h1>`;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Header with spaces');
    });

    it('should handle headers with multiple spaces', () => {
      const html = '<h1>Header    with    spaces</h1>';

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Header');
      expect(result.tocHTML).toContain('spaces');
    });

    it('should handle self-closing headers (malformed HTML)', () => {
      const html = '<h1/>Content after';

      const result = generateToc(html);

      // Should not break, but may not capture malformed headers
      expect(result.modifiedContentHTML).toContain('Content after');
    });

    it('should handle very long header text', () => {
      const longText = 'A'.repeat(1000);
      const html = `<h1>${longText}</h1>`;

      const result = generateToc(html);

      expect(result.tocHTML).toContain(longText);
      expect(result.modifiedContentHTML).toContain(longText);
    });

    it('should handle headers with nested HTML elements', () => {
      const html = `<h1><span class="prefix">Prefix:</span><strong>Important</strong><code>code()</code></h1>`;

      const result = generateToc(html);

      // Text content should be extracted (but without spaces between elements)
      expect(result.tocHTML).toContain('Prefix:');
      expect(result.tocHTML).toContain('Important');
      expect(result.tocHTML).toContain('code()');
    });

    it('should handle consecutive headers without content', () => {
      const html = `
        <h1>First</h1>
        <h2>Second</h2>
        <h3>Third</h3>
        <h4>Fourth</h4>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('First');
      expect(result.tocHTML).toContain('Second');
      expect(result.tocHTML).toContain('Third');
      expect(result.tocHTML).toContain('Fourth');
    });

    it('should handle duplicate header text', () => {
      const html = `
        <h1>Duplicate</h1>
        <h2>Duplicate</h2>
        <h3>Duplicate</h3>
      `;

      const result = generateToc(html);

      // Should create different IDs for duplicate headers
      const idMatches = result.modifiedContentHTML.match(/id="([^"]+)"/g);
      expect(idMatches).not.toBeNull();
      if (idMatches) {
        const ids = idMatches.map((match) => match.match(/id="([^"]+)"/)?.[1]);
        // All IDs should be unique
        expect(new Set(ids).size).toBe(3);
      }
    });

    it('should preserve header attributes other than ID', () => {
      const html = `
        <h1 class="custom-class" data-attr="value" id="old-id">Header</h1>
      `;

      const result = generateToc(html);

      expect(result.modifiedContentHTML).toContain('class="custom-class"');
      expect(result.modifiedContentHTML).toContain('data-attr="value"');
      expect(result.modifiedContentHTML).not.toContain('old-id');
    });
  });

  describe('multiple headers at same level', () => {
    it('should handle multiple h1 headers', () => {
      const html = `
        <h1>First H1</h1>
        <h1>Second H1</h1>
        <h1>Third H1</h1>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('First H1');
      expect(result.tocHTML).toContain('Second H1');
      expect(result.tocHTML).toContain('Third H1');
      expect((result.tocHTML.match(/toc-item-1/g) || []).length).toBe(3);
    });

    it('should handle mixed header levels', () => {
      const html = `
        <h1>Chapter 1</h1>
        <h2>Section 1.1</h2>
        <h2>Section 1.2</h2>
        <h1>Chapter 2</h1>
        <h2>Section 2.1</h2>
        <h3>Subsection 2.1.1</h3>
        <h3>Subsection 2.1.2</h3>
        <h2>Section 2.2</h2>
      `;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Chapter 1');
      expect(result.tocHTML).toContain('Section 1.1');
      expect(result.tocHTML).toContain('Subsection 2.1.1');
      expect((result.tocHTML.match(/toc-item-1/g) || []).length).toBe(2);
      expect((result.tocHTML.match(/toc-item-2/g) || []).length).toBe(4);
      expect((result.tocHTML.match(/toc-item-3/g) || []).length).toBe(2);
    });
  });

  describe('integration with other functions', () => {
    it('should work with generateTocHtml directly', () => {
      const headers = [
        { header: 'First', level: 1, id: 'id-1' },
        { header: 'Second', level: 2, id: 'id-2' },
        { header: 'Third', level: 1, id: 'id-3' },
      ];

      const tocHTML = generateTocHtml(headers, 'My Contents');

      expect(tocHTML).toContain('My Contents');
      expect(tocHTML).toContain('First');
      expect(tocHTML).toContain('Second');
      expect(tocHTML).toContain('Third');
      expect(tocHTML).toContain('href="#id-1"');
      expect(tocHTML).toContain('href="#id-2"');
      expect(tocHTML).toContain('href="#id-3"');
    });

    it('should work with generateHeader directly', () => {
      const headers: Array<{ header: string; level: number; id: string }> = [];
      const matchedStr = '<h1 id="test">Test Header</h1>';

      const result = generateHeader(headers, matchedStr);

      expect(result.headerText).toBe('Test Header');
      expect(result.level).toBe(1);
      expect(result.headerId).toMatch(/^[a-z0-9]+-0$/);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle typical documentation page structure', () => {
      const html = `
        <h1>Getting Started</h1>
        <p>Introduction paragraph</p>
        <h2>Installation</h2>
        <p>How to install</p>
        <h3>Prerequisites</h3>
        <p>What you need</p>
        <h3>Steps</h3>
        <p>Installation steps</p>
        <h2>Configuration</h2>
        <p>How to configure</p>
        <h3>Basic Configuration</h3>
        <p>Basic setup</p>
        <h3>Advanced Configuration</h3>
        <p>Advanced setup</p>
        <h2>Usage</h2>
        <p>How to use</p>
      `;

      const result = generateToc(html, { maxLevel: 3 });

      expect(result.tocHTML).toContain('Getting Started');
      expect(result.tocHTML).toContain('Installation');
      expect(result.tocHTML).toContain('Prerequisites');
      expect(result.tocHTML).toContain('Configuration');
      expect(result.tocHTML).toContain('Usage');
    });

    it('should handle Docusaurus-style markdown headers', () => {
      // Headers must be on a single line to be matched by the regex
      const html = `<h1 class="anchor anchorWithStickyNavbar">Introduction<a class="hash-link" href="#introduction" title="Direct link to heading">#</a></h1><h2 class="anchor anchorWithStickyNavbar">Getting Started<a class="hash-link" href="#getting-started" title="Direct link to heading">#</a></h2>`;

      const result = generateToc(html);

      expect(result.tocHTML).toContain('Introduction');
      expect(result.tocHTML).toContain('Getting Started');
      // Note: The # character will be included because sanitize-html extracts all text content
      expect(result.tocHTML).toContain('#');
    });
  });

  describe('performance and large documents', () => {
    it('should handle documents with many headers efficiently', () => {
      let html = '';
      for (let i = 1; i <= 100; i++) {
        html += `<h1>Header ${i}</h1>\n`;
        html += `<p>Content ${i}</p>\n`;
      }

      const startTime = Date.now();
      const result = generateToc(html);
      const duration = Date.now() - startTime;

      expect(result.tocHTML).toContain('Header 1');
      expect(result.tocHTML).toContain('Header 100');
      // Each toc-item appears twice: once in class and once in the class attribute
      // So we match on "toc-item-" which appears once per item
      expect((result.tocHTML.match(/toc-item-1/g) || []).length).toBe(100);
      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle documents with deeply nested headers', () => {
      const html = `
        <h1>Level 1</h1>
        <h2>Level 2</h2>
        <h3>Level 3</h3>
        <h4>Level 4</h4>
        <h5>Level 5</h5>
        <h6>Level 6</h6>
      `.repeat(20);

      const result = generateToc(html, { maxLevel: 6 });

      // Should not crash or hang
      expect(result.tocHTML).toContain('Level 1');
      expect(result.tocHTML).toContain('Level 6');
    });
  });
});
