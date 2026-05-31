# Architecture Documentation: PDF Generation Process

This document provides a detailed technical overview of how `docs-to-pdf` generates PDFs from documentation websites, including HTML extraction with Puppeteer, PDF creation, and PDF manipulation with bookmarks/outlines.

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Phase 1: HTML Extraction with Puppeteer](#phase-1-html-extraction-with-puppeteer)
- [Phase 2: HTML Processing and Restructuring](#phase-2-html-processing-and-restructuring)
- [Phase 3: PDF Generation](#phase-3-pdf-generation)
- [Phase 4: PDF Manipulation and Outline Injection](#phase-4-pdf-manipulation-and-outline-injection)
- [Key Components](#key-components)
- [Data Flow](#data-flow)
- [Technical Details](#technical-details)

## Overview

The `docs-to-pdf` tool converts documentation websites (particularly Docusaurus sites) into PDF files with full support for navigation through bookmarks/outlines. The process involves four main phases:

1. **HTML Extraction**: Using Puppeteer to crawl and extract content
2. **HTML Processing**: Restructuring and combining content from multiple pages
3. **PDF Generation**: Converting HTML to PDF using Chrome's PDF engine
4. **PDF Manipulation**: Adding bookmarks/outlines using pdf-lib

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PHASE 1: HTML EXTRACTION                        │
│                         (Puppeteer)                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Documentation Website(s)                                           │
│         ↓                                                           │
│  ┌──────────────────┐                                              │
│  │ Launch Browser   │ ← Puppeteer with Chrome/Chromium            │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Navigate to URLs │ ← Process initialDocURLs                     │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Extract Content  │ ← contentSelector, excludeSelectors          │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Follow Pagination│ ← paginationSelector                         │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Open <details>   │ ← Expand collapsible elements                │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Extract iframes  │ ← Optional iframe content extraction         │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│     HTML Content (String)                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│              PHASE 2: HTML PROCESSING & RESTRUCTURING               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  HTML Content (from Phase 1)                                        │
│         ↓                                                           │
│  ┌──────────────────┐                                              │
│  │ Generate Cover   │ ← coverTitle, coverImage, coverSub          │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Extract Headers  │ ← Parse h1-h6 tags                           │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Generate TOC     │ ← Create table of contents                   │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Assign Header IDs│ ← Ensure all headers have unique IDs        │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Combine HTML     │ ← Cover + TOC + Content                      │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Inject into Page │ ← Load combined HTML into Puppeteer page    │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Apply CSS Styles │ ← cssStyle option                            │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Scroll to Bottom │ ← Force lazy-loaded images to load          │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│     Fully Rendered HTML Page                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                   PHASE 3: PDF GENERATION                           │
│                   (Puppeteer + Chrome PDF Engine)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Fully Rendered HTML Page (from Phase 2)                            │
│         ↓                                                           │
│  ┌──────────────────┐                                              │
│  │ Get Page         │ ← Calculate document dimensions              │
│  │ Dimensions       │   (width, height in pixels)                  │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Extract Outline  │ ← Parse h1-h6 with positions                 │
│  │ Structure        │   (getOutline function)                      │
│  └────────┬─────────┘                                              │
│           │                                                         │
│           │  Returns: OutlineNode[]                                │
│           │  - title: heading text                                 │
│           │  - destination: heading ID                             │
│           │  - yPosition: Y coordinate from top (pixels)          │
│           │  - children: nested headings                           │
│           │  - depth: heading level (h1=0, h2=1, etc.)            │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Call page.pdf()  │ ← Chrome's Print to PDF                      │
│  │                  │   Options:                                   │
│  │                  │   - paperFormat (A4, Letter, etc.)          │
│  │                  │   - margins                                  │
│  │                  │   - headerTemplate/footerTemplate           │
│  │                  │   - printBackground: true                    │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│     PDF Buffer (Uint8Array)                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│            PHASE 4: PDF MANIPULATION & OUTLINE INJECTION            │
│                         (pdf-lib)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PDF Buffer + Outline Structure (from Phase 3)                      │
│         ↓                                                           │
│  ┌──────────────────┐                                              │
│  │ Load PDF with    │ ← PDFDocument.load(buffer)                   │
│  │ pdf-lib          │                                              │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Get PDF Page     │ ← pdfDoc.getPage(0)                          │
│  │ Dimensions       │   (height in points for calculations)        │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Map HTML         │ ← Convert pixel coordinates to PDF points    │
│  │ Coordinates to   │                                              │
│  │ PDF Points       │   Formula:                                   │
│  │                  │   pageIndex = floor(yPixels / docHeight      │
│  │                  │                     * pdfPageCount)           │
│  │                  │   yPoints = pdfPageHeight -                  │
│  │                  │             (yPixels % pageHeight) *         │
│  │                  │             (pdfPageHeight / pageHeight)     │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Build Outline    │ ← Create PDF outline objects                 │
│  │ Objects          │   - PDFRef for each outline item             │
│  │                  │   - Parent/child relationships                │
│  │                  │   - Explicit destinations [page, /XYZ, x, y] │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Add Outline to   │ ← pdfDoc.catalog.set('Outlines', ...)        │
│  │ PDF Catalog      │                                              │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Save PDF         │ ← pdfDoc.save() returns buffer               │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│  ┌──────────────────┐                                              │
│  │ Write to File    │ ← fs.writeFile(filename, buffer)             │
│  └────────┬─────────┘                                              │
│           ↓                                                         │
│     Final PDF with Bookmarks                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Phase 1: HTML Extraction with Puppeteer

### File: `src/core.ts`

The first phase uses [Puppeteer](https://pptr.dev/) (a headless Chrome/Chromium automation library) to extract HTML content from documentation websites.

#### Key Steps:

1. **Browser Launch**
   ```typescript
   const browser = await puppeteer.launch({
     headless: true,
     executablePath: chromeExecPath(),
     args: puppeteerArgs,
     protocolTimeout: protocolTimeout,
   });
   ```

2. **Page Navigation and Content Extraction**
   - Iterate through `initialDocURLs`
   - Follow pagination links using `paginationSelector`
   - Extract content using `contentSelector`
   - Track visited URLs to prevent infinite loops

3. **Content Processing**
   ```typescript
   // Open collapsible <details> elements
   await utils.openDetails(page);
   
   // Extract HTML content (optionally including iframes)
   contentHTML += await utils.getHtmlContent(
     page,
     contentSelector,
     extractIframes
   );
   ```

4. **Special Handling**
   - **HTTP Basic Auth**: Authenticate using `page.authenticate()`
   - **Request Interception**: Block PDF files to prevent navigation issues
   - **Details Elements**: Automatically expand `<details>` tags
   - **Iframe Extraction**: Optionally extract same-origin iframe content

### Technical Details

#### URL Filtering
Pages are filtered based on:
- `excludeURLs`: Explicit URL exclusion list
- `filterKeyword`: Meta keywords filtering
- `excludePaths`: Path-based exclusion
- `restrictPaths`: Limit to specific path patterns

#### Circular Pagination Detection
```typescript
const visitedURLs = new Set<string>();
if (visitedURLs.has(nextPageURL)) {
  console.log('Skipping already visited URL (circular pagination detected)');
  break;
}
visitedURLs.add(nextPageURL);
```

## Phase 2: HTML Processing and Restructuring

### File: `src/utils.ts`

After extracting HTML from all pages, the content is restructured into a single document.

#### Key Steps:

1. **Cover Generation**
   ```typescript
   const coverImageHtml = generateImageHtml(image.base64, image.type);
   const coverHTML = generateCoverHtml(coverTitle, coverImageHtml, coverSub);
   ```

2. **Table of Contents (TOC) Generation**
   ```typescript
   const { modifiedContentHTML, tocHTML } = generateToc(contentHTML, {
     tocTitle,
     maxLevel: 4, // Default: h1 to h4
   });
   ```
   - Parses all headers (h1-h6)
   - Generates unique IDs for headers without IDs
   - Creates hierarchical TOC HTML
   - Links TOC entries to headers via anchor tags

3. **Header ID Assignment**
   ```typescript
   function replaceHeader(match: string): string {
     if (match.includes('id=')) {
       // Replace existing ID
       return match.replace(/id="[^"]*"/, `id="${newId}"`);
     } else {
       // Add new ID
       return match.replace('>', ` id="${newId}">`);
     }
   }
   ```

4. **HTML Combination**
   ```typescript
   await page.evaluate(
     concatHtml,
     coverHTML,
     tocHTML,
     modifiedContentHTML,
     disableTOC,
     disableCover,
     baseUrl
   );
   ```
   - Injects combined HTML into the page's DOM
   - Adds base URL if specified
   - Optionally excludes cover or TOC

5. **CSS Application**
   ```typescript
   await page.addStyleTag({ content: cssStyle });
   ```

6. **Image Loading**
   ```typescript
   await scrollPageToBottom(page, {});
   ```
   - Scrolls to bottom to trigger lazy-loaded images

## Phase 3: PDF Generation

### File: `src/pdf/generate.ts`

This phase converts the rendered HTML page into a PDF using Chrome's built-in PDF rendering engine.

#### Key Steps:

1. **Get Page Dimensions**
   ```typescript
   const pageDimensions = await page.evaluate(() => {
     return {
       width: document.documentElement.scrollWidth,
       height: document.documentElement.scrollHeight,
     };
   });
   ```
   - Captures full document dimensions in pixels
   - Used later for coordinate mapping

2. **Extract Outline Structure**
   ```typescript
   const outline = await getOutline(page, [
     'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
   ]);
   ```
   
   The `getOutline` function:
   - Runs in browser context via `page.evaluate()`
   - Queries all heading elements
   - Captures for each heading:
     - `title`: Inner text of the heading
     - `destination`: The heading's ID attribute (encoded)
     - `yPosition`: Y coordinate from document top (in pixels)
     - `depth`: Heading level (h1=0, h2=1, etc.)
   - Builds hierarchical tree structure matching heading nesting

   Example outline structure:
   ```typescript
   [
     {
       title: "Introduction",
       destination: "introduction",
       yPosition: 150,
       depth: 0,
       children: [
         {
           title: "Getting Started",
           destination: "getting-started",
           yPosition: 300,
           depth: 1,
           children: []
         }
       ]
     }
   ]
   ```

3. **Generate PDF**
   ```typescript
   const pdf = await page.pdf({
     path: outputPDFFilename,
     format: paperFormat,
     margin: pdfMargin,
     headerTemplate: headerTemplate,
     footerTemplate: footerTemplate,
     displayHeaderFooter: !!(headerTemplate || footerTemplate),
     printBackground: true,
     timeout: 0,
   });
   ```
   - Uses Chrome's print-to-PDF functionality
   - Returns PDF as a `Uint8Array` buffer
   - Supports custom paper formats (A4, Letter, Legal, etc.)
   - Includes headers/footers if provided

### File: `src/pdf/outline.ts`

Contains utility functions for outline extraction and manipulation.

#### `getOutline()` Function

Executed in browser context to extract heading structure:

```typescript
await page.evaluate((tags, outlineSelector) => {
  // Query all heading elements
  const tagsToProcess = Array.from(
    document.querySelectorAll(outlineSelector)
  ).reverse();
  
  // Build hierarchical tree
  const root = { children: [], depth: -1 };
  let currentOutlineNode = root;
  
  while (tagsToProcess.length > 0) {
    const tag = tagsToProcess.pop();
    const orderDepth = tags.indexOf(tag.tagName.toLowerCase());
    
    // Get Y position from top of document
    const rect = tag.getBoundingClientRect();
    const yPosition = window.scrollY + rect.top;
    
    // Create node and manage hierarchy
    const newNode = {
      title: tag.innerText.trim(),
      destination: encodeURIComponent(tag.id),
      yPosition: yPosition,
      children: [],
      depth: orderDepth,
    };
    
    // Add to appropriate parent based on depth
    // ...
  }
  
  return root.children;
}, tags, selectors);
```

## Phase 4: PDF Manipulation and Outline Injection

### File: `src/pdf/outline.ts` - `setOutline()` Function

This phase uses [pdf-lib](https://pdf-lib.js.org/) to manipulate the PDF and inject bookmark/outline metadata.

#### Key Steps:

1. **Load PDF**
   ```typescript
   const pdfDoc = await PDFDocument.load(pdf);
   ```
   - Parses the PDF buffer into a modifiable document

2. **Get PDF Page Dimensions**
   ```typescript
   const pdfPage = pdfDoc.getPage(0);
   const pdfPageHeight = pdfPage.getHeight();
   ```
   - Gets page height in points (1 point = 1/72 inch)
   - Assumes all pages have same dimensions

3. **Coordinate Mapping**

   The most complex part: mapping HTML pixel coordinates to PDF page coordinates.

   **Problem**: 
   - HTML document is measured in pixels from top (Y increases downward)
   - PDF pages are measured in points from bottom (Y increases upward)
   - HTML is one continuous scroll, PDF has discrete pages

   **Solution**:
   ```typescript
   // Calculate which PDF page this heading is on
   const pageIndex = Math.floor(
     (item.yPosition / documentHeightInPixels) * pdfDoc.getPageCount()
   );
   
   // Calculate Y position within that page
   const pageLocalYPixels = item.yPosition % documentHeightInPixels;
   const yPositionInPoints = 
     pdfPageHeightInPoints - 
     pageLocalYPixels * (pdfPageHeightInPoints / documentHeightInPixels);
   ```

   **Limitations**:
   - Assumes uniform content distribution across pages
   - May be inaccurate for complex layouts with page breaks
   - Works well for continuous documentation content

4. **Create PDF References**
   ```typescript
   function addRefsForOutlineItems(
     outlines: OutlineNode[],
     context: PDFContext,
     parentRef: PDFRef
   ): OutlineRef[] {
     return outlines.map((item) => {
       const itemRef = context.nextRef();
       return {
         ...item,
         ref: itemRef,
         parentRef,
         children: addRefsForOutlineItems(item.children, context, itemRef),
       };
     });
   }
   ```
   - Recursively assigns PDF references to each outline item
   - Maintains parent-child relationships

5. **Build PDF Outline Objects**
   ```typescript
   function buildPdfObjectsForOutline(
     outlinesWithRef: OutlineRef[],
     context: PDFContext,
     pdfDoc: PDFDocument,
     pageHeightInPixels: number,
     pdfPageHeightInPoints: number
   ) {
     for (const [i, item] of outlinesWithRef.entries()) {
       const pdfObject: DictMap = new Map();
       
       // Set title
       pdfObject.set(
         PDFName.of('Title'),
         PDFHexString.fromText(decode(item.title))
       );
       
       // Create explicit destination
       const page = pdfDoc.getPage(pageIndex);
       const pageRef = page.ref;
       
       const destArray = PDFArray.withContext(context);
       destArray.push(pageRef);           // Target page
       destArray.push(PDFName.of('XYZ'));  // Destination type
       destArray.push(PDFNumber.of(0));    // Left (X)
       destArray.push(PDFNumber.of(yPositionInPoints)); // Top (Y)
       destArray.push(PDFNumber.of(0));    // Zoom (0 = keep current)
       
       pdfObject.set(PDFName.of('Dest'), destArray);
       pdfObject.set(PDFName.of('Parent'), item.parentRef);
       
       // Set previous/next siblings
       if (prev) pdfObject.set(PDFName.of('Prev'), prev.ref);
       if (next) pdfObject.set(PDFName.of('Next'), next.ref);
       
       // Set first/last children
       if (item.children.length > 0) {
         pdfObject.set(PDFName.of('First'), item.children[0].ref);
         pdfObject.set(PDFName.of('Last'), item.children[...].ref);
         pdfObject.set(PDFName.of('Count'), PDFNumber.of(childCount));
       }
       
       context.assign(item.ref, PDFDict.fromMapWithContext(pdfObject, context));
       
       // Recursively process children
       buildPdfObjectsForOutline(item.children, ...);
     }
   }
   ```

6. **Add Outline to PDF Catalog**
   ```typescript
   const outlineObject: DictMap = new Map();
   outlineObject.set(PDFName.of('Type'), PDFName.of('Outlines'));
   outlineObject.set(PDFName.of('First'), outlinesWithRef[0].ref);
   outlineObject.set(PDFName.of('Last'), outlinesWithRef[last].ref);
   outlineObject.set(PDFName.of('Count'), PDFNumber.of(totalCount));
   
   pdfDoc.context.assign(rootOutlineRef, PDFDict.fromMapWithContext(...));
   pdfDoc.catalog.set(PDFName.of('Outlines'), rootOutlineRef);
   ```

7. **Save and Write PDF**
   ```typescript
   const buffer = await pdfDoc.save();
   await writeFile(outputPDFFilename, buffer);
   ```

### PDF Structure

The generated PDF follows the PDF specification for outlines:

```
PDF Document
├── Catalog
│   ├── Pages
│   │   ├── Page 1
│   │   ├── Page 2
│   │   └── ...
│   └── Outlines (Root)
│       ├── First → OutlineItem 1
│       ├── Last → OutlineItem N
│       └── Count → Total items
│
└── Outline Items
    ├── OutlineItem 1
    │   ├── Title: "Introduction"
    │   ├── Dest: [Page 1, /XYZ, 0, 500, 0]
    │   ├── Parent: Root
    │   ├── Next: OutlineItem 2
    │   ├── First: OutlineItem 1.1
    │   └── Count: 2 (children)
    │
    ├── OutlineItem 1.1
    │   ├── Title: "Getting Started"
    │   ├── Dest: [Page 1, /XYZ, 0, 350, 0]
    │   ├── Parent: OutlineItem 1
    │   └── Next: OutlineItem 1.2
    │
    └── ...
```

## Key Components

### Core Module (`src/core.ts`)

Entry point for PDF generation:
- Orchestrates all phases
- Manages browser lifecycle
- Handles errors and cleanup

### Utils Module (`src/utils.ts`)

HTML processing utilities:
- `getHtmlContent()`: Extract content from page
- `generateToc()`: Create table of contents
- `openDetails()`: Expand collapsible elements
- `concatHtml()`: Combine HTML sections

### PDF Generate Module (`src/pdf/generate.ts`)

PDF generation coordination:
- `PDF` class: Main PDF generation interface
- Bridges Puppeteer and pdf-lib

### PDF Outline Module (`src/pdf/outline.ts`)

Outline/bookmark management:
- `getOutline()`: Extract heading structure from HTML
- `setOutline()`: Inject outline into PDF
- `formatOutlineContainerSelector()`: Selector utilities

### Provider Module (`src/provider/docusaurus.ts`)

Docusaurus-specific logic:
- Version detection
- Build directory handling
- Server management for local builds

## Data Flow

### Complete Flow Diagram

```
User Command (CLI)
    ↓
generatePDF(options)
    ↓
┌───────────────────────────────────────┐
│ Launch Puppeteer Browser              │
│  - Chrome/Chromium                    │
│  - Headless mode                      │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│ For each initialDocURL:               │
│  ┌─────────────────────────────────┐ │
│  │ Navigate to URL                 │ │
│  │ Extract content (contentSelector)│ │
│  │ Follow pagination               │ │
│  │ Accumulate HTML                 │ │
│  └─────────────────────────────────┘ │
└───────────┬───────────────────────────┘
            ↓
    contentHTML (accumulated)
            ↓
┌───────────────────────────────────────┐
│ Generate Cover                        │
│ Generate TOC from headers             │
│ Assign IDs to headers                 │
│ Combine: cover + TOC + content        │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│ Inject combined HTML into page        │
│ Apply CSS styles                      │
│ Scroll to load images                 │
└───────────┬───────────────────────────┘
            ↓
┌───────────────────────────────────────┐
│ PDF.generate(page)                    │
│  ┌─────────────────────────────────┐ │
│  │ Get page dimensions             │ │
│  │ Extract outline (getOutline)    │ │
│  │ Call page.pdf()                 │ │
│  │ Load PDF with pdf-lib           │ │
│  │ Add outline (setOutline)        │ │
│  │ Save PDF                        │ │
│  └─────────────────────────────────┘ │
└───────────┬───────────────────────────┘
            ↓
    Final PDF File with Bookmarks
```

## Technical Details

### Puppeteer Configuration

```typescript
{
  headless: true,              // Run without GUI
  executablePath: chromeExecPath(), // Chrome/Chromium path
  args: puppeteerArgs,         // Custom Chrome flags
  protocolTimeout: protocolTimeout, // DevTools Protocol timeout
}
```

### PDF Options

```typescript
{
  path: outputPDFFilename,     // Output file path
  format: paperFormat,         // A4, Letter, Legal, etc.
  margin: pdfMargin,           // { top, right, bottom, left }
  headerTemplate: '...',       // HTML template for header
  footerTemplate: '...',       // HTML template for footer
  displayHeaderFooter: true,   // Enable headers/footers
  printBackground: true,       // Include background colors/images
  timeout: 0,                  // Disable timeout
}
```

### Outline Node Structure

```typescript
interface OutlineNode {
  title: string;               // Heading text
  destination: string;         // Heading ID (URL encoded)
  yPosition: number;           // Y coordinate in pixels
  children: OutlineNode[];     // Nested headings
  depth: number;               // Heading level (0-5 for h1-h6)
  parent?: OutlineNode;        // Parent node reference
  italic?: boolean;            // Text styling
  bold?: boolean;              // Text styling
  color?: number[];            // RGB color [0-1, 0-1, 0-1]
}
```

### Coordinate Conversion

**HTML Coordinates → PDF Coordinates**

1. **Page Index Calculation**:
   ```
   pageIndex = floor((yPixels / documentHeightPixels) * pageCount)
   ```

2. **Y Position Calculation**:
   ```
   pageLocalYPixels = yPixels % documentHeightPixels
   yPoints = pdfPageHeight - (pageLocalYPixels * (pdfPageHeight / pageHeightPixels))
   ```

3. **Coordinate Systems**:
   - HTML: Origin at top-left, Y increases downward, measured in pixels
   - PDF: Origin at bottom-left, Y increases upward, measured in points

### PDF Destination Format

Explicit destinations use the `/XYZ` format:
```
[pageRef, /XYZ, left, top, zoom]
```
- `pageRef`: Reference to target page
- `/XYZ`: Destination type (explicit coordinates)
- `left`: X coordinate (0 = left margin)
- `top`: Y coordinate from bottom
- `zoom`: Zoom level (0 = retain current zoom)

## Dependencies

### Core Dependencies

- **puppeteer / puppeteer-core**: Headless browser automation
- **pdf-lib**: PDF manipulation and outline injection
- **html-entities**: HTML entity decoding for special characters
- **chalk**: Colored console output
- **fs-extra**: Enhanced file system operations

### Why These Libraries?

1. **Puppeteer**: 
   - Industry-standard for browser automation
   - Direct access to Chrome's PDF rendering engine
   - Full control over page rendering and JavaScript execution

2. **pdf-lib**:
   - Pure JavaScript PDF manipulation
   - No external dependencies
   - Full PDF specification support
   - Can modify existing PDFs (crucial for outline injection)

3. **html-entities**:
   - Properly decodes HTML entities in heading text
   - Ensures bookmark titles display correctly

## Performance Considerations

### Memory Usage

- Large documentation sites can require significant memory
- Chrome process memory scales with page size
- pdf-lib loads entire PDF into memory

### Optimization Strategies

1. **Incremental Processing**: Process pages one at a time
2. **Browser Cleanup**: Close browser after PDF generation
3. **Image Loading**: Only load visible images initially
4. **Cleanup**: Remove temporary Chrome data directories

### Timing

Typical generation times:
- Small site (< 10 pages): 10-30 seconds
- Medium site (10-50 pages): 1-3 minutes
- Large site (> 50 pages): 3-10+ minutes

## Error Handling

### Browser Errors

```typescript
try {
  await browser.close();
} finally {
  // Always cleanup temp directory
  if (chromeTmpDataDir) {
    fs.removeSync(chromeTmpDataDir);
  }
}
```

### PDF Generation Errors

```typescript
const pdf = await page.pdf(options).catch((err) => {
  console.error(chalk.red(err));
  throw err; // Preserve stack trace
});
```

### Outline Injection Errors

- Gracefully handles missing destinations
- Warns about inaccessible heading IDs
- Returns unmodified PDF if outline is empty

## Future Improvements

### Coordinate Mapping

The current page index calculation assumes uniform content distribution:
```typescript
const pageIndex = Math.floor(
  (item.yPosition / pageHeightInPixels) * pdfDoc.getPageCount()
);
```

**Potential Improvements**:
1. Capture actual page break positions during PDF generation
2. Use Chrome DevTools Protocol to query page boundaries
3. Add integration tests with multi-page documents
4. Implement fallback strategies for complex layouts

### Performance

1. Stream PDF generation instead of loading entire document
2. Parallel page processing where possible
3. Caching of unchanged pages

### Features

1. **Optional Outline**: Add `disableOutline` option
2. **Custom Outline Depth**: Allow limiting bookmark depth
3. **Outline Styling**: Support bold/italic/colors in bookmarks
4. **Progress Reporting**: Real-time progress updates for large sites

## Credits

The outline generation code is adapted from [asciidoctor-web-pdf](https://github.com/ggrossetie/asciidoctor-web-pdf) by Guillaume Grossetie, licensed under the MIT License.

## References

- [Puppeteer Documentation](https://pptr.dev/)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [PDF Specification - Outlines](https://www.adobe.com/content/dam/acom/en/devnet/pdf/pdfs/PDF32000_2008.pdf)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
