/**
 * Skill types for the Cowork skills system (PRD-aligned)
 */

export type SkillParameterType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "boolean";

export interface SkillParameter {
  name: string;
  label: string;
  type: SkillParameterType;
  description: string;
  required: boolean;
  default?: string;
  options?: string[];
}

export type SkillStatus = "draft" | "published";

export interface SkillDraft {
  id?: string;
  name: string;
  description: string;
  category: string;
  content: string;
  parameters?: SkillParameter[];
  exampleInput?: string;
  exampleOutput?: string;
  tags?: string[];
  triggers?: string[];
  status?: SkillStatus;
}
