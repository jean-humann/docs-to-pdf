import chalk from 'chalk';
import console_stamp from 'console-stamp';
import { acquire } from './acquire';
import { render } from './render';
import { AcquireIR } from './ir';
import { PDFOptions } from './pdf/generate';

console_stamp(console);

export interface GeneratePDFOptions extends PDFOptions {
  initialDocURLs: Array<string>;
  excludeURLs: Array<string>;
  contentSelector: string;
  paginationSelector: string;
  excludeSelectors: Array<string>;
  cssStyle: string;
  puppeteerArgs: Array<string>;
  coverTitle: string;
  coverImage: string;
  disableTOC: boolean;
  tocTitle: string;
  disableCover: boolean;
  coverSub: string;
  waitForRender: number;
  protocolTimeout: number;
  filterKeyword: string;
  baseUrl: string;
  excludePaths: Array<string>;
  restrictPaths: boolean;
  openDetail: boolean;
  extractIframes: boolean;
  noInternalLinks: boolean;
  httpAuthUser?: string;
  httpAuthPassword?: string;
  /** Number of pages to fetch in parallel. Default 1 (serial, IR-identical to v1). */
  concurrency?: number;
  /** Frontier source when concurrency > 1: 'next-link' (default) or 'sitemap'. */
  seedFrom?: 'sitemap' | 'next-link';
  /**
   * Acquisition (crawl) engine: 'chromium' (default) or 'lightpanda' (a fast
   * Zig DOM engine, opt-in, auto-falls back to Chromium if unavailable).
   * Render always uses Chromium.
   */
  acquireEngine?: 'chromium' | 'lightpanda';
}

// Re-export the render stage so alternative pipelines/backends can consume the IR.
export { render };

/**
 * Generate a PDF from a documentation site. v2 pipeline: ACQUIRE the content
 * into a stable intermediate representation, then RENDER the IR into a PDF.
 * The two stages run in separate browsers with a clean IR boundary between them.
 */
/* c8 ignore start */
export async function generatePDF(options: GeneratePDFOptions): Promise<void> {
  console.log(chalk.cyan('Start acquiring content...'));
  const ir: AcquireIR = await acquire(options);
  console.log(
    chalk.cyan(`Acquired ${ir.chunks.length} pages. Start generating PDF...`),
  );
  await render(ir, options);
}
/* c8 ignore stop */
