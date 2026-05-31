import * as puppeteer from 'puppeteer-core';
import chalk from 'chalk';
import { getOutline, setOutline, OutlineNode } from './outline';
import { PDFDocument } from 'pdf-lib';
import { writeFile } from 'fs/promises';

/**
 * Count total number of headings in the outline tree
 */
function countTotalHeadings(outlines: OutlineNode[]): number {
  let count = 0;
  for (const item of outlines) {
    count++;
    count += countTotalHeadings(item.children);
  }
  return count;
}

export interface PDFOptions {
  outputPDFFilename: string;
  paperFormat: puppeteer.PaperFormat;
  pdfFormat?: puppeteer.PaperFormat;
  pdfMargin: puppeteer.PDFOptions['margin'];
  headerTemplate: string;
  footerTemplate: string;
  excludeCoverPageHeaderFooter?: boolean;
}

/**
 * Replace the leading cover page(s) of a PDF with header/footer-free versions.
 *
 * Puppeteer's running header/footer are global to every page, so to omit them
 * from the cover the cover is rendered a second time without them; this swaps
 * the first `coverPdf.pageCount` pages of `fullPdf` for those cover pages.
 * Because the cover content (and paper size/margin) is identical, the page
 * count is preserved, so bookmark page destinations computed for the body stay
 * valid.
 *
 * @param fullPdfBytes - the full document rendered with header/footer
 * @param coverPdfBytes - the cover rendered without header/footer
 * @returns the merged PDF bytes
 */
export async function swapLeadingCoverPages(
  fullPdfBytes: Uint8Array,
  coverPdfBytes: Uint8Array,
): Promise<Uint8Array> {
  const fullDoc = await PDFDocument.load(fullPdfBytes);
  const coverDoc = await PDFDocument.load(coverPdfBytes);

  const coverPageCount = Math.min(
    coverDoc.getPageCount(),
    fullDoc.getPageCount(),
  );
  const coverPages = await fullDoc.copyPages(
    coverDoc,
    coverDoc.getPageIndices().slice(0, coverPageCount),
  );

  // Remove the original (header/footer'd) cover pages, then insert the clean ones.
  for (let i = coverPageCount - 1; i >= 0; i--) {
    fullDoc.removePage(i);
  }
  coverPages.forEach((coverPage, index) =>
    fullDoc.insertPage(index, coverPage),
  );

  return fullDoc.save();
}

export class PDF {
  private readonly options: PDFOptions;

  constructor(options: PDFOptions) {
    this.options = options;
  }

  /**
   * Generate PDF
   * @param page
   * @returns
   * @throws {Error} - if page.pdf() fails
   */
  public async generate(
    page: puppeteer.Page,
    coverHtml?: string,
  ): Promise<void> {
    console.log(chalk.cyan('Generate PDF...'));

    // Get page dimensions for coordinate mapping
    const pageDimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
    });

    console.log(chalk.cyan('Extracting headings from document...'));

    // Listen for console messages from the browser context (for progress updates)
    const consoleListener = (msg: { text: () => string }) => {
      const text = msg.text();
      if (text.startsWith('Processing headings...')) {
        console.log(chalk.cyan(text));
      }
    };
    page.on('console', consoleListener);

    const outline = await getOutline(page, [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]);

    // Remove the console listener after extraction
    page.off('console', consoleListener);

    const totalHeadings = countTotalHeadings(outline);
    if (totalHeadings > 0) {
      console.log(chalk.green(`✓ Found ${totalHeadings} headings`));
    } else {
      console.log(
        chalk.yellow(
          'No headings found - PDF will be generated without bookmarks',
        ),
      );
    }

    const pdfExportOptions = {
      path: this.options.outputPDFFilename ?? 'output.pdf',
      format: this.options.paperFormat,
      margin: this.options.pdfMargin ?? {
        top: 32,
        right: 32,
        bottom: 32,
        left: 32,
      },
      headerTemplate: this.options.headerTemplate,
      footerTemplate: this.options.footerTemplate,
      displayHeaderFooter: !!(
        this.options.headerTemplate || this.options.footerTemplate
      ),
      printBackground: true,
      timeout: 0,
    };

    const pdf = await page.pdf(pdfExportOptions).catch((err) => {
      console.error(chalk.red(err));
      throw err; // Re-throw original error to preserve stack trace
    });

    let pdfBytes: Uint8Array = pdf;

    // Optionally omit the running header/footer from the cover page by
    // re-rendering the cover on its own (without header/footer) and swapping it
    // into the leading page(s). Only meaningful when a header/footer is shown.
    if (
      this.options.excludeCoverPageHeaderFooter &&
      coverHtml &&
      pdfExportOptions.displayHeaderFooter
    ) {
      console.log(chalk.cyan('Rendering cover page without header/footer...'));
      await page.evaluate((html: string) => {
        document.body.innerHTML = html;
      }, coverHtml);
      const coverPdf = await page.pdf({
        ...pdfExportOptions,
        path: undefined,
        displayHeaderFooter: false,
        headerTemplate: '',
        footerTemplate: '',
      });
      pdfBytes = await swapLeadingCoverPages(pdf, coverPdf);
    }

    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get PDF page dimensions (first page, assuming all pages same size)
    const pdfPage = pdfDoc.getPage(0);
    const pdfPageHeight = pdfPage.getHeight();

    if (totalHeadings > 0) {
      await setOutline(
        pdfDoc,
        outline,
        pageDimensions.height,
        pdfPageHeight,
        true,
      );
      console.log(chalk.green(`✓ Created ${totalHeadings} bookmarks`));
    }

    console.log(chalk.cyan('Saving PDF...'));
    const buffer = await pdfDoc.save();
    await writeFile(this.options.outputPDFFilename ?? 'output.pdf', buffer);
    console.log(
      chalk.green(
        `PDF generated at ${this.options.outputPDFFilename ?? 'output.pdf'}`,
      ),
    );
  }
}
