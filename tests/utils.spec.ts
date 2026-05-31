import * as puppeteer from 'puppeteer-core';
import {
  extractIframeContent,
  findNextUrl,
  generateCoverHtml,
  generateImageHtml,
  generateTocHtml,
  getCoverImage,
  getHtmlContent,
  isPageKept,
  mapUrlToOrigin,
  matchKeyword,
  openDetails,
  removeExcludeSelector,
  replaceHeader,
} from '../src/utils';

// Try to find Chrome executable, skip tests if not available
let execPath: string | undefined;
let chromeAvailable = false;

try {
  execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath('chrome');
  chromeAvailable = true;
  console.log(`Using executable path: ${execPath}`);
} catch {
  console.warn('Chrome not found, skipping puppeteer tests');
  chromeAvailable = false;
}

// Helper to conditionally skip tests when Chrome is not available
const describeIfChrome = chromeAvailable ? describe : describe.skip;

describeIfChrome('getHtmlContent', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should return the HTML content of the specified selector', async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content">Hello, world!</div>
        </body>
      </html>
    `);

    const html = await getHtmlContent(page, '#content');
    expect(html).toBe(
      '<div id="content" style="break-after: page;">Hello, world!</div>',
    );
  });
});

describeIfChrome('findNextUrl', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should return the href of the specified selector', async () => {
    await page.setContent(`
      <html>
        <body>
          <a href="https://example.com/next">Next Page</a>
        </body>
      </html>
    `);

    const href = await findNextUrl(page, 'a');
    expect(href).toBe('https://example.com/next');
  });
});

describeIfChrome('removeExcludeSelector', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should remove elements matching the exclude selector', async () => {
    await page.setContent(`
      <html>
        <body>
          <div class="remove">Remove me</div>
          <div class="keep">Keep me</div>
        </body>
      </html>
    `);

    await removeExcludeSelector(page, ['.remove']);
    const removedElement = await page.evaluate(() =>
      document.querySelector('.remove'),
    );
    const keptElement = await page.evaluate(() =>
      document.querySelector('.keep'),
    );

    expect(removedElement).toBeNull();
    expect(keptElement).not.toBeNull();
  });
});

describeIfChrome('getCoverImage', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should retrieve the image content', async () => {
    // Mock the network response with a sample image
    await page.setRequestInterception(true);
    page.on('request', (interceptedRequest) => {
      if (interceptedRequest.url() === 'https://example.com/cover-image.jpg') {
        interceptedRequest.respond({
          status: 200,
          contentType: 'image/jpeg',
          body: Buffer.from('SAMPLE_IMAGE_CONTENT', 'base64'),
        });
      } else {
        interceptedRequest.continue();
      }
    });

    // Call the getCoverImage function with the mocked URL
    const result = await getCoverImage(
      page,
      'https://example.com/cover-image.jpg',
    );

    // Assert the result
    expect(result.base64).toBe('SAMPLE/IMAGE/CONTENT');
    expect(result.type).toBe('image/jpeg');
  });
});

describe('generateCoverHtml', () => {
  it('should generate the HTML code for the cover page', () => {
    const coverTitle = 'My Book';
    const coverImageHtml = '<img src="cover.jpg" alt="Cover Image">';
    const coverSub = 'A Fantastic Read';

    const expectedOutput = `
  <div
    class="pdf-cover"
    style="
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      page-break-after: always;
      text-align: center;
    "
  >
    <h1>My Book</h1>
    <h3>A Fantastic Read</h3>
    <img src="cover.jpg" alt="Cover Image">
  </div>`;

    const output = generateCoverHtml(coverTitle, coverImageHtml, coverSub);
    expect(output).toBe(expectedOutput);
  });
});

describe('generateImageHtml', () => {
  it('should generate the HTML code for the image with preserved aspect ratio', () => {
    const imgBase64 = 'base64-encoded-image-content';
    const contentType = 'image/jpeg';

    const expectedOutput = `<img
    class="cover-img"
    src="data:image/jpeg;base64, base64-encoded-image-content"
    alt=""
    style="max-width: 300px; height: auto;"
    />`;

    const output = generateImageHtml(imgBase64, contentType);
    expect(output).toBe(expectedOutput);
  });
});

describe('generateTocHtml', () => {
  it('should generate the HTML code for the table of contents', () => {
    const headers = [
      { level: 1, id: 'header1', header: 'Header 1' },
      { level: 2, id: 'header2', header: 'Header 2' },
      { level: 3, id: 'header3', header: 'Header 3' },
    ];
    const expectedOutput = `
  <div class="toc-page" style="page-break-after: always;">
    <h1 class="toc-header">Table of contents:</h1>
    <li class="toc-item toc-item-1" style="margin-left:0px"><a href="#header1">Header 1</a></li>
<li class="toc-item toc-item-2" style="margin-left:20px"><a href="#header2">Header 2</a></li>
<li class="toc-item toc-item-3" style="margin-left:40px"><a href="#header3">Header 3</a></li>
  </div>
  `;
    const output = generateTocHtml(headers);
    expect(output).toBe(expectedOutput);
  });
});

describe('replaceHeader', () => {
  it('should replace the header IDs in the matched string', () => {
    const matchedStr = '<h1 id="old-id">Header 1</h1>';
    const headerId = 'new-id';
    const maxLevel = 3;

    const expectedOutput = '<h1 id="new-id">Header 1</h1>';

    const output = replaceHeader(matchedStr, headerId, maxLevel);
    expect(output).toBe(expectedOutput);
  });

  it('should add a new header ID if the header does not have an ID attribute', () => {
    const matchedStr = '<h2>Header 2</h2>';
    const headerId = 'new-id';
    const maxLevel = 3;

    const expectedOutput = '<h2 id="new-id">Header 2</h2>';

    const output = replaceHeader(matchedStr, headerId, maxLevel);
    expect(output).toBe(expectedOutput);
  });
});

describeIfChrome('matchKeyword', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <meta name="keywords" content="hallo,match" />
        </head>
        <body>
          <div id="content">Hello, world!</div>
        </body>
      </html>
    `);
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should be true with a existing filterKeyword', async () => {
    expect(await matchKeyword(page, 'match')).toBe(true);
  });

  it('should be false with a nonexisting filterKeyword', async () => {
    expect(await matchKeyword(page, 'no-match')).toBe(false);
  });
  it('should be false when no meta keywords are present', async () => {
    await page.setContent(`
      <html>
        <head>
        </head>
        <body>
          <div id="content">Hello, world!</div>
        </body>
      </html>
    `);
    expect(await matchKeyword(page, 'match')).toBe(false);
  });
});

