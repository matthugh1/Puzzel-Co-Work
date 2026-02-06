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
import { requireOrganization, isOrganizationAdmin } from "@/lib/organization";
import { hashPassword } from "@/lib/auth/simple-auth";

interface RouteContext {
  params: Promise<Record<string, string>>;
}

/**
 * GET /api/users
 * List users (org-aware)
 * - Global admin: sees all users (optionally filter by org)
 * - Org admin: sees only users in their org
 * - Regular user: sees only users in their org (if has users:read permission)
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
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId");
    const search = url.searchParams.get("search") || "";

    // Global admin can see all users or filter by org
    if (isAdmin(user)) {
      const where: any = {};
      
      if (organizationId) {
        where.organizationMemberships = {
          some: {
            organizationId,
          },
        };
      }

      if (search) {
        where.OR = [
          { email: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ];
      }

      const users = await db.user.findMany({
        where,
        include: {
          organizationMemberships: {
            include: {
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  isSystem: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          organizations: u.organizationMemberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role ? { id: m.role.id, name: m.role.name } : null,
          })),
          globalRoles: u.roles.map((ur) => ({
            id: ur.role.id,
            name: ur.role.name,
            isSystem: ur.role.isSystem,
          })),
          createdAt: u.createdAt,
        })),
      });
    }

    // Org admin or regular user - see only their org
    const org = await requireOrganization(request);
    
    // Check permission for org users
    if (!isAdmin(user) && !isOrganizationAdmin(user.id, org.id)) {
      const hasPermission = user.permissions.includes(PERMISSIONS.USERS_READ);
      if (!hasPermission) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const where: any = {
      organizationMemberships: {
        some: {
          organizationId: org.id,
        },
      },
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const users = await db.user.findMany({
      where,
      include: {
        organizationMemberships: {
          where: {
            organizationId: org.id,
          },
          include: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                isSystem: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        organizationRole: u.organizationMemberships[0]?.role
          ? { id: u.organizationMemberships[0].role.id, name: u.organizationMemberships[0].role.name }
          : null,
        globalRoles: u.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          isSystem: ur.role.isSystem,
        })),
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/users
 * Create user (org-aware)
 * - Global admin: can specify organizationId (any org)
 * - Org admin: can only create users in their own org
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
    PERMISSIONS.USERS_ADMIN,
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
      validationSchemas.createUser,
    );

    // Determine target organization
    let targetOrgId: string;
    
    if (isAdmin(user)) {
      // Global admin can specify any org
      if (body.organizationId) {
        targetOrgId = body.organizationId;
      } else {
        // Default to user's current org if not specified
        const org = await requireOrganization(request);
        targetOrgId = org.id;
      }
    } else {
      // Org admin can only create in their org
      const org = await requireOrganization(request);
      targetOrgId = org.id;
    }

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: targetOrgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 },
      );
    }

    // Check email uniqueness
    const existingUser = await db.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 },
      );
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (body.password) {
      passwordHash = await hashPassword(body.password);
    }

    // 5. Business logic - Create user
    const newUser = await db.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash,
        authProvider: "LOCAL",
      },
    });

    // Assign to organization
    const defaultRole = body.roleId
      ? await db.organizationRole.findUnique({
          where: { id: body.roleId },
        })
      : await db.organizationRole.findFirst({
          where: {
            organizationId: targetOrgId,
            name: "member",
          },
        });

    await db.organizationUser.create({
      data: {
        userId: newUser.id,
        organizationId: targetOrgId,
        roleId: defaultRole?.id || undefined,
      },
    });

    // 6. Audit logging
    await audit.userCreated(
      newUser.id,
      user.id,
      {
        email: newUser.email,
        organizationId: targetOrgId,
        roleId: defaultRole?.id,
      },
      request,
    );

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
