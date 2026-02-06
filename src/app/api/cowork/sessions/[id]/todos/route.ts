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
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cowork/sessions/:id/todos
 * Get current todos for a session
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
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      );
    }

    const todos = await db.coworkTodoItem.findMany({
      where: { sessionId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      todos: todos.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        content: t.content,
        activeForm: t.activeForm,
        status: t.status.toLowerCase().replace("_", "_"),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get todos error:", error);
    return NextResponse.json(
      { error: "Failed to get todos" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/cowork/sessions/:id/todos
 * Replace all todos for a session (used by TodoWrite tool)
 */
export async function PUT(request: Request, context: RouteContext) {
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
    // 6. Validate input
    const body = await validateRequestBody(
      request,
      validationSchemas.updateCoworkTodos,
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

    // 8. Replace all todos in a transaction
    const todos = await db.$transaction(async (tx) => {
      // Delete existing todos
      await tx.coworkTodoItem.deleteMany({
        where: { sessionId: id },
      });

      // Create new todos
      const created = [];
      for (let i = 0; i < body.todos.length; i++) {
        const todo = body.todos[i];
        if (!todo) continue;
        const newTodo = await tx.coworkTodoItem.create({
          data: {
            id: todo.id,
            sessionId: id,
            content: todo.content,
            activeForm: todo.activeForm,
            status: todo.status.toUpperCase().replace(" ", "_") as "PENDING" | "IN_PROGRESS" | "COMPLETED",
            sortOrder: i,
          },
        });
        created.push(newTodo);
      }

      return created;
    });

    return NextResponse.json({
      todos: todos.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        content: t.content,
        activeForm: t.activeForm,
        status: t.status.toLowerCase(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Update todos error:", error);
    return NextResponse.json(
      { error: "Failed to update todos" },
      { status: 500 },
    );
  }
}
