import chalk from 'chalk';
import * as puppeteer from 'puppeteer-core';
import * as fs from 'fs-extra';
import { chromeExecPath } from './browser';
import * as utils from './utils';
import { configurePage } from './acquire';
import { PDF } from './pdf/generate';
import { AcquireIR } from './ir';
import type { GeneratePDFOptions } from './core';

/**
 * RENDER stage (v2): consume the intermediate representation and produce the
 * PDF. Launches a fresh browser, navigates to the first initial URL to
 * establish document context, assembles the combined DOM (TOC + rewritten
 * content via concatHtml), applies excludes/styles/autoscroll, and runs
 * PDF.generate() — which measures outline bookmark Y-positions in-browser
 * against the assembled DOM. This is why the IR carries no outline/Y data.
 */
/* c8 ignore start */
export async function render(
  ir: AcquireIR,
  options: GeneratePDFOptions,
): Promise<void> {
  const {
    excludeSelectors,
    cssStyle,
    puppeteerArgs,
    coverTitle,
    disableTOC,
    tocTitle,
    disableCover,
    coverSub,
    protocolTimeout,
    baseUrl,
    noInternalLinks = false,
  } = options;
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  console.debug(chalk.cyan(`[render] Using Chromium from ${execPath}`));
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath,
    args: puppeteerArgs,
    protocolTimeout: protocolTimeout,
  });
  const chromeTmpDataDir = browser
    .process()
    ?.spawnargs.find((arg) => arg.startsWith('--user-data-dir'))
    ?.split('=')[1] as string | undefined;

  try {
    const page = await configurePage(await browser.newPage(), options);

    // Generate cover (image was already fetched during acquisition).
    const coverImageHtml = ir.coverImage
      ? utils.generateImageHtml(ir.coverImage.base64, ir.coverImage.type)
      : '';
    console.log(chalk.cyan('Generate cover...'));
    const coverHTML = utils.generateCoverHtml(
      coverTitle,
      coverImageHtml,
      coverSub,
    );

    // Generate TOC. Unless disabled, rewrite cross-page hyperlinks to internal
    // PDF links (#336) via the per-page chunk pipeline.
    const { modifiedContentHTML, tocHTML } = noInternalLinks
      ? utils.generateToc(ir.chunks.map((c) => c.html).join(''), { tocTitle })
      : utils.generateTocFromChunks(ir.chunks, { tocTitle });

    // Restructuring the HTML of a document
    console.log(chalk.cyan('Restructuring the html of a document...'));
    await page.goto(ir.firstInitialURL, { waitUntil: 'networkidle0' });
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

    // Default print styles, injected before user CSS so `--cssStyle` can override.
    await page.addStyleTag({ content: utils.DEFAULT_PDF_STYLESHEET });
    if (cssStyle) {
      console.log(chalk.cyan('Add CSS to HTML...'));
      await page.addStyleTag({ content: cssStyle });
    }

    // Scroll to the bottom of the page to force lazy-loading images to load.
    // Imported dynamically because puppeteer-autoscroll-down is ESM-only and
    // this package builds to CommonJS.
    console.log(chalk.cyan('Scroll to the bottom of the page...'));
    const { scrollPageToBottom } = await import('puppeteer-autoscroll-down');
    await scrollPageToBottom(page, {});

    // Generate PDF (getOutline measures bookmark Y-positions on the assembled DOM).
    const pdf = new PDF(options);
    await pdf.generate(page, disableCover ? undefined : coverHTML);
  } finally {
    await browser.close();
    console.log(chalk.green('[render] Browser closed'));
    if (chromeTmpDataDir) {
      fs.removeSync(chromeTmpDataDir);
      console.debug(chalk.cyan('[render] Chrome user data dir removed'));
    }
  }
}
/* c8 ignore stop */
