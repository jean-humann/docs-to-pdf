import {
  generateDocusaurusPDF,
  DocusaurusOptions,
  startDocusaurusServer,
  stopDocusaurusServer,
} from '../src/provider/docusaurus'; // Update with the actual module path
import * as generatePDFModule from '../src/core'; // Import the actual generatePDF function
import express from 'express';
import supertest from 'supertest';

jest.mock('../src/core'); // Mock the generatePDF module

describe('generateDocusaurusPDF', () => {
  const core: generatePDFModule.GeneratePDFOptions = {
    initialDocURLs: ['https://example.com'],
    excludeURLs: ['https://example.com'],
    outputPDFFilename: 'docs-to-pdf.pdf',
    pdfMargin: { top: 32, right: 32, bottom: 32, left: 32 },
    contentSelector: '',
    paginationSelector: '',
    paperFormat: 'A4',
    excludeSelectors: [],
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
      docsDir: '',
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
        contentSelector: 'article',
      }),
    );
  });

  it('should generate a PDF for Docusaurus version 1', async () => {
    const options: DocusaurusOptions = {
      version: 1,
      docsDir: '',
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
        contentSelector: 'article',
        // ... other expected properties for Docusaurus version 1
      }),
    );
    expect(generatePDFMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cssStyle: `
      .navPusher {padding-top: 0;}
      `,
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

describe('startDocusaurusServer', () => {
  let server: express.Express;

  beforeAll(async () => {
    server = await startDocusaurusServer('../examples/website/build');
  });

  afterAll(() => {
    server.listen().close();
  });

  it('should respond with status 200 for root URL', async () => {
    const response = await supertest(server).get('/');
    expect(response.status).toBe(200);
  });

  it('should respond with status 404 for non-existent URL', async () => {
    const response = await supertest(server).get('/non-existent');
    expect(response.status).toBe(404);
  });
});

describe('stopDocusaurusServer', () => {
  it('should stop the server successfully', async () => {
    const mockClose = jest.fn().mockImplementation((callback) => {
      callback();
    });
    const mockListen = jest.fn().mockReturnValue({ close: mockClose });
    const mockApp = {
      listen: mockListen,
    } as unknown as express.Express;

    await stopDocusaurusServer(mockApp);

    expect(mockListen).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('should throw an error if no server is provided', async () => {
    await expect(stopDocusaurusServer(null as any)).rejects.toThrow(
      'No server to stop'
    );
  });

  it('should throw an error if provided server is not a Docusaurus server', async () => {
    const mockApp = {} as unknown as express.Express;
    await expect(stopDocusaurusServer(mockApp)).rejects.toThrow(
      'Server is not a docusaurus server'
    );
  });
});
