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
import {
  isOrganizationMember,
  isOrganizationAdmin,
} from "@/lib/organization";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/organizations/[id]
 * Get organization details
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

  // 2. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Global admin can see any org, regular users must be members
    if (!isAdmin(user)) {
      const isMember = await isOrganizationMember(user.id, id);
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        isActive: organization.isActive,
        memberCount: organization._count.members,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json(
      { error: "Failed to get organization" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/organizations/[id]
 * Update organization (global admin or org admin)
 */
export async function PUT(
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
      validationSchemas.updateOrganization,
    );

    // Check if organization exists
    const existingOrg = await db.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Check slug uniqueness if updating slug
    if (body.slug && body.slug !== existingOrg.slug) {
      const slugExists = await db.organization.findUnique({
        where: { slug: body.slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: "Organization slug already exists" },
          { status: 400 },
        );
      }
    }

    // 5. Business logic - Update organization
    const organization = await db.organization.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.slug && { slug: body.slug }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    // 6. Audit logging
    await audit.organizationUpdated(
      organization.id,
      user.id,
      {
        oldValues: {
          name: existingOrg.name,
          slug: existingOrg.slug,
          isActive: existingOrg.isActive,
        },
        newValues: {
          name: organization.name,
          slug: organization.slug,
          isActive: organization.isActive,
        },
      },
      request,
    );

    return NextResponse.json({ organization });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Update organization error:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 },
    );
  }
}