describeIfChrome('isPageKept function', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
    await page.setContent(`
      <html>
        <head>
          <meta name="keywords" content="keep" />
        </head>
        <body>
          <div id="content">Hello, world!</div>
        </body>
      </html>
    `);
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });
  it('should exclude a page when the URL is in the excludeUrls list', async () => {
    console.debug('test: should exclude a page when any condition is matched');
    const result = await isPageKept(
      page,
      'https://example.com/exclude',
      '',
      ['https://example.com/exclude'],
      '',
      [],
      false,
    );
    expect(result).toBe(false);
  });

  it('should exclude a page if the filterKeyword is not matched', async () => {
    console.debug(
      'test: should exclude a page if the filterKeyword is not matched',
    );
    const result = await isPageKept(
      page,
      'https://example.com/keep',
      '',
      [],
      'no-match',
      [],
      false,
    );
    expect(result).toBe(false);
  });

  it('shoud exclude a page if the path of the URL is in the excludePaths list', async () => {
    console.debug(
      'test: should exclude a page if the path of the URL is in the excludePaths list',
    );
    const result = await isPageKept(
      page,
      'https://example.com/exclude',
      '',
      [''],
      '',
      ['/exclude'],
      false,
    );
    expect(result).toBe(false);
  });

  it('shoud exclude a page if restrictPath is true and the path of the URL dont match urlPath', async () => {
    console.debug(
      'test: shoud exclude a page if restrictPath is true and the path of the URL dont mach urlPath',
    );
    const result = await isPageKept(
      page,
      'https://example.com/exclude',
      '/keep',
      [],
      '',
      [],
      true,
    );
    expect(result).toBe(false);
  });

  it('should keep a page if the URL is not in the excludeUrls list', async () => {
    console.debug(
      'test: should keep a page if the URL is not in the excludeUrls list',
    );
    const result = await isPageKept(
      page,
      'https://example.com/keep',
      '',
      ['https://example.com/exclude'],
      '',
      [],
      false,
    );
    expect(result).toBe(true);
  });

  it('should keep a page if the filterKeyword is matched', async () => {
    console.debug('test: should keep a page if the filterKeyword is matched');
    const result = await isPageKept(
      page,
      'https://example.com/keep',
      '',
      [],
      'keep',
      [],
      false,
    );
    expect(result).toBe(true);
  });

  it('should keep a page if the path of the URL is not in the excludePaths list', async () => {
    console.debug(
      'test: should keep a page if the path of the URL is not in the excludePaths list',
    );
    const result = await isPageKept(
      page,
      'https://example.com/keep',
      '',
      [''],
      '',
      ['/exclude'],
      false,
    );
    expect(result).toBe(true);
  });

  it('should keep a page if restrictPath is true and the path of the URL match urlPath', async () => {
    console.debug(
      'test: should keep a page if restrictPath is true and the path of the URL match urlPath',
    );
    const result = await isPageKept(
      page,
      'https://example.com/keep',
      '/keep',
      [],
      '',
      [],
      true,
    );
    expect(result).toBe(true);
  });
});

