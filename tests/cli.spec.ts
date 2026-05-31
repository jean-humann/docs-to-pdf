import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// The package builds to CommonJS, so its runtime dependencies must be
// require()-able. ESM-only deps (e.g. chalk v5) silently break the published
// CLI on Node versions without require(ESM) support (issue #562).
//
// `--no-experimental-require-module` forces the strict CommonJS behaviour on any
// Node version, so a top-level require() of an ESM-only module throws
// ERR_REQUIRE_ESM here even on Node >= 22 where it would otherwise be masked.
const cliPath = path.join(__dirname, '..', 'lib', 'cli.js');

// Only runs against the built output; skips if `yarn build` hasn't produced lib/.
const describeIfBuilt = fs.existsSync(cliPath) ? describe : describe.skip;

describeIfBuilt('built CommonJS CLI', () => {
  test('loads under strict CommonJS and prints usage (guards against ESM-only deps)', () => {
    const stdout = execFileSync(
      process.execPath,
      ['--no-experimental-require-module', cliPath, '--help'],
      { encoding: 'utf8' },
    );
    expect(stdout).toContain('Usage: docs-to-pdf');
  });
});
