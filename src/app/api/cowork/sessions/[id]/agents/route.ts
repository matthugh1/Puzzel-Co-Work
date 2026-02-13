import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { getSessionSubAgents } from "@/lib/cowork/sub-agent";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id/agents
 * List all sub-agents for a session
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
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // 5. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 6. Get sub-agents
    const agents = await getSessionSubAgents(id);

    return NextResponse.json({
      agents,
    });
  } catch (error) {
    console.error("List agents error:", error);
    return NextResponse.json(
      { error: "Failed to list agents" },
      { status: 500 },
    );
  }
}
