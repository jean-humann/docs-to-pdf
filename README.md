# Docs to PDF

[![npm](https://img.shields.io/npm/v/docs-to-pdf?label=NPM%20STABLE&style=for-the-badge)](https://www.npmjs.com/package/docs-to-pdf)
![node-current](https://img.shields.io/node/v/docs-to-pdf?style=for-the-badge)
![npm](https://img.shields.io/npm/dt/docs-to-pdf?style=for-the-badge)
[![Codecov](https://img.shields.io/codecov/c/github/jean-humann/docs-to-pdf/branch/master?style=for-the-badge&token=YMY82958X4)](https://codecov.io/gh/jean-humann/docs-to-pdf)
![GitHub](https://img.shields.io/github/license/jean-humann/docs-to-pdf?style=for-the-badge)

## 📌 Introduction

This is a PDF generator from document website such as `docusaurus`. This is a fork of [mr-pdf](https://github.com/KohheePeace/mr-pdf) which was not maintained anymore.
Feel free to contribute to this project.

## 📦 Installation

```shell
npm install -g docs-to-pdf
```

## 🚀 Quick Start

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus.io/docs/" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
```


## ⚡ Usage

For [Docusaurus v2](https://docusaurus.io/docs)

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://docusaurus.io/docs/"
```

OR

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus.io/docs/" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
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
| `--paperFormat`        | No       | pdf format ex: `--paperFormat="A3"`. Please check this link for available formats [Puppeteer document](https://pptr.dev/#?product=Puppeteer&version=v5.2.1&show=api-pagepdfoptions)|
| `--disableTOC`         | No       | Optional toggle to show the table of contents or not                                                                                                                               |
| `--coverTitle`         | No       | Title for the PDF cover.                                                                                                                                                           |
| `--coverImage`         | No       | `<src>` Image for PDF cover (does not support SVG)                                                                                                                                 |
| `--coverSub`           | No       | Subtitle the for PDF cover. Add `<br/>` tags for multiple lines.                                                                                                                   |
| `--headerTemplate`     | No       | HTML template for the print header. Please check this link for details of injecting values [Puppeteer document](https://pptr.dev/#?product=Puppeteer&show=api-pagepdfoptions)      |
| `--footerTemplate`     | No       | HTML template for the print footer. Please check this link for details of injecting values [Puppeteer document](https://pptr.dev/#?product=Puppeteer&show=api-pagepdfoptions)      |
| `--puppeteerArgs`      | No       | Add puppeteer BrowserLaunchArgumentOptions arguments ex: --sandbox [Puppeteer document](https://pptr.dev/api/puppeteer.browserlaunchargumentoptions)                               |
| `--protocolTimeout`    | No       | Timeout setting for individual protocol calls in milliseconds. If omitted, the default value of 180000 ms (3 min) is used                                                          |
| `--filterKeyword`      | No       | Only adds pages to the PDF containing a given meta keywords. Makes it possible to generate PDFs of selected pages                                                                  |
| `--baseUrl`            | No       | Base URL for all relative URLs. Allows to render the pdf on localhost (ci/Github Actions) while referencing the deployed page.                                                     |
| `--excludePaths`       | No       | URL Paths to be excluded                                                                                                                                                           |
| `--restrictPaths`      | No       | Keep Only URL Path with the same rootPath as  `--initialDocURLs`                                                                                                                   |
|                        |          |                                                                                                                                                                                    |

## Docusaurus Options

| Option                 | Required | Description                                                                                                                                                                        |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--version`            | No       | Docusaurus version. Default is 2.                                                                                                                                                  |
| `--builDir`            | No       | Path to Docusaurus build dir. Either absolute or relative from path of the shell                                                                                                   |

## 🎨 Examples and Demo PDF



### Docusaurus v2

![20210603060438](https://user-images.githubusercontent.com/29557494/120552058-b4299e00-c431-11eb-833e-1ac1338b0a70.gif)

<https://docusaurus.io/>

`initialDocURLs`: <https://docusaurus.io/docs>

`demoPDF`: <https://github.com/jean-humann/docs-to-pdf/blob/master/pdf/v2-docusaurus.pdf>

`command`:

```shell
npx docs-to-pdf docusaurus --initialDocURLs="https://docusaurus.io/docs/"
```

OR

```shell
npx docs-to-pdf --initialDocURLs="https://docusaurus.io/docs/" --contentSelector="article" --paginationSelector="a.pagination-nav__link.pagination-nav__link--next" --excludeSelectors=".margin-vert--xl a,[class^='tocCollapsible'],.breadcrumbs,.theme-edit-this-page" --coverImage="https://docusaurus.io/img/docusaurus.png" --coverTitle="Docusaurus v2"
```

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

## 📄 How `docs-to-pdf` works

1. [puppeteer](https://pptr.dev/) can make html to PDF like you can print HTML page in chrome browser
2. so, the idea of docs-to-pdf is **generating one big HTML through looping page link, then run [`page.pdf()`](https://github.com/puppeteer/puppeteer/blob/main/docs/api/puppeteer.page.pdf.md)** from puppeteer to generate PDF.

![docs-to-pdf-diagram](https://user-images.githubusercontent.com/29557494/90359040-c8fb9780-e092-11ea-89c7-1868bc32919f.png)

## 🎉 Thanks

This repo's code is coming from <https://github.com/KohheePeace/mr-pdf>.

Thanks for awesome code made by [@KohheePeace](https://github.com/KohheePeace/), [@maxarndt](https://github.com/maxarndt) and [@aloisklink](https://github.com/aloisklink).

[@bojl](https://github.com/bojl) approach to make TOC was awesome and breakthrough.
