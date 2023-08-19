import os from 'os';
import path from 'path';
import { Browser as InstalledBrowser } from '@puppeteer/browsers';
import { chromeExecPath } from '../src/browser';

// Mock the required module
jest.mock('puppeteer-core/lib/cjs/puppeteer/revisions.js', () => ({
  PUPPETEER_REVISIONS: { chrome: 'mockedRevision' },
}));

describe('chromeExecPath function', () => {
  it('should return the correct executable path', () => {
    // Mock the path and os modules for consistency in test environment
    const originalPathJoin = path.join;
    const originalHomedir = os.homedir;
    path.join = jest.fn((...args) => args.join('/'));
    os.homedir = jest.fn(() => '/home/user');

    // Mock the computeExecutablePath function
    const computeExecutablePathMock = jest.fn(() => 'mockedExecutablePath');

    // Call the function
    const result = chromeExecPath(computeExecutablePathMock);

    // Restore the original modules
    path.join = originalPathJoin;
    os.homedir = originalHomedir;

    // Assertions
    expect(result).toBe('mockedExecutablePath');
    expect(computeExecutablePathMock).toHaveBeenCalledWith({
      cacheDir: '/home/user/.cache/puppeteer',
      browser: InstalledBrowser.CHROME,
      buildId: 'mockedRevision',
    });
  });
});
