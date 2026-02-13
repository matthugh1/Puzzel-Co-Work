/**
 * Skills Registry
 * File-based built-in skills + DB-backed org/session skills
 */

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { db } from "@/lib/db";

export interface SkillMetadata {
  id: string;
  name: string;
  description: string;
  /** File path for built-in/session file-based skills; empty for DB skills */
  path?: string;
  triggers?: string[];
  /** Inline content for DB-backed skills; when set, no file read */
  content?: string;
  /** Parameter definitions (DB skills only; for {{param}} placeholder binding) */
  parameters?: import("@/types/skill").SkillParameter[];
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
            console.error(
              `[Skills] Error parsing frontmatter for ${skillId}:`,
              parseError,
            );
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
            triggers: Array.isArray(triggers) ? triggers : ([] as string[]),
          });
        } catch (err) {
          console.error(`[Skills] Error loading skill ${skillId}:`, err);
          // Continue loading other skills
        }
      }
    } catch (err) {
      console.error(
        `[Skills] Error reading skills directory ${skillsDir}:`,
        err,
      );
    }
  }

  // Cache the registry
  registryCache = skills;
  cacheTimestamp = now;

  return skills;
}

/**
 * Load full skill content (markdown body)
 * Uses inline content for DB skills, or reads file for path-based skills.
 */
export async function loadSkillContent(
  skillId: string,
  sessionId?: string,
): Promise<SkillContent | null> {
  try {
    const registry = sessionId
      ? await loadSessionSkills(sessionId)
      : await loadSkillRegistry();
    const skill = registry.find((s) => s.id === skillId);

    if (!skill) {
      return null;
    }

    if (skill.content != null && skill.content !== "") {
      return { metadata: skill, content: skill.content };
    }

    if (skill.path) {
      const fileContent = await fs.readFile(skill.path, "utf-8");
      const parsed = matter(fileContent);
      return {
        metadata: skill,
        content: parsed.content || "",
      };
    }

    return null;
  } catch (err) {
    console.error(`[Skills] Error loading skill content ${skillId}:`, err);
    return null;
  }
}

export interface DbSkillListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  triggers: string[];
  tags: string[];
}

export interface DbSkillListFilters {
  category?: string;
  search?: string;
  tags?: string[];
}

/**
 * Load DB skills for list API (metadata only).
 * organizationId required. Returns all custom skills for the org (built-in come from elsewhere).
 * Optional filters: category, search (name/description), tags.
 */
export async function loadDbSkillsForList(
  organizationId: string,
  _sessionId?: string | null,
  filters?: DbSkillListFilters,
): Promise<DbSkillListItem[]> {
  try {
    const where: Record<string, unknown> = { organizationId };

    if (filters?.category?.trim()) {
      where.category = filters.category.trim();
    }
    if (filters?.search?.trim()) {
      const searchTerm = filters.search.trim();
      where.OR = [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { description: { contains: searchTerm, mode: "insensitive" } },
      ];
    }
    // Tags filter: Prisma Json does not support hasSome easily; filter in memory below
    const tagsFilter = filters?.tags?.filter(Boolean) ?? [];

    const rows = await db.coworkSkill.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        triggers: true,
        tags: true,
      },
    });

    let results = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      category: r.category ?? "General",
      triggers: Array.isArray(r.triggers) ? (r.triggers as string[]) : [],
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    }));

    if (tagsFilter.length > 0) {
      results = results.filter((r) =>
        tagsFilter.some((t) =>
          r.tags.some((rt) => rt.toLowerCase() === t.toLowerCase()),
        ),
      );
    }
    return results;
  } catch (err) {
    console.error("[Skills] loadDbSkillsForList error:", err);
    return [];
  }
}

/**
 * Load skills for a specific session: built-in (file) + org/session skills (DB).
 */
export async function loadSessionSkills(
  sessionId: string,
): Promise<SkillMetadata[]> {
  try {
    const builtInSkills = await loadSkillRegistry();

    const session = await db.coworkSession.findUnique({
      where: { id: sessionId },
      select: { organizationId: true },
    });

    const dbSkills: SkillMetadata[] = [];
    if (session) {
      const rows = await db.coworkSkill.findMany({
        where: {
          organizationId: session.organizationId,
          status: "published",
          OR: [{ sessionId: null }, { sessionId }],
        },
        select: {
          id: true,
          name: true,
          description: true,
          triggers: true,
          content: true,
          parameters: true,
        },
      });
      for (const r of rows) {
        const params = r.parameters;
        const parameters = Array.isArray(params)
          ? (params as unknown as import("@/types/skill").SkillParameter[])
          : undefined;
        dbSkills.push({
          id: r.id,
          name: r.name,
          description: r.description,
          triggers: Array.isArray(r.triggers) ? (r.triggers as string[]) : [],
          content: r.content ?? "",
          parameters,
        });
      }
    }

    return [...builtInSkills, ...dbSkills];
  } catch (err) {
    console.error("[Skills] Error loading session skills:", err);
    return [];
  }
}

/**
 * Invalidate file registry cache (DB skills are not cached here).
 */
export function invalidateSkillCache(): void {
  registryCache = null;
  cacheTimestamp = 0;
}
