/**
 * Next.js Middleware
 * Handles request size limits, CSRF protection, and security headers
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Request size limit (1MB)
const MAX_REQUEST_SIZE = 1024 * 1024;

/**
 * Generate CSRF token
 */
function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files only
  // Note: We process all API routes (including /api/csrf-token) so middleware can set cookies
  if (pathname.startsWith("/_next") || pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Set CSRF token cookie if not present (for state-changing operations)
  // This ensures all pages have a CSRF token available
  // Note: CSRF token must NOT be httpOnly so JavaScript can read it for API requests
  const existingToken = request.cookies.get("csrf-token")?.value;
  if (!existingToken) {
    const csrfToken = generateCSRFToken();
    response.cookies.set("csrf-token", csrfToken, {
      httpOnly: false, // Must be readable by JavaScript for API client
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax", // Use 'lax' instead of 'strict' for better compatibility
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
  } else {
    // Ensure cookie is always set with correct attributes (refresh expiry)
    response.cookies.set("csrf-token", existingToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });
  }

  // Check request size for POST/PUT/PATCH requests
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 },
      );
    }
  }

  // Add request ID header for tracing
  response.headers.set("X-Request-ID", crypto.randomUUID());

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * Note: We include API routes so CSRF tokens are available for API calls
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
