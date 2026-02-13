/**
 * Skill Tool
 * Allows the agent to explicitly invoke a skill by name
 */

import { loadSessionSkills, loadSkillContent } from "../skills";
import { buildPromptFromSkill } from "../skill-runner";
import type { ToolExecutor } from "./types";

/** Extract {{placeholder_name}} tokens from content */
function extractPlaceholders(content: string): string[] {
  const re = /\{\{(\w+)\}\}/g;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) set.add(m[1]!);
  return Array.from(set);
}

export const skillTool: ToolExecutor = {
  name: "Skill",
  description:
    "Load a custom skill's full instructions by name. Call this tool when the user's request matches one of the Available Custom Skills. The tool returns the skill's detailed instructions as text — read them and follow them precisely. If the skill content contains {{parameter}} placeholders and you don't have values yet, call AskUserQuestion first to collect them, then call this tool again with paramValues.",
  parameters: {
    type: "object",
    properties: {
      skillName: {
        type: "string",
        description:
          "Name or ID of the skill to invoke (e.g., 'docx', 'xlsx', 'web-artifacts-builder')",
      },
      paramValues: {
        type: "object",
        description:
          'Optional. Key-value map for {{parameter_name}} placeholders (e.g. {"document_title": "Q4 Report"}). Use after collecting values via AskUserQuestion.',
        additionalProperties: { type: "string" },
      },
    },
    required: ["skillName"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { skillName, paramValues: rawParamValues } = input as {
      skillName: string;
      paramValues?: Record<string, string>;
    };

    const paramValues: Record<string, string> =
      rawParamValues && typeof rawParamValues === "object"
        ? Object.fromEntries(
            Object.entries(rawParamValues).filter(
              (e): e is [string, string] =>
                typeof e[0] === "string" && typeof e[1] === "string",
            ),
          )
        : {};

    if (!skillName || typeof skillName !== "string") {
      return {
        content: "Error: skillName must be a non-empty string",
        isError: true,
      };
    }

    try {
      const registry = await loadSessionSkills(context.sessionId);
      const skill = registry.find(
        (s) =>
          s.id === skillName ||
          s.name.toLowerCase() === skillName.toLowerCase(),
      );

      if (!skill) {
        return {
          content: `Skill "${skillName}" not found. Available skills: ${registry.map((s) => s.name).join(", ")}`,
          isError: true,
        };
      }

      const content = await loadSkillContent(skill.id, context.sessionId);
      if (!content) {
        return {
          content: `Error loading skill "${skillName}"`,
          isError: true,
        };
      }

      const parameters = content.metadata.parameters ?? [];
      const placeholders = extractPlaceholders(content.content);
      const hasPlaceholders = placeholders.length > 0;

      let body = content.content;
      if (hasPlaceholders && Object.keys(paramValues).length > 0) {
        body = buildPromptFromSkill(body, parameters, paramValues);
      }

      let out = `# Skill: ${skill.name}\n\nDescription: ${content.metadata.description}\n\n${body}`;

      if (hasPlaceholders && Object.keys(paramValues).length === 0) {
        out += `\n\n---\n**Parameters in this skill:** ${placeholders.join(", ")}. If you do not have values for these yet, call AskUserQuestion to collect them from the user, then call the Skill tool again with \`paramValues\` set to the collected values.`;
      }

      return {
        content: out,
        isError: false,
        metadata: {
          skillId: skill.id,
          skillName: skill.name,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error invoking skill: ${message}`,
        isError: true,
      };
    }
  },
};
