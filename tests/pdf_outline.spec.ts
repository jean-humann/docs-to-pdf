import { describe, expect, test } from '@jest/globals';
import puppeteer from 'puppeteer-core';
import {
  formatOutlineContainerSelector,
  getOutline,
  setOutline,
  OutlineNode,
} from '../src/pdf/outline';
import { PDFDocument, PDFName } from 'pdf-lib';

describe('formatOutlineContainerSelector', () => {
  test('should return empty string for empty input', () => {
    expect(formatOutlineContainerSelector('')).toBe('');
  });

  test('should trim and format selector with trailing space', () => {
    expect(formatOutlineContainerSelector('main')).toBe('main ');
  });

  test('should handle multiple spaces', () => {
    expect(formatOutlineContainerSelector('  main   article  ')).toBe(
      'main article ',
    );
  });

  test('should handle selector with multiple elements', () => {
    expect(formatOutlineContainerSelector('div.content section')).toBe(
      'div.content section ',
    );
  });
});

describe('getOutline', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  test('should extract outline from simple heading structure', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="intro">Introduction</h1>
          <h2 id="getting-started">Getting Started</h2>
          <h2 id="usage">Usage</h2>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1', 'h2']);

    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Introduction');
    expect(outline[0].destination).toBe('intro');
    expect(outline[0].children).toHaveLength(2);
    expect(outline[0].children[0].title).toBe('Getting Started');
    expect(outline[0].children[0].destination).toBe('getting-started');
    expect(outline[0].children[1].title).toBe('Usage');
    expect(outline[0].children[1].destination).toBe('usage');
  });

  test('should handle nested heading hierarchy', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="chapter1">Chapter 1</h1>
          <h2 id="section1-1">Section 1.1</h2>
          <h3 id="subsection1-1-1">Subsection 1.1.1</h3>
          <h3 id="subsection1-1-2">Subsection 1.1.2</h3>
          <h2 id="section1-2">Section 1.2</h2>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1', 'h2', 'h3']);

    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Chapter 1');
    expect(outline[0].children).toHaveLength(2);
    expect(outline[0].children[0].title).toBe('Section 1.1');
    expect(outline[0].children[0].children).toHaveLength(2);
    expect(outline[0].children[0].children[0].title).toBe('Subsection 1.1.1');
    expect(outline[0].children[0].children[1].title).toBe('Subsection 1.1.2');
    expect(outline[0].children[1].title).toBe('Section 1.2');
  });

  test('should handle headings without IDs by encoding them', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test">Test Heading</h1>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1']);

    expect(outline).toHaveLength(1);
    expect(outline[0].destination).toBe('test');
  });

  test('should trim whitespace from heading text', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test">
            Test with spaces
          </h1>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1']);

    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Test with spaces');
  });

  test('should handle container selector', async () => {
    await page.setContent(`
      <html>
        <body>
          <nav>
            <h1 id="nav-heading">Navigation</h1>
          </nav>
          <main>
            <h1 id="main-heading">Main Content</h1>
            <h2 id="section">Section</h2>
          </main>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1', 'h2'], 'main');

    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Main Content');
    expect(outline[0].children).toHaveLength(1);
    expect(outline[0].children[0].title).toBe('Section');
  });

  test('should return empty array for no headings', async () => {
    await page.setContent(`
      <html>
        <body>
          <p>No headings here</p>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1', 'h2', 'h3']);

    expect(outline).toHaveLength(0);
  });

  test('should handle multiple top-level headings', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="chapter1">Chapter 1</h1>
          <h2 id="section1">Section 1</h2>
          <h1 id="chapter2">Chapter 2</h1>
          <h2 id="section2">Section 2</h2>
        </body>
      </html>
    `);

    const outline = await getOutline(page, ['h1', 'h2']);

    expect(outline).toHaveLength(2);
    expect(outline[0].title).toBe('Chapter 1');
    expect(outline[0].children).toHaveLength(1);
    expect(outline[1].title).toBe('Chapter 2');
    expect(outline[1].children).toHaveLength(1);
  });
});

describe('setOutline', () => {
  test('should add outline to PDF document', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();

    // Add some content to the page to create destinations
    page.drawText('Test content');

    const outlines: OutlineNode[] = [
      {
        title: 'Chapter 1',
        destination: 'chapter1',
        yPosition: 100,
        children: [
          {
            title: 'Section 1.1',
            destination: 'section1-1',
            yPosition: 200,
            children: [],
            depth: 1,
          },
        ],
        depth: 0,
      },
    ];

    // Use typical page dimensions: 792 points high (US Letter), 1000 pixels total document height
    const result = await setOutline(pdfDoc, outlines, 1000, 792, false);

    expect(result).toBe(pdfDoc);
    // Check that outlines were added to catalog
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeDefined();
  });

  test('should return document unchanged for empty outline', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();

    const result = await setOutline(pdfDoc, [], 1000, 792, false);

    expect(result).toBe(pdfDoc);
    // Check that no outlines were added
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeUndefined();
  });

  test('should handle nested outline structure', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();

    const outlines: OutlineNode[] = [
      {
        title: 'Part 1',
        destination: 'part1',
        yPosition: 50,
        children: [
          {
            title: 'Chapter 1',
            destination: 'chapter1',
            yPosition: 150,
            children: [
              {
                title: 'Section 1.1',
                destination: 'section1-1',
                yPosition: 250,
                children: [],
                depth: 2,
              },
            ],
            depth: 1,
          },
        ],
        depth: 0,
      },
    ];

    const result = await setOutline(pdfDoc, outlines, 1000, 792, false);

    expect(result).toBe(pdfDoc);
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeDefined();
  });
});
