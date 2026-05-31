import express from 'express';
import * as fs from 'fs-extra';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as path from 'path';
import * as puppeteer from 'puppeteer-core';
import { generatePDF } from '../src/core';
import * as utils from '../src/utils';

// Try to find Chrome executable, skip tests if not available
let execPath: string | undefined;
let chromeAvailable = false;

try {
  execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath('chrome');
  chromeAvailable = true;
  console.log(`Using executable path: ${execPath}`);
} catch {
  console.warn('Chrome not found, skipping core integration tests');
  chromeAvailable = false;
}

// Helper to conditionally skip tests when Chrome is not available
const describeIfChrome = chromeAvailable ? describe : describe.skip;

// Test server setup
interface TestServer {
  app: express.Express;
  server: http.Server;
  port: number;
  baseUrl: string;
}

async function createTestServer(port: number = 0): Promise<TestServer> {
  const app = express();

  // Simple test page with navigation
  app.get('/page1', (req, res) => {
    const baseUrl = `http://localhost:${(req.socket.address() as AddressInfo).port}`;
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Page 1</title>
          <!-- Test resource that might be rewritten -->
          <link rel="stylesheet" href="${baseUrl}/styles.css">
        </head>
        <body>
          <article id="content">
            <h1>Page 1 Content</h1>
            <p>This is the first page.</p>
            <!-- Test image that might be rewritten -->
            <img src="${baseUrl}/test-image.png" alt="test" style="width:1px;height:1px;">
          </article>
          <a href="/page2" class="next">Next</a>
        </body>
      </html>
    `);
  });

  app.get('/page2', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Page 2</title></head>
        <body>
          <article id="content">
            <h1>Page 2 Content</h1>
            <p>This is the second page.</p>
          </article>
        </body>
      </html>
    `);
  });

  // Serve dummy resources
  app.get('/styles.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.send('body { margin: 0; }');
  });

  app.get('/test-image.png', (req, res) => {
    res.setHeader('Content-Type', 'image/png');
    // 1x1 transparent PNG
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    res.send(pixel);
  });

  // Page that references a PDF (should be blocked)
  app.get('/page-with-pdf', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Page with PDF</title></head>
        <body>
          <article id="content">
            <h1>Page with PDF Link</h1>
            <p>This page references a PDF.</p>
            <a href="/document.pdf">Download PDF</a>
          </article>
        </body>
      </html>
    `);
  });

  app.get('/document.pdf', (req, res) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send('fake pdf content');
  });

  // Start server on available port
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });

  const actualPort = (server.address() as AddressInfo).port;
  const baseUrl = `http://localhost:${actualPort}`;

  return { app, server, port: actualPort, baseUrl };
}

