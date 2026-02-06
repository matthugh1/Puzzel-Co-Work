---
name: Word Document Generator
description: Generate Microsoft Word (.docx) documents with formatted text, tables, images, and styling
triggers:
  - word document
  - docx
  - .docx file
  - microsoft word
  - create word doc
---

# Word Document Generation Skill

This skill enables the agent to create Microsoft Word documents (.docx format) with rich formatting, tables, images, and styling.

## Installation

The `docx` npm package is required. Install it with:
```bash
npm install docx
```

## Usage Pattern

When generating Word documents:

1. **Import the library**:
   ```typescript
   import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
   ```

2. **Create document structure**:
   ```typescript
   const doc = new Document({
     sections: [{
       properties: {},
       children: [
         new Paragraph({
           text: "Title",
           heading: HeadingLevel.HEADING_1,
         }),
         new Paragraph({
           children: [
             new TextRun({
               text: "Body text with ",
             }),
             new TextRun({
               text: "bold formatting",
               bold: true,
             }),
           ],
         }),
       ],
     }],
   });
   ```

3. **Generate file**:
   ```typescript
   const buffer = await Packer.toBuffer(doc);
   // Write buffer to file using Write tool
   ```

4. **Save to outputs/** directory:
   - Use the `Write` tool to save the buffer as a `.docx` file
   - The file will be automatically registered as an artifact

## Common Patterns

### Tables
```typescript
new Table({
  rows: [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Header 1")] }),
        new TableCell({ children: [new Paragraph("Header 2")] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Data 1")] }),
        new TableCell({ children: [new Paragraph("Data 2")] }),
      ],
    }),
  ],
})
```

### Styling
- Use `bold: true`, `italics: true` for text formatting
- Use `HeadingLevel.HEADING_1` through `HEADING_6` for headings
- Use `alignment: AlignmentType.CENTER` for center alignment

## Examples

- Create a formatted report with headers, paragraphs, and tables
- Generate a letter or memo with proper formatting
- Build a structured document with sections and subsections
