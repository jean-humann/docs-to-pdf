import * as puppeteer from 'puppeteer-core';
import {
  getHtmlContent,
  findNextUrl,
  removeExcludeSelector,
  generateHeader,
  generateTocHtml,
  getCoverImage,
  generateImageHtml,
  generateCoverHtml,
  replaceHeader,
  matchKeyword,
  isPageKept,
  openDetails,
} from '../src/utils';

const execPath =
  process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath('chrome');
console.log(`Using executable path: ${execPath}`);

describe('getHtmlContent', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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

describe('findNextUrl', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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

describe('removeExcludeSelector', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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
});

describe('getCoverImage', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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
  it('should generate the HTML code for the image', () => {
    const imgBase64 = 'base64-encoded-image-content';
    const contentType = 'image/jpeg';
    const width = 200;
    const height = 200;

    const expectedOutput = `<img
    class="cover-img"
    src="data:image/jpeg;base64, base64-encoded-image-content"
    alt=""
    width="200"
    height="200"
    />`;

    const output = generateImageHtml(imgBase64, contentType, width, height);
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

describe('matchKeyword', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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

describe('isPageKept function', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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

describe('openDetails function', () => {
  let page: puppeteer.Page;
  let browser: puppeteer.Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
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

    // Close the browser
    await browser.close();
  });
});
