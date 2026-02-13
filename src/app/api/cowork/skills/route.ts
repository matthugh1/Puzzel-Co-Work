import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { z } from "zod";
import { loadSkillRegistry, loadDbSkillsForList } from "@/lib/cowork/skills";
import { validationSchemas } from "@/lib/validation";

const createSkillSchema = validationSchemas.createCoworkSkill.extend({
  sessionId: z.string().cuid().optional(),
});

/**
 * GET /api/cowork/skills
 * List built-in skills; optionally include session skills when sessionId is provided and owned.
 */
export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const tagsParam = searchParams.get("tags");
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
    const filters = category || search || tags?.length ? { category, search, tags } : undefined;

    let builtIn: Awaited<ReturnType<typeof loadSkillRegistry>>;
    let dbSkills: Awaited<ReturnType<typeof loadDbSkillsForList>> = [];

    try {
      builtIn = await loadSkillRegistry();
    } catch (err) {
      console.error("[Skills] GET loadSkillRegistry error:", err);
      return NextResponse.json(
        { error: "Failed to load skills" },
        { status: 500 },
      );
    }

    try {
      dbSkills = await loadDbSkillsForList(org.id, undefined, filters);
    } catch (dbErr) {
      console.error("[Skills] GET loadDbSkillsForList error:", dbErr);
      // Continue with built-in only so the page still loads
    }

    const builtInSkills = builtIn.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      triggers: s.triggers ?? [],
      source: "built-in" as const,
    }));
    const customSkills = dbSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      triggers: s.triggers,
      tags: s.tags,
      source: "custom" as const,
    }));
    return NextResponse.json({
      skills: [...builtInSkills, ...customSkills],
      builtIn: builtInSkills,
      custom: customSkills,
    });
  } catch (error) {
    console.error("[Skills] GET error:", error);
    return NextResponse.json(
      { error: "Failed to list skills" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cowork/skills
 * Create a session-scoped skill. sessionId is required (MVP).
 */
export async function POST(request: Request) {
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const parsed = createSkillSchema.parse(body);

    if (!parsed.sessionId) {
      return NextResponse.json(
        { error: "sessionId is required to create a skill" },
        { status: 400 },
      );
    }

    const session = await db.coworkSession.findFirst({
      where: {
        id: parsed.sessionId,
        userId: user.id,
        organizationId: org.id,
      },
    });
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    const skill = await db.coworkSkill.create({
      data: {
        organizationId: org.id,
        sessionId: parsed.sessionId ?? null,
        name: parsed.name.trim(),
        description: parsed.description.trim(),
        category: parsed.category ?? "General",
        triggers: parsed.triggers ?? [],
        tags: parsed.tags ?? [],
        content: parsed.content.trim(),
        parameters: parsed.parameters ?? [],
        exampleInput: parsed.exampleInput?.trim() || null,
        exampleOutput: parsed.exampleOutput?.trim() || null,
        status: parsed.status === "published" ? "published" : "draft",
        createdById: user.id,
      },
    });

    return NextResponse.json(
      {
        skill: {
          id: skill.id,
          name: skill.name,
          description: skill.description,
          category: skill.category,
          triggers: (skill.triggers as string[]) ?? [],
          tags: (skill.tags as string[]) ?? [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.flatten() },
        { status: 400 },
      );
    }
    console.error("[Skills] POST error:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 },
    );
  }
}
