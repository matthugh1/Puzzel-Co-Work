import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember, isOrganizationAdmin } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/skills/:id
 * Fetch a single custom skill (including content) for editing.
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

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

  try {
    const skill = await db.coworkSkill.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!skill) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        triggers: (skill.triggers as string[]) ?? [],
        tags: (skill.tags as string[]) ?? [],
        content: skill.content,
        parameters: (skill.parameters as Record<string, unknown>[]) ?? [],
        exampleInput: skill.exampleInput ?? undefined,
        exampleOutput: skill.exampleOutput ?? undefined,
        version: skill.version,
        status: skill.status,
      },
    });
  } catch (error) {
    console.error("[Skills] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/cowork/skills/:id
 * Update a custom skill (name, description, triggers, content). Partial updates supported.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    const body = await validateRequestBody(
      request,
      validationSchemas.updateCoworkSkill,
    );

    const existing = await db.coworkSkill.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.triggers !== undefined) updateData.triggers = body.triggers;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.parameters !== undefined) updateData.parameters = body.parameters;
    if (body.exampleInput !== undefined) updateData.exampleInput = body.exampleInput;
    if (body.exampleOutput !== undefined) updateData.exampleOutput = body.exampleOutput;
    if (body.status !== undefined) updateData.status = body.status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Increment version on any update
    updateData.version = { increment: 1 };

    const skill = await db.coworkSkill.update({
      where: { id },
      data: updateData,
    });

    await audit.coworkSkillUpdated(
      skill.id,
      user.id,
      org.id,
      { fields: Object.keys(updateData) },
      request,
    );

    return NextResponse.json({
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        triggers: (skill.triggers as string[]) ?? [],
        tags: (skill.tags as string[]) ?? [],
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }
    console.error("[Skills] PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update skill" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cowork/skills/:id
 * Delete a custom skill. Only the creator or an org admin can delete.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    const existing = await db.coworkSkill.findFirst({
      where: { id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Skill not found" },
        { status: 404 },
      );
    }

    // Only the creator or an org admin can delete
    if (existing.createdById !== user.id) {
      // Check if user is an org admin
      const isAdmin = await isOrganizationAdmin(user.id, org.id);
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only the skill creator or an org admin can delete skills" },
          { status: 403 },
        );
      }
    }

    await db.coworkSkill.delete({ where: { id } });

    await audit.coworkSkillUpdated(
      id,
      user.id,
      org.id,
      { action: "deleted", skillName: existing.name },
      request,
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[Skills] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete skill" },
      { status: 500 },
    );
  }
}
