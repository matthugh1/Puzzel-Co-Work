/**
 * Skills Registry
 * File-based skill system with runtime metadata loading and trigger matching
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  path: string;
  triggers?: string[]; // Keywords/phrases that trigger this skill
}

export interface SkillContent {
  metadata: SkillMetadata;
  content: string; // Full markdown content
}

// Cache for skill registry
let registryCache: SkillMetadata[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load skill registry from storage directories
 */
export async function loadSkillRegistry(): Promise<SkillMetadata[]> {
  const now = Date.now();
  
  // Return cached registry if still valid
  if (registryCache && now - cacheTimestamp < CACHE_TTL) {
    return registryCache;
  }

  const skills: SkillMetadata[] = [];
  const skillsDirs = [
    path.join(process.cwd(), "storage", "skills"), // Built-in skills
    // Session-specific skills would be loaded per-session
  ];

  for (const skillsDir of skillsDirs) {
    try {
      // Check if directory exists
      try {
        await fs.access(skillsDir);
      } catch {
        // Directory doesn't exist, skip
        continue;
      }

      const entries = await fs.readdir(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(skillsDir, entry.name);
        const skillFile = path.join(skillDir, "SKILL.md");
        const skillId = entry.name;

        try {
          const fileContent = await fs.readFile(skillFile, "utf-8");
          let parsed;
          try {
            parsed = matter(fileContent);
          } catch (parseError) {
            console.error(`[Skills] Error parsing frontmatter for ${skillId}:`, parseError);
            continue; // Skip this skill
          }

          const skillName = parsed.data?.name || skillId;
          const skillDescription = parsed.data?.description || "";
          const triggers = parsed.data?.triggers || [];

          skills.push({
            id: skillId,
            name: skillName,
            description: skillDescription,
            path: skillFile,
            triggers: Array.isArray(triggers) ? triggers : [],
          });
        } catch (err) {
          console.error(`[Skills] Error loading skill ${skillId}:`, err);
          // Continue loading other skills
        }
      }
    } catch (err) {
      console.error(`[Skills] Error reading skills directory ${skillsDir}:`, err);
    }
  }

  // Cache the registry
  registryCache = skills;
  cacheTimestamp = now;

  return skills;
}

/**
 * Match skills based on user message
 * Simple keyword/phrase matching against skill descriptions and triggers
 */
export function matchSkills(
  userMessage: string,
  registry: SkillMetadata[],
): string[] {
  const messageLower = userMessage.toLowerCase();
  const matched: string[] = [];

  for (const skill of registry) {
    // Check triggers
    if (skill.triggers && skill.triggers.length > 0) {
      for (const trigger of skill.triggers) {
        if (messageLower.includes(trigger.toLowerCase())) {
          matched.push(skill.id);
          break;
        }
      }
    }

    // Check description keywords (simple word matching)
    const descWords = skill.description.toLowerCase().split(/\s+/);
    for (const word of descWords) {
      if (word.length > 4 && messageLower.includes(word)) {
        // Only match words longer than 4 chars to avoid false positives
        if (!matched.includes(skill.id)) {
          matched.push(skill.id);
        }
        break;
      }
    }
  }

  return matched;
}

/**
 * Load full skill content (markdown body)
 * @param skillId - Skill ID to load
 * @param sessionId - Optional session ID for session-specific skills
 */
export async function loadSkillContent(skillId: string, sessionId?: string): Promise<SkillContent | null> {
  try {
    // Load appropriate registry (built-in or session-specific)
    const registry = sessionId ? await loadSessionSkills(sessionId) : await loadSkillRegistry();
    const skill = registry.find((s) => s.id === skillId);

    if (!skill) {
      return null;
    }

    const fileContent = await fs.readFile(skill.path, "utf-8");
    let parsed;
    try {
      parsed = matter(fileContent);
    } catch (parseError) {
      console.error(`[Skills] Error parsing skill content ${skillId}:`, parseError);
      return null;
    }

    return {
      metadata: skill,
      content: parsed.content || "", // Markdown body without frontmatter
    };
  } catch (err) {
    console.error(`[Skills] Error loading skill content ${skillId}:`, err);
    return null;
  }
}

/**
 * Load skills for a specific session
 * Checks both built-in skills and session-specific skills
 */
export async function loadSessionSkills(sessionId: string): Promise<SkillMetadata[]> {
  try {
    const builtInSkills = await loadSkillRegistry();
    
    // Load session-specific skills from storage/sessions/{id}/skills/
    const sessionSkillsDir = path.join(
      process.cwd(),
      "storage",
      "sessions",
      sessionId,
      "skills",
    );

    const sessionSkills: SkillMetadata[] = [];

    try {
      await fs.access(sessionSkillsDir);
      const entries = await fs.readdir(sessionSkillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillDir = path.join(sessionSkillsDir, entry.name);
        const skillFile = path.join(skillDir, "SKILL.md");

        try {
          const fileContent = await fs.readFile(skillFile, "utf-8");
          let parsed;
          try {
            parsed = matter(fileContent);
          } catch (parseError) {
            console.error(`[Skills] Error parsing frontmatter for session skill ${entry.name}:`, parseError);
            continue; // Skip this skill
          }

          const skillId = `session-${sessionId}-${entry.name}`;
          const skillName = parsed.data?.name || entry.name;
          const skillDescription = parsed.data?.description || "";
          const triggers = parsed.data?.triggers || [];

          sessionSkills.push({
            id: skillId,
            name: skillName,
            description: skillDescription,
            path: skillFile,
            triggers: Array.isArray(triggers) ? triggers : [],
          });
        } catch (err) {
          console.error(`[Skills] Error loading session skill ${entry.name}:`, err);
        }
      }
    } catch {
      // Session skills directory doesn't exist, that's fine
    }

    return [...builtInSkills, ...sessionSkills];
  } catch (err) {
    console.error("[Skills] Error loading session skills:", err);
    // Return empty array on error - skills are optional
    return [];
  }
}

/**
 * Invalidate cache (call after adding/modifying skills)
 */
export function invalidateSkillCache(): void {
  registryCache = null;
  cacheTimestamp = 0;
}
