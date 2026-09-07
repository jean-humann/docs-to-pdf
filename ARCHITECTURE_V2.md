# docs-to-pdf v2 — Definitive Architecture Review

**Author:** Lead Architect
**Subject:** Whether docs-to-pdf can drop Puppeteer/Chromium for v2, and what v2 should actually be
**Status:** Final, opinionated, and deliberately honest about what is *not* achievable
**Baseline reviewed:** docs-to-pdf v1.3.0 (Node ≥20, TypeScript→CJS, `puppeteer-core` ^24 + bundled Chromium, `pdf-lib`, Express)

---

## 1. Executive Summary & The Honest Verdict

### 1.1 The question

Can a v2 of docs-to-pdf **fully drop Puppeteer/Chromium while matching ALL current features**, ideally getting the kind of speedup popularized by the "I replaced Puppeteer with a Zig engine and went from 18 → 17,000 PDFs/sec" article?

### 1.2 The verdict (stated plainly)

**No.** Not while preserving the tool's *defining* capability: crawling **live, JavaScript-rendered Docusaurus sites** and producing PDFs with **fidelity to the site's own theme**, including running headers/footers, page-break control, bookmarks, and internal links.

The blocker is structural, not a matter of effort, and it survived verification against the source tree and five independent technology surveys:

> **No browserless engine both executes JavaScript *and* writes a PDF.**
> - `lightpanda` (Zig + V8) runs JS but has **no layout engine and no PDF output** — by explicit design.
> - WeasyPrint, PrinceXML, Typst, and Blitz/Stylo produce layout/PDF but run **zero JavaScript** (Prince is ES5-only and pre-layout — it cannot hydrate a modern React bundle).
>
> You can have one half browserless. Never both.

A docs-to-pdf run has **two independent hard problems** that must be evaluated separately (conflating them is the single biggest source of hand-waving in this space):

| | **Problem A — ACQUISITION** | **Problem B — RENDER** |
|---|---|---|
| What it needs | A JS engine + DOM + network stack that hydrates a React SPA and exposes the post-hydration DOM | A CSS-Paged-Media engine (`break-*`, `@page`, running header/footer margin boxes, `printBackground`) that emits PDF |
| Today | `page.goto(url, {waitUntil:'networkidle0'})` + `page.evaluate` selector extraction (`core.ts:156-193`) | A single Chromium `page.pdf()` (`generate.ts:149`) |
| Browserless option? | **Only** by changing the input to a *static build* (read pre-rendered HTML off disk) | **Only** with a *different* CSS-paged engine (WeasyPrint / Prince), each with fidelity loss |

A v2 that "drops Chromium" must solve **both** without a browser **simultaneously**. The two independent substitutes each forfeit a core requirement of the original question.

### 1.3 What *can* be dropped, and what *cannot*

- **Puppeteer the npm package: droppable.** You can drive the same Chromium over raw CDP (the `bun-cdp` candidate). This sheds the dependency but **not the engine**.
- **Chromium the engine: not droppable for the live-site use case.** It is the only thing that both runs the SPA's JS and faithfully prints arbitrary HTML+CSS to paged PDF with the `#anchor`→internal-link conversion the tool relies on.
- **`pdf-lib` post-processing: droppable** (replace with a native krilla writer for smaller, cleaner output) — but this is a quality/footprint win on a 1–5% slice, **not** a speed lever.

### 1.4 The recommendation in one line

**Do not pursue a Chromium-free rewrite.** Ship a **phased hybrid**: keep the browser for live acquisition, **decouple crawl from render** behind a stable intermediate representation, and offer an **opt-in Chromium-free fast path** (`--engine=weasyprint`, consuming the static `build/` directory) for the static-content subset — honest about its tradeoffs and with automatic fallback to the browser path. This captures the real wins (parallel crawl, smaller PDFs, a browser-optional fast lane for the common static case) without betting the product on pre-alpha engines or a category-error performance claim.

---

## 2. Feature Inventory & Which Features Fundamentally Need a Browser Engine

docs-to-pdf v1.3.0 exposes ~31 CLI options across a default `core` command and a `docusaurus` subcommand. The pipeline is **Crawl → Reconstruct (single combined DOM) → Print (one `page.pdf()`)**.

The decisive classification is **which features fundamentally require a JS-capable browser engine** versus a CSS-layout engine versus nothing at all. Verified against `core.ts`, `utils.ts`, `pdf/generate.ts`, `pdf/outline.ts`, `links.ts`.

### 2.1 Fundamentally require a JavaScript engine (ACQUISITION) — *no browserless path exists*

