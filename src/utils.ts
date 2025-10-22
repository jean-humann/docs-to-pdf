import chalk from 'chalk';
import console_stamp from 'console-stamp';
import * as puppeteer from 'puppeteer-core';

console_stamp(console);

/**
 * Helper function to create a delay promise
 * @param ms - milliseconds to wait
 * @returns Promise that resolves after the specified delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks whether a page contains a given keyword
 * @param page - The Puppeteer page instance.
 * @param keyword - The meta keyword to search for
 * @returns boolean if the keyword was found
 */
export async function matchKeyword(
  page: puppeteer.Page,
  keyword: string,
): Promise<boolean> {
  try {
    const metaKeywords = await page.$eval(
      "head > meta[name='keywords']",
      (element) => element.content,
    );
    if (metaKeywords.split(',').includes(keyword)) {
      console.log(
        chalk.green(`Keyword found: ${keyword} in ${metaKeywords}`),
      );
      return true;
    }
    console.log(
      chalk.yellowBright(`Keyword not found: ${keyword} in ${metaKeywords}`),
    );
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`No meta keywords found: ${message}`));
    return false;
  }
}

/**
 * Retrieves the HTML content of a specific element on a page using Puppeteer.
 * @param page - The Puppeteer page instance.
 * @param selector - The CSS selector of the element.
 * @returns The HTML content of the element.
 */
export async function getHtmlContent(page: puppeteer.Page, selector: string) {
  const html = await page.evaluate(getHtmlFromSelector, selector);
  return html;
}

/**
 * Retrieves the HTML content of an element matching the specified selector.
 * Adds page break styling for PDF generation.
 *
 * @param selector - The CSS selector of the element to retrieve.
 * @returns The HTML content of the matched element, or an empty string if no element is found.
 */
export function getHtmlFromSelector(selector: string): string {
  const element: HTMLElement | null = document.querySelector(selector);
  if (element) {
    // Add page break for PDF
    element.style.breakAfter = 'always';
    return element.outerHTML;
  }
  return '';
}

type ClickFunction = (element: puppeteer.ElementHandle) => Promise<void>;
type WaitFunction = (milliseconds: number) => Promise<void>;

/**
 * Recursively opens all <details> elements on a page.
 *
 * @param page - The Puppeteer page instance.
 * @param clickFunction - A function to click the summary element of a <details> element.
 * @param waitFunction - A function to wait for a specified number of milliseconds.
 */
export async function openDetails(
  page: puppeteer.Page,
  clickFunction?: ClickFunction,
  waitFunction?: WaitFunction,
) {
  const detailsHandles = await page.$$('details');

  console.debug(`Found ${detailsHandles.length} elements`);

  for (const detailsHandle of detailsHandles) {
    const summaryHandle = await detailsHandle.$('summary');
    if (summaryHandle) {
      console.debug(
        `Clicking summary: ${await summaryHandle.evaluate(
          (node) => node.textContent,
        )}`,
      );
      await (clickFunction
        ? clickFunction(summaryHandle)
        : summaryHandle.click());
      await (waitFunction ? waitFunction(800) : delay(800));
    }
  }
}

/**
 * Finds the URL of the next page based on a CSS selector using Puppeteer.
 * @param page - The Puppeteer page instance.
 * @param selector - The CSS selector of the element containing the link to the next page.
 * @returns The URL of the next page.
 */
export async function findNextUrl(page: puppeteer.Page, selector: string) {
  const nextPageURL = await page.evaluate(getUrlFromSelector, selector);
  return nextPageURL;
}

/**
 * Retrieves the URL from an HTML element specified by the selector.
 * @param selector - The CSS selector to target the HTML element.
 * @returns The URL of the element, or an empty string if the element is not found.
 */
export function getUrlFromSelector(selector: string): string {
  const element = document.querySelector(selector);
  if (element) {
    // If the element is found, return its href property as the next page URL
    return (element as HTMLLinkElement).href;
  }
  // If the element is not found, return an empty string
  return '';
}

/**
 * Concatenates the HTML content of the cover, table of contents (toc), and main content.
 * @param cover - The HTML content of the cover.
 * @param toc - The HTML content of the table of contents.
 * @param content - The HTML content of the main content.
 * @param disable - A boolean indicating whether to disable the table of contents.
 * @returns The concatenated HTML content.
 */
