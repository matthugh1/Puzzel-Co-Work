/**
 * CreateSpreadsheet Tool
 * Creates Excel (.xlsx) spreadsheets with data tables
 */

import * as XLSX from "xlsx";
import { writeFile } from "fs/promises";
import path from "path";
import type { ToolExecutor } from "./types";

export const createSpreadsheetTool: ToolExecutor = {
  name: "CreateSpreadsheet",
  description: "Create an Excel spreadsheet (.xlsx) with one or more sheets containing tabular data. The spreadsheet will be saved to the session directory and made available for download.",
  parameters: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description: "Name of the spreadsheet file (e.g., 'data.xlsx'). Must end with .xlsx",
      },
      sheets: {
        type: "array",
        description: "Array of sheets, each with a name and data table",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Sheet name (e.g., 'Sales Data')",
            },
            data: {
              type: "array",
              description: "Array of rows, where each row is an array of cell values. First row typically contains headers.",
              items: {
                type: "array",
                items: {
                  oneOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "null" },
                  ],
                },
              },
            },
          },
          required: ["name", "data"],
        },
      },
    },
    required: ["filename", "sheets"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { filename, sheets } = input as {
      filename: string;
      sheets: Array<{ name: string; data: unknown[][] }>;
    };

    // Validate filename
    if (!filename || !filename.endsWith(".xlsx")) {
      return {
        content: "Error: filename must end with .xlsx",
        isError: true,
      };
    }

    if (!sheets || !Array.isArray(sheets) || sheets.length === 0) {
      return {
        content: "Error: at least one sheet is required",
        isError: true,
      };
    }

    try {
      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Add each sheet
      for (const sheet of sheets) {
        if (!sheet.name || !Array.isArray(sheet.data)) {
          return {
            content: `Error: sheet must have name and data array`,
            isError: true,
          };
        }

        const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
      }

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      // Save to session directory
      const outputPath = path.join(context.sessionDir, filename);
      await writeFile(outputPath, buffer);

      const sheetSummary = sheets
        .map(
          (s, i) =>
            `  ${i + 1}. "${s.name}" - ${s.data.length} rows × ${s.data[0]?.length || 0} columns`
        )
        .join("\n");

      return {
        content: `Spreadsheet created successfully: ${filename}\nLocation: ${outputPath}\n\nSheets:\n${sheetSummary}\n\nThe spreadsheet is now available for download in the Files panel.`,
        isError: false,
        metadata: {
          filename,
          path: outputPath,
          size: buffer.length,
          sheets: sheets.map((s) => ({
            name: s.name,
            rows: s.data.length,
            columns: s.data[0]?.length || 0,
          })),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error creating spreadsheet: ${message}`,
        isError: true,
      };
    }
  },
};