describeIfChrome('openDetails function', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should open all details elements recursively', async () => {
    // Mock the click and wait functions
    const clickFunction = jest.fn(async () => {});
    const waitFunction = jest.fn(async () => {});

    // Mock a simple HTML page with nested <details> elements
    await page.setContent(`
      <details>
        <summary>Toggle me!</summary>
        <div>
          <div>This is the detailed content</div>
          <br/>
          <details>
            <summary>
              Nested toggle! Some surprise inside...
            </summary>
            <div>😲😲😲😲😲</div>
          </details>
        </div>
      </details>
    `);

    // Call the recursive function to open details elements
    await openDetails(page, clickFunction, waitFunction);

    // Assertions based on the mock functions
    expect(clickFunction).toHaveBeenCalledTimes(2);
    expect(waitFunction).toHaveBeenCalledTimes(2);
    expect(waitFunction).toHaveBeenCalledWith(800);
  });
});

describeIfChrome('extractIframeContent function', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should return unchanged HTML when no iframes are present', async () => {
    await page.setContent(`
      <html>
        <body>
          <div>No iframes here</div>
        </body>
      </html>
    `);

    const html = '<div>Test content</div>';
    const result = await extractIframeContent(page, html);
    expect(result).toBe(html);
  });

  it('should extract content from same-origin iframe', async () => {
    // Create a data URL iframe with content
    await page.setContent(`
      <html>
        <body>
          <div id="main">
            <p>Main content</p>
            <iframe id="test-iframe" srcdoc="<div>Iframe content here</div>"></iframe>
          </div>
        </body>
      </html>
    `);

    // Wait for iframe to load
    await page.waitForSelector('#test-iframe', { timeout: 5000 });
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const html = await page.evaluate(() => document.body.innerHTML);
    const result = await extractIframeContent(page, html);

    // Check that iframe content was extracted
    expect(result).toContain('Iframe content here');
    expect(result).toContain('class="iframe-content"');
    expect(result).toContain('Embedded content:');
  });

  it('should handle multiple iframes', async () => {
    await page.setContent(`
      <html>
        <body>
          <iframe srcdoc="<div>First iframe</div>"></iframe>
          <iframe srcdoc="<div>Second iframe</div>"></iframe>
        </body>
      </html>
    `);

    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const html = await page.evaluate(() => document.body.innerHTML);
    const result = await extractIframeContent(page, html);

    expect(result).toContain('First iframe');
    expect(result).toContain('Second iframe');
  });

  it('should preserve iframe title in extracted content', async () => {
    await page.setContent(`
      <html>
        <body>
          <iframe title="My Special Content" srcdoc="<div>Content</div>"></iframe>
        </body>
      </html>
    `);

    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const html = await page.evaluate(() => document.body.innerHTML);
    const result = await extractIframeContent(page, html);

    expect(result).toContain('My Special Content');
  });
});

