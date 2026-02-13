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
  requireOrganization,
  isOrganizationMember,
  isOrganizationAdmin,
} from "@/lib/organization";
import { hashPassword } from "@/lib/auth/simple-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/users/[id]
 * Get user details (org-aware)
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
    const targetUser = await db.user.findUnique({
      where: { id },
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
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Global admin can see any user
    if (isAdmin(user)) {
      return NextResponse.json({
        user: {
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          organizations: targetUser.organizationMemberships.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
            slug: m.organization.slug,
            role: m.role ? { id: m.role.id, name: m.role.name } : null,
          })),
          globalRoles: targetUser.roles.map((ur) => ({
            id: ur.role.id,
            name: ur.role.name,
            isSystem: ur.role.isSystem,
          })),
          createdAt: targetUser.createdAt,
        },
      });
    }

    // Org admin or regular user - can see users in their org or themselves
    const org = await requireOrganization(request);

    const isTargetInOrg = targetUser.organizationMemberships.some(
      (m) => m.organizationId === org.id,
    );

    if (!isTargetInOrg && targetUser.id !== user.id) {
      // Check permission for org users
      if (!isOrganizationAdmin(user.id, org.id)) {
        const hasPermission = user.permissions.includes(PERMISSIONS.USERS_READ);
        if (!hasPermission) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const orgMembership = targetUser.organizationMemberships.find(
      (m) => m.organizationId === org.id,
    );

    return NextResponse.json({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        organizationRole: orgMembership?.role
          ? { id: orgMembership.role.id, name: orgMembership.role.name }
          : null,
        globalRoles: targetUser.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          isSystem: ur.role.isSystem,
        })),
        createdAt: targetUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}

/**
 * PUT /api/users/[id]
 * Update user (org-aware)
 * - Global admin: can update any user, assign to any org
 * - Org admin: can update users in their org, cannot change org
 * - Regular user: can update themselves (limited fields)
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

  // 2. Authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check authorization
  const isSelf = user.id === id;
  const isGlobalAdmin = isAdmin(user);

  if (!isSelf && !isGlobalAdmin) {
    // Org admin needs permission
    const org = await requireOrganization(request);
    const isOrgAdmin = await isOrganizationAdmin(user.id, org.id);

    if (!isOrgAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if target user is in same org
    const targetInOrg = await isOrganizationMember(id, org.id);
    if (!targetInOrg) {
      return NextResponse.json(
        { error: "User is not in your organization" },
        { status: 403 },
      );
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
      validationSchemas.updateUser,
    );

    const targetUser = await db.user.findUnique({
      where: { id },
      include: {
        organizationMemberships: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check email uniqueness if updating email
    if (body.email && body.email !== targetUser.email) {
      const emailExists = await db.user.findUnique({
        where: { email: body.email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 },
        );
      }
    }

    // Hash password if provided
    let passwordHash: string | undefined;
    if (body.password) {
      passwordHash = await hashPassword(body.password);
    }

    // 5. Business logic - Update user
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (passwordHash !== undefined) updateData.passwordHash = passwordHash;

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
    });

    // Handle organization assignment (global admin only)
    if (isGlobalAdmin && body.organizationId) {
      const currentMembership = targetUser.organizationMemberships.find(
        (m) => m.organizationId === body.organizationId,
      );

      if (!currentMembership) {
        // Remove from old orgs and add to new org
        await db.organizationUser.deleteMany({
          where: { userId: id },
        });

        const defaultRole = body.roleId
          ? await db.organizationRole.findUnique({
              where: { id: body.roleId },
            })
          : await db.organizationRole.findFirst({
              where: {
                organizationId: body.organizationId,
                name: "member",
              },
            });

        await db.organizationUser.create({
          data: {
            userId: id,
            organizationId: body.organizationId,
            roleId: defaultRole?.id || undefined,
          },
        });
      } else if (body.roleId) {
        // Update role in same org
        await db.organizationUser.update({
          where: {
            userId_organizationId: {
              userId: id,
              organizationId: body.organizationId,
            },
          },
          data: { roleId: body.roleId },
        });
      }
    } else if (!isGlobalAdmin && body.roleId) {
      // Org admin can update role in their org
      const org = await requireOrganization(request);
      await db.organizationUser.update({
        where: {
          userId_organizationId: {
            userId: id,
            organizationId: org.id,
          },
        },
        data: { roleId: body.roleId },
      });
    }

    // 6. Audit logging
    await audit.userUpdated(
      id,
      user.id,
      {
        organizationId: isGlobalAdmin
          ? body.organizationId
          : user.organizationId,
        changes: Object.keys(updateData),
      },
      request,
    );

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Update user error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/users/[id]
 * Delete user (org-aware)
 * - Global admin: can delete any user
 * - Org admin: can delete users in their org
 */
export async function DELETE(
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
    const targetUser = await db.user.findUnique({
      where: { id },
      include: {
        organizationMemberships: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Global admin can delete any user
    if (!isAdmin(user)) {
      // Org admin can only delete users in their org
      const org = await requireOrganization(request);
      const isTargetInOrg = targetUser.organizationMemberships.some(
        (m) => m.organizationId === org.id,
      );

      if (!isTargetInOrg) {
        return NextResponse.json(
          { error: "User is not in your organization" },
          { status: 403 },
        );
      }

      // Check if removing last admin in org
      const targetMembership = targetUser.organizationMemberships.find(
        (m) => m.organizationId === org.id,
      );

      if (targetMembership?.role?.name === "admin") {
        const adminCount = await db.organizationUser.count({
          where: {
            organizationId: org.id,
            role: {
              name: "admin",
            },
          },
        });

        if (adminCount <= 1) {
          return NextResponse.json(
            { error: "Cannot delete the last admin from organization" },
            { status: 400 },
          );
        }
      }
    }

    // 5. Business logic - Delete user (cascade deletes memberships)
    await db.user.delete({
      where: { id },
    });

    // 6. Audit logging
    await audit.userDeleted(
      id,
      user.id,
      {
        email: targetUser.email,
        organizationIds: targetUser.organizationMemberships.map(
          (m) => m.organizationId,
        ),
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 },
    );
  }
}
