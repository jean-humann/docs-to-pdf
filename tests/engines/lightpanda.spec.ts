import {
  CHROMIUM_ENGINE,
  LIGHTPANDA_ENGINE,
  launchLightpanda,
} from '../../src/engines/lightpanda';
import { configurePage } from '../../src/acquire';
import * as puppeteer from 'puppeteer-core';

function fakePage() {
  return {
    authenticate: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  } as unknown as puppeteer.Page;
}

describe('AcquireEngine descriptors', () => {
  it('chromium: networkidle0, no timeout, interception, awaits close', () => {
    expect(CHROMIUM_ENGINE).toMatchObject({
      name: 'chromium',
      waitUntil: 'networkidle0',
      gotoTimeout: 0,
      supportsInterception: true,
      fireAndForgetClose: false,
    });
  });

  it('lightpanda: domcontentloaded, finite timeout, no interception, fire-and-forget close', () => {
    expect(LIGHTPANDA_ENGINE).toMatchObject({
      name: 'lightpanda',
      waitUntil: 'domcontentloaded',
      supportsInterception: false,
      fireAndForgetClose: true,
    });
    expect(LIGHTPANDA_ENGINE.gotoTimeout).toBeGreaterThan(0);
  });
});

describe('configurePage engine behaviour', () => {
  it('skips request interception for lightpanda', async () => {
    const page = fakePage();
    await configurePage(page, {}, LIGHTPANDA_ENGINE);
    expect(page.setRequestInterception).not.toHaveBeenCalled();
    expect(page.on).not.toHaveBeenCalled();
  });

  it('sets request interception for chromium (default engine)', async () => {
    const page = fakePage();
    await configurePage(page, {});
    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    expect(page.on).toHaveBeenCalledWith('request', expect.any(Function));
  });

  it('swallows a basic-auth failure for lightpanda (warns, resolves)', async () => {
    const page = fakePage();
    (page.authenticate as jest.Mock).mockRejectedValue(new Error('unsupported'));
    await expect(
      configurePage(
        page,
        { httpAuthUser: 'u', httpAuthPassword: 'p' },
        LIGHTPANDA_ENGINE,
      ),
    ).resolves.toBe(page);
  });

  it('rethrows a basic-auth failure for chromium', async () => {
    const page = fakePage();
    (page.authenticate as jest.Mock).mockRejectedValue(new Error('boom'));
    await expect(
      configurePage(page, { httpAuthUser: 'u', httpAuthPassword: 'p' }),
    ).rejects.toThrow('boom');
  });
});

describe('launchLightpanda', () => {
  it('rejects when the binary is missing (so acquire falls back to Chromium)', async () => {
    const prevBin = process.env.LIGHTPANDA_BIN;
    const prevWs = process.env.LIGHTPANDA_WS;
    delete process.env.LIGHTPANDA_WS;
    process.env.LIGHTPANDA_BIN = '/nonexistent/lightpanda-binary-xyz';
    try {
      await expect(launchLightpanda()).rejects.toThrow();
    } finally {
      if (prevBin === undefined) delete process.env.LIGHTPANDA_BIN;
      else process.env.LIGHTPANDA_BIN = prevBin;
      if (prevWs !== undefined) process.env.LIGHTPANDA_WS = prevWs;
    }
  }, 20000);
});
