/**
 * Permission constants and authorization utilities
 */

import { NextResponse } from "next/server";
import { getUserFromRequest, type AuthUser } from "@/lib/auth";

// Permission constants
export const PERMISSIONS = {
  // User permissions
  USERS_READ: "users:read",
  USERS_ADMIN: "users:admin",
  
  // Organization permissions
  ORGANIZATIONS_CREATE: "organizations:create", // Global admin only
  ORGANIZATIONS_READ: "organizations:read",
  ORGANIZATIONS_UPDATE: "organizations:update",
  ORGANIZATIONS_ADMIN: "organizations:admin", // Manage org settings
  ORGANIZATIONS_MANAGE_MEMBERS: "organizations:manage_members", // Add/remove members
  
  // Audit permissions
  AUDIT_READ: "audit:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Check if user has a specific permission
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

/**
 * Check if user is an admin
 */
export function isAdmin(user: AuthUser): boolean {
  return user.roles.includes("admin");
}

/**
 * Check if user can modify a resource (is owner or admin)
 */
export function canModifyResource(user: AuthUser, ownerId: string): boolean {
  return user.id === ownerId || isAdmin(user);
}

/**
 * Auth check result type
 */
type AuthCheckResult =
  | { authorized: true; user: AuthUser }
  | { authorized: false; response: NextResponse };

/**
 * Check authentication and permission in one call
 * Returns user if authorized, or error response if not
 */
export async function checkAuthWithPermission(
  request: Request,
  permission: Permission,
): Promise<AuthCheckResult> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!hasPermission(user, permission) && !isAdmin(user)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Forbidden: insufficient permissions" },
        { status: 403 },
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Higher-order function to wrap route handlers with permission check
 */
export type RouteHandler<T = unknown> = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
  user: AuthUser,
) => Promise<NextResponse<T>>;

export function withPermission<T>(
  permission: Permission,
  handler: RouteHandler<T>,
) {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const result = await checkAuthWithPermission(request, permission);

    if (!result.authorized) {
      return result.response;
    }

    return handler(request, context, result.user);
  };
}
