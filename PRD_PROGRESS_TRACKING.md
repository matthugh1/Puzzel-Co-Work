# PRD: Progress Tracking in Puzzel Co-Work

**Date:** 13 February 2026
**Status:** Analysis complete, implementation gaps identified

---

## 1. How Claude Cowork Handles Progress

Claude Cowork's system prompt (visible in the Cowork system prompt documentation) has an explicit `<todo_list_tool>` section that instructs the LLM to use TodoWrite **proactively** for virtually all non-trivial tasks. The key passages:

> **DEFAULT BEHAVIOR:** Claude MUST use TodoWrite for virtually ALL tasks that involve tool calls.
>
> Claude should use the tool more liberally than the advice in TodoWrite's tool description would imply. This is because Claude is powering Cowork mode, and the TodoList is nicely rendered as a widget to Cowork users.
>
> **ONLY skip TodoWrite if:**
>
> - Pure conversation with no tool use (e.g., answering "what is the capital of France?")
> - User explicitly asks Claude not to use it

The prompt also specifies ordering:

> **Suggested ordering with other tools:**
>
> - Review Skills / AskUserQuestion (if clarification needed) → TodoWrite → Actual work

And requires a final verification step:

> Claude should include a final verification step in the TodoList for virtually any non-trivial task.

The result is that for any request beyond simple conversation, the user sees a progress widget in the right panel showing what the agent is working on, what's done, and what's next — before any actual work starts.

### How Progress Appears in Claude Cowork

1. **User sends message** (e.g. "Create a presentation about Q4 results")
2. **LLM's first action** is to call `TodoWrite` with a task list:
   - `[pending]` Read Q4 data files
   - `[pending]` Design slide structure
   - `[pending]` Create presentation
   - `[pending]` Verify output
3. **Progress widget** immediately appears in the right panel showing 0/4
4. **As LLM works**, it calls `TodoWrite` again to mark items `in_progress` then `completed`
5. **Widget updates in real-time** via SSE `todo_update` events: 1/4, 2/4, 3/4, 4/4

This gives the user continuous visibility into what's happening, even during long-running tasks.

---

## 2. Current State in Puzzel Co-Work

### What Exists (Backend — All Working)

| Component        | File                                                          | Status                                           |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| TodoWrite tool   | `src/lib/cowork/tools/todo-write.ts` (113 lines)              | Registered, functional, persists to DB           |
| DB model         | `prisma/schema.prisma` CoworkTodoItem (lines 273–287)         | Complete with all fields                         |
| SSE emission     | `src/lib/cowork/tool-execution.ts` (lines 314–315)            | Emits `todo_update` on TodoWrite                 |
| SSE parsing      | `src/components/cowork/CoworkCentrePanel.tsx` (lines 290–295) | Parses `todo_update`, calls `actions.setTodos()` |
| State management | `src/lib/cowork/context.tsx` (lines 264–272)                  | `SET_TODOS` action, `state.todos.items`          |
| Session loading  | `src/app/cowork/page.tsx` (lines 123–129)                     | Loads todos from DB on session open              |
| API endpoint     | `GET /api/cowork/sessions/:id`                                | Returns session todos                            |
| Session state    | `src/lib/cowork/agent-loop.ts` (lines 39–43)                  | Appends pending todos to system prompt           |
| Session steps    | `src/lib/cowork/session-steps.ts` (135 lines)                 | Derives steps from tool_use/tool_result pairs    |
| Todo widget      | `src/components/cowork/CoworkTodoWidget.tsx` (57 lines)       | Renders progress count + item list               |
| Right panel      | `src/components/cowork/CoworkRightPanel.tsx` (lines 119–157)  | Shows Progress section when `hasProgress`        |

**The entire data flow is wired up and functional.** TodoWrite tool → DB → SSE event → frontend state → right panel widget.

### What's Broken (The Actual Problem)

**The LLM is never told to use TodoWrite.**

The system prompt in `agent-loop.ts` (lines 80–120) has detailed instructions for:

- Using custom skills (12 lines)
- Creating skills (18 lines)
- Writing skill prompts (8 lines)
- Document creation (4 lines)

