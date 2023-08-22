import { GeneratePDFOptions, generatePDF } from '../core';
import express from 'express';
import * as fs from 'fs';
import path from 'path';

export interface DocusaurusOptions extends GeneratePDFOptions {
  version: number;
  docsDir: string;
}

export async function generateDocusaurusPDF(
  options: DocusaurusOptions,
): Promise<void> {
  const { version, docsDir, ...core } = options;
  console.debug(`Docusaurus version: ${version}`);
  console.debug(`Docs directory: ${docsDir}`);
  core.contentSelector = 'article';

  // Pagination and exclude selectors are different depending on Docusaurus version
  if (version == 2) {
    console.debug('Docusaurus version 2');
    core.paginationSelector =
      'a.pagination-nav__link.pagination-nav__link--next';
    core.excludeSelectors = [
      '.margin-vert--xl a',
      "[class^='tocCollapsible']",
      '.breadcrumbs',
      '.theme-edit-this-page',
    ];
  } else if (version == 1) {
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
  } else {
    console.error(`Unsupported Docusaurus version: ${version}`);
    throw new Error(`Unsupported Docusaurus version: ${version}`);
  }
  if (docsDir) {
    await generateFromBuild(docsDir, core);
  } else {
    await generatePDF(core);
  }
}


/** 
 * Start Docusaurus Server from build directory
 * @param {string} buildDir - Docusaurus build directory
 * @param {number} port - port to start server on (default: 3000)
 * @returns {Promise<express.Express>} - express server
 */
export async function startDocusaurusServer(
  buildDirPath: string,
  port: number = 3000,
): Promise<express.Express> {
  const app = express();
  const dirPath = path.resolve(buildDirPath);
  app.use(express.static(dirPath));
  app.listen(port, () => {
    console.log(`Docusaurus server listening at http://localhost:${port}`);
  });
  return app;
}

/**
 * Stop Docusaurus Server
 * @param {express.Express} app - express server
 * @returns {Promise<void>}
 * @throws {Error} - if server is not running
 * @throws {Error} - if server is not an express server
 */
export async function stopDocusaurusServer(
  app: express.Express,
): Promise<void> {
  if (!app) {
    throw new Error('No server to stop');
  }
  try {
    var httpServer = app.listen();
    await httpServer.close(
      () => console.log('Docusaurus server stopped')
    );
  }
  catch{
    throw new Error('Server is not a docusaurus server');
  }
  
}

/**
 * Check build directory
 * @param {string} buildDirPath - Docusaurus build directory
 * @returns {Promise<void>}
 * @throws {Error} - if build directory does not exist
*/
export async function checkBuildDir(
  buildDirPath: string,
): Promise<void> {
let buildDirStat;
  try {
    buildDirStat = await fs.promises.stat(buildDirPath);
  } catch (error) {
    throw new Error(
      `Could not find docusaurus build directory at "${buildDirPath}". ` +
        'Have you run "docusaurus build"?'
    );
  }
  if (!buildDirStat.isDirectory()) {
    throw new Error(`${buildDirPath} is not a docusaurus build directory.`);
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
  const app = await startDocusaurusServer(buildDirPath);
  const urlPath = new URL(options.initialDocURLs[0]).pathname 
  options.initialDocURLs = [`http://127.0.0.1:3000${urlPath}`];
  await generatePDF(options);
  console.log('Stopping server');
  await stopDocusaurusServer(app);
}
