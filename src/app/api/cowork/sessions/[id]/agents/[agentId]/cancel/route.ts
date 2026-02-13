import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { cancelSubAgent } from "@/lib/cowork/sub-agent";

interface RouteContext {
  params: Promise<{ id: string; agentId: string }>;
}

/**
 * POST /api/cowork/sessions/:id/agents/:agentId/cancel
 * Cancel a running sub-agent
 */
export async function POST(request: Request, context: RouteContext) {
  const { id, agentId } = await context.params;

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
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 7. Verify agent belongs to session
    const agent = await db.coworkSubAgent.findFirst({
      where: { id: agentId, sessionId: id },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Sub-agent not found" },
        { status: 404 },
      );
    }

    // 8. Cancel agent
    const cancelled = await cancelSubAgent(agentId);

    if (!cancelled) {
      return NextResponse.json(
        { error: "Sub-agent is not running or already cancelled" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sub-agent cancelled",
    });
  } catch (error) {
    console.error("Cancel agent error:", error);
    return NextResponse.json(
      { error: "Failed to cancel sub-agent" },
      { status: 500 },
    );
  }
}
