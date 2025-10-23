import { describe, expect, test } from '@jest/globals';
import puppeteer from 'puppeteer-core';
import { PDF, PDFOptions } from '../src/pdf/generate';
import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument, PDFName } from 'pdf-lib';

describe('PDF class', () => {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  const testOutputDir = path.join(__dirname, 'test-output');
  const testPdfPath = path.join(testOutputDir, 'test-output.pdf');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    });

    // Create test output directory
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterAll(async () => {
    await browser.close();

    // Clean up test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();

    // Clean up test PDF if it exists
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
  });

  test('should generate PDF with default options', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test">Test Heading</h1>
          <p>Test content</p>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'A4',
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    // Check that PDF was created
    expect(fs.existsSync(testPdfPath)).toBeTruthy();

    // Verify PDF is valid
    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Check that PDF has at least one page
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);

    // Check that PDF has outline (bookmarks)
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeDefined();
  });

  test('should generate PDF with custom paper format', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test">Test</h1>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'Letter',
      pdfMargin: { top: 10, right: 10, bottom: 10, left: 10 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    expect(fs.existsSync(testPdfPath)).toBeTruthy();

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);
  });

  test('should generate PDF with header and footer', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test">Test</h1>
          <p>Content</p>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'A4',
      pdfMargin: { top: 50, right: 32, bottom: 50, left: 32 },
      headerTemplate:
        '<div style="font-size:10px; width:100%; text-align:center;">Header</div>',
      footerTemplate:
        '<div style="font-size:10px; width:100%; text-align:center;"><span class="pageNumber"></span></div>',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    expect(fs.existsSync(testPdfPath)).toBeTruthy();
  });

  test('should generate PDF with outline from multiple heading levels', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="chapter1">Chapter 1</h1>
          <h2 id="section1-1">Section 1.1</h2>
          <h3 id="subsection1-1-1">Subsection 1.1.1</h3>
          <h2 id="section1-2">Section 1.2</h2>
          <h1 id="chapter2">Chapter 2</h1>
          <h2 id="section2-1">Section 2.1</h2>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'A4',
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    expect(fs.existsSync(testPdfPath)).toBeTruthy();

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Verify outline was created
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeDefined();
  });

  test('should handle pages without headings', async () => {
    await page.setContent(`
      <html>
        <body>
          <p>This page has no headings</p>
          <p>Just regular paragraphs</p>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'A4',
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    expect(fs.existsSync(testPdfPath)).toBeTruthy();

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);

    // No outline should be created if there are no headings
    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeUndefined();
  });

  test('should handle special characters in headings', async () => {
    await page.setContent(`
      <html>
        <body>
          <h1 id="test1">Chapter with "quotes" & ampersands</h1>
          <h2 id="test2">Section with <em>HTML</em> tags</h2>
          <h3 id="test3">Subsection with émojis 🚀</h3>
        </body>
      </html>
    `);

    const options: PDFOptions = {
      outputPDFFilename: testPdfPath,
      paperFormat: 'A4',
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);
    await pdf.generate(page);

    expect(fs.existsSync(testPdfPath)).toBeTruthy();

    const pdfBuffer = fs.readFileSync(testPdfPath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    expect(pdfDoc.getPageCount()).toBeGreaterThan(0);

    const catalog = pdfDoc.catalog;
    const outlinesDict = catalog.get(PDFName.of('Outlines'));
    expect(outlinesDict).toBeDefined();
  });

  test('should throw error on PDF generation failure', async () => {
    // Create a page with content that might cause issues
    await page.setContent('<html><body><h1>Test</h1></body></html>');

    // Use invalid output path to trigger error
    const options: PDFOptions = {
      outputPDFFilename: '/invalid/path/that/does/not/exist/test.pdf',
      paperFormat: 'A4',
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      headerTemplate: '',
      footerTemplate: '',
    };

    const pdf = new PDF(options);

    await expect(pdf.generate(page)).rejects.toThrow();
  });
});
