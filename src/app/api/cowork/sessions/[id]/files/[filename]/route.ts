import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

interface RouteContext {
  params: Promise<{ id: string; filename: string }>;
}

/**
 * GET /api/cowork/sessions/:id/files/:filename
 * Serve an individual file from a session
 */
export async function GET(request: Request, context: RouteContext) {
  const { id, filename } = await context.params;

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
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    // 6. Look up file record in DB
    const fileRecord = await db.coworkFile.findFirst({
      where: { sessionId: id, fileName: filename },
    });

    if (!fileRecord) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 },
      );
    }

    // 7. Read file from disk
    const filePath = fileRecord.storagePath;

    // Security: ensure the file path is within the session storage directory
    const sessionDir = path.join(process.cwd(), "storage", "sessions", id);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(sessionDir)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    let fileContent: string;
    try {
      fileContent = await fs.readFile(resolvedPath, "utf-8");
    } catch {
      return NextResponse.json(
        { error: "File not found on disk" },
        { status: 404 },
      );
    }

    // 8. Return file with correct content type
    return new Response(fileContent, {
      status: 200,
      headers: {
        "Content-Type": fileRecord.mimeType || "application/octet-stream",
        "Content-Length": String(Buffer.byteLength(fileContent, "utf-8")),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Serve file error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}
