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
  description:
    "Create a Word document (.docx) and save it so the user can download it. Call this only after you have already written the full content in your message. You MUST pass the actual text in sections: each section has 'heading' (string) and 'paragraphs' (array of strings). Put the full poem or document text into paragraphs—e.g. sections: [{ heading: 'Content', paragraphs: ['First paragraph or stanza.', 'Second paragraph.'] }]. Never call with empty paragraphs.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      filename: {
        type: "string",
        description:
          "Name of the document file (e.g., 'report.docx'). Must end with .docx",
      },
      title: {
        type: "string",
        description: "Main title of the document",
      },
      sections: {
        type: "array",
        description:
          "Array of sections, each with a heading and content paragraphs",
        items: {
          type: "object",
          additionalProperties: false,
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

    // Normalise filename: ensure it ends with .docx (append if missing)
    const base =
      typeof filename === "string" && filename.trim()
        ? filename.trim()
        : "document";
    const safeFilename = base.endsWith(".docx") ? base : `${base}.docx`;

    // Normalise sections: accept sections as array, and per-section accept paragraphs (array or single string) or content (string or array)
    const sectionsList = Array.isArray(sections) ? sections : [];
    const normalizedSections: Array<{ heading: string; paragraphs: string[] }> =
      [];

    for (const s of sectionsList) {
      if (s == null || typeof s !== "object") continue;
      const heading =
        typeof (s as { heading?: unknown }).heading === "string" &&
        (s as { heading: string }).heading.trim()
          ? (s as { heading: string }).heading.trim()
          : "Section";
      const rawParagraphs = (s as { paragraphs?: unknown }).paragraphs;
      const rawContent = (s as { content?: unknown }).content;
      let paras: string[] = [];
      if (Array.isArray(rawParagraphs)) {
        paras = rawParagraphs.map((p) =>
          typeof p === "string" ? p : String(p ?? ""),
        );
      } else if (typeof rawParagraphs === "string" && rawParagraphs.trim()) {
        paras = [rawParagraphs.trim()];
      }
      if (paras.length === 0 && rawContent !== undefined) {
        if (Array.isArray(rawContent)) {
          paras = rawContent.map((c) =>
            typeof c === "string" ? c : String(c ?? ""),
          );
        } else if (typeof rawContent === "string" && rawContent.trim()) {
          paras = [rawContent.trim()];
        }
      }
      normalizedSections.push({ heading, paragraphs: paras });
    }

    const hasRealContent = normalizedSections.some((s) =>
      s.paragraphs.some((p) => p.length > 0),
    );
    if (!hasRealContent) {
      // Log what we received so we can see why content was missing
      const received =
        sectionsList.length === 0
          ? "sections missing or empty array"
          : sectionsList
              .slice(0, 2)
              .map((s) => {
                const o = s as Record<string, unknown>;
                return {
                  keys: Object.keys(o),
                  hasParagraphs: Array.isArray(o.paragraphs),
                  paragraphsLen: Array.isArray(o.paragraphs)
                    ? o.paragraphs.length
                    : 0,
                  hasContent: "content" in o,
                };
              })
              .join("; ");
      console.warn(
        "[CreateDocument] No content in sections. Received:",
        received,
      );
      return {
        content: `No content was provided in the sections parameter. Call CreateDocument again with the same filename (e.g. "${safeFilename}"), a title, and sections containing the actual text. Example: sections: [{ heading: "Content", paragraphs: ["Your full poem or text here."] }]. The paragraphs array must contain the full poem or document text—do not send empty paragraphs.`,
        isError: true,
      };
    }

    const docTitle =
      typeof title === "string" && title.trim()
        ? title.trim()
        : safeFilename.replace(/\.docx$/i, "").replace(/[-_]/g, " ") ||
          "Document";

    const totalParas = normalizedSections.reduce(
      (n, s) => n + s.paragraphs.length,
      0,
    );
    console.log(
      "[CreateDocument] Creating doc sections=" +
        normalizedSections.length +
        " paragraphs=" +
        totalParas +
        " filename=" +
        safeFilename,
    );

    try {
      // Build document structure
      const docParagraphs: Paragraph[] = [];

      // Add title
      docParagraphs.push(
        new Paragraph({
          text: docTitle,
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
      );

      // Add sections
      for (const section of normalizedSections) {
        const heading =
          typeof section.heading === "string" && section.heading.trim()
            ? section.heading
            : "Section";
        const paras = Array.isArray(section.paragraphs)
          ? section.paragraphs
          : [];
        docParagraphs.push(
          new Paragraph({
            text: heading,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
        );
        for (const para of paras) {
          const text = typeof para === "string" ? para : String(para ?? "");
          docParagraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  size: 24, // 12pt
                }),
              ],
              spacing: { after: 200 },
            }),
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
      const outputPath = path.join(context.sessionDir, safeFilename);
      await writeFile(outputPath, buffer);

      return {
        content: `Document created successfully: ${safeFilename}\nLocation: ${outputPath}\n\nThe document is now available for download in the Files panel.`,
        isError: false,
        metadata: {
          filename: safeFilename,
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
