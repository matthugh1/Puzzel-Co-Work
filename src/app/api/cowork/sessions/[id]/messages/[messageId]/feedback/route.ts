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

interface RouteContext {
  params: Promise<{ id: string; messageId: string }>;
}

/**
 * GET /api/cowork/sessions/:id/messages/:messageId/feedback
 * Get feedback for a specific message
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: sessionId, messageId } = await context.params;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await db.coworkSession.findFirst({
      where: { id: sessionId, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const message = await db.coworkMessage.findFirst({
      where: { id: messageId, sessionId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const feedback = await db.coworkMessageFeedback.findUnique({
      where: {
        messageId_userId: { messageId, userId: user.id },
      },
    });

    if (!feedback) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: feedback.id,
      messageId: feedback.messageId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Get message feedback error:", error);
    return NextResponse.json(
      { error: "Failed to get feedback" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cowork/sessions/:id/messages/:messageId/feedback
 * Submit or update feedback for a message
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: sessionId, messageId } = await context.params;

  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let org;
  try {
    org = await requireOrganization(request);
  } catch {
    return NextResponse.json(
      { error: "Organization context required" },
      { status: 403 },
    );
  }

  const isMember = await isOrganizationMember(user.id, org.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await validateRequestBody(
      request,
      validationSchemas.coworkMessageFeedback,
    );

    const session = await db.coworkSession.findFirst({
      where: { id: sessionId, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const message = await db.coworkMessage.findFirst({
      where: { id: messageId, sessionId },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const feedback = await db.coworkMessageFeedback.upsert({
      where: {
        messageId_userId: { messageId, userId: user.id },
      },
      create: {
        messageId,
        sessionId,
        userId: user.id,
        organizationId: org.id,
        rating: body.rating,
        comment: body.comment ?? null,
      },
      update: {
        rating: body.rating,
        comment: body.comment ?? null,
      },
    });

    return NextResponse.json({
      id: feedback.id,
      messageId: feedback.messageId,
      rating: feedback.rating,
      comment: feedback.comment,
      createdAt: feedback.createdAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }
    console.error("Submit message feedback error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 },
    );
  }
}
