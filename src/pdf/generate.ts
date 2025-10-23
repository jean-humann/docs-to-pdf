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
  public async generate(page: puppeteer.Page): Promise<void> {
    console.log(chalk.cyan('Generate PDF...'));

    // Get page dimensions for coordinate mapping
    const pageDimensions = await page.evaluate(() => {
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      };
    });

    console.log(chalk.cyan('Extracting headings from document...'));
    const outline = await getOutline(page, [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]);

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
    const pdfDoc = await PDFDocument.load(pdf);

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
