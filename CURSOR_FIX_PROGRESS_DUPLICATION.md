# Cursor Implementation Plan: Fix Progress Section Duplication

**Problem:** The right panel Progress section shows the same work multiple times:

1. **TodoWrite calls appear as session steps AND as todo items** — e.g. "TodoWrite: Successfully created, created, created 2 todo item(s)" shows as a step, AND the actual todo items appear in the widget below. The user sees their task list twice.
2. **Every assistant text response creates a "Response" step** — "Response: ### What to Cover in a Project Kickoff" duplicates content already visible in the chat.
3. **Session steps and todo widget are stacked** — when todos exist, the session steps above them are redundant noise (they show the mechanics of HOW the agent worked, not WHAT it's doing).

**Root cause:** Session steps (`getSessionStepsFromMessages`) show EVERY tool call including internal bookkeeping tools (TodoWrite) and text responses. When the todo widget is also visible, this creates a confusing wall of duplicated information.

**Design principle:** When todos exist, the todo widget IS the progress view — it shows what the agent planned, what's done, and what's next. Session steps should only show when there are no todos (as a fallback to show some activity). Internal tools like TodoWrite should never appear as session steps.

---

## Task 1: Filter Out Noisy Tools from Session Steps

### File: `src/lib/cowork/session-steps.ts`

In the `getSessionStepsFromMessages()` function, add a filter to skip internal/bookkeeping tools that should not appear as progress steps. These tools either have their own UI representation (TodoWrite → todo widget) or are too low-level to be useful (like internal tool metadata).

**At the top of the file (after imports), add a set of tools to exclude:**

```typescript
/** Tools that should not appear as session steps because they have their
 *  own UI representation or are internal bookkeeping. */
const HIDDEN_STEP_TOOLS = new Set([
  "TodoWrite", // Has its own todo widget in the Progress section
  "AskUserQuestion", // Has its own interactive block in the chat
  "EnterPlanMode", // Has its own plan block in the chat
  "ExitPlanMode", // Has its own plan block in the chat
  "GetSubAgentResults", // Internal coordination
]);
```

**Then in the loop that processes tool_use blocks (around line 95), add a check:**

Change:

```typescript
if (isToolUse(block)) {
  const input = block.input && typeof block.input === "object" ? block.input : {};
  pending.set(block.id, {
```

To:

```typescript
if (isToolUse(block)) {
  // Skip tools that have their own UI (todo widget, plan block, etc.)
  if (HIDDEN_STEP_TOOLS.has(block.name)) continue;

  const input = block.input && typeof block.input === "object" ? block.input : {};
  pending.set(block.id, {
```

This removes TodoWrite, AskUserQuestion, EnterPlanMode, ExitPlanMode, and GetSubAgentResults from the session steps list.

---

## Task 2: Remove "Response" Steps When Todos Exist

The "Response: ..." steps are useful as a fallback when the agent doesn't call any tools (so the Progress section still shows something). But when todos exist, they're just noise duplicating the chat content.

### Option A (Simpler — recommended): Remove Response steps entirely

The recent change to show Response steps for ALL assistant messages (not just those with tool calls) makes the Progress section too chatty. Every reply creates a step. Revert to only showing Response steps when the assistant message ALSO contains tool calls — this was the original behaviour.

**File: `src/lib/cowork/session-steps.ts`**

Change the assistant text check (around lines 81-91) back to requiring tool calls:

```typescript
if (msg.role === "assistant") {
  const textSummary = getAssistantTextSummary(content);
  const hasToolCalls = content.some((b) => isToolUse(b));
  // Only show a "Response" step when the message also has tool calls —
  // otherwise it just duplicates the chat content
  if (textSummary && hasToolCalls) {
    result.push({
      id: `response-${msg.id}`,
      name: "Response",
      resultSummary: textSummary,
      order: order++,
    });
  }
}
```

### Option B (More nuanced): Remove Response steps only when todos exist

This requires passing a `hasTodos` flag into the function, which changes the signature. Option A is simpler and achieves the same goal.

---

## Task 3: Prioritise Todo Widget Over Session Steps

When both todos AND session steps exist, the todo widget should be the primary view. Session steps become secondary detail.

### File: `src/components/cowork/CoworkRightPanel.tsx`

Change the Progress section (around lines 118–157) to show todos FIRST (they're the plan) and session steps BELOW (they're the execution log). Also, when todos exist, collapse the session steps into a smaller, less prominent view.

Replace the Progress section content (lines 136–154) with:

```tsx
{
  progressOpen && (
    <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
      {/* Todo widget is the primary progress view */}
      {todos.length > 0 && (
        <div className="cowork-right-panel__progress-tasks">
          <CoworkTodoWidget items={todos} />
        </div>
      )}
      {/* Session steps are secondary — only show when no todos, or as a compact log */}
      {recentSteps.length > 0 && todos.length === 0 && (
        <div className="cowork-right-panel__progress-list">
          {recentSteps.map((step, i) => (
            <div
              key={`${step.name}-${i}`}
              className="cowork-right-panel__progress-item"
            >
              <IconCheckCircle
                size={14}
                className="cw-rpanel-icon--success"
                aria-hidden
              />
              <span className="cowork-right-panel__progress-label">
                {step.summary ? `${step.name}: ${step.summary}` : step.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Key change:** When `todos.length > 0`, session steps are hidden entirely. The todo widget is the authoritative progress view. Session steps only show as a fallback when there are no todos (e.g. the agent used tools but didn't call TodoWrite).

---

## Task 4: Update the Badge Count

The Progress section header currently shows the todo count. When there are no todos but there are session steps, show the step count instead.

**File: `src/components/cowork/CoworkRightPanel.tsx`**

Change the badge (around lines 129–134) to:

```tsx
{
  todos.length > 0 ? (
    <span className="cowork-right-panel__section-badge">
      {todos.filter((t) => t.status === "completed").length}/{todos.length}
    </span>
  ) : recentSteps.length > 0 ? (
    <span className="cowork-right-panel__section-badge">
      {recentSteps.length} steps
    </span>
  ) : null;
}
```

---

## Summary of Changes

| File                   | Change                                                                                            | Why                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `session-steps.ts`     | Filter out TodoWrite, AskUserQuestion, EnterPlanMode, ExitPlanMode, GetSubAgentResults from steps | These tools have their own UI — showing them as steps is duplication |
| `session-steps.ts`     | Only create "Response" steps when assistant message also has tool calls                           | Prevents every text reply from creating a progress step              |
| `CoworkRightPanel.tsx` | Show todo widget as primary view; hide session steps when todos exist                             | Eliminates the two-views-of-same-work duplication                    |
| `CoworkRightPanel.tsx` | Badge shows step count as fallback when no todos                                                  | Keeps the badge useful in both modes                                 |

## Before → After

**Before (current):**

```
Progress                                    2/9
✓ Response: ### What to Cover in a Project Kickoff
✓ TodoWrite: Successfully created, created, created...
✓ TodoWrite: Successfully created 1 todo item(s)
✓ TodoWrite: Successfully created, created 2 todo item(s)
✓ TodoWrite: Successfully created, created 2 todo item(s)
✓ CreateDocument: Document created successfully: project-...

Progress                                    2/9
○ List key elements of a project kickoff
✦ List key elements of a project kickoff        ← in progress
✓ List key elements of a project kickoff        ← completed
○ Write the actual checklist as bullet points
✦ Write the actual checklist as bullet points
✓ Write the actual checklist as bullet points
○ Create Word document
✦ Create Word document
○ Summarize the produced document
```

**After (fixed):**

```
Progress                                    2/9
○ List key elements of a project kickoff
✦ List key elements of a project kickoff
✓ List key elements of a project kickoff
○ Write the actual checklist as bullet points
✦ Write the actual checklist as bullet points
✓ Write the actual checklist as bullet points
○ Create Word document
✦ Create Word document
○ Summarize the produced document
```

One clean view. No duplication. The todo widget shows the plan and its progress. The internal mechanics (TodoWrite calls, Response text) are hidden.

## Verify

1. Send "create a project kickoff checklist as a Word document"
2. Right panel should show **only** the todo widget under Progress — no session steps above it
3. No "TodoWrite: Successfully created..." entries anywhere
4. No "Response: ..." entries
5. The badge should show "2/9" (or whatever the todo completion count is)
6. Send a simple message like "write me a poem" — Progress section should show nothing (or a single step if tools are called), not a "Response" step
7. `npm run build` compiles clean
