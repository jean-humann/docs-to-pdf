import { Command, Option } from 'commander';
import {
  commaSeparatedList,
  generatePuppeteerPDFMargin,
} from './commander-options';
import { generatePDF, GeneratePDFOptions } from '../core';
import {
  generateDocusaurusPDF,
  DocusaurusOptions,
} from '../provider/docusaurus';
import chalk from 'chalk';
import console_stamp from 'console-stamp';
import packageJson from '../../package.json';

const version = packageJson.version;

console_stamp(console);

/**
 * Safely stringify an unknown error value for display
 * @param err - The error value to stringify
 * @returns A string representation of the error
 */
function stringifyError(err: unknown): string {
  if (typeof err === 'string') {
    return err;
  }
  if (typeof err === 'number' || typeof err === 'boolean') {
    return String(err);
  }
  if (err === null || err === undefined) {
    return String(err);
  }
  // For objects, use JSON.stringify
  try {
    return JSON.stringify(err);
  } catch {
    // Fallback if JSON.stringify fails (circular references, etc.)
    return Object.prototype.toString.call(err);
  }
}

/**
 * Handle promise completion with consistent success and error handling
 */
function handleCommandCompletion(promise: Promise<void>): void {
  promise
    .then(() => {
      console.log(chalk.green('Finish generating PDF!'));
      process.exit(0);
    })
    .catch((err: unknown) => {
      if (err instanceof Error) {
        console.error(chalk.red(`Error: ${err.message}`));
        if (err.stack) {
          console.error(chalk.red(err.stack));
        }
      } else {
        console.error(chalk.red(`Error: ${stringifyError(err)}`));
      }
      process.exit(1);
    });
}

export function makeProgram() {
  const program = new Command('docs-to-pdf');
  const docstopdf = program
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
      (value) => Number.parseInt(value, 10),
      2,
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
      handleCommandCompletion(generateDocusaurusPDF(options));
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
      handleCommandCompletion(generatePDF(options));
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
      .option('--coverTitle <title>', 'title for PDF cover')
      .option(
        '--coverImage <src>',
        'image for PDF cover. *.svg file not working!',
      )
      .option('--coverSub <subtitle>', 'subtitle for PDF cover')
      .option('--tocTitle <title>', 'title for table of contents')
      .option('--disableCover', 'disable PDF cover')
      .option('--disableTOC', 'disable table of contents')
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
