/**
 * TodoWrite Tool
 * Updates session todos in the database
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ToolExecutor } from "./types";

export const todoWriteTool: ToolExecutor = {
  name: "TodoWrite",
  description:
    "Create or update todo items for the current session. Use this to track task progress.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: {
              type: "string",
              description:
                "Todo item ID (empty string for new item, existing ID to update)",
            },
            content: {
              type: "string",
              description:
                "Todo description in imperative form (e.g., 'Run tests')",
            },
            activeForm: {
              type: "string",
              description: "Present continuous form (e.g., 'Running tests')",
            },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "Todo status",
            },
            sortOrder: {
              type: "number",
              description: "Display order (lower numbers first)",
            },
          },
          required: ["id", "content", "activeForm", "status", "sortOrder"],
        },
      },
    },
    required: ["todos"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { todos } = input as {
      todos: Array<{
        id?: string;
        content: string;
        activeForm: string;
        status?: string;
        sortOrder?: number;
      }>;
    };

    if (!Array.isArray(todos) || todos.length === 0) {
      return {
        content: "Error: todos must be a non-empty array",
        isError: true,
      };
    }

    try {
      const results = [];

      const toStatus = (
        s: string | undefined,
      ): "PENDING" | "IN_PROGRESS" | "COMPLETED" =>
        (s && String(s).trim() ? String(s).toUpperCase() : "PENDING") as
          | "PENDING"
          | "IN_PROGRESS"
          | "COMPLETED";

      for (const todo of todos) {
        const hasId = todo.id != null && String(todo.id).trim() !== "";
        const idStr = hasId ? String(todo.id).trim() : "";
        const isPreliminaryId = idStr.startsWith("prelim-");

        if (hasId && !isPreliminaryId) {
          // Update existing todo (skip preliminary ids — they were never stored)
          try {
            const updated = await db.coworkTodoItem.update({
              where: { id: idStr, sessionId: context.sessionId },
              data: {
                content: todo.content,
                activeForm: todo.activeForm,
                status: toStatus(todo.status),
                sortOrder: todo.sortOrder ?? undefined,
              },
            });
            results.push({ id: updated.id, action: "updated" });
          } catch (err) {
            // Record not found (e.g. stale id from LLM) — create instead
            if (
              err instanceof Prisma.PrismaClientKnownRequestError &&
              err.code === "P2025"
            ) {
              const created = await db.coworkTodoItem.create({
                data: {
                  sessionId: context.sessionId,
                  content: todo.content,
                  activeForm: todo.activeForm,
                  status: toStatus(todo.status),
                  sortOrder:
                    typeof todo.sortOrder === "number" ? todo.sortOrder : 0,
                },
              });
              results.push({ id: created.id, action: "created" });
            } else {
              throw err;
            }
          }
        } else {
          // No valid ID — try to find an existing todo with matching content
          const existing = await db.coworkTodoItem.findFirst({
            where: {
              sessionId: context.sessionId,
              content: todo.content,
            },
            orderBy: { createdAt: "desc" },
          });

          if (existing) {
            // Update the matching existing todo instead of creating a duplicate
            const updated = await db.coworkTodoItem.update({
              where: { id: existing.id },
              data: {
                activeForm: todo.activeForm,
                status: toStatus(todo.status),
                sortOrder:
                  typeof todo.sortOrder === "number"
                    ? todo.sortOrder
                    : existing.sortOrder,
              },
            });
            results.push({ id: updated.id, action: "updated" });
          } else {
            // Truly new todo — create it
            const created = await db.coworkTodoItem.create({
              data: {
                sessionId: context.sessionId,
                content: todo.content,
                activeForm: todo.activeForm,
                status: toStatus(todo.status),
                sortOrder:
                  typeof todo.sortOrder === "number" ? todo.sortOrder : 0,
              },
            });
            results.push({ id: created.id, action: "created" });
          }
        }
      }

      // Fetch all todos for the session to return in metadata
      const allTodos = await db.coworkTodoItem.findMany({
        where: { sessionId: context.sessionId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      // Build a content string that includes IDs so the LLM can reference them
      // in subsequent calls. This is the tool_result the LLM sees.
      const todoSummary = allTodos
        .map(
          (t, i) =>
            `${i + 1}. [id=${t.id}] ${t.content} (${t.status.toLowerCase()})`,
        )
        .join("\n");

      return {
        content: `Todos updated. Current state:\n${todoSummary}\n\nIMPORTANT: Use the exact id values above when updating these todos.`,
        isError: false,
        metadata: {
          results,
          todos: allTodos.map((t) => ({
            id: t.id,
            sessionId: t.sessionId,
            content: t.content,
            activeForm: t.activeForm,
            status: t.status.toLowerCase(),
            createdAt: t.createdAt.toISOString(),
            updatedAt: t.updatedAt.toISOString(),
          })),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error updating todos: ${message}`,
        isError: true,
      };
    }
  },
};