export function concatHtml(
  cover: string,
  toc: string,
  content: string,
  disable: boolean,
  baseUrl: string,
) {
  // Clear the body content
  const body = document.body;
  body.innerHTML = '';

  // Add base tag for relative links
  // see: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/base
  if (baseUrl) {
    body.innerHTML += `<base href="${baseUrl}" />`;
  }

  // Add the cover HTML to the body
  body.innerHTML += cover;

  // Add the table of contents HTML to the body if not disabled
  if (!disable) {
    body.innerHTML += toc;
  }

  // Add the main content HTML to the body
  body.innerHTML += content;

  // Return the concatenated HTML content
  return body.innerHTML;
}

/**
 * Retrieves the cover image from the specified URL using Puppeteer.
 * @param page - The Puppeteer page object.
 * @param url - The URL of the cover image.
 * @returns An object containing the base64-encoded image content and the content type.
 */
export async function getCoverImage(page: puppeteer.Page, url: string) {
  // Download buffer of coverImage if it exists
  const imgSrc = await page.goto(url);
  const imgSrcBuffer = await imgSrc?.buffer();
  const base64 = imgSrcBuffer?.toString('base64') || '';
  const type = imgSrc?.headers()['content-type'] || '';
  console.log(chalk.cyan('Cover image content-type: ' + type));
  return { base64, type };
}

/**
 * Generates the HTML code for an image with the specified base64 content, content type, width, and height.
 * @param imgBase64 - The base64-encoded content of the image.
 * @param contentType - The content type of the image. Defaults to 'image/png'.
 * @param width - The width of the image. Defaults to 140.
 * @param height - The height of the image. Defaults to 140.
 * @returns The HTML code for the image.
 */
export function generateImageHtml(
  imgBase64: string,
  contentType = 'image/png',
  width = 140,
  height = 140,
) {
  // Return the HTML code for the image with the specified properties
  return `<img
    class="cover-img"
    src="data:${contentType};base64, ${imgBase64}"
    alt=""
    width="${width}"
    height="${height}"
    />`;
}

/**
 * Generates the HTML code for a cover page with a title, subtitle, and image.
 * @param coverTitle - The title for the cover page.
 * @param coverImageHtml - The HTML code for the cover image.
 * @param coverSub - The subtitle for the cover page.
 * @returns The HTML code for the cover page.
 */
export function generateCoverHtml(
  coverTitle: string,
  coverImageHtml: string,
  coverSub: string,
) {
  // Return the HTML code for the cover page with optional title, subtitle, and cover image
  return `
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
    ${coverTitle ? `<h1>${coverTitle}</h1>` : ''}
    ${coverSub ? `<h3>${coverSub}</h3>` : ''}
    ${coverImageHtml}
  </div>`;
}

/**
 * Generates a table of contents (TOC) HTML and modifies the content HTML by replacing header tags with updated header IDs.
 * @param contentHtml - The content HTML string.
 * @param maxLevel - The maximum header level to include in the TOC. Defaults to 3.
 * @returns An object containing the modified content HTML and the TOC HTML.
 */
export function generateToc(contentHtml: string, maxLevel = 4) {
  const headers: Array<{
    header: string;
    level: number;
    id: string;
  }> = [];

  console.log(chalk.cyan('Start generating TOC...'));
  // Create TOC only for h1~h${maxLevel}
  // Regex to match all header tags
  const re = new RegExp(
    '<h[1-' + maxLevel + '](.+?)</h[1-' + maxLevel + ']( )*>',
    'g',
  );
  const modifiedContentHTML = contentHtml.replace(re, htmlReplacer);

  function htmlReplacer(matchedStr: string) {
    // Generate header information and update the headers array
    const { headerText, headerId, level } = generateHeader(headers, matchedStr);
    headers.push({ header: headerText, level, id: headerId });

    // Replace the header ID in the matched string and return the modified string
    return replaceHeader(matchedStr, headerId, maxLevel);
  }

  const tocHTML = generateTocHtml(headers);

  return { modifiedContentHTML, tocHTML };
}

/**
 * Generates the HTML code for a table of contents based on the provided headers.
 * @param headers - An array of header objects containing level, id, and header properties.
 * @returns The HTML code for the table of contents.
 */
export function generateTocHtml(headers: any[]) {
  // Map the headers array to create a list item for each header with the appropriate indentation
  const toc = headers
    .map(
      (header) =>
        `<li class="toc-item toc-item-${header.level}" style="margin-left:${
          (header.level - 1) * 20
        }px"><a href="#${header.id}">${header.header}</a></li>`,
    )
    .join('\n');
  // Return the HTML code for the table of contents
  return `
  <div class="toc-page" style="page-break-after: always;">
    <h1 class="toc-header">Table of contents:</h1>
    ${toc}
  </div>
  `;
}

