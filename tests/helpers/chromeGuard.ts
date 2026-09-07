import * as fs from 'fs';
import { chromeExecPath } from '../../src/browser';

/**
 * Shared Chrome-availability guard for browser-dependent suites. Resolves the
 * Chrome executable (env override or puppeteer's downloaded binary) and whether
 * it exists, so suites skip cleanly on runners without Chrome (e.g. the Node CI
 * job). Extracted from the previously-duplicated guards in the spec files.
 */
let chromeExecutablePath: string | undefined;
let chromeAvailable = false;
try {
  chromeExecutablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? chromeExecPath();
  chromeAvailable =
    Boolean(chromeExecutablePath) && fs.existsSync(chromeExecutablePath);
} catch {
  console.warn('Chrome not found, skipping puppeteer tests');
  chromeAvailable = false;
}

export { chromeExecutablePath, chromeAvailable };

/** `describe` when Chrome is available, `describe.skip` otherwise. */
export const describeIfChrome = chromeAvailable ? describe : describe.skip;
