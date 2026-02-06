/**
 * Simple Auth Provider
 * Local username/password authentication with JWT tokens
 * Will be replaced with Azure AD in production
 */

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type {
  AuthProvider,
  AuthResult,
  AuthUser,
  LoginCredentials,
} from "./types";

// BCRYPT_ROUNDS should be at least 12 for production
const BCRYPT_ROUNDS = 12;

// JWT_SECRET must be provided via environment variable - no fallback
const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);
const TOKEN_EXPIRY = "24h";

/**
 * Hash password using bcrypt (industry standard)
 * Each password gets a unique salt automatically
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against bcrypt hash
 */
async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function createToken(user: AuthUser, organizationId?: string): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    permissions: user.permissions,
    organizationId: organizationId || user.organizationId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

async function getUserWithPermissions(
  userId: string,
  organizationId?: string,
): Promise<AuthUser | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  // Type definitions for the nested relations
  type UserRoleWithPermissions = {
    role: {
      name: string;
      permissions: Array<{ permission: { name: string } }>;
    };
  };

  const roles = user.roles.map((ur: UserRoleWithPermissions) => ur.role.name);
  const permissionSet = new Set<string>();
  user.roles.forEach((ur: UserRoleWithPermissions) => {
    ur.role.permissions.forEach((rp: { permission: { name: string } }) => {
      permissionSet.add(rp.permission.name);
    });
  });
  const permissions = Array.from(permissionSet);

  // Get default organization if not provided
  let defaultOrgId: string | undefined = organizationId;
  if (!defaultOrgId) {
    const firstMembership = await db.organizationUser.findFirst({
      where: { userId },
      include: { organization: true },
      orderBy: { joinedAt: "asc" },
    });
    defaultOrgId = firstMembership?.organization.isActive
      ? firstMembership.organization.id
      : undefined;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    organizationId: defaultOrgId,
  };
}

export class SimpleAuthProvider implements AuthProvider {
  async authenticate(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      console.log(`[Auth] Authenticating user: ${credentials.email}`);
      const user = await db.user.findUnique({
        where: { email: credentials.email },
      });

      if (!user || !user.passwordHash) {
        console.log(
          `[Auth] User not found or no password hash: ${credentials.email}`,
        );
        // Generic error message to prevent user enumeration
        return { success: false, error: "Invalid credentials" };
      }

      console.log(`[Auth] User found, verifying password for: ${user.email}`);
      const passwordValid = await verifyPassword(
        credentials.password,
        user.passwordHash,
      );
      if (!passwordValid) {
        console.log(`[Auth] Password verification failed for: ${user.email}`);
        return { success: false, error: "Invalid credentials" };
      }

      console.log(
        `[Auth] Password valid, loading permissions for: ${user.email}`,
      );
      const authUser = await getUserWithPermissions(user.id);
      if (!authUser) {
        console.error(
          `[Auth] Failed to load permissions for user ${user.id} (${user.email})`,
        );
        // Check if user has roles
        const userWithRoles = await db.user.findUnique({
          where: { id: user.id },
          include: { roles: true },
        });
        if (!userWithRoles || userWithRoles.roles.length === 0) {
          console.error(`[Auth] User ${user.email} has no roles assigned`);
          return {
            success: false,
            error:
              "User has no roles assigned. Please contact an administrator.",
          };
        }
        console.error(
          `[Auth] User ${user.email} has ${userWithRoles.roles.length} roles but getUserWithPermissions returned null`,
        );
        return { success: false, error: "Failed to load user permissions" };
      }

      console.log(
        `[Auth] Successfully authenticated: ${user.email} with roles: ${authUser.roles.join(", ")}`,
      );

      const token = await createToken(authUser, authUser.organizationId);

      return {
        success: true,
        user: authUser,
        token,
      };
    } catch (error) {
      console.error("Authentication error:", error);
      // Generic error message to prevent information leakage
      return { success: false, error: "Authentication failed" };
    }
  }

  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);

      if (!payload.sub) return null;

      // Extract organizationId from token if present
      const organizationId =
        typeof payload.organizationId === "string"
          ? payload.organizationId
          : undefined;

      // Refresh user data from DB to get latest permissions
      return getUserWithPermissions(payload.sub as string, organizationId);
    } catch {
      // Token invalid or expired
      return null;
    }
  }

  async refreshToken(token: string): Promise<string | null> {
    const user = await this.validateToken(token);
    if (!user) return null;
    return createToken(user, user.organizationId);
  }

  async revokeToken(_token: string): Promise<void> {
    // For simple auth, we don't track revoked tokens
    // In production with Azure AD, this would invalidate the session
  }
}

// Export singleton instance
export const simpleAuth = new SimpleAuthProvider();

// Export password hash function for seed script
export { hashPassword };
