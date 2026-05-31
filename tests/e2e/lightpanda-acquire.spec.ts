import * as fs from 'fs';
import { acquire } from '../../src/acquire';
import { AcquireIR } from '../../src/ir';
import {
  startFixture,
  stopDocusaurusServer,
  v3Options,
  ServerInstance,
} from '../helpers/fixtureServer';

/**
 * Gated on a configured lightpanda binary (LIGHTPANDA_BIN or LIGHTPANDA_WS),
 * mirroring the describeIfChrome pattern — skips cleanly in CI and for anyone
 * without lightpanda installed. Verifies the opt-in lightpanda acquire engine
 * crawls the real fixture and extracts content.
 */
const lightpandaAvailable =
  (!!process.env.LIGHTPANDA_BIN && fs.existsSync(process.env.LIGHTPANDA_BIN)) ||
  !!process.env.LIGHTPANDA_WS;
const describeIfLightpanda = lightpandaAvailable ? describe : describe.skip;

describeIfLightpanda('Phase 1 e2e: lightpanda acquire engine', () => {
  let server: ServerInstance;
  let introURL: string;

  beforeAll(async () => {
    server = await startFixture();
    introURL = `http://127.0.0.1:${server.port}/docs/intro`;
  }, 120000);

  afterAll(async () => {
    if (server) await stopDocusaurusServer(server);
  });

  it('crawls the fixture via lightpanda and extracts non-empty content', async () => {
    const ir: AcquireIR = await acquire(
      v3Options([introURL], { acquireEngine: 'lightpanda' }),
    );
    expect(ir.chunks.length).toBeGreaterThan(1);
    expect(ir.chunks[0].url).toBe(introURL);
    expect(ir.chunks.every((c) => c.html && c.html.length > 0)).toBe(true);
  }, 180000);

  it('reaches the same docs pages as Chromium (set parity)', async () => {
    const lp = await acquire(v3Options([introURL], { acquireEngine: 'lightpanda' }));
    const cr = await acquire(v3Options([introURL], { acquireEngine: 'chromium' }));
    expect(new Set(lp.chunks.map((c) => c.url))).toEqual(
      new Set(cr.chunks.map((c) => c.url)),
    );
  }, 240000);
});
