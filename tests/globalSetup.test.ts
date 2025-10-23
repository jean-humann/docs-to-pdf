import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import globalSetup from './globalSetup';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockExistsSync = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>;
const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

describe('globalSetup', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('when build directory does not exist', () => {
    it('should build the test website from scratch', async () => {
      mockExistsSync.mockReturnValue(false);

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith('Setting up test website...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Installing dependencies for test website...',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('Building test website...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Test website built successfully',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
      expect(mockExecSync).toHaveBeenCalledWith(
        'yarn install',
        expect.any(Object),
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'yarn build',
        expect.any(Object),
      );
    });
  });

  describe('when build directory exists and is recent', () => {
    it('should skip rebuild if build is less than 5 minutes old', async () => {
      const recentTime = Date.now() - 2 * 60 * 1000; // 2 minutes ago
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: recentTime,
      } as fs.Stats);

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith('Setting up test website...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Test website build is recent, skipping rebuild',
      );
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should rebuild if build is older than 5 minutes', async () => {
      const oldTime = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: oldTime,
      } as fs.Stats);

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith('Setting up test website...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Installing dependencies for test website...',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('when build directory exists but is incomplete', () => {
    it('should rebuild if index.html is missing', async () => {
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath) {
          return true; // Build dir exists
        }
        if (filepath === indexPath) {
          return false; // But index.html is missing
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: Date.now(),
      } as fs.Stats);

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Build directory exists but appears incomplete, rebuilding...',
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Installing dependencies for test website...',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('when build directory exists but is not a directory', () => {
    it('should rebuild if path is a file instead of directory', async () => {
      const buildPath = path.join(__dirname, 'website', 'build');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath) {
          return true; // Path exists
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => false, // But it's not a directory
        mtimeMs: Date.now(),
      } as fs.Stats);

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith('Setting up test website...');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Installing dependencies for test website...',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(false);
    });

    it('should throw meaningful error when yarn install fails', async () => {
      const installError = new Error('yarn install failed: network timeout');
      mockExecSync.mockImplementation((command) => {
        if (command === 'yarn install') {
          throw installError;
        }
        return Buffer.from('');
      });

      await expect(globalSetup()).rejects.toThrow(
        'Could not build test website. Tests require a built Docusaurus site. Original error: yarn install failed: network timeout',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to build test website:',
        installError,
      );
    });

    it('should throw meaningful error when yarn build fails', async () => {
      const buildError = new Error('Build failed: syntax error in config');
      mockExecSync.mockImplementation((command) => {
        if (command === 'yarn install') {
          return Buffer.from('');
        }
        if (command === 'yarn build') {
          throw buildError;
        }
        return Buffer.from('');
      });

      await expect(globalSetup()).rejects.toThrow(
        'Could not build test website. Tests require a built Docusaurus site. Original error: Build failed: syntax error in config',
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to build test website:',
        buildError,
      );
    });

    it('should handle non-Error thrown values', async () => {
      const stringError = 'Some random string error';
      mockExecSync.mockImplementation(() => {
        throw stringError;
      });

      await expect(globalSetup()).rejects.toThrow(
        'Could not build test website. Tests require a built Docusaurus site. Original error: Some random string error',
      );
    });

    it('should handle unknown error types', async () => {
      const objectError = { code: 'ENOENT', message: 'file not found' };
      mockExecSync.mockImplementation(() => {
        throw objectError;
      });

      await expect(globalSetup()).rejects.toThrow(
        'Could not build test website. Tests require a built Docusaurus site. Original error: [object Object]',
      );
    });
  });

  describe('caching threshold behavior', () => {
    it('should rebuild at exactly 5 minutes (default threshold)', async () => {
      const exactlyFiveMinutes = Date.now() - 5 * 60 * 1000;
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: exactlyFiveMinutes,
      } as fs.Stats);

      mockExecSync.mockReturnValue(Buffer.from(''));

      await globalSetup();

      // At exactly 5 minutes, should rebuild (age >= threshold)
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should skip rebuild at 4.9 minutes (default threshold)', async () => {
      const justUnderFiveMinutes = Date.now() - 4.9 * 60 * 1000;
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: justUnderFiveMinutes,
      } as fs.Stats);

      await globalSetup();

      // Just under 5 minutes should skip rebuild
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Test website build is recent, skipping rebuild',
      );
    });

    it('should respect REBUILD_THRESHOLD_MINUTES environment variable', async () => {
      const originalEnv = process.env.REBUILD_THRESHOLD_MINUTES;
      process.env.REBUILD_THRESHOLD_MINUTES = '10';

      const eightMinutesOld = Date.now() - 8 * 60 * 1000;
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: eightMinutesOld,
      } as fs.Stats);

      await globalSetup();

      // 8 minutes is less than custom 10 minute threshold, should skip
      expect(mockExecSync).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Test website build is recent, skipping rebuild',
      );

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.REBUILD_THRESHOLD_MINUTES = originalEnv;
      } else {
        delete process.env.REBUILD_THRESHOLD_MINUTES;
      }
    });

    it('should rebuild when age exceeds custom threshold', async () => {
      const originalEnv = process.env.REBUILD_THRESHOLD_MINUTES;
      process.env.REBUILD_THRESHOLD_MINUTES = '10';

      const elevenMinutesOld = Date.now() - 11 * 60 * 1000;
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: elevenMinutesOld,
      } as fs.Stats);

      mockExecSync.mockReturnValue(Buffer.from(''));

      await globalSetup();

      // 11 minutes exceeds custom 10 minute threshold, should rebuild
      expect(mockExecSync).toHaveBeenCalled();

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.REBUILD_THRESHOLD_MINUTES = originalEnv;
      } else {
        delete process.env.REBUILD_THRESHOLD_MINUTES;
      }
    });

    it('should use default threshold for invalid env var values', async () => {
      const originalEnv = process.env.REBUILD_THRESHOLD_MINUTES;
      process.env.REBUILD_THRESHOLD_MINUTES = 'invalid';

      const fourMinutesOld = Date.now() - 4 * 60 * 1000;
      const buildPath = path.join(__dirname, 'website', 'build');
      const indexPath = path.join(buildPath, 'index.html');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath || filepath === indexPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockReturnValue({
        isDirectory: () => true,
        mtimeMs: fourMinutesOld,
      } as fs.Stats);

      await globalSetup();

      // NaN from parseInt('invalid') should result in using default behavior
      // 4 minutes should skip with default 5 minute threshold
      expect(mockExecSync).not.toHaveBeenCalled();

      // Restore original env
      if (originalEnv !== undefined) {
        process.env.REBUILD_THRESHOLD_MINUTES = originalEnv;
      } else {
        delete process.env.REBUILD_THRESHOLD_MINUTES;
      }
    });
  });

  describe('working directory configuration', () => {
    it('should execute commands in the website directory', async () => {
      mockExistsSync.mockReturnValue(false);
      mockExecSync.mockReturnValue(Buffer.from(''));

      await globalSetup();

      const websitePath = path.join(__dirname, 'website');
      expect(mockExecSync).toHaveBeenCalledWith('yarn install', {
        cwd: websitePath,
        stdio: 'inherit',
      });
      expect(mockExecSync).toHaveBeenCalledWith('yarn build', {
        cwd: websitePath,
        stdio: 'inherit',
      });
    });
  });

  describe('race condition handling', () => {
    it('should rebuild if statSync fails due to race condition', async () => {
      const buildPath = path.join(__dirname, 'website', 'build');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath) {
          return true; // Directory exists when checked
        }
        return false;
      });

      // Simulate race condition: directory deleted/modified between existsSync and statSync
      mockStatSync.mockImplementation(() => {
        const error: NodeJS.ErrnoException = new Error(
          'ENOENT: no such file or directory',
        );
        error.code = 'ENOENT';
        throw error;
      });

      mockExecSync.mockReturnValue(Buffer.from(''));

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Build directory check failed, rebuilding...',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });

    it('should rebuild if statSync fails due to permissions', async () => {
      const buildPath = path.join(__dirname, 'website', 'build');

      mockExistsSync.mockImplementation((filepath) => {
        if (filepath === buildPath) {
          return true;
        }
        return false;
      });

      mockStatSync.mockImplementation(() => {
        const error: NodeJS.ErrnoException = new Error(
          'EACCES: permission denied',
        );
        error.code = 'EACCES';
        throw error;
      });

      mockExecSync.mockReturnValue(Buffer.from(''));

      await globalSetup();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Build directory check failed, rebuilding...',
      );
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });
});
