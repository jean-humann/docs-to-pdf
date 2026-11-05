import * as path from 'path';
import {
  startDocusaurusServer,
  stopDocusaurusServer,
  ServerInstance,
} from '../../src/provider/docusaurus';
import type { GeneratePDFOptions } from '../../src/core';

/** Absolute path to the built Docusaurus v3 test fixture. */
export const FIXTURE_BUILD = path.join(__dirname, '..', 'website', 'build');

/**
 * Serve the built fixture over HTTP on an auto-selected free port (so parallel
 * jest workers don't collide). Returns the express ServerInstance.
 */
export function startFixture(): Promise<ServerInstance> {
  return startDocusaurusServer(FIXTURE_BUILD, 3000);
}

export { stopDocusaurusServer };
export type { ServerInstance };

/**
 * Build GeneratePDFOptions with the Docusaurus v3 selector defaults (mirrors
 * src/provider/docusaurus.ts) for crawling the served fixture. Cover is disabled
 * by default so render() needs no extra network fetch.
 */
export function v3Options(
  initialDocURLs: string[],
  over: Partial<GeneratePDFOptions> = {},
): GeneratePDFOptions {
  return {
    initialDocURLs,
    excludeURLs: [],
    contentSelector: 'main',
    paginationSelector: 'a.pagination-nav__link.pagination-nav__link--next',
    excludeSelectors: [
      '.margin-vert--xl a',
      "[class^='tocCollapsible']",
      '.breadcrumbs',
      '.theme-edit-this-page',
    ],
    cssStyle: '',
    puppeteerArgs: ['--no-sandbox', '--disable-setuid-sandbox'],
    coverTitle: '',
    coverImage: '',
    disableTOC: false,
    tocTitle: 'Table of contents:',
    disableCover: true,
    coverSub: '',
    waitForRender: 0,
    protocolTimeout: 30000,
    filterKeyword: '',
    baseUrl: '',
    excludePaths: [],
    restrictPaths: false,
    openDetail: true,
    extractIframes: false,
    noInternalLinks: false,
    outputPDFFilename: 'e2e-output.pdf',
    pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
    paperFormat: 'A4',
    headerTemplate: '',
    footerTemplate: '',
    ...over,
  } as GeneratePDFOptions;
}
