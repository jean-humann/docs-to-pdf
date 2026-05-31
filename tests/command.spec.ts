import {
  commaSeparatedList,
  generatePuppeteerPDFMargin,
} from '../src/command/commander-options';
import { makeProgram } from '../src/command/command';

describe('commaSeparatedList', () => {
  it('splits a comma-separated string into an array', () => {
    expect(commaSeparatedList('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('returns a single-element array for one value', () => {
    expect(commaSeparatedList('only')).toEqual(['only']);
  });
});

describe('generatePuppeteerPDFMargin', () => {
  it('maps four comma-separated values to top/right/bottom/left', () => {
    expect(generatePuppeteerPDFMargin('1px,2px,3px,4px')).toEqual({
      top: '1px',
      right: '2px',
      bottom: '3px',
      left: '4px',
    });
  });
});

describe('makeProgram', () => {
  const program = makeProgram();

  it('is named docs-to-pdf', () => {
    expect(program.name()).toBe('docs-to-pdf');
  });

  it('registers the docusaurus and core commands', () => {
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('docusaurus');
    expect(names).toContain('core');
  });

  it('parses --protocolTimeout as a number, not a list', () => {
    const core = program.commands.find((c) => c.name() === 'core');
    expect(core).toBeDefined();
    const opt = core?.options.find((o) => o.long === '--protocolTimeout');
    expect(opt).toBeDefined();
    expect(opt?.parseArg?.('30000', undefined)).toBe(30000);
  });

  it('wires the HTTP basic-auth and iframe options (consumed by core.ts)', () => {
    const core = program.commands.find((c) => c.name() === 'core');
    const longs = core?.options.map((o) => o.long) ?? [];
    expect(longs).toContain('--httpAuthUser');
    expect(longs).toContain('--httpAuthPassword');
    expect(longs).toContain('--extractIframes');
  });
});
