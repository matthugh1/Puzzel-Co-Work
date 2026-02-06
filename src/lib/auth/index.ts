/**
 * Auth module - exports the current auth provider
 * Swappable between SimpleAuth (dev) and AzureAD (production)
 */

import { simpleAuth } from "./simple-auth";
import type { AuthUser } from "./types";

// Export the current auth provider
export const auth = simpleAuth;

// Export types
export type {
  AuthUser,
  AuthProvider,
  AuthResult,
  LoginCredentials,
} from "./types";

/**
 * Extract user from request Authorization header or cookie
 * Supports both Bearer token (legacy) and httpOnly cookie (preferred)
 */
export async function getUserFromRequest(
  request: Request,
): Promise<AuthUser | null> {
  // Try Bearer token first (legacy support)
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return auth.validateToken(token);
  }

  // Try httpOnly cookie (preferred method)
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").reduce(
      (acc, cookie) => {
        const [name, value] = cookie.trim().split("=");
        if (name && value) {
          acc[name] = decodeURIComponent(value);
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const token = cookies["auth-token"];
    if (token) {
      return auth.validateToken(token);
    }
  }

  return null;
}
