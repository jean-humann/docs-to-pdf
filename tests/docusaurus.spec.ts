import {
  generateDocusaurusPDF,
  DocusaurusOptions,
} from '../src/provider/docusaurus'; // Update with the actual module path
import * as generatePDFModule from '../src/core'; // Import the actual generatePDF function

jest.mock('../src/core'); // Mock the generatePDF module

describe('generateDocusaurusPDF', () => {
  const core: generatePDFModule.GeneratePDFOptions = {
    initialDocURLs: ['https://example.com'],
    excludeURLs: ['https://example.com'],
    outputPDFFilename: 'docs-to-pdf.pdf',
    pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
    contentSelector: 'article',
    paginationSelector: 'a.pagination-nav__link.pagination-nav__link--next',
    paperFormat: 'A4',
    excludeSelectors: [
      '.margin-vert--xl a',
      "[class^='tocCollapsible']",
      '.breadcrumbs',
      '.theme-edit-this-page',
    ],
    cssStyle: '',
    puppeteerArgs: [],
    coverTitle: '',
    coverImage: '',
    disableTOC: false,
    coverSub: '',
    waitForRender: 0,
    headerTemplate: '',
    footerTemplate: '',
    protocolTimeout: 30000,
    filterKeyword: '',
    baseUrl: '',
    excludePaths: [],
    restrictPaths: false,
    openDetail: false,
  };

  it('should generate a PDF for Docusaurus version 2', async () => {
    const options: DocusaurusOptions = {
      version: 2,
      docsDir: 'path/to/docs',
      ...core,
    };

    const generatePDFMock = jest.spyOn(generatePDFModule, 'generatePDF');

    await generateDocusaurusPDF(options);

    expect(generatePDFMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paginationSelector: 'a.pagination-nav__link.pagination-nav__link--next',
        excludeSelectors: [
          '.margin-vert--xl a',
          "[class^='tocCollapsible']",
          '.breadcrumbs',
          '.theme-edit-this-page',
        ],
      }),
    );
  });

  it('should generate a PDF for Docusaurus version 1', async () => {
    const options: DocusaurusOptions = {
      version: 1,
      docsDir: 'path/to/docs',
      ...core,
      // ... other required properties for testing
    };

    const generatePDFMock = jest.spyOn(generatePDFModule, 'generatePDF');

    await generateDocusaurusPDF(options);

    expect(generatePDFMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paginationSelector: '.docs-prevnext > a.docs-next',
        excludeSelectors: [
          '.fixedHeaderContainer',
          'footer.nav-footer',
          '#docsNav',
          'nav.onPageNav',
          'a.edit-page-link',
          'div.docs-prevnext',
        ],

        // ... other expected properties for Docusaurus version 1
      }),
    );
  });

  it('should throw an error for unsupported Docusaurus version', async () => {
    const options: DocusaurusOptions = {
      version: 3, // Unsupported version
      docsDir: 'path/to/docs',
      ...core,
      // ... other required properties for testing
    };

    await expect(generateDocusaurusPDF(options)).rejects.toThrowError(
      'Unsupported Docusaurus version: 3',
    );
  });
});
