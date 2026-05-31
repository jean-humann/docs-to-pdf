---
sidebar_position: 4
title: FAQ (Details Test)
---

# FAQ Page

This page tests `<details>` elements in various states.

## Already Open (default open)

<details open>
<summary>What is docs-to-pdf?</summary>

A tool that generates PDFs from documentation websites like Docusaurus. This details element is **open by default** and should stay open during PDF generation.

</details>

<details open>
<summary>How does it work?</summary>

It uses Puppeteer to crawl pages, combine them into a single HTML document, and generate a PDF. This is also **open by default**.

</details>

## Closed by Default

<details>
<summary>How do I install it?</summary>

```bash
npm install -g docs-to-pdf
```

This details element is **closed by default** and should be opened during PDF generation.

</details>

<details>
<summary>What options are available?</summary>

Run `docs-to-pdf --help` to see all available options. This is also **closed by default**.

</details>

## Mixed Nesting

<details open>
<summary>Advanced Topics (open)</summary>

This outer details is open by default.

<details>
<summary>Nested closed topic</summary>

This nested details is closed and should be opened.

</details>

<details open>
<summary>Nested open topic</summary>

This nested details is already open and should stay open.

</details>

</details>