/**
 * Generates header information from the matched string and updates the headers array.
 * @param headers - The headers array to update with the new header information.
 * @param matchedStr - The matched string containing the header information.
 * @returns An object containing the header text, header ID, and level.
 */
export function generateHeader(headers: any[], matchedStr: string) {
  // Remove anchor tags inserted by Docusaurus for direct links to the header
  const headerText = matchedStr
    .replaceAll(/<a[^>]*>#<\/a( )*>/g, '')
    .replaceAll(/<[^>]*>/g, '')
    .trim();

  // Generate a random header ID using a combination of random characters and the headers array length
  const headerId = `${Math.random().toString(36).slice(2, 5)}-${
    headers.length
  }`;

  // Extract the level from the matched string (e.g., h1, h2, etc.)
  const level = Number(matchedStr[matchedStr.indexOf('h') + 1]);

  return { headerText, headerId, level };
}

/**
 * Replaces the ID attribute of the headers in a string with the specified headerId.
 * @param matchedStr - The string containing headers to be modified.
 * @param headerId - The ID value to replace the existing IDs with.
 * @returns The modified string with replaced header IDs.
 */
export function replaceHeader(
  matchedStr: string,
  headerId: string,
  maxLevel = 3,
) {
  // Create a regular expression to match the header tags
  const re = new RegExp('<h[1-' + maxLevel + '].*?>', 'g');
  // Replaces the ID attribute of the headers using regular expressions and the headerId parameter
  const modifiedContentHTML = matchedStr.replace(re, (header) => {
    if (header.match(/id( )*=( )*"/g)) {
      // If the header already has an ID attribute, replace its value with the headerId parameter
      return header.replaceAll(/id\s*=\s*"([^"]*)"/g, `id="${headerId}"`);
    } else {
      // If the header doesn't have an ID attribute, add the headerId parameter as a new ID attribute
      return header.substring(0, header.length - 1) + ` id="${headerId}">`;
    }
  });
  // Return the modified string with replaced header IDs
  return modifiedContentHTML;
}

/**
 * Removes elements from the page that match the exclude selectors.
 * @param page - The Puppeteer page object.
 * @param excludeSelectors - An array of CSS selectors for elements to be removed.
 */
export async function removeExcludeSelector(
  page: puppeteer.Page,
  excludeSelectors: string[],
) {
  for (const excludeSelector of excludeSelectors) {
    await page.evaluate(removeElementFromSelector, excludeSelector);
  }
}

/**
 * Removes all elements that match the specified selector from the document.
 *
 * @param selector - The CSS selector of the elements to remove.
 */
export function removeElementFromSelector(selector: string): void {
  // Find all elements that match the selector
  const matches = document.querySelectorAll(selector);

  // Remove each matched element
  matches.forEach((match) => match.remove());
}

/**
 * Check if a page should be kept based on exclusion and filtering conditions.
 *
 * @param page - The Puppeteer page instance
 * @param nextPageURL The URL of the next page to be checked.
 * @param urlPath The path of the URL to be checked.
 * @param excludeURLs List of URLs to exclude.
 * @param filterKeyword Keyword to filter pages.
 * @param excludePaths List of path patterns to exclude.
 * @param restrictPaths Whether to restrict by path.
 * @returns True if the page should be kept, false if it should be excluded.
 */
export async function isPageKept(
  page: puppeteer.Page,
  nextPageURL: string,
  urlPath: string,
  excludeURLs: string[] | undefined,
  filterKeyword: string | undefined,
  excludePaths: string[] | undefined,
  restrictPaths: boolean | undefined,
): Promise<boolean> {
  if (excludeURLs && excludeURLs.includes(nextPageURL)) {
    console.log(chalk.green('This URL is excluded.'));
    return false;
  } else if (filterKeyword && !(await matchKeyword(page, filterKeyword))) {
    console.log(
      chalk.yellowBright(`Page excluded by keyword filter: ${filterKeyword}`),
    );
    return false;
  } else if (
    excludePaths &&
    excludePaths.some((path) => nextPageURL.includes(path))
  ) {
    console.log(
      chalk.yellowBright(`Page excluded by path filter: ${excludePaths}`),
    );
    return false;
  } else if (restrictPaths && nextPageURL.includes(urlPath) === false) {
    console.log(
      chalk.yellowBright(
        `Page excluded by path restriction: ${urlPath} !== ${urlPath}`,
      ),
    );
    return false;
  }

  return true;
}
