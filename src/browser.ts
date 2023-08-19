import path from 'path';
import os from 'os';
import {
  computeExecutablePath,
  Browser as InstalledBrowser,
} from '@puppeteer/browsers';
import { PUPPETEER_REVISIONS } from 'puppeteer-core/lib/cjs/puppeteer/revisions.js';

export function chromeExecPath(
  computeExecutable = computeExecutablePath,
): string {
  const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer');
  const builId = PUPPETEER_REVISIONS['chrome'];
  const executablePath = computeExecutable({
    cacheDir: cacheDir,
    browser: InstalledBrowser.CHROME,
    buildId: builId,
  });
  return executablePath;
}
