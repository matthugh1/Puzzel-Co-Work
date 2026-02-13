import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import {
  checkAuthWithPermission,
  PERMISSIONS,
  isAdmin,
} from "@/lib/permissions";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isOrganizationMember, isOrganizationAdmin } from "@/lib/organization";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/organizations/[id]/members
 * List organization members
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  // 1. Authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is global admin or org member
  if (!isAdmin(user)) {
    const isMember = await isOrganizationMember(user.id, id);
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 2. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const members = await db.organizationUser.findMany({
      where: { organizationId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        role: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return NextResponse.json({
      members: members.map((m) => ({
        userId: m.userId,
        user: m.user,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (error) {
    console.error("List members error:", error);
    return NextResponse.json(
      { error: "Failed to list members" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/organizations/[id]/members
 * Add member to organization (global admin or org admin)
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;

  // 1. CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 2. Authentication & Authorization
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is global admin or org admin
  if (!isAdmin(user)) {
    const isOrgAdmin = await isOrganizationAdmin(user.id, id);
    if (!isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // 3. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 4. Input Validation
    const body = await validateRequestBody(
      request,
      validationSchemas.addMember,
    );

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Check if user exists
    const targetUser = await db.user.findUnique({
      where: { id: body.userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user is already a member
    const existingMembership = await db.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId: body.userId,
          organizationId: id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 400 },
      );
    }

    // Get default role (member) if not specified
    let roleId = body.roleId;
    if (!roleId) {
      const memberRole = await db.organizationRole.findFirst({
        where: {
          organizationId: id,
          name: "member",
        },
      });
      roleId = memberRole?.id;
    }

    // 5. Business logic - Add member
    await db.organizationUser.create({
      data: {
        userId: body.userId,
        organizationId: id,
        roleId: roleId || undefined,
      },
    });

    // 6. Audit logging
    await audit.memberAdded(id, body.userId, user.id, { roleId }, request);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Failed to add member" },
      { status: 500 },
    );
  }
}
