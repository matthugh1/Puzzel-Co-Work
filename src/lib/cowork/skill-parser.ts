/**
 * Parse skill draft from PRD-format markdown.
 * Expects the format defined in storage/skills/skill-creator/SKILL.md:
 *   **Skill Name:** value
 *   **Category:** value
 *   **System Prompt:** followed by a fenced code block
 *   **Parameters:** followed by a markdown table
 *   etc.
 */

import type { SkillDraft, SkillParameter } from "@/types/skill";

const LABEL_PATTERNS = [
  ["Skill Name", "name"],
  ["Name", "name"],
  ["Category", "category"],
  ["Description", "description"],
  ["Example Input", "exampleInput"],
  ["Example User Input", "exampleInput"],
  ["Example Output", "exampleOutput"],
  ["Tags", "tags"],
  ["Triggers", "triggers"],
  ["Status", "status"],
] as const;

const PARAMETER_TYPES = [
  "text",
  "textarea",
  "select",
  "number",
  "boolean",
] as const;

/** Match **Label:** value (PRD format) */
function parseBoldLabel(text: string, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\*\\*${escaped}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n\\n|\\n\`\`\`|$)`,
    "s",
  );
  const m = text.match(re);
  const val = m?.[1];
  return val != null ? val.trim() : undefined;
}

/** Extract system prompt from fenced code block after **System Prompt:** */
function extractSystemPrompt(text: string): string | undefined {
  const m = text.match(
    /\*\*System Prompt:\*\*\s*(?:\([^)]*\))?\s*\n+```(?:\w+)?\n([\s\S]*?)```/,
  );
  const val = m?.[1];
  return val != null ? val.trim() : undefined;
}

/** Parse parameters from a markdown table after **Parameters:** */
function parseParametersTable(text: string): SkillParameter[] {
  const lines = text.split("\n");
  const params: SkillParameter[] = [];
  let inTable = false;
  let headers: string[] = [];

  for (const line of lines) {
    if (line.includes("**Parameters:**")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // Detect header row
      if (
        headers.length === 0 &&
        cells.some((c) => c.toLowerCase() === "name")
      ) {
        headers = cells.map((c) => c.toLowerCase());
        continue;
      }
      if (headers.length === 0) continue;

      // Skip separator row (---|---|---)
      if (cells.every((c) => /^[-:]+$/.test(c))) continue;

      if (cells.length < headers.length) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = (cells[i] ?? "").trim();
      });

      const name = row.name;
      if (!name) continue;

      const typeRaw = (row.type ?? "text").toLowerCase();
      const type = PARAMETER_TYPES.includes(
        typeRaw as (typeof PARAMETER_TYPES)[number],
      )
        ? (typeRaw as SkillParameter["type"])
        : "text";

      const defaultVal = row.default?.trim() || undefined;
      let options: string[] | undefined;
      let defaultForParam: string | undefined = defaultVal;

      if (row.options) {
        options = row.options
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      } else if (type === "select" && defaultVal && defaultVal.includes(",")) {
        options = defaultVal
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        defaultForParam = undefined;
      }

      params.push({
        name,
        label: row.label ?? name,
        type,
        description: row.description ?? "",
        required: /^(1|true|yes|y)$/i.test(row.required ?? "false"),
        default: defaultForParam,
        options,
      });
    } else if (inTable && line.trim() === "") {
      break;
    }
  }

  return params;
}

/** Parse comma-separated or JSON array strings into string[] */
function parseCommaList(val: string | undefined): string[] {
  if (!val || typeof val !== "string") return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const arr = JSON.parse(trimmed);
      return Array.isArray(arr)
        ? arr.filter((x) => typeof x === "string").map(String)
        : [];
    } catch {
      /* fall through to comma split */
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/**
 * Parse PRD-format skill markdown into a structured SkillDraft.
 * Returns null if essential fields (name, content) are missing.
 */
export function parseSkillFromMarkdown(
  markdown: string,
): Partial<SkillDraft> | null {
  const text = markdown.trim();
  if (!text) return null;

  const result: Partial<SkillDraft> = {};

  for (const [label, key] of LABEL_PATTERNS) {
    const val = parseBoldLabel(text, label);
    if (val !== undefined) {
      if (key === "tags" || key === "triggers") {
        (result as Record<string, unknown>)[key] = parseCommaList(val);
      } else if (key === "status") {
        (result as Record<string, unknown>)[key] = val;
      } else {
        (result as Record<string, unknown>)[key] = val
          .replace(/^["']|["']$/g, "")
          .trim();
      }
    }
  }

  const content = extractSystemPrompt(text);
  if (content) result.content = content;

  const parameters = parseParametersTable(text);
  if (parameters.length > 0) result.parameters = parameters;

  if (!result.name && !result.content) return null;

  result.category = result.category ?? "General";
  result.description = result.description ?? "";
  result.tags = result.tags ?? [];
  result.triggers = result.triggers ?? [];

  return result;
}

/**
 * Check if markdown contains a skill draft in PRD format.
 */
export function hasSkillDraftFormat(text: string): boolean {
  return text.includes("**Skill Name:**");
}

/**
 * Check if text contains the confirmation marker.
 */
export function hasSkillConfirmedMarker(text: string): boolean {
  return /\b%%SKILL_CONFIRMED%%\b/.test(text);
}
