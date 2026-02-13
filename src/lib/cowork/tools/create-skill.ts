/**
 * CreateSkill Tool
 * Lets the agent create a reusable skill from the conversation.
 * Called ONLY after the user has confirmed the drafted skill in chat.
 */

import { db } from "@/lib/db";
import type { ToolExecutor } from "./types";

/**
 * Normalize raw tool input into a plain object.
 * Handles: JSON string input, nested input/arguments from some providers.
 */
function normalizeInput(input: unknown): Record<string, unknown> {
  // String input — parse as JSON
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  // Object input
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const raw = input as Record<string, unknown>;

    // Some providers nest params under input.input or input.arguments
    if (!("name" in raw) && !("content" in raw) && (raw.input || raw.arguments)) {
      const nested = (raw.input || raw.arguments) as unknown;
      if (typeof nested === "string") {
        try {
          return JSON.parse(nested) as Record<string, unknown>;
        } catch {
          return raw;
        }
      }
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        return nested as Record<string, unknown>;
      }
    }

    return raw;
  }

  return {};
}

export const createSkillTool: ToolExecutor = {
  name: "CreateSkill",
  description:
    "Create a new reusable AI skill (a structured prompt template the user can invoke later). " +
    "IMPORTANT WORKFLOW: Do NOT call this tool immediately. First have a conversation: " +
    "(1) Ask 2-3 clarifying questions about the skill's purpose, inputs, and expected output format. " +
    "(2) Draft the skill and show it to the user for review: name, description, system prompt, parameters, example input/output. " +
    "(3) Only call CreateSkill AFTER the user confirms the draft (says 'yes', 'looks good', 'create it', etc.). " +
    "Required fields: name (string), description (string), content (string — the full system prompt in markdown, use {{param}} for dynamic inputs), " +
    "category (string — one of: Writing, Analysis, Code, Research, General), " +
    "triggers (string array — phrases that activate the skill), tags (string array — searchable keywords), " +
    "parameters (JSON string — array of {name, label, type, description, required, default, options}, or '[]' if none), " +
    "exampleInput (string or null), exampleOutput (string or null). " +
    "Copy the EXACT values from the draft the user confirmed.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string", description: "Short name (e.g. 'Contract Notice Periods')" },
      description: { type: "string", description: "One-line summary of when to use this skill" },
      category: { type: "string", description: "Category: Writing, Analysis, Code, Research, or General" },
      triggers: { type: "array", items: { type: "string" }, description: "Phrases that activate the skill" },
      tags: { type: "array", items: { type: "string" }, description: "Searchable tags" },
      content: { type: "string", description: "Full system prompt / instructions in markdown (use {{param}} for dynamic inputs)" },
      parameters: { type: "string", description: "JSON array of parameter objects. Each object: {name, label, type, description, required, default, options}. Set default to null if none. Set options to null unless type is select. Pass \"[]\" if no parameters." },
      exampleInput: { type: ["string", "null"], description: "Example user input when using this skill, or null" },
      exampleOutput: { type: ["string", "null"], description: "Example output the skill produces, or null" },
    },
    required: ["name", "description", "content", "category", "triggers", "tags", "parameters", "exampleInput", "exampleOutput"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const raw = normalizeInput(input);

    // Debug logging — helps diagnose when the LLM sends malformed input
    const rawKeys = Object.keys(raw);
    console.log(
      `[CreateSkill] Received input: keys=[${rawKeys.join(",")}] nameType=${typeof raw.name} nameLen=${typeof raw.name === "string" ? raw.name.length : "N/A"} contentLen=${typeof raw.content === "string" ? raw.content.length : "N/A"}`,
    );

    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const description = typeof raw.description === "string" ? raw.description.trim() : "";
    const content = typeof raw.content === "string" ? raw.content.trim() : "";

    // Validate required fields
    if (!name) {
      return {
        content: 'Error: "name" is required. Pass the skill name exactly as shown in your draft.',
        isError: true,
      };
    }
    if (!description) {
      return {
        content: 'Error: "description" is required. Pass the skill description exactly as shown in your draft.',
        isError: true,
      };
    }
    if (!content) {
      return {
        content: 'Error: "content" is required. Pass the full system prompt / instructions from your draft.',
        isError: true,
      };
    }

    // Parse optional fields
    const category =
      typeof raw.category === "string" && raw.category.trim()
        ? raw.category.trim().slice(0, 80)
        : "General";

    const triggers = Array.isArray(raw.triggers)
      ? (raw.triggers as string[]).filter((t) => typeof t === "string" && t.trim()).slice(0, 20)
      : [];

    const tags = Array.isArray(raw.tags)
      ? (raw.tags as string[]).filter((t) => typeof t === "string" && t.trim()).slice(0, 50)
      : [];

    // Parameters come as a JSON string (to avoid nested object schema issues with OpenAI strict mode)
    let parsedParams: Record<string, unknown>[] = [];
    if (typeof raw.parameters === "string" && raw.parameters.trim()) {
      try {
        const parsed = JSON.parse(raw.parameters);
        if (Array.isArray(parsed)) parsedParams = parsed;
      } catch {
        // Not valid JSON — ignore
      }
    } else if (Array.isArray(raw.parameters)) {
      // Fallback: some providers might still pass an array directly
      parsedParams = raw.parameters as Record<string, unknown>[];
    }

    const paramList = parsedParams
      .filter(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof p.name === "string" &&
          typeof p.label === "string",
      )
      .slice(0, 20)
      .map((p) => ({
        name: String(p.name).trim(),
        label: String(p.label).trim(),
        type: ["text", "textarea", "select", "number", "boolean"].includes(String(p.type))
          ? p.type
          : "text",
        description: typeof p.description === "string" ? p.description.trim() : "",
        required: Boolean(p.required),
        default: typeof p.default === "string" ? p.default : undefined,
        options: Array.isArray(p.options)
          ? (p.options as unknown[]).filter((o) => typeof o === "string").slice(0, 50)
          : undefined,
      }));

    const exampleInput = typeof raw.exampleInput === "string" && raw.exampleInput.trim()
      ? raw.exampleInput.trim().slice(0, 2000)
      : null;
    const exampleOutput = typeof raw.exampleOutput === "string" && raw.exampleOutput.trim()
      ? raw.exampleOutput.trim().slice(0, 2000)
      : null;

    const status = raw.status === "draft" ? "draft" : "published";

    try {
      const skill = await db.coworkSkill.create({
        data: {
          organizationId: context.organizationId,
          sessionId: context.sessionId,
          name,
          description,
          category,
          triggers,
          tags,
          content,
          parameters: paramList as object[],
          exampleInput,
          exampleOutput,
          status,
          createdById: context.userId,
        },
      });

      return {
        content: `Skill "${skill.name}" was created successfully. It is now available in this chat. The user can invoke it by name or by saying things that match its description or triggers.`,
        isError: false,
        metadata: { skillId: skill.id, skillName: skill.name },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[CreateSkill] Error:", error);
      return {
        content: `Failed to create skill: ${message}`,
        isError: true,
      };
    }
  },
};
