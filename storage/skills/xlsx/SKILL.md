---
name: Excel Spreadsheet Generator
description: Generate Microsoft Excel (.xlsx) spreadsheets with data, formulas, formatting, and charts
triggers:
  - excel
  - xlsx
  - spreadsheet
  - .xlsx file
  - create excel
  - microsoft excel
---

# Excel Spreadsheet Generation Skill

This skill enables the agent to create Microsoft Excel spreadsheets (.xlsx format) with data, formulas, formatting, and charts.

## Installation

The `exceljs` npm package is required. Install it with:
```bash
npm install exceljs
```

## Usage Pattern

When generating Excel files:

1. **Import the library**:
   ```typescript
   import ExcelJS from "exceljs";
   ```

2. **Create workbook and worksheet**:
   ```typescript
   const workbook = new ExcelJS.Workbook();
   const worksheet = workbook.addWorksheet("Sheet1");
   ```

3. **Add data**:
   ```typescript
   // Set column headers
   worksheet.columns = [
     { header: "Name", key: "name", width: 20 },
     { header: "Age", key: "age", width: 10 },
   ];

   // Add rows
   worksheet.addRow({ name: "John", age: 30 });
   worksheet.addRow({ name: "Jane", age: 25 });
   ```

4. **Add formulas**:
   ```typescript
   worksheet.getCell("C2").value = { formula: "SUM(A2:B2)" };
   ```

5. **Style cells**:
   ```typescript
   worksheet.getRow(1).font = { bold: true };
   worksheet.getColumn(1).alignment = { vertical: "middle", horizontal: "center" };
   ```

6. **Generate file**:
   ```typescript
   const buffer = await workbook.xlsx.writeBuffer();
   // Write buffer to file using Write tool
   ```

7. **Save to outputs/** directory:
   - Use the `Write` tool to save the buffer as a `.xlsx` file
   - The file will be automatically registered as an artifact

## Common Patterns

### Data Tables
```typescript
worksheet.addTable({
  name: "MyTable",
  ref: "A1",
  columns: [{ name: "Column1" }, { name: "Column2" }],
  rows: [[1, 2], [3, 4]],
});
```

### Charts
```typescript
worksheet.addChart({
  type: "bar",
  name: "Chart",
  title: "My Chart",
  series: [{
    categories: ["A", "B", "C"],
    values: [1, 2, 3],
  }],
});
```

## Examples

- Create a data analysis spreadsheet with formulas
- Generate a formatted report with charts
- Build a budget or financial model
