import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { validateCSRFToken } from "@/lib/csrf";
import {
  rateLimit,
  RATE_LIMITS,
  trackFailedLogin,
  clearFailedLoginAttempts,
} from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  // 1. CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 2. Rate limiting - strict limits for authentication
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.AUTH);
  if (rateLimitResponse) {
    console.log("Login blocked by rate limit");
    return rateLimitResponse;
  }

  try {
    // Validate input
    const { email, password } = await validateRequestBody(
      request,
      validationSchemas.login,
    );
    console.log(`Login attempt for: ${email}`);

    // Check if account is locked due to failed attempts
    const lockStatus = trackFailedLogin(email);
    if (lockStatus.locked) {
      console.log(`Login blocked - account locked for: ${email}`);
      return NextResponse.json(
        {
          error:
            "Account temporarily locked due to too many failed attempts. Please try again later.",
        },
        { status: 429 },
      );
    }

    const result = await auth.authenticate({ email, password });
    console.log(`Authentication result for ${email}:`, {
      success: result.success,
      error: result.error,
    });

    if (!result.success) {
      // Track failed attempt
      trackFailedLogin(email);
      // Log failed login attempt
      await audit
        .authFailed(email, { error: result.error }, request)
        .catch((err) => {
          console.error("Failed to log audit:", err);
        });

      // Return more specific error message for debugging (in dev) but generic in production
      const errorMessage =
        process.env.NODE_ENV === "development" && result.error
          ? result.error
          : "Invalid credentials";

      console.log(`Login failed for ${email}: ${errorMessage}`);
      return NextResponse.json({ error: errorMessage }, { status: 401 });
    }

    // Clear failed attempts on successful login
    clearFailedLoginAttempts(email);

    // Log successful login
    if (!result.user) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
    }

    await audit.authLogin(result.user.id, { email }, request);

    // Set JWT token as httpOnly cookie (more secure than localStorage)
    const cookieStore = await cookies();
    cookieStore.set("auth-token", result.token ?? "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // Return user data
    // Token is now in httpOnly cookie, but also return for backward compatibility
    const response = NextResponse.json({
      user: result.user,
      token: result.token, // Legacy support - prefer reading from cookie
    });

    // Also set cookie in response headers (for immediate use)
    response.cookies.set("auth-token", result.token ?? "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
