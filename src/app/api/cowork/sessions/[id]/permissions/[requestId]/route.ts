/**
 * Permission Resolution API
 * POST /api/cowork/sessions/:id/permissions/:requestId/resolve
 */

import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { db } from "@/lib/db";
import { resolvePermission } from "@/lib/cowork/permissions";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string; requestId: string }>;
}

const resolvePermissionSchema = z.object({
  approved: z.boolean(),
});

/**
 * POST /api/cowork/sessions/:id/permissions/:requestId/resolve
 * Resolve a pending permission request
 */
export async function POST(request: Request, context: RouteContext) {
  const { id, requestId } = await context.params;

  // 1. CSRF
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  // 2. Authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Organization context
  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  // 4. Membership
  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 6. Validate input
    const body = await validateRequestBody(request, resolvePermissionSchema);

    // 7. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    // 8. Resolve permission
    const resolved = resolvePermission(requestId, body.approved);

    if (!resolved) {
      return NextResponse.json(
        { error: "Permission request not found or already resolved" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      approved: body.approved,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Resolve permission error:", error);
    return NextResponse.json(
      { error: "Failed to resolve permission" },
      { status: 500 },
    );
  }
}
