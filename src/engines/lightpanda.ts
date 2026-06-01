import { spawn, spawnSync } from 'child_process';
import * as net from 'net';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import * as puppeteer from 'puppeteer-core';

/**
 * lightpanda (https://lightpanda.io) is a Zig + V8 DOM-only headless browser.
 * It exposes a Chrome DevTools Protocol WebSocket server, so puppeteer-core can
 * drive it as a drop-in replacement for Chromium during ACQUISITION (crawling).
 * It is dramatically lighter/faster but does NOT do layout/raster/PDF — so it is
 * used for acquire() only; render() always stays on Chromium.
 *
 * Hard-won integration notes (verified empirically against lightpanda nightly):
 *  - It does NOT settle `networkidle0`/`load`; navigation must wait for
 *    `domcontentloaded` (Docusaurus pre-renders content into the HTML).
 *  - `await page.close()` can hang (a `frame_loaded` CDP dispatch hits a broken
 *    pipe); callers must fire-and-forget closes.
 *  - One CDP connection serves exactly ONE page/target (a second
 *    `Target.createTarget` fails `TargetAlreadyLoaded`), so concurrency uses N
 *    connections, one page each — see LightpandaPagePool.
 */

/** How a connected browser should be driven during acquisition. */
export interface AcquireEngine {
  name: 'chromium' | 'lightpanda';
  /** Lifecycle event to wait for on page.goto. */
  waitUntil: puppeteer.PuppeteerLifeCycleEvent;
  /** page.goto timeout in ms (0 = no timeout, Chromium's behaviour). */
  gotoTimeout: number;
  /** Whether the engine supports request interception / page.authenticate. */
  supportsInterception: boolean;
  /** Don't await page.close() (avoids a lightpanda teardown hang). */
  fireAndForgetClose: boolean;
}

export const CHROMIUM_ENGINE: AcquireEngine = {
  name: 'chromium',
  waitUntil: 'networkidle0',
  gotoTimeout: 0,
  supportsInterception: true,
  fireAndForgetClose: false,
};

export const LIGHTPANDA_ENGINE: AcquireEngine = {
  name: 'lightpanda',
  waitUntil: 'domcontentloaded',
  gotoTimeout: 15000,
  supportsInterception: false,
  fireAndForgetClose: true,
};

/** A running lightpanda CDP server: its WS endpoint plus a cleanup function. */
export interface LightpandaHandle {
  wsEndpoint: string;
  cleanup: () => Promise<void>;
}

/* c8 ignore start */
/** Map the current platform to its lightpanda release asset, or null. */
export function lightpandaAssetName(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): string | null {
  if (platform === 'darwin' && arch === 'arm64')
    return 'lightpanda-aarch64-macos';
  if (platform === 'darwin' && arch === 'x64') return 'lightpanda-x86_64-macos';
  if (platform === 'linux' && arch === 'arm64')
    return 'lightpanda-aarch64-linux';
  if (platform === 'linux' && arch === 'x64') return 'lightpanda-x86_64-linux';
  return null; // Windows and musl/Alpine have no upstream binary -> fall back.
}

function cacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'docs-to-pdf', 'lightpanda');
}

/** A binary is usable if `<bin> version` exits 0 (catches musl/arch mismatch). */
function binaryWorks(bin: string): boolean {
  try {
    const r = spawnSync(bin, ['version'], { stdio: 'ignore', timeout: 10000 });
    return !r.error && r.status === 0;
  } catch {
    return false;
  }
}

