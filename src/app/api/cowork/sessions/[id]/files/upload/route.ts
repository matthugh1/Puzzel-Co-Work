import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { getUserFromRequest } from "@/lib/auth";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".md",
  ".rtf",
  ".xlsx",
  ".xls",
  ".csv",
  ".tsv",
  ".pptx",
  ".ppt",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".html",
  ".css",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".zip",
]);

/**
 * POST /api/cowork/sessions/:id/files/upload
 * Upload file(s) to a session
 */
export async function POST(request: Request, context: RouteContext) {
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
    // 6. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // 7. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 8. Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 },
      );
    }

    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    // 9. Save file to disk
    const uploadsDir = join(
      process.cwd(),
      "storage",
      "sessions",
      id,
      "uploads",
    );
    await mkdir(uploadsDir, { recursive: true });

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = join(uploadsDir, safeFileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await writeFile(storagePath, fileBuffer);

    // 10. Create file record
    const fileRecord = await db.coworkFile.create({
      data: {
        sessionId: id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category: "UPLOAD",
        storagePath,
        downloadUrl: `/api/cowork/files/${id}/${safeFileName}`,
        metadata: {
          originalName: file.name,
        },
      },
    });

    return NextResponse.json(
      {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        category: "upload",
        downloadUrl: fileRecord.downloadUrl,
        createdAt: fileRecord.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
