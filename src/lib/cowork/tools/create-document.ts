/**
 * CreateDocument Tool
 * Creates Word (.docx) documents with formatted content
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { writeFile } from "fs/promises";
import path from "path";
import type { ToolExecutor } from "./types";

export const createDocumentTool: ToolExecutor = {
  name: "CreateDocument",
  description: "Create a formatted Word document (.docx) with headings, paragraphs, and styled text. The document will be saved to the session directory and made available for download.",
  parameters: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description: "Name of the document file (e.g., 'report.docx'). Must end with .docx",
      },
      title: {
        type: "string",
        description: "Main title of the document",
      },
      sections: {
        type: "array",
        description: "Array of sections, each with a heading and content paragraphs",
        items: {
          type: "object",
          properties: {
            heading: {
              type: "string",
              description: "Section heading text",
            },
            paragraphs: {
              type: "array",
              description: "Array of paragraph texts for this section",
              items: {
                type: "string",
              },
            },
          },
          required: ["heading", "paragraphs"],
        },
      },
    },
    required: ["filename", "title", "sections"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { filename, title, sections } = input as {
      filename: string;
      title: string;
      sections: Array<{ heading: string; paragraphs: string[] }>;
    };

    // Validate filename
    if (!filename || !filename.endsWith(".docx")) {
      return {
        content: "Error: filename must end with .docx",
        isError: true,
      };
    }

    if (!title || !sections || !Array.isArray(sections)) {
      return {
        content: "Error: title and sections are required",
        isError: true,
      };
    }

    try {
      // Build document structure
      const docParagraphs: Paragraph[] = [];

      // Add title
      docParagraphs.push(
        new Paragraph({
          text: title,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Add sections
      for (const section of sections) {
        // Section heading
        docParagraphs.push(
          new Paragraph({
            text: section.heading,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        // Section paragraphs
        for (const para of section.paragraphs) {
          docParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: para,
                  size: 24, // 12pt
                }),
              ],
              spacing: { after: 200 },
            })
          );
        }
      }

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docParagraphs,
          },
        ],
      });

      // Generate buffer
      const buffer = await Packer.toBuffer(doc);

      // Save to session directory
      const outputPath = path.join(context.sessionDir, filename);
      await writeFile(outputPath, buffer);

      return {
        content: `Document created successfully: ${filename}\nLocation: ${outputPath}\n\nThe document is now available for download in the Files panel.`,
        isError: false,
        metadata: {
          filename,
          path: outputPath,
          size: buffer.length,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error creating document: ${message}`,
        isError: true,
      };
    }
  },
};
