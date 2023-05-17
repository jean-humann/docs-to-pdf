#!/usr/bin/env node

import chalk from 'chalk';
import console_stamp from 'console-stamp';
import { program } from 'commander';

import { generatePDF, GeneratePDFOptions } from './utils';
import {
  commaSeparatedList,
  generatePuppeteerPDFMargin,
} from './commander-options';

console_stamp(console);

program
  .name('docs-to-pdf')
  .requiredOption(
    '--initialDocURLs <urls>',
    'set urls to start generating PDF from',
    commaSeparatedList,
  )
  .option(
    '--excludeURLs <urls>',
    'urls to be excluded in PDF',
    commaSeparatedList,
  )
  .requiredOption(
    '--contentSelector <selector>',
    'used to find the part of main content',
  )
  .requiredOption('--paginationSelector <selector>', 'used to find next url')
  .option(
    '--excludeSelectors <selectors>',
    'exclude selector ex: .nav',
    commaSeparatedList,
  )
  .option(
    '--cssStyle <cssString>',
    'css style to adjust PDF output ex: body{padding-top: 0;}',
  )
  .option('--outputPDFFilename <filename>', 'name of output PDF file')
  .option(
    '--pdfMargin <margin>',
    'set margin around PDF file',
    generatePuppeteerPDFMargin,
  )
  .option('--pdfFormat <format>', '(DEPRECATED use paperFormat)') //TODO: Remove at next major version, replaced by paperFormat
  .option('--paperFormat <format>', 'pdf format ex: A3, A4...')
  .option('--coverTitle <title>', 'title for PDF cover')
  .option('--coverImage <src>', 'image for PDF cover. *.svg file not working!')
  .option('--disableTOC', 'disable table of contents')
  .option('--coverSub <subtitle>', 'subtitle for PDF cover')
  .option(
    '--waitForRender <timeout>',
    'wait for document render in milliseconds',
  )
  .option('--headerTemplate <html>', 'html template for page header')
  .option('--footerTemplate <html>', 'html template for page footer')
  .option(
    '--puppeteerArgs <selectors>',
    'add puppeteer arguments ex: --sandbox',
    commaSeparatedList,
  )
  .option(
    '--protocolTimeout <timeout>',
    'timeout setting for individual protocol calls in milliseconds',
    commaSeparatedList,
  )

  .action((options: GeneratePDFOptions) => {
    if (options.pdfFormat) {
      console.log(chalk.red('--pdfFormat is deprecated, use --paperFormat'));
      process.exit(1);
    }
    generatePDF(options)
      .then(() => {
        console.log(chalk.green('Finish generating PDF!'));
        process.exit(0);
      })
      .catch((err: { stack: unknown }) => {
        console.error(chalk.red(err.stack));
        process.exit(1);
      });
  });

program.parse(process.argv);
