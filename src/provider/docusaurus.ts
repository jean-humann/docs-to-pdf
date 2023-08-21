import { GeneratePDFOptions, generatePDF } from '../core';

export interface DocusaurusOptions extends GeneratePDFOptions {
  version: number;
  docsDir: string;
}

export async function generateDocusaurusPDF(
  options: DocusaurusOptions,
): Promise<void> {
  const { version, docsDir, ...core } = options;
  console.log(`Docusaurus version: ${version}`);
  console.log(`Docs directory: ${docsDir}`);
  core.contentSelector = 'article';
  core.paginationSelector = 'a.pagination-nav__link.pagination-nav__link--next';
  core.excludeSelectors = [
    '.margin-vert--xl a',
    "[class^='tocCollapsible']",
    '.breadcrumbs',
    '.theme-edit-this-page',
  ];
  await generatePDF(core);
}
