# Cursor Implementation Plan: Compact Tool Blocks

**Problem:** Every tool call and tool result renders as a full-width colored block with prominent "TOOL CALL" (purple) and "TOOL RESULT" (green) badges. These dominate the chat, pushing the actual response content out of view. The user sees more tool chrome than actual answers.

**Target:** Claude Cowork shows tool activity as a single compact, collapsible line — just the tool name + a brief summary, with a subtle background. Tool use and its result are **merged into one entry** rather than two separate blocks. Details expand on click. The chat stays clean and readable.

---

## Task 1: Merge Tool Use + Tool Result Into a Single Component

Currently, `ToolUseBlock` and `ToolResultBlock` are separate components rendered as separate blocks in the message. A single tool call produces TWO visual entries. Replace them with one `ToolActivityBlock` that shows both the call and its result in a single collapsed line.

### New file: `src/components/cowork/message-blocks/ToolActivityBlock.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  IconChevronRight,
  IconChevronDown,
  IconTerminal,
  IconCheckCircle,
  IconAlertTriangle,
  IconLoader,
} from "@/components/cowork/icons";

/** One-line summary for the tool (e.g. "Read package.json", "Bash npm run build"). */
function toolSummary(
  name: string,
  input?: Record<string, unknown>,
): string | null {
  if (!input || typeof input !== "object") return null;
  const path = [input.path, input.filePath, input.file].find(
    (v) => typeof v === "string",
  ) as string | undefined;
  const command = typeof input.command === "string" ? input.command : undefined;
  const query = typeof input.query === "string" ? input.query : undefined;
  const pattern = typeof input.pattern === "string" ? input.pattern : undefined;
  const url = typeof input.url === "string" ? input.url : undefined;
  const str = path ?? command ?? query ?? pattern ?? url;
  if (!str) return null;
  return str.length > 60 ? str.slice(0, 57) + "…" : str;
}

/** Human-friendly tool labels */
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    Read: "Read file",
    Write: "Write file",
    Edit: "Edit file",
    Bash: "Run command",
    Glob: "Search files",
    Grep: "Search content",
    WebSearch: "Web search",
    WebFetch: "Fetch page",
    CreateDocument: "Create document",
    CreateSpreadsheet: "Create spreadsheet",
    Task: "Run sub-agent",
    Skill: "Load skill",
    TodoWrite: "Update progress",
    Delete: "Delete file",
  };
  return labels[name] || name;
}

interface ToolActivityBlockProps {
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  /** true while waiting for the tool result (still streaming) */
  isPending?: boolean;
}

