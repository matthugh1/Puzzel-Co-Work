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
import { audit } from "@/lib/audit";

/**
 * GET /api/cowork/sessions
 * List current user's sessions for the active organization
 */
export async function GET(request: Request) {
  // 1. Authentication
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Organization context
  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  // 3. Verify membership
  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 4. Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const sessions = await db.coworkSession.findMany({
      where: {
        userId: user.id,
        organizationId: org.id,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        userId: true,
        organizationId: true,
      },
    });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        organizationId: s.organizationId,
        title: s.title,
        status: s.status.toLowerCase(),
        model: s.model,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("List cowork sessions error:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cowork/sessions
 * Create a new cowork session
 */
export async function POST(request: Request) {
  // 1. CSRF
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

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

  // 4. Verify membership
  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 5. Rate limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 6. Validate input
    const body = await validateRequestBody(
      request,
      validationSchemas.createCoworkSession,
    );

    // 7. Create session
    const session = await db.coworkSession.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        title: body.title || "New Task",
        model: body.model,
        status: "ACTIVE",
      },
    });

    // 8. Audit
    await audit.coworkSessionCreated(session.id, user.id, org.id, {
      model: session.model,
    }, request);

    return NextResponse.json(
      {
        session: {
          id: session.id,
          userId: session.userId,
          organizationId: session.organizationId,
          title: session.title,
          status: session.status.toLowerCase(),
          model: session.model,
          createdAt: session.createdAt.toISOString(),
          updatedAt: session.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Create cowork session error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}
