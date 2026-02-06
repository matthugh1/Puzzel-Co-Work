/**
 * TodoWrite Tool
 * Updates session todos in the database
 */

import { db } from "@/lib/db";
import type { ToolExecutor } from "./types";

export const todoWriteTool: ToolExecutor = {
  name: "TodoWrite",
  description: "Create or update todo items for the current session. Use this to track task progress.",
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Todo item ID (use existing ID to update, omit to create new)" },
            content: { type: "string", description: "Todo description in imperative form (e.g., 'Run tests')" },
            activeForm: { type: "string", description: "Present continuous form (e.g., 'Running tests')" },
            status: { type: "string", enum: ["pending", "in_progress", "completed"], description: "Todo status" },
            sortOrder: { type: "number", description: "Display order (lower numbers first)" },
          },
          required: ["content", "activeForm"],
        },
      },
    },
    required: ["todos"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { todos } = input as { todos: Array<{
      id?: string;
      content: string;
      activeForm: string;
      status?: "pending" | "in_progress" | "completed";
      sortOrder?: number;
    }> };

    if (!Array.isArray(todos) || todos.length === 0) {
      return {
        content: "Error: todos must be a non-empty array",
        isError: true,
      };
    }

    try {
      const results = [];

      for (const todo of todos) {
        if (todo.id) {
          // Update existing todo
          const updated = await db.coworkTodoItem.update({
            where: { id: todo.id, sessionId: context.sessionId },
            data: {
              content: todo.content,
              activeForm: todo.activeForm,
              status: todo.status?.toUpperCase() as "PENDING" | "IN_PROGRESS" | "COMPLETED" || undefined,
              sortOrder: todo.sortOrder,
            },
          });
          results.push({ id: updated.id, action: "updated" });
        } else {
          // Create new todo
          const created = await db.coworkTodoItem.create({
            data: {
              sessionId: context.sessionId,
              content: todo.content,
              activeForm: todo.activeForm,
              status: (todo.status?.toUpperCase() || "PENDING") as "PENDING" | "IN_PROGRESS" | "COMPLETED",
              sortOrder: todo.sortOrder || 0,
            },
          });
          results.push({ id: created.id, action: "created" });
        }
      }

      // Fetch all todos for the session to return in metadata
      const allTodos = await db.coworkTodoItem.findMany({
        where: { sessionId: context.sessionId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      return {
        content: `Successfully ${results.map(r => r.action).join(", ")} ${results.length} todo item(s)`,
        isError: false,
        metadata: { 
          results,
          todos: allTodos.map(t => ({
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
