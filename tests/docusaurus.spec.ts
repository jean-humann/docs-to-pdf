import {
  generateDocusaurusPDF,
  DocusaurusOptions,
  startDocusaurusServer,
  stopDocusaurusServer,
  checkBuildDir,
  generateFromBuild,
} from '../src/provider/docusaurus'; // Update with the actual module path
import * as generatePDFModule from '../src/core'; // Import the actual generatePDF function
import express from 'express';
import supertest from 'supertest';
import fs from 'fs-extra';

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
  console.debug('startDocusaurusServer')
  let server: express.Express;

  beforeAll(async () => {
    server = await startDocusaurusServer('tests/website/build', 3001);
  });

  afterAll(async () => {
    await stopDocusaurusServer(server);
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
  console.debug('stopDocusaurusServer')
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

    mockListen.mockRestore();
    mockClose.mockRestore();
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



describe('checkBuildDir', () => {
  console.debug('checkBuildDir')
  it('should not throw an error if the build directory exists', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    mockStat.mockResolvedValue({ isDirectory: () => true } as fs.Stats);

    await expect(checkBuildDir('/path/to/valid/buildDir')).resolves.not.toThrow();
    
    mockStat.mockRestore();
  });

  it('should throw an error if the build directory does not exist', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    mockStat.mockRejectedValue(new Error('Directory not found'));

    await expect(checkBuildDir('/path/to/nonexistent/buildDir')).rejects.toThrow(
      'Could not find docusaurus build directory at "/path/to/nonexistent/buildDir". Have you run "docusaurus build"?'
    );

    mockStat.mockRestore();
  });

  it('should throw an error if the build directory is not a directory', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    mockStat.mockResolvedValue({ isDirectory: () => false } as fs.Stats);

    await expect(checkBuildDir('/path/to/file/notDirectory')).rejects.toThrow(
      '/path/to/file/notDirectory is not a docusaurus build directory.'
    );

    mockStat.mockRestore();
  });
});


describe('generateFromBuild', () => {
  console.debug('generateFromBuild')

  // Kill all listening servers before each test
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const core: generatePDFModule.GeneratePDFOptions = {
    initialDocURLs: ['https://example.com/docs/intro', 'https://example.com/docs/next'],
    excludeURLs: [],
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

  it('should generate a PDF from a Docusaurus build directory', async () => {
    const mockGeneratePDF = jest.spyOn(generatePDFModule, 'generatePDF');
    mockGeneratePDF.mockResolvedValue();


    await generateFromBuild('tests/website/build', core);

    expect(mockGeneratePDF).toHaveBeenCalledWith(
      expect.objectContaining({
        initialDocURLs: ['http://127.0.0.1:3000/docs/intro'],
      }),
    );

    mockGeneratePDF.mockRestore();
  }
  );



});
