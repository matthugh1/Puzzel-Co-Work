/**
 * Plan Approval API
 * POST /api/cowork/sessions/:id/plan/approve
 */

import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getPlan, removePlan } from "@/lib/cowork/plan-store";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const approvePlanSchema = z.object({
  planId: z.string(),
});

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
    // 6. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    // 7. Parse request body
    const body = await request.json();
    const { planId } = approvePlanSchema.parse(body);

    const plan = getPlan(planId);
    if (!plan || plan.sessionId !== id) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 },
      );
    }

    // Approve: exit plan mode
    await db.coworkSession.update({
      where: { id },
      data: { planMode: false },
    });

    removePlan(planId);

    return NextResponse.json({
      success: true,
      message: "Plan approved. Execution can continue.",
    });
  } catch (error) {
    console.error("Approve plan error:", error);
    return NextResponse.json(
      { error: "Failed to approve plan" },
      { status: 500 },
    );
  }
}
