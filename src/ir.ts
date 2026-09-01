/**
 * Stable Intermediate Representation (IR) produced by acquire() and consumed by
 * render() — the v2 decoupling boundary between ACQUISITION (needs a JS engine
 * to crawl) and RENDER (needs a paged-media engine to write the PDF).
 *
 * The chunk array is in DETERMINISTIC page order. This order drives the table of
 * contents, the global heading-ID counter, anchor namespacing, and the PDF page
 * sequence, so it must NEVER be reordered after construction. Outline
 * Y-positions are intentionally NOT carried here: they are measured in the
 * browser at render time against the assembled combined-DOM scrollHeight.
 */
export interface ContentChunk {
  /** Stable position in the ordered frontier. Assembly is by this index, never by arrival order. */
  order: number;
  /** Absolute URL of the crawled page (also the base URL for that chunk's relative-href rewrite). */
  url: string;
  /** outerHTML of the content selector, after openDetails/extractIframes were applied during acquire. */
  html: string;
}

/** A cover image fetched during acquisition, ready to inline at render time. */
export interface CoverImage {
  base64: string;
  type: string;
}

/** The complete intermediate representation passed from acquire() to render(). */
export interface AcquireIR {
  /** Ordered, dense content chunks. `chunks[i].order === i`. */
  chunks: ContentChunk[];
  /** Origin of `initialDocURLs[0]`; scopes in-site link rewriting. */
  baseOrigin: string;
  /** `initialDocURLs[0]`; the page.goto target render() uses to establish document context. */
  firstInitialURL: string;
  /** Cover image fetched during acquire (so render() needs no extra navigation), or null. */
  coverImage: CoverImage | null;
}
