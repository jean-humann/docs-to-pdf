import { GeneratePDFOptions, generatePDF } from '../core';
import express from 'express';
import * as fs from 'fs';
import path from 'path';
import * as http from 'http';

export interface DocusaurusOptions extends GeneratePDFOptions {
  version: number;
  docsDir: string;
}

export interface ServerInstance {
  app: express.Express;
  server: http.Server;
  port: number;
}

export async function generateDocusaurusPDF(
  options: DocusaurusOptions,
): Promise<void> {
  const { version, docsDir, ...core } = options;
  console.debug(`Docusaurus version: ${version}`);
  console.debug(`Docs directory: ${docsDir}`);
  core.contentSelector = 'article';

  // Pagination and exclude selectors are different depending on Docusaurus version
  if (version === 1) {
    console.debug('Docusaurus version 1');
    core.paginationSelector = '.docs-prevnext > a.docs-next';
    core.excludeSelectors = [
      '.fixedHeaderContainer',
      'footer.nav-footer',
      '#docsNav',
      'nav.onPageNav',
      'a.edit-page-link',
      'div.docs-prevnext',
    ];
    core.cssStyle = `
      .navPusher {padding-top: 0;}
      `;
  } else if (version === 2 || version === 3) {
    console.debug(`Docusaurus version ${version}`);
    // Docusaurus v2 and v3 use the same selectors
    core.paginationSelector =
      'a.pagination-nav__link.pagination-nav__link--next';
    core.excludeSelectors = [
      '.margin-vert--xl a',
      "[class^='tocCollapsible']",
      '.breadcrumbs',
      '.theme-edit-this-page',
    ];
  } else {
    console.error(`Unsupported Docusaurus version: ${version}`);
    throw new Error(`Unsupported Docusaurus version: ${version}. Supported versions are 1, 2, and 3.`);
  }
  if (docsDir) {
    await generateFromBuild(docsDir, core);
  } else {
    await generatePDF(core);
  }
}

/**
 * Find an available port starting from the given port
 * @param {number} startPort - port to start searching from
 * @param {number} maxAttempts - maximum number of ports to try (default: 10)
 * @returns {Promise<number>} - available port number
 */
async function findAvailablePort(
  startPort = 3000,
  maxAttempts = 10,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    try {
      await new Promise<void>((resolve, reject) => {
        const testServer = http.createServer();
        testServer.once('error', reject);
        testServer.once('listening', () => {
          testServer.close(() => resolve());
        });
        testServer.listen(port, '127.0.0.1');
      });
      return port;
    } catch (err) {
      // Port is in use, try next one
      continue;
    }
  }
  throw new Error(
    `Could not find available port after trying ${maxAttempts} ports starting from ${startPort}`,
  );
}

/**
 * Start Docusaurus Server from build directory
 * @param {string} buildDir - Docusaurus build directory
 * @param {number} port - port to start server on (default: 3000, will auto-increment if occupied)
 * @returns {Promise<ServerInstance>} - server instance with app, server, and port
 */
export async function startDocusaurusServer(
  buildDirPath: string,
  port = 3000,
): Promise<ServerInstance> {
  const app = express();
  // Disable X-Powered-By header for security
  app.disable('x-powered-by');
  const dirPath = path.resolve(buildDirPath);
  app.use(express.static(dirPath));

  // Find available port
  const availablePort = await findAvailablePort(port);

  return new Promise((resolve, reject) => {
    const server = app.listen(availablePort, '127.0.0.1', () => {
      console.log(
        `Docusaurus server listening at http://127.0.0.1:${availablePort}`,
      );
      resolve({ app, server, port: availablePort });
    });

    server.once('error', (err) => {
      reject(
        new Error(`Failed to start Docusaurus server: ${err.message}`),
      );
    });
  });
}

/**
 * Stop Docusaurus Server
 * @param {ServerInstance} serverInstance - server instance returned from startDocusaurusServer
 * @returns {Promise<void>}
 * @throws {Error} - if server instance is invalid
 */
export async function stopDocusaurusServer(
  serverInstance: ServerInstance,
): Promise<void> {
  if (!serverInstance || !serverInstance.server) {
    throw new Error('No server to stop');
  }

  return new Promise<void>((resolve, reject) => {
    serverInstance.server.close((err) => {
      if (err) {
        reject(new Error(`Failed to stop server: ${err.message}`));
      } else {
        console.log('Docusaurus server stopped');
        resolve();
      }
    });
  });
}

/**
 * Check build directory
 * @param {string} buildDirPath - Docusaurus build directory
 * @returns {Promise<void>}
 * @throws {Error} - if build directory does not exist
 */
export async function checkBuildDir(buildDirPath: string): Promise<void> {
  try {
    const buildDirStat = await fs.promises.stat(buildDirPath);
    if (!buildDirStat.isDirectory()) {
      throw new Error(`${buildDirPath} is not a docusaurus build directory.`);
    }
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        `Could not find docusaurus build directory at "${buildDirPath}". ` +
          'Have you run "docusaurus build"?',
      );
    }
    throw error;
  }
}

/**
 * Generate PDF from Docusaurus build directory
 * @param {string} buildDirPath - Docusaurus build directory
 * @param {GeneratePDFOptions} options - PDF generation options
 * @returns {Promise<void>}
 */
export async function generateFromBuild(
  buildDirPath: string,
  options: GeneratePDFOptions,
): Promise<void> {
  await checkBuildDir(buildDirPath);

  const serverInstance = await startDocusaurusServer(buildDirPath);

  try {
    const urlPath = new URL(options.initialDocURLs[0]).pathname;
    options.initialDocURLs = [`http://127.0.0.1:${serverInstance.port}${urlPath}`];
    await generatePDF(options);
  } finally {
    // Always stop the server, even if PDF generation fails
    console.log('Stopping server');
    try {
      await stopDocusaurusServer(serverInstance);
    } catch (err) {
      console.error('Failed to stop server:', err);
      // Don't throw here, as we want to preserve the original error if PDF generation failed
    }
  }
}
