# Cursor Implementation Plan: Fix Todo Completion

**Problem:** The Progress widget shows 2/4 items checked despite all work being done. The LLM creates the todo plan, does the work, but doesn't consistently call TodoWrite again to mark items as completed. "Create Word document" is still showing as in_progress (purple spinner) even though the CreateDocument tool already ran successfully. "Provide a summary" is still pending even though the summary was written.

**Root causes:**

1. The system prompt instructions are too subtle — the LLM (especially GPT-4 Turbo) doesn't reliably remember to call TodoWrite after each step
2. There's no backend safety net — when the agent loop finishes, any in_progress items should be marked completed automatically

**Two-part fix:**

1. **Strengthen the system prompt** — make it impossible to ignore
2. **Auto-complete at end of agent loop** — when the LLM finishes its response (message_end), automatically mark all remaining in_progress/pending items as completed and emit a final todo_update event

---

## Task 1: Strengthen the System Prompt

### File: `src/lib/cowork/agent-loop.ts`

**Replace lines 89–97** (the current "Progress tracking:" section) with this stronger version:

```
Progress tracking (CRITICAL — you must follow this exactly):
- For any task involving 2+ steps, call TodoWrite FIRST to create a plan before doing any work.
- Each todo needs: content (imperative, e.g. "Run tests"), activeForm (present continuous, e.g. "Running tests"), status, and sortOrder.
- When creating todos for the first time, use id: "" for each item.
- TodoWrite returns the full list with database IDs. You MUST use these IDs in all subsequent calls.
- WORKFLOW: Before EVERY tool call, call TodoWrite to mark the current item as in_progress. After EVERY tool call completes, call TodoWrite to mark it completed and the next item as in_progress. This means a typical step looks like: TodoWrite(mark step N in_progress) → do the work → TodoWrite(mark step N completed, step N+1 in_progress).
- Each TodoWrite call MUST include ALL todos (the complete list), not just the ones that changed.
- After ALL work is done, make a FINAL TodoWrite call marking everything as completed.
- Only skip TodoWrite for simple conversational replies with no tool calls.
```

The key change is the explicit workflow: "Before EVERY tool call, call TodoWrite... After EVERY tool call, call TodoWrite..." This removes ambiguity.

---

## Task 2: Auto-Complete Todos When Agent Loop Ends

This is the backend safety net. When the agent finishes its response (the streaming loop ends), check if there are any in_progress or pending todos left. If the agent successfully completed its work (no error), mark them all as completed and emit a final `todo_update` event.

### File: `src/lib/cowork/agent-loop.ts`

Find the section where the agent loop returns / ends (after all tool iterations are complete, around the `return` statement at the end of `runAgentLoop`). Before returning, add:

```typescript
// ── Auto-complete remaining todos ──
// Safety net: if the agent finished without marking all todos completed,
// mark any in_progress items as completed now.
if (config.sessionId) {
  try {
    const remainingTodos = await db.coworkTodoItem.findMany({
      where: {
        sessionId: config.sessionId,
        status: { in: ["IN_PROGRESS"] },
      },
    });

    if (remainingTodos.length > 0) {
      await db.coworkTodoItem.updateMany({
        where: {
          sessionId: config.sessionId,
          status: "IN_PROGRESS",
        },
        data: { status: "COMPLETED" },
      });

      // Fetch updated list and emit final todo_update
      const allTodos = await db.coworkTodoItem.findMany({
        where: { sessionId: config.sessionId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });

      config.sendEvent?.("todo_update", {
        todos: allTodos.map((t) => ({
          id: t.id,
          sessionId: t.sessionId,
          content: t.content,
          activeForm: t.activeForm,
          status: t.status.toLowerCase(),
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
        })),
      });
    }
  } catch (err) {
    console.error("[Agent Loop] Error auto-completing todos:", err);
  }
}
```

You will need to add `import { db } from "@/lib/db";` at the top of the file if it's not already imported.

You will also need access to `sendEvent` at the point where the agent loop ends. Check how `sendEvent` is available — it may be passed in `config` or available as a local variable. If `sendEvent` is not available directly, the alternative is to add this logic in the **messages route handler** (`src/app/api/cowork/sessions/[id]/messages/route.ts`) after the agent loop call completes. That route already has `sendEvent` available.

### Alternative location: `src/app/api/cowork/sessions/[id]/messages/route.ts`

If it's easier to add this in the route handler (which already has `sendEvent`), add it after the agent loop call completes, before the `message_end` event is sent:

```typescript
// Auto-complete any in_progress todos after agent finishes
try {
  const remainingTodos = await db.coworkTodoItem.findMany({
    where: {
      sessionId: session.id,
      status: "IN_PROGRESS",
    },
  });

  if (remainingTodos.length > 0) {
    await db.coworkTodoItem.updateMany({
      where: {
        sessionId: session.id,
        status: "IN_PROGRESS",
      },
      data: { status: "COMPLETED" },
    });

    const allTodos = await db.coworkTodoItem.findMany({
      where: { sessionId: session.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    sendEvent("todo_update", {
      todos: allTodos.map((t) => ({
        id: t.id,
        sessionId: t.sessionId,
        content: t.content,
        activeForm: t.activeForm,
        status: t.status.toLowerCase(),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  }
} catch (err) {
  console.error("[Route] Error auto-completing todos:", err);
}
```

---

## Summary

| Change                   | File                                   | What it does                                      |
| ------------------------ | -------------------------------------- | ------------------------------------------------- |
| Stronger prompt          | `agent-loop.ts` lines 89–97            | Explicit "before/after every tool call" workflow  |
| Auto-complete safety net | `agent-loop.ts` or `messages/route.ts` | Marks IN_PROGRESS → COMPLETED when agent finishes |

The prompt change makes the LLM more likely to update todos properly. The auto-complete safety net catches anything it misses — when the agent loop ends, any item still stuck as in_progress gets automatically marked completed, and a final `todo_update` SSE event updates the frontend.

## Verify

1. Send "create a project kickoff checklist as a Word document"
2. Watch the Progress widget — items should transition pending → in_progress → completed
3. When the agent finishes, ALL items should show as completed (✓)
4. The badge should show "4/4" (or whatever the total is)
5. No items should be stuck as in_progress (purple spinner) after the agent finishes
6. `npm run build` compiles clean
