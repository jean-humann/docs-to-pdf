// Pure helpers for turning cross-page documentation hyperlinks into internal
// PDF links (issue #336). No Puppeteer/DOM dependency, so this is fully
// unit-testable. The combined PDF document only gets internal "jump" links when
// an <a href> is a bare `#fragment` matching an element id, so these helpers map
// each crawled page (and its heading fragments) to a deterministic local id and
// rewrite in-export links to those bare fragments.

export interface PageAnchorEntry {
  /** Id of a hidden anchor at the top of the page, used for whole-page links. */
  pageTopId: string;
  /** Map of the page's original heading id -> the rewritten (namespaced) id. */
  headings: Record<string, string>;
}

/** Map of canonical page key -> anchor information for that page. */
export type PageAnchorMap = Record<string, PageAnchorEntry>;

/**
 * Lowercase slug: keep [a-z0-9], collapse everything else to single dashes,
 * trim leading/trailing dashes, and cap the length.
 */
export function slugify(value: string, maxLength = 40): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

/**
 * Canonical key for an in-site documentation page, or `null` when the href is
 * not a same-site page link: cross-origin, a non-http(s) scheme (mailto:, tel:),
 * or a bare same-page `#fragment`.
 *
 * @param href - the link target (absolute, root-relative, or relative)
 * @param baseUrl - the full URL of the page the link was found on (used to
 *   resolve relative hrefs and to determine the same-site origin)
 */
export function normalizePageKey(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith('#')) {
    return null;
  }
  let url: URL;
  let base: URL;
  try {
    base = new URL(baseUrl);
    url = new URL(href, baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.origin !== base.origin) {
    return null;
  }

  let path = url.pathname.toLowerCase();
  path = path.replace(/\.html$/, '');
  path = path.replace(/\/index$/, '');
  path = path.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/** Safe element-id prefix from a page key (`/docs/intro` -> `docs-intro`, `/` -> `root`). */
export function buildPageSlug(pageKey: string): string {
  return slugify(pageKey) || 'root';
}

/**
 * Rewrite content `<a href>` links so that links to pages included in the export
 * become bare `#localId` fragments (which Chromium turns into internal PDF
 * links). Cross-origin, non-http, same-page, and not-in-export links are left
 * untouched so they remain normal external links.
 *
 * @param html - the (combined) content HTML
 * @param anchorMap - map built while assigning deterministic heading ids
 * @param baseUrl - full URL of the page this HTML came from (for relative hrefs)
 */
export function rewriteContentLinks(
  html: string,
  anchorMap: PageAnchorMap,
  baseUrl: string,
): string {
  return html.replace(
    /(<a\b[^>]*?\shref=)"([^"]*)"/gi,
    (match: string, prefix: string, href: string) => {
      const pageKey = normalizePageKey(href, baseUrl);
      if (pageKey === null) {
        return match;
      }
      const entry = anchorMap[pageKey];
      if (!entry) {
        // Target page is not part of this PDF: keep it as an external link.
        return match;
      }
      const hashIndex = href.indexOf('#');
      const fragment = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
      const target = (fragment && entry.headings[fragment]) || entry.pageTopId;
      return `${prefix}"#${target}"`;
    },
  );
}
