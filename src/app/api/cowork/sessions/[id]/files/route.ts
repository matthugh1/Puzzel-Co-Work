import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id/files
 * List all files in a session
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
    // Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const files = await db.coworkFile.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      files: files.map((f) => ({
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
    console.error("List files error:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 },
    );
  }
}
