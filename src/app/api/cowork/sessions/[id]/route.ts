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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id
 * Get session details with messages, todos, and files
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    const session = await db.coworkSession.findFirst({
      where: {
        id,
        userId: user.id,
        organizationId: org.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 100,
        },
        todos: {
          orderBy: { sortOrder: "asc" },
        },
        files: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
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
      messages: session.messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase(),
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
      todos: session.todos.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        content: t.content,
        activeForm: t.activeForm,
        status: t.status.toLowerCase().replace("_", "_"),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      files: session.files.map((f) => ({
        id: f.id,
        sessionId: f.sessionId,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        category: f.category.toLowerCase(),
        storagePath: f.storagePath,
        downloadUrl: f.downloadUrl,
        metadata: f.metadata,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get cowork session error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/cowork/sessions/:id
 * Update session title, status, or model
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
      validationSchemas.updateCoworkSession,
    );

    // 7. Verify ownership
    const existing = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    // 8. Update
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.status !== undefined)
      updateData.status = body.status.toUpperCase();
    if (body.model !== undefined) updateData.model = body.model;

    const session = await db.coworkSession.update({
      where: { id },
      data: updateData,
    });

    // 9. Audit
    await audit.coworkSessionUpdated(session.id, user.id, org.id, updateData, request);

    return NextResponse.json({
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
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Update cowork session error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/cowork/sessions/:id
 * Delete a session and all associated data
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    // 6. Verify ownership
    const existing = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    // 7. Delete (cascade deletes messages, todos, files)
    await db.coworkSession.delete({ where: { id } });

    // 8. Audit
    await audit.coworkSessionDeleted(id, user.id, org.id, {
      title: existing.title,
    }, request);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete cowork session error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
