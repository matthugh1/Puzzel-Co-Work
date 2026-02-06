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
import { getUserOrganizations } from "@/lib/organization";

interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * GET /api/organizations
 * List organizations
 * - Global admin: sees all organizations
 * - Regular user: sees only organizations they're member of
 */
export async function GET(request: Request) {
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
    // Global admin sees all organizations
    if (isAdmin(user)) {
      const organizations = await db.organization.findMany({
        where: {},
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      return NextResponse.json({
        organizations: organizations.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          isActive: org.isActive,
          memberCount: org._count.members,
          createdAt: org.createdAt,
        })),
      });
    }

    // Regular user sees only their organizations
    const userOrgs = await getUserOrganizations(user.id);
    return NextResponse.json({ organizations: userOrgs });
  } catch (error) {
    console.error("List organizations error:", error);
    return NextResponse.json(
      { error: "Failed to list organizations" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/organizations
 * Create organization (global admin only)
 */
export async function POST(request: Request) {
  // 1. CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 2. Authentication & Authorization
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.ORGANIZATIONS_CREATE,
  );

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // 3. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 4. Input Validation
    const body = await validateRequestBody(
      request,
      validationSchemas.createOrganization,
    );

    // Check slug uniqueness
    const existingOrg = await db.organization.findUnique({
      where: { slug: body.slug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization slug already exists" },
        { status: 400 },
      );
    }

    // 5. Business logic - Create organization
    const organization = await db.organization.create({
      data: {
        name: body.name,
        slug: body.slug,
        isActive: true,
      },
    });

    // Create default organization roles
    const orgAdminRole = await db.organizationRole.create({
      data: {
        organizationId: organization.id,
        name: "admin",
        description: "Organization administrator",
      },
    });

    const orgMemberRole = await db.organizationRole.create({
      data: {
        organizationId: organization.id,
        name: "member",
        description: "Organization member",
      },
    });

    const orgViewerRole = await db.organizationRole.create({
      data: {
        organizationId: organization.id,
        name: "viewer",
        description: "Organization viewer",
      },
    });

    // Assign permissions to org roles
    const orgPermissions = await db.permission.findMany({
      where: {
        name: {
          in: [
            "organizations:read",
            "organizations:update",
            "organizations:admin",
            "organizations:manage_members",
            "users:read",
            "users:admin",
          ],
        },
      },
    });

    for (const perm of orgPermissions) {
      await db.organizationRolePermission.create({
        data: {
          roleId: orgAdminRole.id,
          permissionId: perm.id,
        },
      });
    }

    const memberPerms = await db.permission.findMany({
      where: {
        name: {
          in: ["organizations:read", "users:read"],
        },
      },
    });

    for (const perm of memberPerms) {
      await db.organizationRolePermission.create({
        data: {
          roleId: orgMemberRole.id,
          permissionId: perm.id,
        },
      });

      await db.organizationRolePermission.create({
        data: {
          roleId: orgViewerRole.id,
          permissionId: perm.id,
        },
      });
    }

    // Assign creator as org admin
    await db.organizationUser.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        roleId: orgAdminRole.id,
      },
    });

    // 6. Audit logging
    await audit.organizationCreated(
      organization.id,
      user.id,
      { name: organization.name, slug: organization.slug },
      request,
    );

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Create organization error:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 },
    );
  }
}