export function ToolActivityBlock({
  name,
  input,
  result,
  isError,
  isPending,
}: ToolActivityBlockProps) {
  // Errors start expanded; everything else is collapsed
  const [open, setOpen] = useState(isError || false);
  const summary = toolSummary(name, input);
  const label = toolLabel(name);

  return (
    <div
      className={`cw-tool-activity ${isError ? "cw-tool-activity--error" : ""} ${isPending ? "cw-tool-activity--pending" : ""}`}
    >
      <button
        type="button"
        className="cw-tool-activity__header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {/* Status indicator */}
        <span className="cw-tool-activity__status">
          {isPending ? (
            <IconLoader size={14} className="cw-tool-activity__spinner" />
          ) : isError ? (
            <IconAlertTriangle size={14} />
          ) : (
            <IconCheckCircle size={14} />
          )}
        </span>

        {/* Tool name */}
        <span className="cw-tool-activity__label">{label}</span>

        {/* Summary */}
        {summary && (
          <span className="cw-tool-activity__summary" title={summary}>
            {summary}
          </span>
        )}

        {/* Expand chevron — pushed to far right */}
        <span className="cw-tool-activity__chevron">
          {open ? (
            <IconChevronDown size={12} />
          ) : (
            <IconChevronRight size={12} />
          )}
        </span>
      </button>

      {open && (
        <div className="cw-tool-activity__details">
          {/* Input section */}
          {input && Object.keys(input).length > 0 && (
            <div className="cw-tool-activity__section">
              <span className="cw-tool-activity__section-label">Input</span>
              <pre className="cw-tool-activity__pre">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {/* Result section */}
          {result && (
            <div className="cw-tool-activity__section">
              <span className="cw-tool-activity__section-label">
                {isError ? "Error" : "Output"}
              </span>
              <pre className="cw-tool-activity__pre">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Add `IconLoader` to icons

In `src/components/cowork/icons.tsx`, add a simple spinning loader icon if one doesn't already exist:

```tsx
export function IconLoader({ size = 16, className = "", style }: IconProps) {
  return (
    <svg
      className={`cw-icon-spin ${className}`}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
```

And in `globals.css`, add the spin animation:

```css
@keyframes cw-spin {
  to {
    transform: rotate(360deg);
  }
}
.cw-icon-spin {
  animation: cw-spin 1s linear infinite;
}
```

---

## Task 2: Pair Tool Use + Tool Result in the Renderer

The `ContentBlock` switch in `CoworkMessageItem.tsx` currently renders `tool_use` and `tool_result` as separate independent blocks. Change this so consecutive `tool_use` → `tool_result` pairs are merged into a single `ToolActivityBlock`.

### File: `src/components/cowork/CoworkMessageItem.tsx`

**Replace the import (lines 12–13):**

```tsx
// OLD:
import {
  TextBlock,
  ToolUseBlock,
  ToolResultBlock,
  ...
} from "@/components/cowork/message-blocks";

// NEW:
import {
  TextBlock,
  ToolActivityBlock,
  ...
} from "@/components/cowork/message-blocks";
```

(Remove `ToolUseBlock` and `ToolResultBlock` from the import — they're no longer used directly.)

**Replace the rendering logic inside the `return` of `CoworkMessageItem` (lines 143–152).**

Instead of rendering every content block individually in order, pre-process the blocks to merge `tool_use` + `tool_result` pairs. Replace the existing `contents.map(...)` with this approach:

```tsx
export function CoworkMessageItem({ message }: CoworkMessageItemProps) {
  const { state } = useCowork();
  const isUser = message.role === "user";
  const rawContents: MessageContent[] = Array.isArray(message.content)
    ? message.content
    : [{ type: "text", text: String(message.content) }];
  const contents = sortContentBlocks(rawContents);
  const fullText = getTextFromContents(contents);
  const showSkillDraft = !isUser && hasSkillDraftFormat(fullText);
  const existingRating = state.chat.messageFeedback[message.id];
  const showFeedbackBar = !isUser && isPersistedMessageId(message.id);

  // ── Merge tool_use + tool_result into paired activities ──
  const mergedBlocks = mergeToolBlocks(contents);

  return (
    <div className={`cowork-message cowork-message--${message.role}`}>
      <div
        className={`cowork-message__avatar cowork-message__avatar--${message.role}`}
      >
        {isUser ? "U" : "C"}
      </div>
      <div className="cowork-message__body">
        <div className="cowork-message__role">
          {isUser ? "You" : "Cowork"}
          {!isUser && fullText && <CopyMessageButton text={fullText} />}
        </div>
        <div className="cowork-message__content">
          {mergedBlocks.map((item, idx) => (
            <ErrorBoundary key={idx} section="message block">
              <span style={{ display: "block" }}>
                {item.type === "tool_activity" ? (
                  <ToolActivityBlock
                    name={item.name}
                    input={item.input}
                    result={item.result}
                    isError={item.isError}
                    isPending={item.isPending}
                  />
                ) : (
                  <>
                    {item.block.type === "text" &&
                      hasCompletedSubAgentsBefore(
                        contents,
                        item.originalIndex,
                      ) && <SubAgentSeparatorBanner />}
                    <ContentBlock
                      block={item.block}
                      sessionId={message.sessionId}
                      stripConfirmedMarker
                    />
                  </>
                )}
              </span>
            </ErrorBoundary>
          ))}
          {showSkillDraft && <SkillDraftCard content={fullText} />}
        </div>
        {showFeedbackBar && (
          <MessageFeedbackBar
            messageId={message.id}
            sessionId={message.sessionId}
            existingFeedback={
              existingRating
                ? { rating: existingRating, comment: undefined }
                : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
```

**Add the `mergeToolBlocks` helper function** above `CoworkMessageItem`:

```tsx
type MergedBlock =
  | {
      type: "tool_activity";
      name: string;
      input?: Record<string, unknown>;
      result?: string;
      isError?: boolean;
      isPending?: boolean;
    }
  | { type: "other"; block: MessageContent; originalIndex: number };

/**
 * Walk sorted content blocks and merge consecutive tool_use → tool_result pairs
 * into a single ToolActivityBlock entry. Unpaired tool_use blocks (still pending)
 * get isPending: true. Unpaired tool_result blocks render standalone.
 */
function mergeToolBlocks(blocks: MessageContent[]): MergedBlock[] {
  const result: MergedBlock[] = [];
  // Build a map of tool_use_id → tool_result for quick lookup
  const resultMap = new Map<string, { content: string; isError: boolean }>();
  for (const block of blocks) {
    if (block.type === "tool_result" && "tool_use_id" in block) {
      resultMap.set(block.tool_use_id, {
        content: block.content || "",
        isError: block.is_error || false,
      });
    }
  }

  const consumedResultIds = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === "tool_use" && "name" in block && "id" in block) {
      const paired = resultMap.get(block.id);
      if (paired) {
        consumedResultIds.add(block.id);
        result.push({
          type: "tool_activity",
          name: block.name,
          input: block.input,
          result: paired.content,
          isError: paired.isError,
          isPending: false,
        });
      } else {
        // No result yet — tool is still running
        result.push({
          type: "tool_activity",
          name: block.name,
          input: block.input,
          isPending: true,
        });
      }
      continue;
    }

    if (block.type === "tool_result" && "tool_use_id" in block) {
      // Skip if already consumed by a tool_use pairing
      if (consumedResultIds.has(block.tool_use_id)) continue;
      // Orphan result (shouldn't happen often) — render as standalone
      result.push({
        type: "tool_activity",
        name: "Tool",
        result: block.content,
        isError: block.is_error,
        isPending: false,
      });
      continue;
    }

    // Everything else passes through
    result.push({ type: "other", block, originalIndex: i });
  }

  return result;
}
```

**Update the `ContentBlock` switch** — remove the `tool_use` and `tool_result` cases since they're now handled by merging:

```tsx
function ContentBlock({ block, sessionId, stripConfirmedMarker }: { ... }) {
  switch (block.type) {
    case "text": { ... }
    // REMOVE: case "tool_use" and case "tool_result" — handled by mergeToolBlocks
    case "todo_update":
      return <CoworkTodoWidget items={block.todos} />;
    case "permission_request": ...
    case "plan": ...
    case "sub_agent_status": ...
    case "skill_activated": ...
    case "artifact": ...
    case "ask_user": ...
    case "error": ...
    default: return null;
  }
}
```

### Update the barrel export

In `src/components/cowork/message-blocks/index.ts`, replace:

```ts
// OLD:
export { ToolUseBlock } from "./ToolUseBlock";
export { ToolResultBlock } from "./ToolResultBlock";

// NEW:
export { ToolActivityBlock } from "./ToolActivityBlock";
```

You can keep the old files around or delete them — they're no longer imported.

---

## Task 3: CSS for Compact Tool Activity Blocks

### File: `src/app/globals.css`

**Add the new styles** (anywhere after the existing tool block styles). These replace the old `.cowork-message__tool-block` and `.cowork-tool-card` styles visually — the old classes can remain in the CSS (dead code) or be cleaned up later.

```css
/* ═══════════════════════════════════════════════════════════
   Compact tool activity blocks — replaces old tool-block/tool-card
   ═══════════════════════════════════════════════════════════ */

.cw-tool-activity {
  margin: 4px 0;
  border-radius: 8px;
  border: 1px solid var(--color-border-muted, rgba(0, 0, 0, 0.06));
  background: var(--color-surface-secondary, #f8fafc);
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.cw-tool-activity:hover {
  border-color: var(--color-border, rgba(0, 0, 0, 0.12));
}

.cw-tool-activity--error {
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(239, 68, 68, 0.03);
}

.cw-tool-activity--pending {
  border-color: rgba(124, 58, 237, 0.15);
  background: rgba(124, 58, 237, 0.02);
}

/* ── Header row (always visible) ── */
.cw-tool-activity__header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 0.8125rem;
  color: var(--color-text-secondary, #64748b);
  text-align: left;
  transition: background 0.1s ease;
  line-height: 1.4;
}

.cw-tool-activity__header:hover {
  background: rgba(0, 0, 0, 0.02);
}

/* Status icon */
.cw-tool-activity__status {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.cw-tool-activity__status svg {
  opacity: 0.5;
}

.cw-tool-activity--error .cw-tool-activity__status svg {
  color: var(--cw-danger, #ef4444);
  opacity: 0.8;
}

.cw-tool-activity--pending .cw-tool-activity__status svg {
  color: var(--color-accent, #7c3aed);
  opacity: 0.7;
}

.cw-tool-activity__status .cw-tool-activity__spinner {
  opacity: 0.6;
}

/* Tool label */
.cw-tool-activity__label {
  font-weight: 500;
  color: var(--color-text-primary, #1e293b);
  white-space: nowrap;
  font-size: 0.8125rem;
}

/* Summary (file path, command, etc.) */
.cw-tool-activity__summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-secondary, #64748b);
  opacity: 0.8;
}

/* Chevron */
.cw-tool-activity__chevron {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0.3;
  transition: opacity 0.1s ease;
}

.cw-tool-activity__header:hover .cw-tool-activity__chevron {
  opacity: 0.6;
}

/* ── Expanded details panel ── */
.cw-tool-activity__details {
  border-top: 1px solid var(--color-border-muted, rgba(0, 0, 0, 0.06));
  padding: 0;
  animation: cw-tool-expand 0.15s ease both;
}

@keyframes cw-tool-expand {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 600px;
  }
}

.cw-tool-activity__section {
  padding: 8px 10px;
}

.cw-tool-activity__section + .cw-tool-activity__section {
  border-top: 1px solid var(--color-border-muted, rgba(0, 0, 0, 0.06));
}

.cw-tool-activity__section-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-secondary, #64748b);
  opacity: 0.6;
  margin-bottom: 4px;
}

.cw-tool-activity__pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--color-text-primary, #1e293b);
  max-height: 200px;
  overflow-y: auto;
}

/* ── Group consecutive tool activities visually ── */
.cw-tool-activity + .cw-tool-activity {
  margin-top: 2px;
}
```

---

## Task 4: Hide Internal Tool Calls From the Chat

Some tools are internal bookkeeping that the user doesn't need to see in the chat at all. They already have dedicated UI (todo widget, plan blocks, etc.). Filter them out in `mergeToolBlocks`.

In the `mergeToolBlocks` function, add a filter at the top:

```tsx
/** Tools that have their own UI — don't show as tool activity in chat */
const HIDDEN_CHAT_TOOLS = new Set([
  "TodoWrite", // Has todo widget in Progress panel
  "AskUserQuestion", // Has interactive block in chat
  "EnterPlanMode", // Has plan block in chat
  "ExitPlanMode", // Has plan block in chat
  "GetSubAgentResults", // Internal sub-agent coordination
]);
```

Then in the `tool_use` handler:

```tsx
if (block.type === "tool_use" && "name" in block && "id" in block) {
  // Skip tools that have their own UI representation
  if (HIDDEN_CHAT_TOOLS.has(block.name)) {
    consumedResultIds.add(block.id); // also consume any matching result
    continue;
  }
  // ... rest of merge logic
}
```

And in the `tool_result` handler, also skip results for hidden tools:

```tsx
if (block.type === "tool_result" && "tool_use_id" in block) {
  if (consumedResultIds.has(block.tool_use_id)) continue;
  // ...
}
```

This means `TodoWrite` calls won't appear in the chat at all — they're already represented by the Progress widget in the right panel.

---

## Summary

| Change                             | File                                   | What it does                                            |
| ---------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| New `ToolActivityBlock` component  | `message-blocks/ToolActivityBlock.tsx` | Single compact line per tool call, collapsed by default |
| Merge tool_use + tool_result pairs | `CoworkMessageItem.tsx`                | One entry per tool call instead of two separate blocks  |
| Compact CSS styles                 | `globals.css`                          | Subtle borders, minimal height, clean expand/collapse   |
| Hide internal tools                | `CoworkMessageItem.tsx`                | TodoWrite, AskUserQuestion etc. hidden from chat        |
| Barrel export update               | `message-blocks/index.ts`              | Export new component, remove old ones                   |
| Spinner icon                       | `icons.tsx` + `globals.css`            | Loading indicator for pending tool calls                |

## Before → After

**Before:**

```
┌──────────────────────────────────────────┐
│ TOOL CALL                      (purple)  │
│ ┌──────────────────────────────────────┐ │
│ │ ▸ 🔧 Read  • package.json           │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ TOOL RESULT                     (green)  │
│ ┌──────────────────────────────────────┐ │
│ │ ▸ ✓ Result                           │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ TOOL CALL                      (purple)  │
│ ┌──────────────────────────────────────┐ │
│ │ ▸ 🔧 Write  • output.docx           │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ TOOL RESULT                     (green)  │
│ ┌──────────────────────────────────────┐ │
│ │ ▸ ✓ Result                           │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

4 full-width blocks taking up ~200px of vertical space.

**After:**

```
┌─ ✓ Read file  package.json            ▸ ─┐
└──────────────────────────────────────────┘
┌─ ✓ Write file  output.docx            ▸ ─┐
└──────────────────────────────────────────┘
```

2 compact single-line entries taking up ~60px of vertical space. Click to expand details.

## Verify

1. Send any message that triggers tool calls (e.g. "create a project kickoff checklist as a Word document")
2. Tool activity should appear as compact single-line entries (not colored blocks)
3. Each entry shows: status icon + tool label + summary (file path or command)
4. Click to expand shows Input and Output sections
5. Errors auto-expand and show red styling
6. Pending tools show a spinning loader
7. `TodoWrite` calls do NOT appear in the chat at all
8. The right-panel Progress widget still works correctly
9. `npm run build` compiles clean
