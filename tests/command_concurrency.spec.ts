import { Command } from 'commander';
import { makeProgram } from '../src/command/command';
import * as core from '../src/core';

// Mock generatePDF so parsing argv never launches a real browser.
jest.mock('../src/core', () => ({
  ...jest.requireActual('../src/core'),
  generatePDF: jest.fn().mockResolvedValue(undefined),
}));

const mockedGeneratePDF = core.generatePDF as jest.MockedFunction<
  typeof core.generatePDF
>;

/**
 * Parse argv against a fresh program and return the resolved options that the
 * `core` action received. process.exit is stubbed so the action's
 * completion handler cannot terminate the test runner.
 */
async function parseCoreOptions(
  args: string[],
): Promise<Record<string, unknown>> {
  const program = makeProgram();
  const exitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never);
  try {
    await program.parseAsync(['node', 'docs-to-pdf', ...args]);
  } finally {
    exitSpy.mockRestore();
  }
  expect(mockedGeneratePDF).toHaveBeenCalledTimes(1);
  return mockedGeneratePDF.mock.calls[0][0] as unknown as Record<
    string,
    unknown
  >;
}

function coreCommand(program: Command): Command {
  const core = program.commands.find((c) => c.name() === 'core');
  expect(core).toBeDefined();
  return core as Command;
}

describe('makeProgram concurrency / seedFrom options', () => {
  beforeEach(() => {
    mockedGeneratePDF.mockClear();
  });

  describe('--concurrency', () => {
    it('parses --concurrency 4 as the number 4 (via Number.parseInt)', async () => {
      const options = await parseCoreOptions([
        'core',
        '--initialDocURLs',
        'http://x',
        '--concurrency',
        '4',
      ]);
      expect(options.concurrency).toBe(4);
      expect(typeof options.concurrency).toBe('number');
    });

    it('defaults to 1 when --concurrency is omitted', async () => {
      const options = await parseCoreOptions([
        'core',
        '--initialDocURLs',
        'http://x',
      ]);
      expect(options.concurrency).toBe(1);
    });
  });

  describe('--seedFrom', () => {
    it('parses --seedFrom sitemap as the string "sitemap"', async () => {
      const options = await parseCoreOptions([
        'core',
        '--initialDocURLs',
        'http://x',
        '--seedFrom',
        'sitemap',
      ]);
      expect(options.seedFrom).toBe('sitemap');
    });

    it('defaults to "next-link" when --seedFrom is omitted', async () => {
      const options = await parseCoreOptions([
        'core',
        '--initialDocURLs',
        'http://x',
      ]);
      expect(options.seedFrom).toBe('next-link');
    });
  });

  describe('--help documentation', () => {
    it('explains that concurrency parallelises fetching', () => {
      const program = makeProgram();
      const help = coreCommand(program).helpInformation();
      expect(help).toContain('--concurrency');
      expect(help.toLowerCase()).toContain('parallel');
    });

    it('explains that seedFrom=sitemap changes the included-page set', () => {
      const program = makeProgram();
      const help = coreCommand(program).helpInformation();
      expect(help).toContain('--seedFrom');
      expect(help.toLowerCase()).toContain('sitemap');
      // The description must call out that sitemap CHANGES the page set,
      // distinguishing it from the order-only effect of --concurrency.
      expect(help.toUpperCase()).toContain('CHANGES');
    });
  });
});