| Capability | Source | Why a JS engine is mandatory |
|---|---|---|
| Live-URL SPA crawl (`--initialDocURLs`, `networkidle0`) | `core.ts:156` | Docusaurus serves a `<div id="root">` shell; `<article>`/`<main>` content exists only after React hydration |
| Resolved `.href` pagination | `utils.ts:367-385` | Returns the browser-resolved absolute URL of the next page from the JS-rendered nav |
| `--openDetail` (`<details>` auto-expand) | `utils.ts:328-358` | Programmatic `click()` fires JS listeners that toggle `open` |
| Lazy-image forcing (`scrollPageToBottom`) | `core.ts:261` | Triggers `IntersectionObserver` callbacks to fetch `loading="lazy"` images |
| `--extractIframes` | `utils.ts:117-277` | `iframe.contentFrame()` is a CDP frame-lifecycle API; CORS is browser-enforced |
| `--httpAuthUser/Password` | `core.ts:92` | `page.authenticate()` injects Basic Auth on every sub-request |
| `.pdf` request interception | `core.ts:99-125` | CDP `Fetch`/`Network` domain; no library equivalent |
| `--filterKeyword` | `utils.ts:51-67` | Reads post-JS `<meta name="keywords">` from the live DOM |

### 2.2 Fundamentally require a CSS-Paged-Media engine (RENDER) — *a non-Chromium engine exists, with fidelity loss*