But **zero instructions about TodoWrite**. The word "TodoWrite" does not appear in the system prompt. The word "progress" does not appear. The word "todo" does not appear.

The LLM has access to the tool (it's registered), but it has no guidance telling it to use the tool proactively. Since LLMs only call tools when they believe it's appropriate, and the default behaviour is to just respond with text, TodoWrite is never called.

### Session Steps — Partially Working

Session steps (`getSessionStepsFromMessages`) derive progress items from tool_use/tool_result pairs in messages. This means:

- When the LLM calls tools (Read, Write, Bash, CreateDocument, etc.), steps appear in the Progress section
- When the LLM responds with text only (like the poem example), **no steps are generated**

This is correct for tool-heavy tasks but produces an empty Progress section for conversational responses — which is the majority of simple interactions.

---

## 3. The Gap

| What Claude Cowork does                                                                 | What Puzzel does                           | Gap                                    |
| --------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| System prompt says "MUST use TodoWrite for virtually ALL tasks that involve tool calls" | System prompt says nothing about TodoWrite | **Critical: LLM never uses TodoWrite** |
| Suggested ordering: AskUserQuestion → TodoWrite → work                                  | No ordering guidance                       | LLM jumps straight to work             |
| "Include a final verification step"                                                     | No verification guidance                   | No quality gate                        |
| "Only skip TodoWrite for pure conversation"                                             | TodoWrite never used at all                | No progress for any task               |
| Session steps from tool calls                                                           | Same (works when tools are called)         | No gap here — works                    |
| Combined view: todos + tool steps                                                       | Same structure (works)                     | No gap here — works                    |

**Root cause: A single missing paragraph in the system prompt.**

---

## 4. The Fix

### 4a. Add TodoWrite Instructions to the System Prompt

In `src/lib/cowork/agent-loop.ts`, the `defaultPrompt` string (lines 80–120) needs a new section about progress tracking. Add this after the "Key behaviours" section and before "Using custom skills":

```
Progress tracking (IMPORTANT):
- For any task that involves multiple steps or tool calls, call TodoWrite FIRST to create a task list before starting work.
- Each todo needs: content (imperative form, e.g. "Run tests"), activeForm (present continuous, e.g. "Running tests"), and status (pending/in_progress/completed).
- Update todo status as you work: mark items in_progress when starting, completed when done.
- Include a verification step as the final todo (e.g. "Verify output", "Review results").
- Only skip TodoWrite for simple conversational responses that don't involve tool calls (e.g. answering a question, writing a short poem).
- Suggested order: clarify requirements → TodoWrite (plan) → do the work → verify.
```

This is the minimum change needed. With this paragraph, the LLM will:

1. Call TodoWrite before starting multi-step work
2. Update progress as it goes
3. The right panel Progress section will populate automatically via the existing SSE pipeline

### 4b. Improve Session Steps Visibility

Session steps are derived from tool_use/tool_result pairs. They currently work but only appear when tools are called. Two improvements:

**4b-i. Show session steps alongside todos (not instead of)**

The current right panel already does this — when both `recentSteps` and `todos` have content, both render. No change needed.

**4b-ii. Add response steps for non-tool messages**

`session-steps.ts` already creates "Response" steps when an assistant message has both text AND tool calls (lines 81–92). But pure text responses (no tool calls) create no steps at all.

Consider adding a lightweight "Response" step for any assistant message that has substantial text content (e.g. > 100 characters), even without tool calls. This would make the Progress section show something like:

```
✓ Response: Here's a lovely poem for you...
```

This is optional — the main fix is 4a (system prompt). This just adds extra polish.

### 4c. Real-Time Progress During Streaming

Currently, todo updates only appear when the TodoWrite tool_result is received (after the tool executes). For a better experience, consider emitting a `todo_update` event when the tool_use is detected (before execution), so the user sees the plan appear instantly when the LLM decides to create todos.

This requires a change in `tool-execution.ts` to emit an early "planning" event when a TodoWrite tool_use is detected. The current code only emits after execution (line 314–315).

---

## 5. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                     │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  POST /api/cowork/sessions/:id/messages                  │
│                                                          │
│  1. Load session state (existing todos, files, feedback) │
│  2. Build system prompt (agent-loop.ts)                  │
│     └─ appendSessionState() adds pending todos           │
│  3. Call LLM with messages + tools                       │
└──────────────────────────┬──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
   ┌──────────────────┐     ┌──────────────────────┐
   │  LLM responds     │     │  LLM calls TodoWrite  │
   │  with text only   │     │  (if prompted to)      │
   │                   │     │                        │
   │  → SSE:           │     │  Tool input:           │
   │    content_delta   │     │  { todos: [            │
   │                   │     │    { content: "...",    │
   │  No progress      │     │      status: "pending" │
   │  updates          │     │    }, ...               │
   └──────────────────┘     │  ] }                    │
                            └───────────┬────────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │  todo-write.ts        │
                            │                       │
                            │  1. Upsert todos      │
                            │     in database       │
                            │  2. Return all todos  │
                            │     in metadata       │
                            └───────────┬──────────┘
                                        │
                                        ▼
                            ┌──────────────────────┐
                            │  tool-execution.ts    │
                            │  handleToolSideEffects│
                            │                       │
                            │  Detects TodoWrite →  │
                            │  sendEvent(           │
                            │    "todo_update",     │
                            │    { todos: [...] }   │
                            │  )                    │
                            └───────────┬──────────┘
                                        │
                              SSE stream│
                                        ▼
                            ┌──────────────────────┐
                            │  CoworkCentrePanel    │
                            │  SSE parser           │
                            │                       │
                            │  case "todo_update":  │
                            │    actions.setTodos() │
                            └───────────┬──────────┘
                                        │
                              dispatch  │
                                        ▼
                            ┌──────────────────────┐
                            │  context.tsx          │
                            │  reducer              │
                            │                       │
                            │  SET_TODOS action →   │
                            │  state.todos.items    │
                            └───────────┬──────────┘
                                        │
                                 props  │
                                        ▼
                            ┌──────────────────────┐
                            │  CoworkRightPanel     │
                            │                       │
                            │  hasProgress = true → │
                            │  Progress section     │
                            │  renders              │
                            │                       │
                            │  → CoworkTodoWidget   │
                            │    shows items +      │
                            │    progress count     │
                            └──────────────────────┘
```

---

## 6. Session Steps Flow (Separate from Todos)

Session steps are a **second source of progress data** that works independently from TodoWrite:

```
┌─────────────────────────────────────────────────────────┐
│  Messages stored in state.chat.messages                  │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  getSessionStepsFromMessages()   (session-steps.ts)      │
│                                                          │
│  For each message:                                       │
│    1. If assistant has text + tool_use → "Response" step  │
│    2. Each tool_use block → pending step                  │
│    3. Each tool_result block → pairs with tool_use        │
│       → completed step with result summary                │
│                                                          │
│  Returns: SessionStep[] ordered by appearance             │
└──────────────────────────┬──────────────────────────────┘
                           │
                  useMemo  │  (page.tsx line 32)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  CoworkRightPanel receives sessionSteps prop              │
│                                                          │
│  recentSteps = sessionSteps.map(...)                     │
│                                                          │
│  Renders: ✓ icon + "ToolName: result summary"            │
└─────────────────────────────────────────────────────────┘
```

Session steps appear automatically whenever the LLM calls any tool. They don't require TodoWrite — they're derived from the message history. But for a pure-text response (like "write me a poem"), no tools are called, so no session steps exist.

---

## 7. File Reference

| File                                                 | Lines   | Role in Progress System                                  |
| ---------------------------------------------------- | ------- | -------------------------------------------------------- |
| `src/lib/cowork/agent-loop.ts`                       | 80–120  | System prompt — **MISSING TodoWrite instructions**       |
| `src/lib/cowork/agent-loop.ts`                       | 39–43   | `appendSessionState()` — appends pending todos to prompt |
| `src/lib/cowork/tools/todo-write.ts`                 | 1–113   | TodoWrite tool — creates/updates todos in DB             |
| `src/lib/cowork/tools/register.ts`                   | 22      | Registers TodoWrite tool                                 |
| `src/lib/cowork/tool-execution.ts`                   | 314–315 | Emits `todo_update` SSE event after TodoWrite executes   |
| `src/lib/cowork/session-steps.ts`                    | 66–135  | Derives SessionStep[] from tool_use/tool_result pairs    |
| `src/app/api/cowork/sessions/[id]/messages/route.ts` | 401–433 | Runs agent loop, streams SSE events                      |
| `src/app/api/cowork/sessions/[id]/route.ts`          | 102–110 | Returns session todos on GET                             |
| `src/components/cowork/CoworkCentrePanel.tsx`        | 290–295 | Parses `todo_update` SSE events                          |
| `src/lib/cowork/context.tsx`                         | 264–272 | `SET_TODOS` reducer action                               |
| `src/lib/cowork/context.tsx`                         | 514–518 | `setTodos()` action creator                              |
| `src/app/cowork/page.tsx`                            | 32–34   | `useMemo` derives sessionSteps from messages             |
| `src/app/cowork/page.tsx`                            | 123–129 | Loads todos from DB on session open                      |
| `src/app/cowork/page.tsx`                            | 319–321 | Passes `todos` and `sessionSteps` to right panel         |
| `src/components/cowork/CoworkRightPanel.tsx`         | 89–157  | Renders Progress section (todos + steps)                 |
| `src/components/cowork/CoworkTodoWidget.tsx`         | 1–57    | Renders todo items with icons and progress count         |
| `prisma/schema.prisma`                               | 273–287 | CoworkTodoItem model                                     |

---

## 8. Implementation Plan for Cursor

### Task 1: Add TodoWrite instructions to system prompt

**File:** `src/lib/cowork/agent-loop.ts`

**Where:** After "Key behaviours:" section (line 87) and before "Using custom skills (IMPORTANT):" section (line 89).

**Add this text:**

```
Progress tracking:
- For any task involving multiple steps or tool calls, call TodoWrite FIRST to create a plan before doing any work.
- Each todo needs: content (imperative, e.g. "Run tests"), activeForm (present continuous, e.g. "Running tests"), and status (pending/in_progress/completed).
- Mark each item in_progress when you start it, then completed when done.
- Include a final verification step (e.g. "Verify output").
- Only skip TodoWrite for simple conversational replies (answering a question, writing a short text).
- Order: clarify with AskUserQuestion if needed → TodoWrite → do the work → verify.
```

### Task 2: (Optional) Add response steps for text-only messages

**File:** `src/lib/cowork/session-steps.ts`

In `getSessionStepsFromMessages()`, after the loop over messages (line 121), add a check: if the current assistant message has substantial text (> 100 chars) but NO tool_use blocks, add a "Response" step. Currently this only happens when BOTH text AND tool_use are present (lines 81–92).

**Change:** In the loop body (around line 81), adjust the condition:

```typescript
if (msg.role === "assistant") {
  const textSummary = getAssistantTextSummary(content);
  const toolUseBlocks = content.filter((b): b is ToolUseContent =>
    isToolUse(b),
  );
  // Show response step: always when there's text (not just when tools follow)
  if (textSummary) {
    result.push({
      id: `response-${msg.id}`,
      name: "Response",
      resultSummary: textSummary,
      order: order++,
    });
  }
}
```

This makes the Progress section show something even for text-only responses.

### Verify

1. Send "create me a lovely poem" — the right panel should now show:
   - A "Response" step: `✓ Response: Here's a lovely poem for you...`
2. Send "create a document about our Q4 results" — the right panel should show:
   - TodoWrite progress: `1/4` with pending/in-progress/completed items
   - Session steps: `✓ CreateDocument: Q4 results...`
3. Confirm `npm run build` compiles clean

---

## 9. Summary

The progress system is **fully implemented but dormant** because the system prompt doesn't tell the LLM to use it. One paragraph added to the system prompt will activate the entire pipeline. The optional session-steps change adds visibility for text-only responses.
