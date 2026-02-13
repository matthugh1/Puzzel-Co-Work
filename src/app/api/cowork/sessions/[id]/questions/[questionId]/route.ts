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
import { resolveQuestion } from "@/lib/cowork/question-store";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string; questionId: string }>;
}

const answerQuestionSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

/**
 * POST /api/cowork/sessions/:id/questions/:questionId
 * Submit an answer to a pending question
 */
export async function POST(request: Request, context: RouteContext) {
  const { id, questionId } = await context.params;

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
    const body = await validateRequestBody(request, answerQuestionSchema);

    // 7. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 8. Resolve question
    const resolved = resolveQuestion(questionId, body.answers);

    if (!resolved) {
      return NextResponse.json(
        { error: "Question not found or already answered" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      answers: body.answers,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Answer question error:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 },
    );
  }
}
