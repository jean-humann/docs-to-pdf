import chalk from 'chalk';
import * as puppeteer from 'puppeteer-core';
import * as utils from './utils';
import { delay } from './utils';

/** One crawled page: its URL and the extracted content-section HTML. */
export interface PageChunk {
  url: string;
  html: string;
}

/**
 * Options consumed by the acquisition stage. A structural subset of
 * GeneratePDFOptions, so acquire() is decoupled from rendering.
 */
export interface AcquireOptions {
  initialDocURLs: Array<string>;
  excludeURLs: Array<string>;
  contentSelector: string;
  paginationSelector: string;
  filterKeyword: string;
  excludePaths: Array<string>;
  restrictPaths: boolean;
  openDetail?: boolean;
  extractIframes?: boolean;
  waitForRender: number;
}

/**
 * ACQUISITION stage of the pipeline (v2 decoupling): crawl the documentation
 * site by following the pagination next-link chain from each initial URL, and
 * return the content HTML of every kept page in deterministic crawl order.
 *
 * This is the stable intermediate representation that decouples crawling from
 * rendering, so the same chunks can feed different render backends. The crawl
 * behaviour is identical to the previous inline loop in generatePDF.
 */
/* c8 ignore start */
export async function acquire(
  page: puppeteer.Page,
  options: AcquireOptions,
): Promise<PageChunk[]> {
  const {
    initialDocURLs,
    excludeURLs,
    contentSelector,
    paginationSelector,
    filterKeyword,
    excludePaths,
    restrictPaths,
    openDetail = true,
    extractIframes = false,
    waitForRender,
  } = options;

  // Accumulate the HTML content of each crawled page, keyed by its URL so
  // cross-page hyperlinks can be rewritten as internal PDF links (#336).
  const chunks: PageChunk[] = [];
  // Track visited URLs across all initial URLs to prevent infinite loops from
  // circular pagination, including cross-references between different seeds.
  const visitedURLs = new Set<string>();

  for (const url of initialDocURLs) {
    let nextPageURL = url;
    const urlPath = new URL(url).pathname;

    // Create a list of HTML for the content section of all pages by looping
    while (nextPageURL) {
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
        chunks.push({
          url: nextPageURL,
          html: await utils.getHtmlContent(
            page,
            contentSelector,
            extractIframes,
          ),
        });
        console.log(chalk.green('Success'));
      }

      // Find next page url before DOM operations
      nextPageURL = await utils.findNextUrl(page, paginationSelector);
    }
  }

  return chunks;
}
/* c8 ignore stop */
