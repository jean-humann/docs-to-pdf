import { Command, Option } from 'commander';
import {
  commaSeparatedList,
  generatePuppeteerPDFMargin,
} from './commander-options';
import { generatePDF, GeneratePDFOptions } from './core';
import {
  generateDocusaurusPDF,
  DocusaurusOptions,
} from './provider/docusaurus';
import chalk from 'chalk';
import console_stamp from 'console-stamp';
const version = require('../package.json').version;

console_stamp(console);

export function makeProgram() {
  const program = new Command('');
  const docstopdf = program
    .command('docs-to-pdf')
    .version(version, '-v, --vers', 'output the current version')
    .showSuggestionAfterError()
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true,
    });

  docstopdf
    .command('docusaurus')
    .alias('d')
    .description('generate PDF from Docusaurus site')
    .option(
      '--version <version>',
      'version of Docusaurus site to generate PDF from',
      '2',
    )
    .addOption(
      new Option(
        '--docsDir <dir>',
        'directory of docs in Docusaurus site to generate PDF from',
      ).conflicts('--initialDocURLs'),
    )
    .action((options: DocusaurusOptions) => {
      console.debug('Generate from Docusaurus');
      console.debug(options);
      generateDocusaurusPDF(options)
        .then(() => {
          console.log(chalk.green('Finish generating PDF!'));
          process.exit(0);
        })
        .catch((err: { stack: unknown }) => {
          console.error(chalk.red(err.stack));
          process.exit(1);
        });
    });

  docstopdf
    .command('core', { isDefault: true })
    .description("generate PDF from Core's options")
    .action((options: GeneratePDFOptions) => {
      if (options.pdfFormat) {
        console.log(chalk.red('--pdfFormat is deprecated, use --paperFormat'));
        process.exit(1);
      }
      console.debug('Generate from Core');
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

  docstopdf.commands.forEach((cmd) => {
    cmd
      .option(
        '--initialDocURLs <urls>',
        'set urls to start generating PDF from',
        commaSeparatedList,
      )
      .option(
        '--excludeURLs <urls>',
        'urls to be excluded in PDF',
        commaSeparatedList,
      )
      .option(
        '--contentSelector <selector>',
        'used to find the part of main content',
      )
      .option('--paginationSelector <selector>', 'used to find next url')
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
      .option('--disableTOC', 'disable table of contents')
      .option('--tocTitle <title>', 'title for table of contents')
      .option('--disableCover', 'disable PDF cover')
      .option('--coverTitle <title>', 'title for PDF cover')
      .option(
        '--coverImage <src>',
        'image for PDF cover. *.svg file not working!',
      )
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
      .option('--filterKeyword <filterKeyword>', 'meta keyword to filter pages')
      .option(
        '--baseUrl <baseUrl>',
        'base URL for all relative URLs. Allows to render the pdf on localhost while referencing the deployed page.',
      )
      .option(
        '--excludePaths <paths>',
        'paths to be excluded in PDF',
        commaSeparatedList,
      )
      .option(
        '--restrictPaths',
        'only the paths in the --initialDocURLs will be included in the PDF',
      )
      .option(
        '--openDetail',
        'open details elements in the PDF, default is open',
      );
  });

  return program;
}
