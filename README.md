# Docs to PDF

[![npm](https://img.shields.io/npm/v/docs-to-pdf?label=NPM%20STABLE&style=for-the-badge)](https://www.npmjs.com/package/docs-to-pdf)
![node-current](https://img.shields.io/node/v/docs-to-pdf?style=for-the-badge)
![npm](https://img.shields.io/npm/dt/docs-to-pdf?style=for-the-badge)
[![Codecov](https://img.shields.io/codecov/c/gh/jean-humann/docs-to-pdf/master?token=YMY82958X4&style=for-the-badge)](https://codecov.io/gh/jean-humann/docs-to-pdf)
![GitHub](https://img.shields.io/github/license/jean-humann/docs-to-pdf?style=for-the-badge)

## ⚡ Requirements

- Node.js >= 20.0.0

## 📌 Introduction

This is a PDF generator from document website such as `docusaurus`. This is a fork of [mr-pdf](https://github.com/KohheePeace/mr-pdf) which was not maintained anymore.
Feel free to contribute to this project.

## 📦 Installation

```shell
npm install -g docs-to-pdf
```

## 🚀 Quick Start

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
```

## ⚡ Usage

For [Docusaurus v2](https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1)

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1"
```

OR

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
```

## 🍗 CLI Global Options

| Option                 | Required | Description                                                                                                                                                                        |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--initialDocURLs`     | Yes      | set URL to start generating PDF from.                                                                                                                                              |
| `--contentSelector`    | No       | used to find the part of main content                                                                                                                                              |
| `--paginationSelector` | No       | CSS Selector used to find next page to be printed for looping.                                                                                                                     |
| `--excludeURLs`        | No       | URLs to be excluded in PDF                                                                                                                                                         |
| `--excludeSelectors`   | No       | exclude selectors from PDF. Separate each selector **with comma and no space**. But you can use space in each selector. ex: `--excludeSelectors=".nav,.next > a"`                  |
| `--cssStyle`           | No       | CSS style to adjust PDF output ex: `--cssStyle="body{padding-top: 0;}"` \*If you're project owner you can use `@media print { }` to edit CSS for PDF.                              |
| `--outputPDFFilename`  | No       | name of the output PDF file. Default is `docs-to-pdf.pdf`                                                                                                                          |
| `--pdfMargin`          | No       | set margin around PDF file. Separate each margin **with comma and no space**. ex: `--pdfMargin="10,20,30,40"`. This sets margin `top: 10px, right: 20px, bottom: 30px, left: 40px` |
| `--paperFormat`        | No       | pdf format ex: `--paperFormat="A3"`. Please check this link for available formats [Puppeteer document](https://pptr.dev/api/puppeteer.paperformat)                                 |
| `--coverTitle`         | No       | Title for the PDF cover.                                                                                                                                                           |
| `--coverImage`         | No       | `<src>` Image for PDF cover (does not support SVG)                                                                                                                                 |
| `--coverSub`           | No       | Subtitle the for PDF cover. Add `<br/>` tags for multiple lines.                                                                                                                   |
| `--tocTitle`           | No       | Title for the table of contents.                                                                                                                                                   |
| `--disableCover`       | No       | Optional toggle to show the PDF cover or not                                                                                                                                       |
| `--disableTOC`         | No       | Optional toggle to show the table of contents or not                                                                                                                               |
| `--headerTemplate`     | No       | HTML template for the print header. Please check this link for details of injecting values [Puppeteer document](https://pptr.dev/#?product=Puppeteer&show=api-pagepdfoptions)      |
| `--footerTemplate`     | No       | HTML template for the print footer. Please check this link for details of injecting values [Puppeteer document](https://pptr.dev/#?product=Puppeteer&show=api-pagepdfoptions)      |
| `--puppeteerArgs`      | No       | Add puppeteer BrowserLaunchArgumentOptions arguments ex: --sandbox [Puppeteer document](https://pptr.dev/api/puppeteer.browserlaunchargumentoptions)                               |
| `--protocolTimeout`    | No       | Timeout setting for individual protocol calls in milliseconds. If omitted, the default value of 180000 ms (3 min) is used                                                          |
| `--filterKeyword`      | No       | Only adds pages to the PDF containing a given meta keywords. Makes it possible to generate PDFs of selected pages                                                                  |
| `--baseUrl`            | No       | Base URL for all relative URLs. Allows to render the pdf on localhost (ci/Github Actions) while referencing the deployed page.                                                     |
| `--excludePaths`       | No       | URL Paths to be excluded                                                                                                                                                           |
| `--restrictPaths`      | No       | Keep Only URL Path with the same rootPath as `--initialDocURLs`                                                                                                                    |
| `--extractIframes`     | No       | Extract and inline content from iframes (only same-origin or accessible iframes). Default is `false`                                                                               |
| `--httpAuthUser`       | No       | HTTP Basic Auth username for protected documentation sites                                                                                                                         |
| `--httpAuthPassword`   | No       | HTTP Basic Auth password for protected documentation sites                                                                                                                         |
| `--concurrency`        | No       | Number of pages to fetch in parallel. Default `1` (serial, identical output to before). `>1` parallelises fetching while preserving page order. See [Parallel crawling](#-parallel-crawling-experimental).         |
| `--seedFrom`           | No       | Frontier source when `--concurrency>1`: `next-link` (default, same pages as serial) or `sitemap` (uses `sitemap.xml`; **changes the included-page set**).                          |
| `--acquireEngine`      | No       | Crawl engine: `chromium` (default) or `lightpanda` (a fast Zig DOM engine; opt-in, auto-falls back to Chromium if unavailable; render always uses Chromium). See [Faster crawling with lightpanda](#-faster-crawling-with-lightpanda-experimental). |

## Docusaurus Options

| Option      | Required | Description                                                                                                                                                       |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--version` | No       | Docusaurus version. Default is 2. Supported versions: 1, 2, and 3.                                                                                                |
| `--docsDir` | No       | Path to Docusaurus build dir. Either absolute or relative from path of the shell. The local server will automatically find an available port if 3000 is occupied. |

## 📚 Docusaurus Version Support

docs-to-pdf supports **Docusaurus v1 (legacy), v2, and v3**. The tool automatically applies the correct selectors based on the version you specify.

### Version Differences

- **Docusaurus v1 (Legacy)**: Older documentation format with different HTML structure and navigation
- **Docusaurus v2**: Uses `<article>` tag as the main content selector
- **Docusaurus v3**: Uses `<main>` tag as the main content selector (changed from v2)

### Usage

When using the `docusaurus` command, specify the version with the `--version` flag:

```shell
# Docusaurus v1
npx docs-to-pdf docusaurus --initialDocURLs="https://your-site.com/docs" --version=1

# Docusaurus v2 (default)
npx docs-to-pdf docusaurus --initialDocURLs="https://your-site.com/docs" --version=2

# Docusaurus v3
npx docs-to-pdf docusaurus --initialDocURLs="https://your-site.com/docs" --version=3
```

If you omit the `--version` flag, it defaults to version 2.

## 🎨 Examples and Demo PDF

### Docusaurus v2

![20210603060438](https://user-images.githubusercontent.com/29557494/120552058-b4299e00-c431-11eb-833e-1ac1338b0a70.gif)

<https://docusaurus-archive-october-2023.netlify.app/>

`initialDocURLs`: <https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1>

`demoPDF`: <https://github.com/jean-humann/docs-to-pdf/blob/master/pdf/v2-docusaurus.pdf>

`command`:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1"
```

OR

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
```

### Docusaurus v3

Docusaurus v3 uses `<main>` as the content selector instead of `<article>`. Here's an example:

`command`:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://your-docusaurus-v3-site.com/docs/" --version=3
```

OR with explicit selectors:

```shell
npx docs-to-pdf --initialDocURLs="https://your-docusaurus-v3-site.com/docs/" --contentSelector="main" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://your-docusaurus-v3-site.com/img/logo.png" --coverTitle="Your Docs"
```

**Note**: Docusaurus v3 changed the main content wrapper from `<article>` (v2) to `<main>` (v3). The `--version=3` flag automatically uses the correct `main` selector.

### Extracting Content from Iframes

By default, docs-to-pdf only captures the `<iframe>` tag itself, but not the content loaded inside it. If your documentation pages contain iframes with important content (e.g., embedded demos, interactive examples), you can use the `--extractIframes` option to extract and inline their content into the PDF.

```shell
# Enable iframe extraction
npx docs-to-pdf --initialDocURLs="https://your-site.com/docs" --contentSelector="article" --paginationSelector="a.pagination-nav__link--next" --extractIframes
```

With Docusaurus:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://your-site.com/docs" --extractIframes
```

**How it works:**

- Detects all `<iframe>` elements on each page
- Extracts content from accessible iframes (same-origin or accessible cross-origin)
- Replaces the iframe tag with a styled `<div>` containing the extracted content
- Preserves iframe metadata (title, src) in the extracted content
- Gracefully skips cross-origin iframes that cannot be accessed due to CORS restrictions

**Limitations:**

- Only works with same-origin iframes or iframes that allow cross-origin access
- Cross-origin iframes blocked by CORS policy will be skipped
- The feature is opt-in and disabled by default for backward compatibility

**When to use:**

- Your documentation contains embedded examples in iframes
- You want to include interactive demos in the PDF
- Your site uses iframes for content that should appear in the PDF

### Using HTTP Basic Authentication

If your documentation site is protected with HTTP Basic Authentication, you can provide credentials using the `--httpAuthUser` and `--httpAuthPassword` options:

```shell
npx docs-to-pdf --initialDocURLs="https://protected-docs.example.com/docs" --contentSelector="article" --paginationSelector="a.pagination-nav__link--next" --httpAuthUser="myusername" --httpAuthPassword="mypassword"
```

This works with both the `core` and `docusaurus` commands:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://protected-docs.example.com/docs" --httpAuthUser="myusername" --httpAuthPassword="mypassword"
```

**Security Note**: Be cautious when using credentials in command-line arguments, as they may be visible in shell history. Consider using environment variables or other secure methods for sensitive credentials in production environments.

## ⚡ Parallel crawling (experimental)

The pipeline is split into an **acquire** stage (crawl pages into an intermediate
representation) and a **render** stage (write the PDF). By default the crawl is
serial and produces exactly the same output as before. You can opt into fetching
pages in parallel with `--concurrency`:

```shell
# Fetch up to 4 pages at once. Page order, the table of contents, and internal
# links are preserved (assembly is by frontier position, not arrival order).
npx docs-to-pdf docusaurus --initialDocURLs="https://your-site.com/docs/intro" --concurrency=4
```

Notes and trade-offs:

- **`--concurrency=1` (default)** runs the original serial crawl; output is
  unchanged.
- **`--concurrency>1` with the default `next-link` discovery** first walks the
  prev/next chain serially to determine the exact same page set and order as the
  serial crawl, then fetches that list in parallel. The wall-clock win is modest
  on navigation-bound sites (the discovery pass is serial) but real on sites
  where per-page work dominates (e.g. `--extractIframes`, many `<details>`).
- **`--seedFrom=sitemap`** skips the serial discovery pass by reading
  `sitemap.xml` (paths are remapped onto the crawl origin, so it also works for
  locally-served builds). This gives the largest speedup but **changes the
  included-page set** — the sitemap usually contains pages (blog, tags, …) that
  the docs prev/next chain does not. If the sitemap is missing it logs a warning
  and falls back to `next-link` discovery.
- Parallel and serial crawls extract identical page **content**; only cosmetic
  attribute differences from client-side hydration timing may occur under high
  concurrency. For byte-stable output, keep `--concurrency=1` or raise
  `--waitForRender`. High concurrency also increases peak memory (one Chromium
  tab per in-flight page).

## 🐼 Faster crawling with lightpanda (experimental)

The crawl (acquire) stage can run on [lightpanda](https://lightpanda.io) — a
Zig + V8 **DOM-only** headless browser — instead of Chromium. lightpanda is far
lighter and faster for crawling because it skips layout/raster/compositing,
which the crawl never needs. **Render still uses Chromium** (lightpanda cannot
produce PDFs), so the output is unchanged.

```shell
# install lightpanda (https://lightpanda.io), then point docs-to-pdf at it:
export LIGHTPANDA_BIN=/path/to/lightpanda     # or put `lightpanda` on PATH
npx docs-to-pdf docusaurus --docsDir build --initialDocURLs https://your-site.com/docs/intro \
  --version 3 --acquireEngine lightpanda
```

How it behaves:

- **Opt-in and safe.** Default is `chromium`. If lightpanda can't be launched
  (binary missing, fails to start), docs-to-pdf logs a warning and
  **automatically falls back to Chromium** — the run still succeeds.
- **It auto-manages the engine.** docs-to-pdf spawns `lightpanda serve` on a
  free port and drives it over CDP with puppeteer, or connects to an existing
  server via `LIGHTPANDA_WS=ws://host:port`.
- **Speed.** On a static Docusaurus build the crawl is several times faster
  per page (no `networkidle0` quiet-window, no layout). End-to-end speedup is
  bounded by the Chromium render stage that always runs.

Fidelity caveats (lightpanda is beta): content is extracted from the
pre-rendered DOM (`domcontentloaded`), which matches Chromium for standard
Docusaurus pages, but client-only widgets (`<BrowserOnly>`, live code blocks),
HTTP Basic Auth, and lazy-loaded images may differ or be unsupported. When in
doubt, use the default Chromium engine. The auto-fallback also protects you if
lightpanda is unavailable on a given platform.

### Docusaurus v1 - Legacy

<https://docusaurus.io/en/>

`initialDocURLs`: <https://docusaurus.io/docs/en/installation>

`demoPDF`: <https://github.com/jean-humann/docs-to-pdf/blob/master/pdf/v1-docusaurus.pdf>

`command`:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://docusaurus.io/docs/en/installation" --version=1
```

OR

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus.io/docs/en/installation" --contentSelector="article" --paginationSelector=".docs-prevnext > a.docs-next" --excludeSelectors=".fixedHeaderContainer,footer.nav-footer,#docsNav,nav.onPageNav,a.edit-page-link,div.docs-prevnext" --cssStyle=".navPusher {padding-top: 0;}" --pdfMargin="20"
```

#### PR to add new docs is welcome here... 😸

## 🐳 Docker Support

Docker images are available for running docs-to-pdf in containerized environments. Images are published for multiple Node.js versions (20, 22, 24) and both Alpine and Debian-based distributions.

### Quick Start with Docker

```bash
# Pull the latest image (Alpine with Node 24)
docker pull ghcr.io/jean-humann/docs-to-pdf:latest-node24-alpine

# Generate a PDF
docker run --rm -v $(pwd)/output:/docs-to-pdf/output \
  ghcr.io/jean-humann/docs-to-pdf:latest-node24-alpine \
  bash -c "docs-to-pdf --initialDocURLs='https://docusaurus-archive-october-2023.netlify.app/docs/2.3.1' --outputPDFFilename='output/docs.pdf'"
```

### Available Image Tags

Images follow the pattern: `<version>-node<X>-<os>`

Examples:

- `latest-node24-alpine` - Latest version with Node 24 on Alpine
- `latest-node22-debian` - Latest version with Node 22 on Debian
- `v1.2.3-node20-alpine` - Specific version with Node 20 on Alpine

### Development and Testing

For local development, testing, and contributing to Docker support, see the [Docker README](./docker/README.md).

## 📄 How `docs-to-pdf` works

1. [puppeteer](https://pptr.dev/) can make html to PDF like you can print HTML page in chrome browser
2. so, the idea of docs-to-pdf is **generating one big HTML through looping page link, then run [`page.pdf()`](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.page.pdf.md)** from puppeteer to generate PDF.

![docs-to-pdf-diagram](https://user-images.githubusercontent.com/29557494/90359040-c8fb9780-e092-11ea-89c7-1868bc32919f.png)

## 🎉 Thanks

This repo's code is coming from <https://github.com/KohheePeace/mr-pdf>.

Thanks for awesome code made by [@KohheePeace](https://github.com/KohheePeace/), [@maxarndt](https://github.com/maxarndt) and [@aloisklink](https://github.com/aloisklink).

[@bojl](https://github.com/bojl) approach to make TOC was awesome and breakthrough.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Setting up the development environment with [mise](https://mise.jit.su/)
- Running tests and linting
- Docker development and E2E testing
- Commit message conventions (Conventional Commits)
- Release process (automated via release-please-action)

For AI assistants working on this project, see [CLAUDE.md](./CLAUDE.md) for specific guidelines.
