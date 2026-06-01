import {
  CHROMIUM_ENGINE,
  LIGHTPANDA_ENGINE,
  launchLightpanda,
  lightpandaAssetName,
  resolveLightpandaBinary,
} from '../../src/engines/lightpanda';
import { configurePage, keptFromExtract } from '../../src/acquire';
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

  it('lightpanda: domcontentloaded, finite timeout, no interception, fire-and-forget close, batched', () => {
    expect(LIGHTPANDA_ENGINE).toMatchObject({
      name: 'lightpanda',
      waitUntil: 'domcontentloaded',
      supportsInterception: false,
      fireAndForgetClose: true,
      batchExtract: true,
    });
    expect(LIGHTPANDA_ENGINE.gotoTimeout).toBeGreaterThan(0);
  });

  it('chromium does not batch-extract (preserves click-based openDetails)', () => {
    expect(CHROMIUM_ENGINE.batchExtract).toBe(false);
  });
});

describe('keptFromExtract (pure keep/drop mirroring isPageKept)', () => {
  const U = 'http://x/docs/page';
  it('keeps a normal page', () => {
    expect(keptFromExtract(U, '/docs', [], '', [], false, null)).toBe(true);
  });
  it('drops excludeURLs', () => {
    expect(keptFromExtract(U, '/docs', [U], '', [], false, null)).toBe(false);
  });
  it('drops when filterKeyword set but no meta keywords', () => {
    expect(keptFromExtract(U, '/docs', [], 'api', [], false, null)).toBe(false);
  });
  it('keeps when filterKeyword present in meta keywords', () => {
    expect(
      keptFromExtract(U, '/docs', [], 'api', [], false, 'guide,api,ref'),
    ).toBe(true);
  });
  it('drops when filterKeyword absent from meta keywords', () => {
    expect(keptFromExtract(U, '/docs', [], 'api', [], false, 'guide,ref')).toBe(
      false,
    );
  });
  it('drops excludePaths match', () => {
    expect(keptFromExtract(U, '/docs', [], '', ['/page'], false, null)).toBe(
      false,
    );
  });
  it('drops restrictPaths violation, keeps when within', () => {
    expect(keptFromExtract(U, '/other', [], '', [], true, null)).toBe(false);
    expect(keptFromExtract(U, '/docs', [], '', [], true, null)).toBe(true);
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
    (page.authenticate as jest.Mock).mockRejectedValue(
      new Error('unsupported'),
    );
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

describe('lightpandaAssetName', () => {
  it('maps supported platforms to release assets', () => {
    expect(lightpandaAssetName('darwin', 'arm64')).toBe(
      'lightpanda-aarch64-macos',
    );
    expect(lightpandaAssetName('darwin', 'x64')).toBe(
      'lightpanda-x86_64-macos',
    );
    expect(lightpandaAssetName('linux', 'arm64')).toBe(
      'lightpanda-aarch64-linux',
    );
    expect(lightpandaAssetName('linux', 'x64')).toBe('lightpanda-x86_64-linux');
  });

  it('returns null for unsupported platforms (Windows)', () => {
    expect(lightpandaAssetName('win32', 'x64')).toBeNull();
  });
});

describe('resolveLightpandaBinary', () => {
  const saved = {
    bin: process.env.LIGHTPANDA_BIN,
    nodl: process.env.LIGHTPANDA_NO_DOWNLOAD,
  };
  afterEach(() => {
    if (saved.bin === undefined) delete process.env.LIGHTPANDA_BIN;
    else process.env.LIGHTPANDA_BIN = saved.bin;
    if (saved.nodl === undefined) delete process.env.LIGHTPANDA_NO_DOWNLOAD;
    else process.env.LIGHTPANDA_NO_DOWNLOAD = saved.nodl;
  });

  it('returns null without downloading when nothing is available and downloads are disabled', async () => {
    process.env.LIGHTPANDA_BIN = '/nonexistent/lightpanda-binary-xyz';
    process.env.LIGHTPANDA_NO_DOWNLOAD = '1';
    await expect(resolveLightpandaBinary()).resolves.toBeNull();
  }, 20000);
});

describe('launchLightpanda', () => {
  it('rejects when no binary is available (so acquire falls back to Chromium)', async () => {
    const prevBin = process.env.LIGHTPANDA_BIN;
    const prevWs = process.env.LIGHTPANDA_WS;
    const prevNodl = process.env.LIGHTPANDA_NO_DOWNLOAD;
    delete process.env.LIGHTPANDA_WS;
    process.env.LIGHTPANDA_BIN = '/nonexistent/lightpanda-binary-xyz';
    process.env.LIGHTPANDA_NO_DOWNLOAD = '1'; // don't hit the network in tests
    try {
      await expect(launchLightpanda()).rejects.toThrow();
    } finally {
      if (prevBin === undefined) delete process.env.LIGHTPANDA_BIN;
      else process.env.LIGHTPANDA_BIN = prevBin;
      if (prevWs !== undefined) process.env.LIGHTPANDA_WS = prevWs;
      if (prevNodl === undefined) delete process.env.LIGHTPANDA_NO_DOWNLOAD;
      else process.env.LIGHTPANDA_NO_DOWNLOAD = prevNodl;
    }
  }, 20000);
});
