import {
  generateDocusaurusPDF,
  DocusaurusOptions,
  startDocusaurusServer,
  stopDocusaurusServer,
  checkBuildDir,
  generateFromBuild,
  ServerInstance,
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
    tocTitle: 'Table of contents:',
    disableCover: false,
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

  it('should generate a PDF for Docusaurus version 3', async () => {
    const options: DocusaurusOptions = {
      version: 3,
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
        contentSelector: 'main',
      }),
    );
  });

  it('should throw an error for unsupported Docusaurus version', async () => {
    const options: DocusaurusOptions = {
      version: 4, // Unsupported version
      docsDir: 'path/to/docs',
      ...core,
      // ... other required properties for testing
    };

    await expect(generateDocusaurusPDF(options)).rejects.toThrowError(
      'Unsupported Docusaurus version: 4. Supported versions are 1, 2, and 3.',
    );
  });
});

describe('startDocusaurusServer', () => {
  console.debug('startDocusaurusServer');
  let serverInstance: ServerInstance;

  beforeAll(async () => {
    serverInstance = await startDocusaurusServer('tests/website/build', 3001);
  });

  afterAll(async () => {
    await stopDocusaurusServer(serverInstance);
  });

  it('should start server and return ServerInstance with valid port', async () => {
    expect(serverInstance).toBeDefined();
    expect(serverInstance.app).toBeDefined();
    expect(serverInstance.server).toBeDefined();
    expect(serverInstance.port).toBeGreaterThanOrEqual(3001);
  });

  it('should respond with status 200 for root URL', async () => {
    const response = await supertest(serverInstance.app).get('/');
    expect(response.status).toBe(200);
  });

  it('should respond with status 404 for non-existent URL', async () => {
    const response = await supertest(serverInstance.app).get('/non-existent');
    expect(response.status).toBe(404);
  });
});

describe('stopDocusaurusServer', () => {
  console.debug('stopDocusaurusServer');
  it('should stop the server successfully', async () => {
    const mockClose = jest.fn().mockImplementation((callback) => {
      callback();
    });
    const mockApp = {} as express.Express;
    const mockServer = { close: mockClose } as unknown as import('http').Server;
    const serverInstance: ServerInstance = {
      app: mockApp,
      server: mockServer,
      port: 3000,
    };

    await stopDocusaurusServer(serverInstance);

    expect(mockClose).toHaveBeenCalled();

    mockClose.mockRestore();
  });

  it('should throw an error if no server is provided', async () => {
    await expect(
      stopDocusaurusServer(null as unknown as ServerInstance),
    ).rejects.toThrow('No server to stop');
  });

  it('should throw an error if server close fails', async () => {
    const mockClose = jest.fn().mockImplementation((callback) => {
      callback(new Error('Close failed'));
    });
    const mockApp = {} as express.Express;
    const mockServer = { close: mockClose } as unknown as import('http').Server;
    const serverInstance: ServerInstance = {
      app: mockApp,
      server: mockServer,
      port: 3000,
    };

    await expect(stopDocusaurusServer(serverInstance)).rejects.toThrow(
      'Failed to stop server: Close failed',
    );
  });
});

describe('checkBuildDir', () => {
  console.debug('checkBuildDir');
  it('should not throw an error if the build directory exists', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    mockStat.mockResolvedValue({ isDirectory: () => true } as fs.Stats);

    await expect(
      checkBuildDir('/path/to/valid/buildDir'),
    ).resolves.not.toThrow();

    mockStat.mockRestore();
  });

  it('should throw an error if the build directory does not exist', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    const error: NodeJS.ErrnoException = new Error('Directory not found');
    error.code = 'ENOENT';
    mockStat.mockRejectedValue(error);

    await expect(
      checkBuildDir('/path/to/nonexistent/buildDir'),
    ).rejects.toThrow(
      'Could not find docusaurus build directory at "/path/to/nonexistent/buildDir". Have you run "docusaurus build"?',
    );

    mockStat.mockRestore();
  });

  it('should throw an error if the build directory is not a directory', async () => {
    const mockStat = jest.spyOn(fs.promises, 'stat');
    mockStat.mockResolvedValue({ isDirectory: () => false } as fs.Stats);

    await expect(checkBuildDir('/path/to/file/notDirectory')).rejects.toThrow(
      '/path/to/file/notDirectory is not a docusaurus build directory.',
    );

    mockStat.mockRestore();
  });
});

describe('generateFromBuild', () => {
  console.debug('generateFromBuild');

  // Kill all listening servers before each test
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const core: generatePDFModule.GeneratePDFOptions = {
    initialDocURLs: [
      'https://example.com/docs/intro',
      'https://example.com/docs/next',
    ],
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
    tocTitle: 'Table of contents:',
    disableCover: false,
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
        initialDocURLs: expect.arrayContaining([
          expect.stringContaining('http://127.0.0.1:'),
        ]),
      }),
    );

    // Verify the URL path is preserved
    const callArgs = mockGeneratePDF.mock.calls[0][0];
    expect(callArgs.initialDocURLs[0]).toMatch(
      /http:\/\/127\.0\.0\.1:\d+\/docs\/intro/,
    );

    mockGeneratePDF.mockRestore();
  });
});
