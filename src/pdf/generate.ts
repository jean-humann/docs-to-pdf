import * as puppeteer from 'puppeteer-core';
import chalk from 'chalk';
import { getOutline, setOutline } from './outline';
import { PDFDocument } from 'pdf-lib';
import { writeFileSync } from 'fs';

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

    const outline = await getOutline(page, [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ]);
    console.log(chalk.green('Outline generated'));

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
      throw new Error(err);
    });
    const pdfDoc = await PDFDocument.load(pdf);

    // Get PDF page dimensions (first page, assuming all pages same size)
    const pdfPage = pdfDoc.getPage(0);
    const pdfPageHeight = pdfPage.getHeight();

    await setOutline(
      pdfDoc,
      outline,
      pageDimensions.height,
      pdfPageHeight,
      true,
    );
    const buffer = await pdfDoc.save();
    writeFileSync(this.options.outputPDFFilename ?? 'output.pdf', buffer);
    console.log(
      chalk.green(
        `PDF generated at ${this.options.outputPDFFilename ?? 'output.pdf'}`,
      ),
    );
  }
}
