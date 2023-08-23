import * as puppeteer from 'puppeteer-core';
import chalk from 'chalk';
import { getOutline, setOutline } from './outline';
import { PDFDocument } from 'pdf-lib';

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
    setOutline(pdfDoc, outline, true);
    pdfDoc.save();
    console.log(
      chalk.green(`PDF generated at ${this.options.outputPDFFilename ?? 'output.pdf'}`),
    );
  }
}
