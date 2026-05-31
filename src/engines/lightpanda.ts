import { spawn } from 'child_process';
import * as net from 'net';
import * as http from 'http';
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
 *    `domcontentloaded` (Docusaurus pre-renders content into the HTML, so the
 *    extracted content matches Chromium).
 *  - `await page.close()` can hang (a `frame_loaded` CDP dispatch hits a broken
 *    pipe); callers must fire-and-forget closes. The page pool reuses pages, so
 *    this only matters at teardown.
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

/** A connected lightpanda browser plus a cleanup that disconnects + kills it. */
export interface LightpandaHandle {
  browser: puppeteer.Browser;
  cleanup: () => Promise<void>;
}

/* c8 ignore start */
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
    const poll = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/json/version', timeout: 1000 },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        },
      );
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        reject(new Error('lightpanda CDP server did not become ready in time'));
      } else {
        setTimeout(poll, 200);
      }
    };
    poll();
  });
}

/**
 * Launch (or connect to) a lightpanda CDP server and return a connected
 * puppeteer Browser. If LIGHTPANDA_WS is set, connect to that existing endpoint;
 * otherwise spawn `${LIGHTPANDA_BIN|'lightpanda'} serve` on a free port. Throws
 * if the binary is missing or the server never becomes ready — callers should
 * catch and fall back to Chromium.
 */
export async function launchLightpanda(): Promise<LightpandaHandle> {
  const existing = process.env.LIGHTPANDA_WS;
  if (existing) {
    const browser = await puppeteer.connect({ browserWSEndpoint: existing });
    return {
      browser,
      cleanup: async () => {
        await browser.disconnect().catch(() => undefined);
      },
    };
  }

  const bin = process.env.LIGHTPANDA_BIN ?? 'lightpanda';
  const port = await getFreePort();
  const proc = spawn(
    bin,
    ['serve', '--host', '127.0.0.1', '--port', String(port)],
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

  const browser = await puppeteer.connect({
    browserWSEndpoint: `ws://127.0.0.1:${port}/`,
  });
  console.debug(
    chalk.cyan(`[acquire] lightpanda CDP server on 127.0.0.1:${port}`),
  );

  return {
    browser,
    cleanup: async () => {
      await browser.disconnect().catch(() => undefined);
      try {
        proc.kill('SIGKILL');
      } catch {
        // already gone
      }
    },
  };
}
/* c8 ignore stop */
