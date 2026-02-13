import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id/feedback
 * List all feedback for a session with summary
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: sessionId } = await context.params;

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

    const feedbackList = await db.coworkMessageFeedback.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    });

    const summary = {
      total: feedbackList.length,
      positive: feedbackList.filter((f) => f.rating === "positive").length,
      negative: feedbackList.filter((f) => f.rating === "negative").length,
    };

    const feedback = feedbackList.map((f) => ({
      id: f.id,
      messageId: f.messageId,
      rating: f.rating,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
    }));

    return NextResponse.json({ feedback, summary });
  } catch (error) {
    console.error("Get session feedback error:", error);
    return NextResponse.json(
      { error: "Failed to get feedback" },
      { status: 500 },
    );
  }
}
