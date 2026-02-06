/**
 * Skill Tool
 * Allows the agent to explicitly invoke a skill by name
 */

import { loadSessionSkills, loadSkillContent } from "../skills";
import type { ToolExecutor } from "./types";

export const skillTool: ToolExecutor = {
  name: "Skill",
  description: "Explicitly invoke a skill by name to load its instructions into context. Use this when you need specialized knowledge or patterns from a skill. The skill's content will be injected into your system prompt for the next iteration.",
  parameters: {
    type: "object",
    properties: {
      skillName: {
        type: "string",
        description: "Name or ID of the skill to invoke (e.g., 'docx', 'xlsx', 'web-artifacts-builder')",
      },
    },
    required: ["skillName"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { skillName } = input as { skillName: string };

    if (!skillName || typeof skillName !== "string") {
      return {
        content: "Error: skillName must be a non-empty string",
        isError: true,
      };
    }

    try {
      // Load registry for this session
      const registry = await loadSessionSkills(context.sessionId);
      
      // Find skill by name or ID
      const skill = registry.find(
        (s) => s.id === skillName || s.name.toLowerCase() === skillName.toLowerCase(),
      );

      if (!skill) {
        return {
          content: `Skill "${skillName}" not found. Available skills: ${registry.map((s) => s.name).join(", ")}`,
          isError: true,
        };
      }

      // Load skill content (pass sessionId for session-specific skills)
      const content = await loadSkillContent(skill.id, context.sessionId);
      
      if (!content) {
        return {
          content: `Error loading skill "${skillName}"`,
          isError: true,
        };
      }

      // Note: The skill content will be injected via activeSkills in the agent loop config
      // This tool just confirms the skill was found and will be used
      return {
        content: `Skill "${skill.name}" loaded successfully. Its instructions are now available in context.`,
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
