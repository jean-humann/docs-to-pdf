import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { acquire } from '../../src/acquire';
import { render } from '../../src/core';
import { generateTocFromChunks } from '../../src/utils';
import { AcquireIR } from '../../src/ir';
import { describeIfChrome } from '../helpers/chromeGuard';
import {
  startFixture,
  stopDocusaurusServer,
  v3Options,
  ServerInstance,
} from '../helpers/fixtureServer';

const sha = (ir: AcquireIR) =>
  crypto
    .createHash('sha256')
    .update(ir.chunks.map((c) => c.html).join(''))
    .digest('hex');

describeIfChrome('Phase 0 e2e: acquire IR golden + render', () => {
  let server: ServerInstance;
  let introURL: string;
  const outDir = path.join(__dirname, 'ir-golden-output');

  beforeAll(async () => {
    server = await startFixture();
    introURL = `http://127.0.0.1:${server.port}/docs/intro`;
    fs.mkdirSync(outDir, { recursive: true });
  }, 120000);

  afterAll(async () => {
    if (server) await stopDocusaurusServer(server);
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('acquires a deterministically-ordered, dense IR (serial)', async () => {
    const ir = await acquire(v3Options([introURL], { concurrency: 1 }));
    expect(ir.chunks.length).toBeGreaterThan(1);
    expect(ir.chunks[0].url).toBe(introURL);
    expect(ir.firstInitialURL).toBe(introURL);
    expect(ir.baseOrigin).toBe(`http://127.0.0.1:${server.port}`);
    // order is dense 0..n
    expect(ir.chunks.map((c) => c.order)).toEqual(ir.chunks.map((_, i) => i));
    // Deterministic crawl-path invariants (no toMatchSnapshot: this suite is
    // Chrome-gated, and a committed snapshot would be flagged obsolete — and
    // fail --ci — on runners without Chrome where the suite is skipped).
    const paths = ir.chunks.map((c) => new URL(c.url).pathname);
    expect(paths[0]).toBe('/docs/intro');
    expect(paths.every((p) => p.startsWith('/docs/'))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length); // no duplicate pages
  }, 120000);

  it('produces byte-stable content across runs (determinism)', async () => {
    const a = await acquire(v3Options([introURL], { concurrency: 1 }));
    const b = await acquire(v3Options([introURL], { concurrency: 1 }));
    expect(a.chunks.map((c) => c.url)).toEqual(b.chunks.map((c) => c.url));
    expect(sha(a)).toBe(sha(b));
  }, 180000);

  it('generates deterministic, page-namespaced heading ids from the IR', async () => {
    const ir = await acquire(v3Options([introURL], { concurrency: 1 }));
    const { modifiedContentHTML } = generateTocFromChunks(ir.chunks, {
      tocTitle: 'Table of contents:',
    });
    // deterministic ids like docs-intro--... (no random hex fallback)
    expect(modifiedContentHTML).toMatch(/id="docs-intro--/);
  }, 120000);

  it('renders the IR to a valid multi-page PDF', async () => {
    const ir = await acquire(v3Options([introURL], { concurrency: 1 }));
    const out = path.join(outDir, 'golden.pdf');
    await render(
      ir,
      v3Options([introURL], { outputPDFFilename: out, disableCover: true }),
    );
    expect(fs.existsSync(out)).toBe(true);
    const doc = await PDFDocument.load(fs.readFileSync(out));
    expect(doc.getPageCount()).toBeGreaterThan(0);
  }, 180000);
});
