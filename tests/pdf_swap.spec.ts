import { PDFDocument, PageSizes } from 'pdf-lib';
import { swapLeadingCoverPages } from '../src/pdf/generate';

async function makePdf(sizes: Array<[number, number]>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const size of sizes) {
    doc.addPage(size);
  }
  return doc.save();
}

describe('swapLeadingCoverPages', () => {
  it('replaces a single leading cover page, preserving total page count', async () => {
    // full = 3 A4 pages (with header/footer), cover = 1 A5 page (without)
    const full = await makePdf([PageSizes.A4, PageSizes.A4, PageSizes.A4]);
    const cover = await makePdf([PageSizes.A5]);

    const doc = await PDFDocument.load(
      await swapLeadingCoverPages(full, cover),
    );

    expect(doc.getPageCount()).toBe(3);
    // page 0 is now the A5 cover; pages 1-2 remain A4 body pages
    expect(Math.round(doc.getPage(0).getWidth())).toBe(
      Math.round(PageSizes.A5[0]),
    );
    expect(Math.round(doc.getPage(1).getWidth())).toBe(
      Math.round(PageSizes.A4[0]),
    );
    expect(Math.round(doc.getPage(2).getWidth())).toBe(
      Math.round(PageSizes.A4[0]),
    );
  });

  it('replaces multiple leading cover pages', async () => {
    const full = await makePdf([
      PageSizes.A5,
      PageSizes.A5,
      PageSizes.A4,
      PageSizes.A4,
    ]);
    const cover = await makePdf([PageSizes.A3, PageSizes.A3]);

    const doc = await PDFDocument.load(
      await swapLeadingCoverPages(full, cover),
    );

    expect(doc.getPageCount()).toBe(4);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(
      Math.round(PageSizes.A3[0]),
    );
    expect(Math.round(doc.getPage(1).getWidth())).toBe(
      Math.round(PageSizes.A3[0]),
    );
    expect(Math.round(doc.getPage(2).getWidth())).toBe(
      Math.round(PageSizes.A4[0]),
    );
  });
});
