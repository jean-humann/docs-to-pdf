import { DEFAULT_PDF_STYLESHEET } from '../src/utils';

describe('DEFAULT_PDF_STYLESHEET', () => {
  it('targets all heading levels h1-h6', () => {
    expect(DEFAULT_PDF_STYLESHEET).toMatch(/h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6/);
  });

  it('keeps headings with the following content (avoids orphaned headings, #275)', () => {
    expect(DEFAULT_PDF_STYLESHEET).toMatch(/break-after:\s*avoid/);
  });

  it('prevents a heading from being split across pages', () => {
    expect(DEFAULT_PDF_STYLESHEET).toMatch(/break-inside:\s*avoid/);
  });
});