function downloadTo(url: string, dest: string, redirects = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redirects > 6) {
      reject(new Error('too many redirects'));
      return;
    }
    const file = fs.createWriteStream(dest);
    https
      .get(url, { headers: { 'User-Agent': 'docs-to-pdf' } }, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          file.close();
          fs.rmSync(dest, { force: true });
          downloadTo(res.headers.location, dest, redirects + 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.rmSync(dest, { force: true });
          reject(new Error(`download HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        file.close();
        fs.rmSync(dest, { force: true });
        reject(err);
      });
  });
}

/**
 * Resolve a usable lightpanda binary path, auto-provisioning it on demand:
 * LIGHTPANDA_BIN -> `lightpanda` on PATH -> cached download -> download from
 * GitHub releases. Returns null (so callers fall back to Chromium) when the
 * platform is unsupported, downloads are disabled, or the binary won't run.
 */
export async function resolveLightpandaBinary(): Promise<string | null> {
  const envBin = process.env.LIGHTPANDA_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;
  if (binaryWorks('lightpanda')) return 'lightpanda';

  if (process.env.LIGHTPANDA_NO_DOWNLOAD) return null;

  const asset = lightpandaAssetName();
  if (!asset) {
    console.log(
      chalk.yellow(
        `[acquire] no lightpanda binary for ${process.platform}/${process.arch}`,
      ),
    );
    return null;
  }

  const dir = cacheDir();
  const cached = path.join(dir, asset);
  if (fs.existsSync(cached) && binaryWorks(cached)) return cached;

  const url =
    process.env.LIGHTPANDA_DOWNLOAD_URL ??
    `https://github.com/lightpanda-io/browser/releases/download/nightly/${asset}`;
  try {
    fs.mkdirSync(dir, { recursive: true });
    console.log(chalk.cyan(`[acquire] downloading lightpanda from ${url} ...`));
    const tmp = `${cached}.download`;
    await downloadTo(url, tmp);
    fs.chmodSync(tmp, 0o755);
    fs.renameSync(tmp, cached);
    if (binaryWorks(cached)) {
      console.log(chalk.green(`[acquire] lightpanda cached at ${cached}`));
      return cached;
    }
    console.log(
      chalk.yellow('[acquire] downloaded lightpanda did not run; ignoring'),
    );
    fs.rmSync(cached, { force: true });
  } catch (err) {
    console.log(
      chalk.yellow(
        `[acquire] lightpanda download failed: ${(err as Error).message}`,
      ),
    );
  }
  return null;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

function cdpReady(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error('lightpanda CDP server did not become ready in time'));
      } else {
        setTimeout(poll, 200);
      }
    };
    const poll = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/json/version', timeout: 1000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else retry();
        },
      );
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    poll();
  });
}

/**
 * Launch (or connect to) a lightpanda CDP server and return its WS endpoint.
 * If LIGHTPANDA_WS is set, use that existing endpoint; otherwise resolve a
 * binary (auto-provisioning if needed) and spawn `lightpanda serve` on a free
 * port. Throws if no binary is available or the server never starts — callers
 * should catch and fall back to Chromium.
 */
export async function launchLightpanda(): Promise<LightpandaHandle> {
  const existing = process.env.LIGHTPANDA_WS;
  if (existing) {
    return { wsEndpoint: existing, cleanup: async () => undefined };
  }

  const bin = await resolveLightpandaBinary();
  if (!bin) {
    throw new Error('no usable lightpanda binary');
  }

  const port = await getFreePort();
  const proc = spawn(
    bin,
    [
      'serve',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--cdp-max-connections',
      '64',
    ],
    { stdio: 'ignore' },
  );
  const spawnFailed = new Promise<never>((_, reject) => {
    proc.once('error', (err) => reject(err));
  });

  try {
    await Promise.race([cdpReady(port, 15000), spawnFailed]);
  } catch (err) {
    try {
      proc.kill('SIGKILL');
    } catch {
      // ignore
    }
    throw err;
  }

  console.debug(
    chalk.cyan(`[acquire] lightpanda CDP server on 127.0.0.1:${port}`),
  );
  return {
    wsEndpoint: `ws://127.0.0.1:${port}/`,
    cleanup: async () => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // already gone
      }
    },
  };
}
/* c8 ignore stop */
