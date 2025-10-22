---
sidebar_position: 7
---

# Details Element Test

This page tests the handling of `<details>` elements in PDF generation.

## Simple Details Element

<details>
  <summary>Toggle me!</summary>
  <div>
    <div>This is the detailed content</div>
  </div>
</details>

## Nested Details Elements

<details>
  <summary>Click to expand</summary>
  <div>
    <p>This is the outer details content</p>
    <details>
      <summary>Nested toggle! Some surprise inside...</summary>
      <div>😲😲😲😲😲</div>
    </details>
  </div>
</details>

## Why This Matters

The `<details>` element is commonly used in documentation for:
- Collapsible code examples
- FAQ sections
- Optional reading material
- Long explanations that don't need to be visible by default

When generating PDFs, all `<details>` elements should be expanded so that the content is visible in the final document.