describeIfChrome('getHtmlContent with iframe extraction', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: execPath!,
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    await browser.close();
  });

  it('should extract iframe content when extractIframes is true', async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content">
            <p>Main content</p>
            <iframe srcdoc="<div>Iframe content</div>"></iframe>
          </div>
        </body>
      </html>
    `);

    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const html = await getHtmlContent(page, '#content', true);
    expect(html).toContain('Iframe content');
    expect(html).toContain('class="iframe-content"');
  });

  it('should not extract iframe content when extractIframes is false', async () => {
    await page.setContent(`
      <html>
        <body>
          <div id="content">
            <p>Main content</p>
            <iframe srcdoc="<div>Embedded iframe data</div>"></iframe>
          </div>
        </body>
      </html>
    `);

    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const html = await getHtmlContent(page, '#content', false);
    expect(html).toContain('<iframe');
    expect(html).not.toContain('class="iframe-content"');
    expect(html).not.toContain('Embedded content:');
  });
});

describe('mapUrlToOrigin', () => {
  it('should map a URL to use a different origin', () => {
    const url = 'https://docs.example.com/guide/intro';
    const targetOrigin = 'http://localhost:3000';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:3000/guide/intro');
  });

  it('should preserve path, query parameters, and fregments when mapping', () => {
    const url =
      'https://docs.example.com/api/reference?version=v2&lang=en#section-1';
    const targetOrigin = 'http://localhost:8080';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe(
      'http://localhost:8080/api/reference?version=v2&lang=en#section-1',
    );
  });

  it('should handle protocol changes (http to https)', () => {
    const url = 'http://baseurl.example.com/docs/page';
    const targetOrigin = 'https://crawl.example.com';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('https://crawl.example.com/docs/page');
  });

  it('should handle protocol changes (https to http)', () => {
    const url = 'https://baseurl.example.com/docs/page';
    const targetOrigin = 'http://crawl.example.com';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://crawl.example.com/docs/page');
  });

  it('should handle different TLDs', () => {
    const url = 'https://external-docs.com/docs/guide';
    const targetOrigin = 'https://internal.company.net';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('https://internal.company.net/docs/guide');
  });

  it('should handle ports in the target origin', () => {
    const url = 'https://docs.example.com/guide';
    const targetOrigin = 'http://localhost:4000';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:4000/guide');
  });

  it('should handle ports in both URL and target origin', () => {
    const url = 'https://docs.example.com:8443/guide';
    const targetOrigin = 'http://localhost:3000';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:3000/guide');
  });

  it('should handle root path URLs', () => {
    const url = 'https://docs.example.com/';
    const targetOrigin = 'http://localhost:3000';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:3000/');
  });

  it('should handle URLs with only query parameters', () => {
    const url = 'https://api.example.com/?search=test&page=2';
    const targetOrigin = 'http://localhost:8080';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:8080/?search=test&page=2');
  });

  it('should handle URLs with only fragments', () => {
    const url = 'https://docs.example.com/#introduction';
    const targetOrigin = 'http://localhost:3000';

    const result = mapUrlToOrigin(url, targetOrigin);

    expect(result).toBe('http://localhost:3000/#introduction');
  });
});
