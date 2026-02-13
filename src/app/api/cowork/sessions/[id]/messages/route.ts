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
import type { Prisma } from "@prisma/client";
import {
  getDefaultProvider,
  getDefaultModel,
  type LLMProvider,
} from "@/lib/cowork/llm";
import { streamAgentLoop, type ArtifactCreator } from "@/lib/cowork/agent-loop";
// Force tool registration when this route loads (avoids tools: 0 in agent loop)
import "@/lib/cowork/tools/register";
import path from "path";
import fs from "fs/promises";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id/messages
 * Get paginated message history
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;

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
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      100,
    );

    const messages = await db.coworkMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return NextResponse.json({
      messages: messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role.toLowerCase(),
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
      hasMore: messages.length === limit,
      nextCursor:
        messages.length > 0 ? messages[messages.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to get messages" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cowork/sessions/:id/messages
 * Send a message and stream LLM response via SSE
 */
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
    // 6. Validate input
    const body = await validateRequestBody(
      request,
      validationSchemas.sendCoworkMessage,
    );

    // 7. Verify session ownership
    const session = await db.coworkSession.findFirst({
      where: { id, userId: user.id, organizationId: org.id },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    if (!body.content || body.content.length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    const userMessageText = body.content;

    // 8. Save user message
    await db.coworkMessage.create({
      data: {
        sessionId: id,
        role: "USER",
        content: [{ type: "text", text: userMessageText }],
      },
    });

    // 9. Auto-title from first message
    const messageCount = await db.coworkMessage.count({
      where: { sessionId: id },
    });

    if (messageCount === 1) {
      const title =
        userMessageText.length > 60
          ? userMessageText.substring(0, 57) + "..."
          : userMessageText;
      await db.coworkSession.update({
        where: { id },
        data: { title },
      });
    }

    // 10. Resolve provider/model from request, session, org settings, or defaults
    const requestProvider = body.provider as LLMProvider | undefined;
    const requestModel = body.model as string | undefined;

    let settings;
    try {
      settings = await db.coworkSettings.findUnique({
        where: { organizationId: org.id },
      });
    } catch {
      // Settings table might not exist yet — use defaults
    }

    const provider: LLMProvider =
      requestProvider ||
      (settings?.defaultProvider as LLMProvider) ||
      getDefaultProvider();

    const model: string =
      requestModel ||
      (settings?.defaultModel as string) ||
      session.model ||
      getDefaultModel(provider);

    // 11. Set up session directory
    const sessionDir = path.join(process.cwd(), "storage", "sessions", id);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.mkdir(path.join(sessionDir, "working"), { recursive: true });
    await fs.mkdir(path.join(sessionDir, "outputs"), { recursive: true });

    // 12. Load conversation history for context
    const history = await db.coworkMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      take: 40, // Last 40 messages for context
    });

    // Convert messages to simple format (agent loop will handle tool_use/tool_result)
    const chatMessages = history.map((m) => {
      const content = m.content as unknown as Array<{ type: string; text?: string }>;
      const text =
        content
          .filter((c) => c.type === "text")
          .map((c) => c.text || "")
          .join("\n") || "";
      return {
        role: m.role === "USER" ? "user" as const : "assistant" as const,
        content: text,
      };
    });

    // Helper to determine MIME type and artifact type from file extension
    const getFileInfo = (fileName: string): { mimeType: string; artifactType?: string } => {
      const ext = path.extname(fileName).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".html": "text/html",
        ".htm": "text/html",
        ".jsx": "text/jsx",
        ".tsx": "text/tsx",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".json": "application/json",
        ".js": "text/javascript",
        ".ts": "text/typescript",
        ".css": "text/css",
        ".xml": "application/xml",
      };
      
      const artifactTypes: Record<string, string> = {
        ".html": "html",
        ".htm": "html",
        ".jsx": "jsx", // Prioritize jsx over code
        ".tsx": "jsx", // Prioritize jsx over code
        ".md": "markdown",
        ".markdown": "markdown",
        ".svg": "svg",
        ".png": "image",
        ".jpg": "image",
        ".jpeg": "image",
        ".gif": "image",
        ".pdf": "pdf",
        ".js": "code",
        ".ts": "code",
        ".json": "code",
        ".css": "code",
        ".py": "code",
        ".java": "code",
        ".cpp": "code",
        ".c": "code",
        ".go": "code",
        ".rs": "code",
        ".rb": "code",
        ".php": "code",
      };
      
      return {
        mimeType: mimeTypes[ext] || "application/octet-stream",
        artifactType: artifactTypes[ext],
      };
    };

    // Artifact creation callback (content optional for binary files already on disk, e.g. CreateDocument)
    const createArtifact: ArtifactCreator = async (filePath, fileName, content, sessionId) => {
      const { mimeType, artifactType } = getFileInfo(fileName);
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const downloadUrl = `/api/cowork/sessions/${sessionId}/files/${encodeURIComponent(safeFileName)}`;

      let sizeBytes: number;
      if (content !== undefined) {
        sizeBytes = Buffer.byteLength(content, "utf-8");
      } else {
        try {
          const stat = await fs.stat(filePath);
          sizeBytes = stat.size;
        } catch {
          sizeBytes = 0;
        }
      }

      const fileRecord = await db.coworkFile.create({
        data: {
          sessionId,
          fileName: safeFileName,
          mimeType,
          sizeBytes,
          category: "OUTPUT",
          storagePath: filePath,
          downloadUrl,
          metadata: {
            originalName: fileName,
            generatedBy: "agent",
            artifactType,
          },
        },
      });

      return {
        id: fileRecord.id,
        fileName: fileRecord.fileName,
        mimeType: fileRecord.mimeType,
        sizeBytes: fileRecord.sizeBytes,
        category: fileRecord.category,
        storagePath: fileRecord.storagePath,
        downloadUrl: fileRecord.downloadUrl,
        createdAt: fileRecord.createdAt.toISOString(),
        metadata: fileRecord.metadata as Record<string, unknown> | undefined,
      };
    };

    // 13. Load session state for context
    const todos = await db.coworkTodoItem.findMany({
      where: { sessionId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const files = await db.coworkFile.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "desc" },
    });

    // Load active sub-agents
    const subAgentsRaw = await db.coworkSubAgent.findMany({
      where: {
        sessionId: id,
        status: { in: ["RUNNING", "COMPLETED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    const subAgents: Array<{ id: string; description: string; status: string }> = subAgentsRaw.map((a) => ({
      id: a.id,
      description: a.description,
      status: a.status.toLowerCase(),
    }));

    // 14. Create the SSE stream with agent loop
    let agentStream: ReadableStream<Uint8Array>;
    try {
      agentStream = streamAgentLoop(chatMessages, {
        provider,
        model,
        temperature: settings?.temperature ?? 0.7,
        maxTokens: settings?.maxTokens ?? 4096,
        systemPrompt: settings?.systemPrompt || session.systemPrompt || undefined,
        sessionId: id,
        userId: user.id,
        organizationId: org.id,
        sessionDir: path.join(sessionDir, "working"), // Tools operate in working/ subdirectory
        planMode: session.planMode || false,
        createArtifact,
        sessionState: {
          todos: todos.map((t) => ({
            id: t.id,
            content: t.content,
            status: t.status.toLowerCase(),
          })),
          files: files.map((f) => ({
            fileName: f.fileName,
            category: f.category.toLowerCase(),
          })),
          subAgents,
        },
      });
    } catch (streamError) {
      console.error("[Messages Route] Error creating agent stream:", streamError);
      throw streamError;
    }

    const reader = agentStream.getReader();
    const encoder = new TextEncoder();

    // Wrap the agent stream to capture full message content and handle side effects
    const outputStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "";
        const contentBlocks: Array<{ type: string; [key: string]: unknown }> = [];
        let todoUpdate: unknown = null;
        const artifacts: Array<{ type: string; artifactId: string; fileName: string; renderType?: string }> = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Forward the SSE data to client
            controller.enqueue(value);

            // Parse the SSE event to capture content and side effects
            const text = new TextDecoder().decode(value);
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const parsed = JSON.parse(line.slice(6));
                  
                  if (parsed.type === "content_delta" && parsed.text) {
                    fullText += parsed.text;
                  } else if (parsed.type === "tool_use_start") {
                    contentBlocks.push({
                      type: "tool_use",
                      id: parsed.id || parsed.data?.id,
                      name: parsed.name || parsed.data?.name,
                      input: parsed.input || parsed.data?.input || {},
                    });
                  } else if (parsed.type === "tool_result") {
                    contentBlocks.push({
                      type: "tool_result",
                      tool_use_id: parsed.tool_use_id || parsed.data?.tool_use_id,
                      content: parsed.content || parsed.data?.content || "",
                      is_error: parsed.is_error || parsed.data?.is_error || false,
                    });
                  } else if (parsed.type === "todo_update") {
                    todoUpdate = parsed.todos || parsed.data?.todos;
                  } else if (parsed.type === "artifact_created") {
                    const artifact = parsed.data || parsed;
                    artifacts.push({
                      type: "artifact",
                      artifactId: artifact.id,
                      fileName: artifact.fileName,
                      renderType: artifact.metadata?.artifactType,
                    });
                  }
                } catch {
                  // skip malformed
                }
              }
            }
          }

          // Build final message content
          const finalContent: Array<{ type: string; [key: string]: unknown }> = [];
          if (fullText) {
            finalContent.push({ type: "text", text: fullText });
          }
          // Add tool_use and tool_result blocks in order
          finalContent.push(...contentBlocks);
          // Add artifacts
          finalContent.push(...artifacts);
          if (todoUpdate) {
            finalContent.push({ type: "todo_update", todos: todoUpdate });
          }

          // Save assistant message to DB after streaming
          if (finalContent.length > 0) {
            await db.coworkMessage.create({
              data: {
                sessionId: id,
                role: "ASSISTANT",
                content: finalContent as Prisma.InputJsonValue,
                metadata: {
                  provider,
                  model,
                },
              },
            });

            // Update session model if it was overridden
            if (model !== session.model) {
              await db.coworkSession.update({
                where: { id },
                data: { model },
              });
            }

            // If EnterPlanMode was used, persist plan mode on session
            const usedEnterPlanMode = contentBlocks.some(
              (b) => (b as { type?: string; name?: string }).type === "tool_use" && (b as { name?: string }).name === "EnterPlanMode"
            );
            if (usedEnterPlanMode) {
              await db.coworkSession.update({
                where: { id },
                data: { planMode: true },
              });
            }
          }
        } catch (error) {
          console.error("[Cowork] Agent stream processing error:", error);
          const errPayload = JSON.stringify({
            type: "error",
            code: "stream_error",
            message: "An error occurred during response generation",
          });
          controller.enqueue(
            encoder.encode(`data: ${errPayload}\n\ndata: [DONE]\n\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(outputStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
