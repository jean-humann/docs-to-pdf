/*
 * Performance benchmarks. Kept OUT of the default `yarn test` run (which matches
 * only *.spec / *.test files) so timings never gate normal CI. Run explicitly:
 *
 *   REBUILD_THRESHOLD_MINUTES=0 npx jest --config jest.perf.config.ts
 *
 * Self-contained (does not import jest.config.ts, which jest's ESM config loader
 * cannot resolve without an extension). Benchmarks crawl the real tests/website
 * fixture under Chrome and assert RELATIVE thresholds, never absolute wall-clock.
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  collectCoverage: false,
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  roots: ['<rootDir>/tests'],
  setupFiles: ['core-js'],
  testMatch: ['**/*.perf.ts'],
  testTimeout: 600000,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        diagnostics: { ignoreCodes: ['TS151002'] },
        tsconfig: { module: 'commonjs' },
      },
    ],
    '^.+\\.m?jsx?$': [
      'ts-jest',
      {
        tsconfig: { allowJs: true, module: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@paralleldrive/cuid2|@noble|formidable|superagent|chalk|#ansi-styles|#supports-color|puppeteer-autoscroll-down)/)',
  ],
};
