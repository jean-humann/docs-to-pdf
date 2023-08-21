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
  console.debug(core);
  await generatePDF(core);
}
