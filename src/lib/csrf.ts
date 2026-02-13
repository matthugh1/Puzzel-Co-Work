/**
 * CSRF Protection Utilities
 * Validates CSRF tokens for state-changing operations
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Extract a cookie value from the Cookie header string
 */
function getCookieFromHeader(
  request: Request,
  name: string,
): string | undefined {
  // Use NextRequest cookies API if available
  if (
    "cookies" in request &&
    typeof (request as NextRequest).cookies?.get === "function"
  ) {
    return (request as NextRequest).cookies.get(name)?.value;
  }

  // Fallback: parse Cookie header manually
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name && value) {
      return decodeURIComponent(value);
    }
  }
  return undefined;
}

/**
 * Extract pathname from request URL
 */
function getPathname(request: Request): string {
  if ("nextUrl" in request && (request as NextRequest).nextUrl) {
    return (request as NextRequest).nextUrl.pathname;
  }
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

/**
 * Validate CSRF token from request
 * Returns error response if invalid, null if valid
 * Accepts both Request and NextRequest
 */
export function validateCSRFToken(request: Request): NextResponse | null {
  // Only check CSRF for state-changing methods
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return null; // No CSRF check needed for GET/HEAD/OPTIONS
  }

  // Skip CSRF check for certain endpoints (e.g., webhooks, public APIs)
  const pathname = getPathname(request);
  if (pathname.startsWith("/api/webhooks/")) {
    return null; // Webhooks may have their own authentication
  }

  // Get CSRF token from header
  const token =
    request.headers.get("X-CSRF-Token") || request.headers.get("x-csrf-token");
  const cookieToken = getCookieFromHeader(request, "csrf-token");

  if (!token || !cookieToken) {
    return NextResponse.json({ error: "CSRF token missing" }, { status: 403 });
  }

  if (token !== cookieToken) {
    return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  }

  return null; // Valid token
}

/**
 * Get CSRF token from cookies (for frontend)
 */
export function getCSRFToken(request: Request): string | null {
  return getCookieFromHeader(request, "csrf-token") || null;
}
