# Cursor Implementation Plan: Fix Todo Duplication

**Problem:** Every todo item appears 3 times in the Progress widget — once as pending, once as in_progress, once as completed. Example from screenshot: "Draft sections for the document" shows as ○ pending, ✦ in_progress (purple spinner), AND ✓ completed — three separate database records.

**Root cause:** When the LLM calls TodoWrite the first time, it creates items with `id: ""`. The backend creates new database records and returns IDs — but only in the `metadata` field (which goes to the frontend SSE event). The `content` field sent back to the LLM just says `"Successfully created, created, created 4 todo item(s)"` with **no IDs**. When the LLM later wants to mark an item as in_progress, it has no ID to reference, so it sends `id: ""` again → creating a duplicate.

**The fix has two parts:**

1. Return the full todo list with IDs in the tool result `content` so the LLM knows the IDs
2. Add a fallback: if the backend receives a todo with no ID but the content matches an existing todo, update it instead of creating a duplicate

---

## Task 1: Return IDs in Tool Result Content

### File: `src/lib/cowork/tools/todo-write.ts`

The `content` field at line 115 is what gets sent back to the LLM as the tool_result in the conversation. Change it from a generic success message to include the actual todo list with IDs.

**Replace lines 114–129:**

```typescript
// Build a content string that includes IDs so the LLM can reference them
// in subsequent calls. This is the tool_result the LLM sees.
const todoSummary = allTodos
  .map(
    (t, i) => `${i + 1}. [id=${t.id}] ${t.content} (${t.status.toLowerCase()})`,
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
```

Now when the LLM calls TodoWrite, it gets back:

```
Todos updated. Current state:
1. [id=cm7abc123] Draft sections for the document (pending)
2. [id=cm7def456] Write the document content (pending)
3. [id=cm7ghi789] Create Word document (pending)
4. [id=cm7jkl012] Provide summary of the document (pending)

IMPORTANT: Use the exact id values above when updating these todos.
```

On the next call, the LLM can use `id: "cm7abc123"` to update the existing record instead of creating a duplicate.

---

## Task 2: Add Content-Matching Fallback

Even with IDs returned, the LLM might occasionally forget to use them (LLMs aren't perfect). Add a fallback: when a todo has an empty ID but the `content` exactly matches an existing todo in the session, update that existing record instead of creating a duplicate.

### File: `src/lib/cowork/tools/todo-write.ts`

**Replace the `else` block (lines 92–105) with:**

```typescript
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
                sortOrder: typeof todo.sortOrder === "number" ? todo.sortOrder : existing.sortOrder,
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
                sortOrder: typeof todo.sortOrder === "number" ? todo.sortOrder : 0,
              },
            });
            results.push({ id: created.id, action: "created" });
          }
        }
```

This means:

- If the LLM sends `{id: "", content: "Draft sections for the document", status: "in_progress"}` and there's already a todo with that exact content → it updates the existing one
- If it's genuinely new content → it creates a new record
- This is a safety net — Task 1 (returning IDs) is the primary fix

---

## Task 3: Update System Prompt

### File: `src/lib/cowork/agent-loop.ts`

The system prompt's progress tracking section (which you recently added) should mention that TodoWrite returns IDs that must be reused.

**Find the "Progress tracking:" section and update it to:**

```
Progress tracking:
- For any task involving multiple steps or tool calls, call TodoWrite FIRST to create a plan before doing any work.
- Each todo needs: content (imperative form, e.g. "Run tests"), activeForm (present continuous, e.g. "Running tests"), and status (pending/in_progress/completed).
- When creating todos for the first time, use id: "" for each item.
- TodoWrite returns the full list with database IDs. You MUST use these exact IDs in all subsequent calls to update status — do NOT send id: "" for items that already exist, or duplicates will be created.
- Each call to TodoWrite should include the COMPLETE list of todos (not just changed ones) so the progress widget stays accurate.
- Mark each item in_progress when you start it, then completed when done.
- Include a final verification step (e.g. "Verify output").
- Only skip TodoWrite for simple conversational replies (answering a question, writing a short text).
```

---

## Task 4: Clean Up Existing Duplicate Todos (Optional)

If there are existing sessions with duplicate todos from testing, you can clean them up with a one-time script. This is optional since new sessions will work correctly after the fix.

Add a DB cleanup in the session GET endpoint or run manually:

```sql
-- Find and remove duplicate todos (keep the newest version of each)
DELETE FROM cowork_todo_items a
USING cowork_todo_items b
WHERE a.session_id = b.session_id
  AND a.content = b.content
  AND a.created_at < b.created_at;
```

---

## Summary

| Change                            | File                         | Why                                      |
| --------------------------------- | ---------------------------- | ---------------------------------------- |
| Return todo IDs in content string | `todo-write.ts` line 115     | LLM needs IDs to update existing items   |
| Content-matching fallback         | `todo-write.ts` lines 92–105 | Safety net when LLM forgets to use IDs   |
| Updated system prompt             | `agent-loop.ts`              | Tell LLM to reuse IDs and send full list |

## Before → After

**Before:**

```
LLM: TodoWrite([{id:"", content:"Draft", status:"pending"}])
→ DB: creates record cm7abc
→ LLM sees: "Successfully created 1 todo item(s)"  ← NO ID!
LLM: TodoWrite([{id:"", content:"Draft", status:"in_progress"}])  ← can't reference cm7abc
→ DB: creates ANOTHER record cm7def  ← DUPLICATE
```

**After:**

```
LLM: TodoWrite([{id:"", content:"Draft", status:"pending"}])
→ DB: creates record cm7abc
→ LLM sees: "1. [id=cm7abc] Draft (pending)"  ← HAS ID
LLM: TodoWrite([{id:"cm7abc", content:"Draft", status:"in_progress"}])  ← uses the ID
→ DB: updates cm7abc  ← CORRECT
```

## Verify

1. Send "create a project kickoff checklist as a Word document"
2. Right panel Progress should show each task ONCE — not duplicated
3. Tasks should transition: ○ pending → ✦ in_progress → ✓ completed (same item, not 3 items)
4. Badge should show correct count (e.g. "3/4" not "3/12")
5. `npm run build` compiles clean
