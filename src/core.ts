import chalk from 'chalk';
import console_stamp from 'console-stamp';
import * as puppeteer from 'puppeteer-core';
import { scrollPageToBottom } from 'puppeteer-autoscroll-down';
import * as fs from 'fs-extra';
import { chromeExecPath } from './browser';
import * as utils from './utils';
import { PDF, PDFOptions } from './pdf/generate';

console_stamp(console);

let contentHTML = '';

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
  coverSub: string;
  waitForRender: number;
  protocolTimeout: number;
  filterKeyword: string;
  baseUrl: string;
  excludePaths: Array<string>;
  restrictPaths: boolean;
  openDetail: boolean;
}

/* c8 ignore start */
export async function generatePDF(options: GeneratePDFOptions): Promise<void> {
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  console.debug(chalk.cyan(`Using Chromium from ${execPath}`));
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: execPath,
    args: options.puppeteerArgs,
    protocolTimeout: options.protocolTimeout,
  });

  const chromeTmpDataDir = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
    ?.split('=')[1] as string;
  console.debug(chalk.cyan(`Chrome user data dir: ${chromeTmpDataDir}`));

  const page = await browser.newPage();

  // Block PDFs as puppeteer can not access them
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    if (request.url().endsWith('.pdf')) {
      console.log(chalk.yellowBright(`ignore pdf: ${request.url()}`));
      request.abort();
    } else request.continue();
  });

  console.debug(`InitialDocURLs: ${options.initialDocURLs}`);
  for (const url of options.initialDocURLs) {
    let nextPageURL = url;
    const urlPath = new URL(url).pathname;

    // Create a list of HTML for the content section of all pages by looping
    while (nextPageURL) {
      console.log(chalk.cyan(`Retrieving html from ${nextPageURL}`));

      // Go to the page specified by nextPageURL
      await page.goto(`${nextPageURL}`, {
        waitUntil: 'networkidle0',
        timeout: 0,
      });
      if (options.waitForRender) {
        console.log(chalk.green('Waiting for render...'));
        await new Promise((r) => setTimeout(r, options.waitForRender));
      }

      if (
        await utils.isPageKept(
          page,
          nextPageURL,
          urlPath,
          options.excludeURLs,
          options.filterKeyword,
          options.excludePaths,
          options.restrictPaths,
        )
      ) {
        // Open all <details> elements on the page
        if (options.openDetail) {
          await utils.openDetails(page);
        }
        // Get the HTML string of the content section.
        contentHTML += await utils.getHtmlContent(
          page,
          options.contentSelector,
        );
        console.log(chalk.green('Success'));
      }

      // Find next page url before DOM operations
      nextPageURL = await utils.findNextUrl(page, options.paginationSelector);
    }
  }

  console.log(chalk.cyan('Start generating PDF...'));

  // Generate cover Image if declared
  let coverImageHtml = '';
  if (options.coverImage) {
    console.log(chalk.cyan('Get coverImage...'));
    const image = await utils.getCoverImage(page, options.coverImage);
    coverImageHtml = utils.generateImageHtml(image.base64, image.type);
  }

  // Generate Cover
  console.log(chalk.cyan('Generate cover...'));
  const coverHTML = utils.generateCoverHtml(
    options.coverTitle,
    coverImageHtml,
    options.coverSub,
  );

  // Generate Toc
  const { modifiedContentHTML, tocHTML } = utils.generateToc(contentHTML);

  // Restructuring the HTML of a document
  console.log(chalk.cyan('Restructuring the html of a document...'));

  // Go to initial page
  await page.goto(`${options.initialDocURLs[0]}`, {
    waitUntil: 'networkidle0',
  });

  await page.evaluate(
    utils.concatHtml,
    coverHTML,
    tocHTML,
    modifiedContentHTML,
    options.disableTOC,
    options.baseUrl,
  );

  // Remove unnecessary HTML by using excludeSelectors
  if (options.excludeSelectors) {
    console.log(chalk.cyan('Remove unnecessary HTML...'));
    await utils.removeExcludeSelector(page, options.excludeSelectors);
  }

  // Add CSS to HTML
  if (options.cssStyle) {
    console.log(chalk.cyan('Add CSS to HTML...'));
    await page.addStyleTag({ content: options.cssStyle });
  }

  // Scroll to the bottom of the page with puppeteer-autoscroll-down
  // This forces lazy-loading images to load
  console.log(chalk.cyan('Scroll to the bottom of the page...'));
  await scrollPageToBottom(page, {}); //cast to puppeteer-core type

  // Generate PDF
  const pdf = new PDF(options);
  await pdf.generate(page);

  await browser.close();
  console.log(chalk.green('Browser closed'));

  if (chromeTmpDataDir !== null) {
    fs.removeSync(chromeTmpDataDir);
  }
  console.debug(chalk.cyan('Chrome user data dir removed'));
}
/* c8 ignore stop */
