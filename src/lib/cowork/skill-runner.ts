/**
 * Skill Runner
 * Build prompt from skill content + parameter values for execution.
 */

import type { SkillParameter } from "@/types/skill";

/**
 * Replace {{parameter_name}} placeholders in content with values.
 * Parameters not in values are left as-placeholder or use default.
 */
export function buildPromptFromSkill(
  content: string,
  parameters: SkillParameter[],
  values: Record<string, string>,
): string {
  let result = content;
  for (const param of parameters) {
    const value = values[param.name] ?? param.default ?? "";
    const re = new RegExp(`\\{\\{${param.name}\\}\\}`, "g");
    result = result.replace(re, value);
  }
  return result;
}
