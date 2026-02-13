import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { isAdmin } from "@/lib/permissions";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isOrganizationAdmin } from "@/lib/organization";

interface RouteContext {
  params: Promise<{ id: string; userId: string }>;
}

/**
 * DELETE /api/organizations/[id]/members/[userId]
 * Remove member from organization (global admin or org admin)
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id, userId } = await context.params;

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
    // Check if membership exists
    const membership = await db.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    // Check if removing last admin
    if (membership.role?.name === "admin") {
      const adminCount = await db.organizationUser.count({
        where: {
          organizationId: id,
          role: {
            name: "admin",
          },
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin from organization" },
          { status: 400 },
        );
      }
    }

    // 5. Business logic - Remove member
    await db.organizationUser.delete({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
    });

    // 6. Audit logging
    await audit.memberRemoved(
      id,
      userId,
      user.id,
      { roleName: membership.role?.name },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/organizations/[id]/members/[userId]
 * Update member role (global admin or org admin)
 */
export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const { id, userId } = await context.params;

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
      validationSchemas.updateMemberRole,
    );

    // Check if membership exists
    const membership = await db.organizationUser.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
      include: {
        role: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 },
      );
    }

    // If removing admin role, check if it's the last admin
    if (membership.role?.name === "admin" && !body.roleId) {
      const adminCount = await db.organizationUser.count({
        where: {
          organizationId: id,
          role: {
            name: "admin",
          },
        },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot remove the last admin from organization" },
          { status: 400 },
        );
      }
    }

    // 5. Business logic - Update member role
    await db.organizationUser.update({
      where: {
        userId_organizationId: {
          userId,
          organizationId: id,
        },
      },
      data: {
        roleId: body.roleId || null,
      },
    });

    // 6. Audit logging
    await audit.memberRoleUpdated(
      id,
      userId,
      user.id,
      {
        oldRoleId: membership.roleId,
        newRoleId: body.roleId || null,
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Update member role error:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 },
    );
  }
}
