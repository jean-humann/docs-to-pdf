import chalk from 'chalk';
import console_stamp from 'console-stamp';
import * as puppeteer from 'puppeteer-core';
import { scrollPageToBottom } from 'puppeteer-autoscroll-down';
import * as fs from 'fs-extra';
import { chromeExecPath } from './browser';
import * as utils from './utils';
import { delay } from './utils';
import { PDF, PDFOptions } from './pdf/generate';

console_stamp(console);

export interface GeneratePDFOptions extends PDFOptions {
  initialDocURLs: Array<string>;
  excludeURLs: Array<string>;
  contentSelector: string;
  paginationSelector: string;
  excludeSelectors: Array<string>;
  cssStyle: string;
  puppeteerArgs: Array<string>;
  coverTitle: string;
  coverImage: string;
  disableTOC: boolean;
  tocTitle: string;
  disableCover: boolean;
  coverSub: string;
  waitForRender: number;
  protocolTimeout: number;
  filterKeyword: string;
  baseUrl: string;
  excludePaths: Array<string>;
  restrictPaths: boolean;
  openDetail: boolean;
  extractIframes: boolean;
  httpAuthUser?: string;
  httpAuthPassword?: string;
}

/* c8 ignore start */
export async function generatePDF(options: GeneratePDFOptions): Promise<void> {
  const {
    initialDocURLs,
    excludeURLs,
    contentSelector,
    paginationSelector,
    excludeSelectors,
    cssStyle,
    puppeteerArgs,
    coverTitle,
    coverImage,
    disableTOC,
    tocTitle,
    disableCover,
    coverSub,
    waitForRender,
    protocolTimeout,
    filterKeyword,
    baseUrl,
    excludePaths,
    restrictPaths,
    openDetail = true,
    extractIframes = false,
    httpAuthUser,
    httpAuthPassword,
  } = options;
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  console.debug(chalk.cyan(`Using Chromium from ${execPath}`));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath,
    args: puppeteerArgs,
    protocolTimeout: protocolTimeout,
  });

  const chromeTmpDataDir = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
    ?.split('=')[1] as string;
  console.debug(chalk.cyan(`Chrome user data dir: ${chromeTmpDataDir}`));

  try {
    const page = await browser.newPage();

    // Set HTTP Basic Auth credentials if provided
    if (httpAuthUser && httpAuthPassword) {
      console.debug(
        chalk.cyan(
          `Setting HTTP Basic Auth credentials for user: ${httpAuthUser}`,
        ),
      );
      await page.authenticate({
        username: httpAuthUser,
        password: httpAuthPassword,
      });
    }

    // Block PDFs as puppeteer can not access them
    await page.setRequestInterception(true);
    // Track handled requests to prevent race conditions
    const handledRequests = new WeakSet<puppeteer.HTTPRequest>();
    page.on('request', (request) => {
      // Skip if request already handled
      if (handledRequests.has(request)) {
        return;
      }
      handledRequests.add(request);

      if (request.url().endsWith('.pdf')) {
        console.log(chalk.yellowBright(`ignore pdf: ${request.url()}`));
        request.abort().catch((err) => {
          // Ignore abort errors - request may already be handled
          console.debug(
            `Request abort error (usually safe to ignore): ${err.message}`,
          );
        });
      } else {
        request.continue().catch((err) => {
          // Ignore continue errors - request may already be handled
          console.debug(
            `Request continue error (usually safe to ignore): ${err.message}`,
          );
        });
      }
    });

    console.debug(`InitialDocURLs: ${initialDocURLs}`);

    // Local variable to accumulate HTML content from all pages
    let contentHTML = '';
    // Track visited URLs across all initial URLs to prevent infinite loops
    // from circular pagination, including cross-references between different initial URLs
    const visitedURLs = new Set<string>();

    for (const url of initialDocURLs) {
      let nextPageURL = url;
      const urlPath = new URL(url).pathname;

      // Create a list of HTML for the content section of all pages by looping
      while (nextPageURL) {
        // Check if we've already visited this URL to prevent infinite loops
        if (visitedURLs.has(nextPageURL)) {
          console.log(
            chalk.yellow(
              `Skipping already visited URL (circular pagination detected): ${nextPageURL}`,
            ),
          );
          break;
        }
        visitedURLs.add(nextPageURL);

        console.log(chalk.cyan(`Retrieving html from ${nextPageURL}`));

        // Go to the page specified by nextPageURL
        await page.goto(`${nextPageURL}`, {
          waitUntil: 'networkidle0',
          timeout: 0,
        });
        if (waitForRender) {
          console.log(chalk.green('Waiting for render...'));
          await delay(waitForRender);
        }

        if (
          await utils.isPageKept(
            page,
            nextPageURL,
            urlPath,
            excludeURLs,
            filterKeyword,
            excludePaths,
            restrictPaths,
          )
        ) {
          // Open all <details> elements on the page
          if (openDetail) {
            await utils.openDetails(page);
          }
          // Get the HTML string of the content section.
          contentHTML += await utils.getHtmlContent(
            page,
            contentSelector,
            extractIframes,
          );
          console.log(chalk.green('Success'));
        }

        // Find next page url before DOM operations
        nextPageURL = await utils.findNextUrl(page, paginationSelector);
      }
    }

    console.log(chalk.cyan('Start generating PDF...'));

    // Generate cover Image if declared
    let coverImageHtml = '';
    if (coverImage) {
      console.log(chalk.cyan('Get coverImage...'));
      const image = await utils.getCoverImage(page, coverImage);
      coverImageHtml = utils.generateImageHtml(image.base64, image.type);
    }

    // Generate Cover
    console.log(chalk.cyan('Generate cover...'));
    const coverHTML = utils.generateCoverHtml(
      coverTitle,
      coverImageHtml,
      coverSub,
    );

    // Generate Toc
    const { modifiedContentHTML, tocHTML } = utils.generateToc(contentHTML, {
      tocTitle,
    });

    // Restructuring the HTML of a document
    console.log(chalk.cyan('Restructuring the html of a document...'));

    // Go to initial page
    await page.goto(`${initialDocURLs[0]}`, { waitUntil: 'networkidle0' });

    await page.evaluate(
      utils.concatHtml,
      coverHTML,
      tocHTML,
      modifiedContentHTML,
      disableTOC,
      disableCover,
      baseUrl,
    );

    // Remove unnecessary HTML by using excludeSelectors
    if (excludeSelectors) {
      console.log(chalk.cyan('Remove unnecessary HTML...'));
      await utils.removeExcludeSelector(page, excludeSelectors);
    }

    // Add CSS to HTML
    if (cssStyle) {
      console.log(chalk.cyan('Add CSS to HTML...'));
      await page.addStyleTag({ content: cssStyle });
    }

    // Scroll to the bottom of the page with puppeteer-autoscroll-down
    // This forces lazy-loading images to load
    console.log(chalk.cyan('Scroll to the bottom of the page...'));
    await scrollPageToBottom(page, {}); //cast to puppeteer-core type

    // Generate PDF
    const pdf = new PDF(options);
    await pdf.generate(page);
  } finally {
    // Always close browser and cleanup temp directory, even if PDF generation fails
    await browser.close();
    console.log(chalk.green('Browser closed'));

    if (chromeTmpDataDir) {
      fs.removeSync(chromeTmpDataDir);
      console.debug(chalk.cyan('Chrome user data dir removed'));
    }
  }
}
/* c8 ignore stop */
