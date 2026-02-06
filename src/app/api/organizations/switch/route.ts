import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { isOrganizationMember } from "@/lib/organization";
import { auth } from "@/lib/auth";

/**
 * POST /api/organizations/switch
 * Switch organization context (update JWT token with new organizationId)
 */
export async function POST(request: Request) {
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

  // 3. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 4. Input Validation
    const body = await validateRequestBody(
      request,
      validationSchemas.switchOrganization,
    );

    // 5. Verify user is member of target organization
    const isMember = await isOrganizationMember(user.id, body.organizationId);
    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this organization" },
        { status: 403 },
      );
    }

    // 6. Return success - frontend will need to refresh token
    // TODO: Create new token with updated organizationId
    // For now, the frontend should call /api/auth/me after switching
    // to get updated user data, then update the token
    
    return NextResponse.json({
      success: true,
      organizationId: body.organizationId,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Switch organization error:", error);
    return NextResponse.json(
      { error: "Failed to switch organization" },
      { status: 500 },
    );
  }
}
