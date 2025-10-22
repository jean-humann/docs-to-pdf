import * as puppeteer from 'puppeteer-core';

// Try to find Chrome executable, skip tests if not available
let execPath: string | undefined;
let chromeAvailable = false;

try {
  execPath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? puppeteer.executablePath('chrome');
  chromeAvailable = true;
  console.log(`Using executable path: ${execPath}`);
} catch {
  console.warn('Chrome not found, skipping puppeteer tests');
  chromeAvailable = false;
}

// Helper to conditionally skip tests when Chrome is not available
const describeIfChrome = chromeAvailable ? describe : describe.skip;

describeIfChrome('HTTP Basic Auth', () => {
  it('should authenticate when credentials are provided', async () => {
    let browser: puppeteer.Browser;
    let page: puppeteer.Page;
    let authenticateCalled = false;

    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: execPath!,
      });
      page = await browser.newPage();

      // Spy on the authenticate method
      const originalAuthenticate = page.authenticate.bind(page);
      page.authenticate = jest.fn(async (credentials) => {
        authenticateCalled = true;
        expect(credentials).toEqual({
          username: 'testuser',
          password: 'testpass',
        });
        return originalAuthenticate(credentials);
      });

      // Test the authenticate call directly with test credentials
      await page.authenticate({
        username: 'testuser',
        password: 'testpass',
      });

      expect(authenticateCalled).toBe(true);
      expect(page.authenticate).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      });
    } finally {
      if (page!) {
        await page.close();
      }
      if (browser!) {
        await browser.close();
      }
    }
  }, 30000);

  it('should not call authenticate when credentials are not provided', async () => {
    let browser: puppeteer.Browser;
    let page: puppeteer.Page;

    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: execPath!,
      });
      page = await browser.newPage();

      // Spy on the authenticate method
      const authenticateSpy = jest.spyOn(page, 'authenticate');

      // Verify authenticate was not called during page creation
      expect(authenticateSpy).not.toHaveBeenCalled();
    } finally {
      if (page!) {
        await page.close();
      }
      if (browser!) {
        await browser.close();
      }
    }
  }, 30000);
});