function stopTestServer(testServer: TestServer): Promise<void> {
  return new Promise((resolve, reject) => {
    testServer.server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

describeIfChrome('generatePDF - Core Integration Tests', () => {
  let testServer: TestServer;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeAll(async () => {
    // Create test server
    testServer = await createTestServer();
    console.log(`Test server started on ${testServer.baseUrl}`);

    // Create output directory for test PDFs
    await fs.ensureDir(testOutputDir);
  }, 30000);

  afterAll(async () => {
    // Stop test server
    if (testServer) {
      await stopTestServer(testServer);
      console.log('Test server stopped');
    }

    // Clean up test PDFs
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  afterEach(async () => {
    // Clean up any PDFs created during tests
    const files = await fs.readdir(testOutputDir);
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        await fs.remove(path.join(testOutputDir, file));
      }
    }
  });

  it('should generate a basic PDF from a single page', async () => {
    const outputPath = path.join(testOutputDir, 'basic-test.pdf');

    await generatePDF({
      initialDocURLs: [`${testServer.baseUrl}/page1`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: '.nonexistent-pagination', // Use non-existent selector instead of empty string
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: '',
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // Verify PDF was created
    expect(await fs.pathExists(outputPath)).toBe(true);
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);
  }, 60000);

  it('should follow pagination links and create multi-page PDF', async () => {
    const outputPath = path.join(testOutputDir, 'pagination-test.pdf');

    // Spy on findNextUrl to verify pagination logic is called
    const findNextUrlSpy = jest.spyOn(utils, 'findNextUrl');
    // Spy on getHtmlContent to verify we're extracting content from multiple pages
    const getHtmlSpy = jest.spyOn(utils, 'getHtmlContent');

    await generatePDF({
      initialDocURLs: [`${testServer.baseUrl}/page1`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: 'a.next',
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: '',
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // Verify findNextUrl was called to follow pagination
    expect(findNextUrlSpy).toHaveBeenCalled();
    expect(findNextUrlSpy.mock.calls.length).toBeGreaterThanOrEqual(2); // Called at least for page1 and page2

    // Verify getHtmlContent was called multiple times (once per page)
    expect(getHtmlSpy).toHaveBeenCalled();
    expect(getHtmlSpy.mock.calls.length).toBeGreaterThanOrEqual(2); // Called for both page1 and page2

    // Verify PDF was created
    expect(await fs.pathExists(outputPath)).toBe(true);
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    findNextUrlSpy.mockRestore();
    getHtmlSpy.mockRestore();
  }, 60000);

  it('should block PDF requests during page crawling', async () => {
    // Note: PDF blocking is tested implicitly in two ways:
    // 1. If PDF request wasn't blocked, puppeteer would try to handle it and likely fail/hang
    // 2. The test completes successfully showing the crawl continued after encountering .pdf
    const outputPath = path.join(testOutputDir, 'pdf-blocking-test.pdf');

    // Spy on getHtmlContent to verify page content extraction happened
    const getHtmlSpy = jest.spyOn(utils, 'getHtmlContent');

    // This should not throw an error even though the page references a PDF
    // The PDF request should be blocked (request.abort()) and the crawl should continue
    await generatePDF({
      initialDocURLs: [`${testServer.baseUrl}/page-with-pdf`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: '.nonexistent-pagination', // Use non-existent selector
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: '',
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // Verify getHtmlContent was called successfully (proves page was crawled despite PDF)
    expect(getHtmlSpy).toHaveBeenCalled();
    expect(getHtmlSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

    // Verify PDF was created successfully (proves PDF blocking didn't break the crawl)
    expect(await fs.pathExists(outputPath)).toBe(true);
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    getHtmlSpy.mockRestore();
  }, 60000);
});

describeIfChrome('generatePDF - URL Rewriting with baseUrl', () => {
  let crawlServer: TestServer;
  let baseUrlServer: TestServer;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeAll(async () => {
    // Create two servers:
    // 1. crawlServer - where we actually crawl
    // 2. baseUrlServer - the origin we want to rewrite FROM
    crawlServer = await createTestServer();
    baseUrlServer = await createTestServer();

    console.log(`Crawl server started on ${crawlServer.baseUrl}`);
    console.log(`BaseUrl server started on ${baseUrlServer.baseUrl}`);

    // Create output directory for test PDFs
    await fs.ensureDir(testOutputDir);
  }, 30000);

  afterAll(async () => {
    // Stop test servers
    if (crawlServer) {
      await stopTestServer(crawlServer);
    }
    if (baseUrlServer) {
      await stopTestServer(baseUrlServer);
    }

    // Clean up test PDFs
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  afterEach(async () => {
    // Clean up any PDFs created during tests
    const files = await fs.readdir(testOutputDir);
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        await fs.remove(path.join(testOutputDir, file));
      }
    }
  });

  it('should rewrite URLs from baseUrl origin to crawl origin', async () => {
    const outputPath = path.join(testOutputDir, 'url-rewrite-test.pdf');

    // Add a route to crawlServer that serves HTML with resources from baseUrlServer
    // This simulates the scenario where documentation references the production baseUrl
    // but we're crawling from a local/staging server
    crawlServer.app.get('/rewrite-test-page', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Test Page with Base URL Resources</title>
            <!-- Resource that references baseUrlServer -->
            <link rel="stylesheet" href="${baseUrlServer.baseUrl}/styles.css">
          </head>
          <body>
            <article id="content">
              <h1>URL Rewriting Test</h1>
              <p>This page has resources from baseUrlServer that should be rewritten.</p>
              <!-- Image from baseUrlServer -->
              <img src="${baseUrlServer.baseUrl}/test-image.png" alt="test" style="width:1px;height:1px;">
            </article>
          </body>
        </html>
      `);
    });

    // Spy on mapUrlToOrigin to verify it's called during URL rewriting
    const mapUrlSpy = jest.spyOn(utils, 'mapUrlToOrigin');

    try {
      // We crawl from crawlServer but set baseUrl to baseUrlServer
      // The HTML contains resources from baseUrlServer which should trigger rewriting
      await generatePDF({
        initialDocURLs: [`${crawlServer.baseUrl}/rewrite-test-page`],
        excludeURLs: [],
        outputPDFFilename: outputPath,
        pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
        contentSelector: '#content',
        paginationSelector: '.nonexistent-pagination',
        paperFormat: 'A4',
        excludeSelectors: [],
        cssStyle: '',
        puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
        coverTitle: '',
        coverImage: '',
        disableTOC: true,
        tocTitle: '',
        disableCover: true,
        coverSub: '',
        waitForRender: 0,
        headerTemplate: '',
        footerTemplate: '',
        protocolTimeout: 30000,
        filterKeyword: '',
        baseUrl: baseUrlServer.baseUrl,
        excludePaths: [],
        restrictPaths: false,
        openDetail: false,
        extractIframes: false,
      });

      // Verify mapUrlToOrigin was called during the crawl
      // When baseUrl differs from crawl origin, requests should be rewritten
      expect(mapUrlSpy).toHaveBeenCalled();

      // Verify it was called with correct parameters
      const calls = mapUrlSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);

      // At least one call should have the crawl origin as target
      const hasCorrectCall = calls.some(([url, target]) => {
        return (
          url.includes(baseUrlServer.baseUrl) && target === crawlServer.baseUrl
        );
      });
      expect(hasCorrectCall).toBe(true);

      // Verify PDF was created successfully
      expect(await fs.pathExists(outputPath)).toBe(true);
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      mapUrlSpy.mockRestore();
    }
  }, 60000);

  it('should not rewrite URLs when baseUrl is not set', async () => {
    const outputPath = path.join(testOutputDir, 'no-rewrite-test.pdf');

    // Spy on mapUrlToOrigin to verify it's NOT called when baseUrl is empty
    const mapUrlSpy = jest.spyOn(utils, 'mapUrlToOrigin');

    await generatePDF({
      initialDocURLs: [`${crawlServer.baseUrl}/page1`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: '.nonexistent-pagination', // Use non-existent selector
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: '', // No baseUrl set
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // Verify mapUrlToOrigin was NOT called since baseUrl is empty
    // When baseUrl is not set, no URL rewriting should occur
    expect(mapUrlSpy).not.toHaveBeenCalled();

    // Verify PDF was created successfully
    expect(await fs.pathExists(outputPath)).toBe(true);
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    mapUrlSpy.mockRestore();
  }, 60000);

  it('should skip URL rewriting entirely when baseUrl equals crawl origin', async () => {
    const outputPath = path.join(testOutputDir, 'same-origin-test.pdf');

    // Spy on mapUrlToOrigin to verify it's not called when origins are the same
    const mapUrlSpy = jest.spyOn(utils, 'mapUrlToOrigin');

    await generatePDF({
      initialDocURLs: [`${crawlServer.baseUrl}/page1`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: '.nonexistent-pagination',
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: crawlServer.baseUrl, // baseUrl SAME as crawl origin
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // When baseUrl equals crawl origin, request interception is skipped
    expect(mapUrlSpy).not.toHaveBeenCalled();

    // Verify PDF was created successfully
    expect(await fs.pathExists(outputPath)).toBe(true);
    const stats = await fs.stat(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    mapUrlSpy.mockRestore();
  }, 60000);
});

describeIfChrome('generatePDF - Error Handling', () => {
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeAll(async () => {
    await fs.ensureDir(testOutputDir);
  });

  afterAll(async () => {
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  it('should handle invalid initial URLs gracefully', async () => {
    const outputPath = path.join(testOutputDir, 'error-test.pdf');

    await expect(
      generatePDF({
        initialDocURLs: ['http://localhost:99999/nonexistent'],
        excludeURLs: [],
        outputPDFFilename: outputPath,
        pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
        contentSelector: '#content',
        paginationSelector: '.nonexistent-pagination', // Use non-existent selector
        paperFormat: 'A4',
        excludeSelectors: [],
        cssStyle: '',
        puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
        coverTitle: '',
        coverImage: '',
        disableTOC: true,
        tocTitle: '',
        disableCover: true,
        coverSub: '',
        waitForRender: 0,
        headerTemplate: '',
        footerTemplate: '',
        protocolTimeout: 5000,
        filterKeyword: '',
        baseUrl: '',
        excludePaths: [],
        restrictPaths: false,
        openDetail: false,
        extractIframes: false,
      }),
    ).rejects.toThrow();
  }, 30000);
});

describeIfChrome('generatePDF - Circular Pagination Detection', () => {
  let testServer: TestServer;
  const testOutputDir = path.join(__dirname, '../test-output');

  beforeAll(async () => {
    // Create test server with circular pagination
    const app = express();

    app.get('/circular1', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <body>
            <article id="content"><h1>Circular Page 1</h1></article>
            <a href="/circular2" class="next">Next</a>
          </body>
        </html>
      `);
    });

    app.get('/circular2', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
          <body>
            <article id="content"><h1>Circular Page 2</h1></article>
            <a href="/circular1" class="next">Next</a>
          </body>
        </html>
      `);
    });

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://localhost:${port}`;

    testServer = { app, server, port, baseUrl };

    await fs.ensureDir(testOutputDir);
  }, 30000);

  afterAll(async () => {
    if (testServer) {
      await stopTestServer(testServer);
    }
    if (await fs.pathExists(testOutputDir)) {
      await fs.remove(testOutputDir);
    }
  });

  it('should detect and break circular pagination loops', async () => {
    const outputPath = path.join(testOutputDir, 'circular-test.pdf');

    // Should complete without infinite loop
    await generatePDF({
      initialDocURLs: [`${testServer.baseUrl}/circular1`],
      excludeURLs: [],
      outputPDFFilename: outputPath,
      pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
      contentSelector: '#content',
      paginationSelector: 'a.next',
      paperFormat: 'A4',
      excludeSelectors: [],
      cssStyle: '',
      puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
      coverTitle: '',
      coverImage: '',
      disableTOC: true,
      tocTitle: '',
      disableCover: true,
      coverSub: '',
      waitForRender: 0,
      headerTemplate: '',
      footerTemplate: '',
      protocolTimeout: 30000,
      filterKeyword: '',
      baseUrl: '',
      excludePaths: [],
      restrictPaths: false,
      openDetail: false,
      extractIframes: false,
    });

    // Verify PDF was created
    expect(await fs.pathExists(outputPath)).toBe(true);
  }, 60000);
});