| Capability | Source | Engine requirement |
|---|---|---|
| HTML+CSS → paginated PDF | `generate.ts:149` | The irreplaceable core. Only a CSS-paged engine (Chromium, WeasyPrint, Prince) can do `@page`, `break-after/inside`, reflow |
| Running header/footer templates (`pageNumber`/`totalPages`/`date`/`title`/`url`) | `generate.ts:140-145` | A print feature; WeasyPrint/Prince do it via `@page` margin boxes + `counter(page)` (different syntax — breaking for user templates) |
| Page-break control (`DEFAULT_PDF_STYLESHEET`, per-block `breakAfter='page'`, `--cssStyle`) | `core.ts:247`, `utils.ts:103` | CSS Paged Media properties |
| `printBackground`, `--paperFormat`, `--pdfMargin` | `generate.ts:133-145` | Print-engine geometry and background painting |
| Cover layout (`flex`, `100vh`, `page-break-after`) | `utils.ts:474-497` | CSS layout + paged media |
| TOC links + cross-page `#fragment` links (#336) | `utils.ts:623`, `links.ts` | The *effect* (fragment→internal PDF jump) is renderer-dependent; WeasyPrint/Prince/Typst resolve `#anchor` natively |

### 2.3 Hybrid — browser-measured today, but a real paged engine *improves* this

| Capability | Source | Note |
|---|---|---|
| Bookmarks / outline | `outline.ts` | The **write** half (`setOutline`, pdf-lib object tree) is pure Node and portable. The **positioning** is a confirmed hack: `getBoundingClientRect()`+`scrollY` (`outline.ts:128-129`) mapped via `Math.floor(yPosition/docHeight * pageCount)` (`:261`). The code itself states at line 271: *"Accurate Y-coordinate mapping is impossible."* A real paged engine (WeasyPrint/Typst/krilla) emits the outline at **exact** layout positions — a net improvement. |
| Named-destination registration | `outline.ts:132-133` | A hidden `<a href="#dest">` is injected so Chromium registers PDF named destinations during print — Chromium-specific behavior. WeasyPrint/Typst resolve anchors natively, so this trick disappears. |

### 2.4 Already browser-free today — *trivially preserved in any backend* (verified)

- **`links.ts`** — the entire cross-page internal-link rewriter. Header comment confirms *"No Puppeteer/DOM dependency"*; grep confirms zero `import`/`page.`/`document.`/`window.`. **Reusable verbatim.**
- URL filtering: `--excludeURLs`/`--excludePaths`/`--restrictPaths` (`utils.isPageKept`, pure string match).
- TOC and cover HTML string generators (`generateTocHtml`, `generateCoverHtml`).
- `pdf-lib` cover-page swap (`swapLeadingCoverPages`, `generate.ts:43-68`).
- Boolean guards: `--disableTOC`/`--disableCover`/`--noInternalLinks`.
- The Express static server for `--docsDir`.
- Cover-image download (`utils.ts:437`, currently `page.goto`+`.buffer()` — a one-line `fetch()` swap).

> **Caveat the field surveys missed but source confirms:** `sanitize-html` is **not** cosmetic. It is a **security boundary** — an iframe XSS allowlist with `allowedTags/allowedAttributes/allowedSchemes` (`utils.ts:201-241`) and a **ReDoS-safe** text-stripping path (`utils.ts:649-652`, comment: *"to avoid ReDoS"*). Any backend that "replaces sanitize-html with HTMLRewriter" must re-implement these guarantees or it introduces a real XSS/ReDoS regression. HTMLRewriter (lol-html) is a streaming transformer, not a security-reviewed sanitizer.

### 2.5 Summary

**The two showstoppers for a browserless v2 are (A) live JS-rendered SPA crawl and the dependent iframe extraction, and (B) faithful CSS-paged rendering.** Everything else is portable or improvable. Removing the browser forces a static-build-only product that silently drops all client-only content.

---

## 3. Technology Landscape — Key Findings

### 3.1 The slothpdf "17,000 PDFs/sec" reality check

`@slothpdf/render` is a Bun/TypeScript wrapper over a **closed-source** prebuilt Zig "libslothpdf" engine. The honest findings:

- **It is not a browser or an HTML/CSS engine.** No JS, no DOM, no crawler, no CSS cascade. It is a **template filler**: `(static template + JSON data) → PDF bytes`, with a ~25-token Tailwind-subset DSL (`flex-row`, `gap-N`, `w-1/2`, a few color tokens) interpreted inside an opaque binary you cannot extend. The author states verbatim: *"Not a full HTML/CSS engine. Intentionally limited to predictable layouts."*
- **It will not parse a Docusaurus stylesheet** and cannot represent Infima themes, syntax-highlight spans, or admonitions.
- **Maturity: experimental.** GitHub repo (`voidzer0-dev/slothpdf-render`): 5 stars, 0 forks, 1 contributor, 7 commits over 2 days, no releases, no tests, no CI, v0.6.0, last commit *"ABI break."* The actual engine is **not in the repo** (closed prebuilt binaries).
- **The "18 → 17,000/sec" claim is real but a category error.** It measures **throughput** of *1,000 tiny fixed-layout invoices* (3–10 line items) from a pre-parsed template on an M4 — 0.057 ms/doc. docs-to-pdf measures **latency of one large multi-page document** (the repo's own outputs are **21 MB** and **29 MB**, verified on disk). The author even concedes his best Puppeteer was ~25/sec and never matched input complexity. The 1000× conflates (a) no-browser vs browser and (b) trivial invoice vs arbitrary rendered HTML.

**Verdict: skip it.** The only transferable idea — "a fast native PDF writer once layout is solved" — is better served by **krilla** (below).

### 3.2 PDF writers & layout engines (Rust/Zig)

| Layer | Best pick | Status | Notes |
|---|---|---|---|
| **PDF writer** (object/outline/links/subsetting) | **krilla** (MIT/Apache) | **Production-ready** | Adopted by **Typst 0.14** for its PDF export — strongest possible endorsement. Native outlines, named destinations, link annotations, font subsetting, tagged/PDF-UA, PDF/A. Best test infra of any Rust PDF crate. **Explicitly out of scope: page-breaking, headers/footers, text layout.** |
| Lower-level writers | pdf-writer, lopdf, printpdf, genpdfi | Mature/usable | Manual positioning; no HTML layout |
| **Browser-grade CSS layout** | **Blitz** = Stylo + Taffy + Parley (Apache/MIT, +MPL-2.0 via `stylo_taffy`) | **Pre-alpha** | Firefox-grade CSS ("often indistinguishable from Chrome"). **Fatal gaps today:** runs **no JS**, has **no PDF backend**, and has **no CSS Paged Media** (built for a continuous viewport — no `@page`, no `break-*`, no running headers, no page counters). |
| Off-the-shelf Blitz+krilla assembly | hyper-render | Very early, single-maintainer | Proves the assembly is conceivable; not production-grade; no paged media |
| Bespoke single-crate HTML→PDF | ironpress, printpdf `html` | Experimental | printpdf's own docs call its HTML path *"a stub … won't produce usable output"*; ironpress publishes no CSS-parity figure and benchmarks only tiny single-page docs |
| **Zig** | pdf-nano only | Minimal | No Zig CSS/layout/shaping stack exists. **Ignore Zig for this project.** The Zig community itself uses Pandoc+Typst for HTML→PDF. |

**Key finding:** Rust gives you a *best-in-class PDF writer* (krilla) and an *exciting-but-pre-alpha layout engine* (Blitz) that **lacks the one thing a multi-page docs PDF requires (paged media)** and has **no PDF output**. The pieces do not yet connect into a production HTML→paged-PDF pipeline.

### 3.3 Browserless render engines (non-Rust)

- **WeasyPrint** (BSD, Python, **production-ready**): the realistic non-Chromium render backend. Native bookmarks, internal/external links, `@page` margin-box headers/footers, `counter(page)/counter(pages)`, `target-counter` TOC, page-break control, PDF/A & PDF/UA — **matches or exceeds** the current pdf-lib outline hack and header/footer feature. **But:** flexbox/grid/web-font support is officially "simple cases, not deeply tested" → **fidelity drift on real Docusaurus themes**; expect per-theme `--cssStyle` tuning. From Rust you'd embed CPython via PyO3 (a deployment wart); from Node it's a subprocess to the `weasyprint` CLI.
- **PrinceXML / PDFreactor / Antenna House** (commercial): best-in-class CSS+PDF fidelity, gold-standard headers/footers. **But** commercial (~$3,800/server for Prince) and **still cannot hydrate the SPA** (ES5-only) — they *also* need the pre-render step.
- **Typst** (Apache-2.0, **production-ready PDF engine**): superb native PDF (auto outline, links, headers, tagged PDF). **But cannot ingest HTML or CSS — ever** (HTML is export-only; issue #5512). A Typst v2 becomes a **MDX/Markdown→Typst transpiler** that (a) abandons the site's theme entirely and (b) hits the MDX wall (JSX/Tabs/admonitions/imported components have no equivalent; Docusaurus maintainers say MDX→MD is impossible without running the components).
- **Paged.js / Vivliostyle**: disqualified — they **are headless Chromium** under the hood.
- **wkhtmltopdf**: dead (archived Jan 2023, ancient QtWebKit, no modern flex/grid).

### 3.4 Crawling / content acquisition

- **lightpanda** (Zig+V8, AGPL-3.0): the *only* browserless thing that runs JS. **But Beta**, with documented React/Next crashes (issues #379 `location is not defined`, #619 `AbortController is not defined`), **no layout, no `getBoundingClientRect`, no PDF**. It cannot feed the render stage and is too fragile to trust on arbitrary Docusaurus. AGPL is a redistribution/SaaS concern. **Dead end for this tool.**
- **Rust CDP/WebDriver clients** (chromiumoxide, headless_chrome, fantoccini) **and Playwright**: full JS rendering — but **only by driving a real Chromium/Blink/Gecko**. They **relocate** the browser dependency, they don't remove it. (chromiumoxide also has long compile times.)
- **Static-build parsing** (read Docusaurus `build/**/index.html` off disk): the **only genuine no-browser acquisition path**. Docusaurus pre-renders every route at build time; a plain HTML parser does `querySelector` trivially, and pagination can come from sidebar/routes metadata. **Limits:** requires a local build (or a plain HTTP GET of SSG HTML — no longer "the live site"); by Docusaurus design it loses `<BrowserOnly>`, `react-live`, runtime Mermaid/KaTeX, Algolia, theme-swapped images, iframe bodies, and any runtime-injected tab/accordion content. **Correction to a common misconception:** today's `--docsDir` mode does **not** parse HTML off disk — it starts an Express server and runs the **full Puppeteer crawl** against `localhost`. So the off-disk static reader is **net-new**, not "half-built."

### 3.5 Runtime: Bun vs Node

- **Bun is a runtime/toolchain, not a rendering technology.** No layout engine, no native HTML→PDF. `puppeteer-core` runs on Bun (use `puppeteer-core`, not `puppeteer`, to avoid the postinstall Chrome-download issue).
- **Genuine wins:** `bun build --compile` produces a single cross-platform CLI binary (but **Chrome can't be embedded** — it's "single JS binary + external browser"); **HTMLRewriter** (lol-html) is a correct streaming parser that could replace the regex heading-id/TOC munging (but **not** the `sanitize-html` security boundary — see §2.4); faster CI, run TS directly, faster spawn.
- **Caveats:** `bun:ffi` is officially **experimental**; Bun is **mid-rewrite from Zig to Rust** (2026, canary-only) — treat native/binding stability as "on watch."
- **Perf reality:** all the Bun startup/spawn gains are **rounding error** against runs the project documents as **10–30+ minutes** (CLAUDE.md:291). Chrome owns the critical path.

---

## 4. Candidate Architectures & Scores

Five candidates were evaluated. Scores: featureParity, performance, renderingFidelity (all 0–10, higher better); implementationEffort and risk are reported **0–10 where higher = LESS effort / LESS risk** (so high is good on every column). Overall is a holistic 0–10.

| Candidate | Drops Puppeteer | Drops Chromium | Feature Parity | Performance | Fidelity | Effort (↑=easier) | Risk (↑=safer) | **Overall** |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **incremental-node** (Node + parallel crawl + krilla-via-napi-rs PDF tail) | ✗ | ✗ | **10** | 5 | **10** | 6 | **7** | **7.0** |
| **bun-cdp** (Bun + raw CDP, same Chrome) | ✓ | ✗ | 7.5 | 6 | 9 | 3.5 | 4.5 | 5.5 |
| **rust-typst** (Markdown/MDX→Typst) | ✓ | ✓ | 2.5 | 7.5 | 2 | 2.5 | 3 | 3.0 |
| **zig-hybrid-slothpdf** (lightpanda/static + Blitz+krilla custom paged layer) | ✓ | ✓ | 4 | 5 | 3 | 1 | 2 | 3.0 |
| **rust-blitz** (static build + Blitz/Stylo/Taffy + krilla) | ✓ | ✓ | 3 | 5.5 | 3.5 | 1.5 | 1.5 | 2.5 |

### 4.1 Reading the table

- **The two "full parity" columns and the two "drops Chromium" columns are mutually exclusive in practice.** Every candidate that drops Chromium (`rust-typst`, `rust-blitz`, `zig-hybrid`) scores ≤4 on feature parity, because dropping the browser forfeits live-SPA crawl and iframe extraction. The only full-parity candidates (`incremental-node`, and `bun-cdp` at 7.5) keep Chromium.
- **incremental-node wins** precisely because it is the control case: Chromium is retained, so parity and fidelity are guaranteed 10/10, and risk is the lowest. Its weakness is that its headline differentiator (the native PDF tail) is Amdahl-capped to ~negligible *speed* (it's a quality/footprint win), while its genuine speed lever (parallel crawl) needs **no Rust at all**.
- **bun-cdp is the most intellectually honest of the rewrite-class candidates** — it correctly refuses to claim Chromium removal or the 17k/sec speedup. But it is a substantial browser-driver rewrite (re-implementing `networkidle0`, idempotent `Fetch` interception, an ElementHandle layer, per-request `protocolTimeout`, the sanitize-html security boundary) whose only real wins (parallel crawl, lighter distribution) are achievable **without** the rewrite. Net risk-positive for low differentiated payoff.
- **rust-blitz and zig-hybrid are the highest-effort, highest-risk paths to a *narrower* product.** Both bet the core on **pre-alpha Blitz**, which lacks the **one** capability multi-page PDF requires (CSS paged media) and has **no PDF backend**, forcing a from-scratch pagination + running-header/footer + page-counter subsystem that exists in **no released crate**. The defensible wins they cite (krilla outline, font subsetting, lower memory) are obtainable far more cheaply via a render-tail swap on the Node stack.
- **rust-typst** is fast and small but **inverts the model**: output looks like a v2-authored Typst template, **not** the Docusaurus theme, and MDX content silently drops through Pandoc/cmarker. A legitimate tool for a *different* problem (source→re-themed PDF), not a v2 of *this* tool.

---

## 5. Recommended v2 Architecture

**A phased hybrid that decouples crawl from render, keeps the browser for live JS sites, and adds an opt-in Chromium-free fast path for static builds.** This is `incremental-node` as the spine, extended with an explicit Acquisition/Render boundary and a second render engine — *not* a Chromium-free rewrite.

### 5.1 The core architectural move: decouple ACQUISITION from RENDER behind a stable IR

Today the pipeline is monolithic Puppeteer. v2 splits it at a clean seam:

```
                 ┌─────────────────────── ACQUISITION ───────────────────────┐
                 │                                                            │
  Live JS site ──┤  [Browser engine] parallel crawl                          │
                 │     puppeteer-core/CDP, networkidle0, openDetails,         │
  Static build ──┤     autoscroll, iframe extract, auth                      │──┐
                 │  ──OR──                                                    │  │
                 │  [No browser] static reader: read build/**/index.html      │  │
                 │     html parser + sidebar/routes metadata                  │  │
                 └────────────────────────────────────────────────────────────┘ │
                                                                                  │
                            ┌──────── INTERMEDIATE REPRESENTATION (IR) ───────────┘
                            │  Combined HTML (cover + TOC + content)
                            │  + heading list (id, level, title)
                            │  + cross-page link map (links.ts, reused verbatim)
                            │  + asset table (resolved absolute URLs / local paths)
                            │  + page order (deterministic)
                            ▼
                 ┌─────────────────────────── RENDER ────────────────────────┐
                 │  Engine = chromium (default, full fidelity)                │
                 │     page.pdf() + krilla/pdf-lib outline tail               │
                 │  ──OR──                                                    │
                 │  Engine = weasyprint (opt-in, Chromium-free)               │
                 │     @page + margin-box headers/footers + native outline    │
                 └────────────────────────────────────────────────────────────┘
                            ▼
                         output.pdf
```

The IR is the contract. Both acquisition modes emit it; both render engines consume it. **`links.ts`, the URL filters, the TOC/cover generators, and the outline-write logic all live at the IR boundary and are reused unchanged.**

### 5.2 Why this is the right shape

1. **It is honest about the hard wall.** The browser stays for live JS sites because nothing else can hydrate them. We do not pretend otherwise.
2. **It offers a real Chromium-free fast path** for the *common* case (static Docusaurus build), where it is both faster (no per-page navigation/`networkidle0`) and lighter (no bundled browser at render time).
3. **It improves output quality** on the WeasyPrint path: native bookmarks at exact positions (deleting the `outline.ts:271` "impossible" Y-hack), native `#anchor` links, native running headers/footers.
4. **It is incrementally shippable** with guaranteed parity at every step (Chromium remains the default).
5. **It avoids every pre-alpha bet** (no Blitz, no lightpanda, no closed slothpdf) and the category-error performance claim.

### 5.3 Engine support matrix (what each render engine can honestly do)

| Feature | `chromium` (default) | `weasyprint` (opt-in, static-build) |
|---|:---:|:---:|
| Live JS-rendered crawl | ✅ full | ❌ (acquisition is static-build only) |
| `--extractIframes` | ✅ | ❌ (iframe bodies absent from prerender) |
| Client-only content (BrowserOnly, react-live, runtime Mermaid/KaTeX) | ✅ | ❌ silently absent |
| Theme/CSS fidelity | ✅ pixel-faithful | ⚠️ drift on complex flex/grid/web-fonts; needs `--cssStyle` tuning |
| Bookmarks/outline | ⚠️ approximate Y (current hack) | ✅ **exact positions** |
| TOC + cross-page `#` links | ✅ | ✅ native |
| Header/footer templates | ✅ Puppeteer syntax | ⚠️ **breaking** — must re-express in `@page` margin-box/counter syntax |
| `--excludeCoverPageHeaderFooter` | ✅ (re-render + swap) | ✅ simpler (`@page:first` rule) |
| Page-break control, paper/margins | ✅ | ✅ (CSS paged media) |
| `--httpAuth`, `--filterKeyword` | ✅ | ⚠️ static-only (fine if SSG-rendered) |

The matrix is the **honesty contract**: the docs and `--help` must state plainly that `weasyprint` is for static-content sites and trades fidelity + JS features for speed and a browser-free render.

---

## 6. Phased Migration Plan

### Phase 0 — Decouple & harden on the current engine (ship as **v2.0**) — *Low risk, full parity*

- **Refactor `core.ts` to emit the IR** (combined HTML + heading/link/asset metadata) instead of driving `page.pdf()` inline. Keep Chromium as the only engine. No behavior change.
- **Parallelize the crawl.** Replace the strictly-serial `for…of` seeds + `while (nextPageURL)` single-`page` loop (`core.ts:136-194`) with a bounded pool of N pages/`BrowserContext`s pulling from a shared frontier. Promote `visitedURLs` to a concurrency-safe dedup; **reconstruct page order deterministically from the frontier, not arrival order** (critical: the `links.ts` anchor map keys on page order/identity).
  - **Seed the frontier from sidebar/sitemap/Docusaurus routes** — the *only* discovery mechanism today is the serial `findNextUrl` next-link chain (`utils.ts:367`), so without seeding there is little to parallelize.
- **Replace `page.goto`+`.buffer()` cover fetch with `fetch()`** (`utils.ts:437`) + a small keyed asset cache.
- **Concurrency must default conservative and be tunable** (N concurrent live Chromium pages multiply peak RAM and DOM-timing flakiness on heavy themes; can OOM the Alpine Docker target).
- **Add an integration test suite** against `tests/website` (the `generatePDF` function is currently `/* c8 ignore */` — the new concurrency path needs real coverage for order, dedup, and memory).

**Exit criterion:** byte/visual-equivalent PDFs to v1 on a fixture matrix; measurable crawl speedup on a large, sidebar-seeded site.

### Phase 1 — Native PDF tail (optional, **v2.1**) — *Low risk, footprint win*

- Port the **already-pure** `setOutline`/`buildPdfObjectsForOutline` (`outline.ts`) and `swapLeadingCoverPages` (`generate.ts:43-68`) to a **krilla-based Rust addon via napi-rs**, shipped as prebuilt per-platform optional deps.
  - FFI surface is tiny: pass the `OutlineNode` tree + page dims as a struct and the PDF as `Uint8Array`; return `Uint8Array`. **Bytes in, bytes out** — never JS objects.
  - **Keep `pdf-lib` behind a fallback flag** for hosts without a prebuilt binary (notably **musl/Alpine**, the project's Docker target).
- **Win:** font subsetting + recompression shrinks the 21–29 MB outputs; lower peak memory. **Not a speed lever** (Amdahl-capped to ~1.05×). Frame it honestly as a quality/footprint release.

### Phase 2 — Chromium-free fast path (opt-in, **v2.2**) — *Medium risk, scoped*

- **Static-build reader (net-new):** read `build/**/index.html` off disk, `querySelector` the `contentSelector` (`article` v1/v2, `main` v3), derive page order from sidebar/routes metadata. No Express, no `networkidle0`.
- **WeasyPrint render engine** behind `--engine=weasyprint` (subprocess to the `weasyprint` CLI, or PyO3 if the core goes Rust). Consume the IR; emit native outline + `@page` headers/footers + `#anchor` links.
- **Automatic guardrails:** detect client-only markers (`<BrowserOnly>` placeholders, unrendered Mermaid/KaTeX) and **warn + recommend the `chromium` engine**, or auto-fall-back. Document the fidelity contract loudly.
- **Header/footer migration:** ship a small translator for common Puppeteer templates → WeasyPrint margin-box/counter syntax, and a deprecation note that custom templates may need rewriting on this engine.

**Explicitly NOT in scope (and a recommendation to *not* pursue):** a pure-Rust Blitz/Stylo render path or a lightpanda crawl path. Revisit Blitz **only** once it reaches beta **and** gains CSS Paged Media support. Revisit Typst only if a separate "source→re-themed PDF" product is desired — it is not a v2 of *this* tool.

---

## 7. Realistic Performance Expectations (with caveats vs the 17k/sec claim)

### 7.1 Where the time actually goes

The pipeline is **strictly serial** and **crawl-dominated**. Allocating the project's own "10–30+ minutes" budget (CLAUDE.md:291) for ~100 pages:

| Phase | Code | Share of wall-clock |
|---|---|---|
| **A. Crawl + JS render** (serial `goto`+`networkidle0`+`openDetails`+extract, ×N) | `core.ts:136-194` | **~90–98%** |
| B. Assemble (re-`goto`, `concatHtml`, autoscroll) | `core.ts:227-262` | ~1–4% |
| **C. Render** (one `page.pdf()`) | `generate.ts:149` | **~1–5%** |
| D. Post-process (`pdf-lib` outline + save) | `outline.ts`, `generate.ts:178-197` | <1% |

`networkidle0` imposes a **500 ms quiet-window floor per page** *before* network RTT + hydration; for 100 pages that alone is a ~50 s floor, with **zero cross-page parallelism**.

### 7.2 What each lever actually buys

| Lever | Realistic gain | Caveat |
|---|---|---|
| **Parallel crawl** (Phase 0) | **~3–6× on large, sidebar-seedable sites** (sum-of-latencies → max-over-batches at concurrency 4–8) | **~1.0× on tiny sites or pure next-link chains** with nothing to parallelize; bounded by target rate-limits and per-tab RAM |
| Native PDF tail (Phase 1) | **~1.05× end-to-end** (Amdahl) | It's a **footprint/quality** win (smaller PDFs, less memory), *not* speed |
| Static-build acquisition (Phase 2) | **Large — seconds instead of minutes** | Because it does **less** (no browser, no `networkidle0`), *not* because any renderer out-renders Chrome. Only for static-content sites. |
| Bun runtime swap | **Rounding error** (~100s of ms vs minutes) | Chrome owns the critical path |

### 7.3 The honest bottom line on "17,000 PDFs/sec"

- **Non-transferable and a category error.** That figure is *throughput of thousands of trivial templated invoices* on a no-browser writer. docs-to-pdf is *latency of one large (21–29 MB) crawl+render job*.
- A faster PDF *writer* (slothpdf, krilla, Typst) attacks Phase C+D (~1–5%). By Amdahl, even an **infinitely fast** writer caps end-to-end gain at **~1.0–1.05×** for a crawl-bound run.
- It also **cannot crawl and cannot run JS**, so it cannot touch the ~90–98% bottleneck at all.
- **The only large, real speedups are (a) parallelizing the browser crawl — achievable today with Puppeteer, no Zig/Rust required — and (b) the static-build fast path, which wins by skipping the browser, not by faster rendering.**

> **Do not market v2 as "1000× faster" or "matches the Zig article."** Market it as: *"Same fidelity by default; typically several-fold faster on large multi-page sites via parallel crawl; an optional browser-free fast path for static builds; smaller, cleaner PDFs."*

---

## 8. Risks, Open Questions, and Final Recommendation

### 8.1 Top risks

1. **Parallel-crawl correctness (Phase 0).** Concurrency can scramble PDF page order and corrupt the `links.ts` anchor map, or double-visit under a non-thread-safe `visitedURLs`. **Mitigation:** deterministic frontier ordering + concurrency-safe dedup + an order/dedup integration test before cutover.
2. **Memory/flakiness under N live pages.** `openDetails` (800 ms clicks), autoscroll, and `extractIframes` running N-wide can OOM CI/Alpine containers. **Mitigation:** conservative default concurrency, tunable cap.
3. **napi-rs prebuilt matrix (Phase 1).** musl-vs-glibc on Alpine is a real install failure surface. **Mitigation:** retain the pure-JS `pdf-lib` fallback (which partially negates the addon on those hosts — accept that).
4. **WeasyPrint fidelity drift (Phase 2).** Flexbox/grid/web-font divergence on real Infima themes is *expected*, not a bug. **Mitigation:** scope it to static-content sites, document loudly, lean on `--cssStyle`, auto-detect client-only content and recommend `chromium`.
5. **Header/footer breaking change (Phase 2).** WeasyPrint uses `@page` margin-box/counter syntax, not Puppeteer's magic `<span class="pageNumber">`. **Mitigation:** a translator for common templates + a clear deprecation note (engine-scoped).
6. **Security regression if `sanitize-html` is naively replaced.** It is an XSS allowlist + ReDoS guard (verified). **Mitigation:** keep it, or re-implement its guarantees explicitly — do not assume HTMLRewriter is a sanitizer.
7. **Chromium maintenance/footprint persists.** This is the deliberate price of correctness. v2 does **not** reduce the deploy/attack surface on the default path.

### 8.2 Open questions for the maintainer

- **Is live-URL SPA crawling sacred?** If yes (the surveys and source say it is the product's reason for existing), Chromium stays and the plan above is correct. If a meaningful fraction of users only ever target their **own static build**, Phase 2 becomes higher priority.
- **How common is heavy client-only content** (react-live, runtime diagrams, Algolia) among real users? This sizes the addressable market for the WeasyPrint fast path.
- **Is a single-file CLI binary a real distribution goal?** If so, `bun build --compile` is attractive *for packaging only* (Chrome still external) — but it does not justify the full `bun-cdp` driver rewrite.
- **Accessibility/PDF-A demand?** If present, it strengthens the WeasyPrint/krilla path (both do tagged PDF natively; Chromium's print does not).

### 8.3 Final recommendation

1. **Adopt the phased hybrid (`incremental-node` spine).** It is the only path that preserves all current features at every step while delivering real, defensible wins.
2. **Phase 0 is the highest-value, lowest-risk work: decouple crawl from render behind the IR, and parallelize the crawl.** This is where the genuine end-to-end speedup lives — and it needs **no new engine and no Zig/Rust**.
3. **Phase 1 (krilla PDF tail) is optional polish** — ship it for smaller/cleaner PDFs, but do not sell it as speed.
4. **Phase 2 (opt-in WeasyPrint + static-build reader) is the honest answer to "drop Chromium"** — a browser-free fast path for static sites, explicitly scoped and documented, with automatic fallback.
5. **Reject the Chromium-free rewrites** (`rust-blitz`, `zig-hybrid-slothpdf`, `rust-typst`) as the v2 *core*. They bet the product on pre-alpha engines (Blitz lacks paged media and a PDF backend; lightpanda lacks layout and a PDF; Typst can't ingest HTML) to ship a **narrower** tool, for benefits obtainable far more cheaply.
6. **Communicate performance honestly.** Never invoke the 17,000/sec framing. The truthful story — *several-fold faster on big sites via parallel crawl; a browser-free fast lane for static builds; smaller PDFs* — is compelling without being a category error.

> **One-sentence verdict:** docs-to-pdf v2 cannot drop Chromium and keep all features — no browserless engine both runs JavaScript and writes a PDF — so the right move is a phased hybrid that keeps the browser for live JS sites, decouples crawl from render, parallelizes the crawl for the real speed win, and offers an honest, opt-in Chromium-free WeasyPrint path for static builds.
