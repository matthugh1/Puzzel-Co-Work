# Phase 1: Agent Loop Refactor — Cursor Prompt

Use this prompt in Cursor (or another AI coding tool) to refactor `src/lib/cowork/agent-loop.ts`.

---

## Prompt

You are refactoring `src/lib/cowork/agent-loop.ts` in a Next.js application. This file is 1,577 lines long and contains massive duplication between the Anthropic and OpenAI tool execution paths. Your job is to extract the duplicated logic into a new shared module `src/lib/cowork/tool-execution.ts`, cutting agent-loop.ts to ~850 lines.

### The Problem

Inside the `runAgentLoop()` function (starting at line 480), there is a `while` loop that branches on `config.provider`. The Anthropic branch (lines 549–905) and the OpenAI branch (lines 906–1264) contain nearly identical logic for:

1. **"Wants document" detection + fake message injection** (Anthropic: lines 563–581, OpenAI: lines 921–940) — regex checks if user wants a document, injects a follow-up message if no tool was called
2. **Permission checking** (Anthropic: lines 589–717, OpenAI: lines 947–1075) — blocked → error result, ask → await user approval via `requestPermission()`, denied → error result
3. **CreateDocument empty-sections fallback** (Anthropic: lines 727–742, OpenAI: lines 1085–1100) — if CreateDocument was called without sections, inject assistant text
4. **AskUserQuestion event emission** (Anthropic: lines 744–767, OpenAI: lines 1101–1125) — emit `ask_question` SSE event before execution
5. **Tool execution + result streaming** (Anthropic: lines 769–782, OpenAI: lines 1127–1140) — call `executeTool()`, emit `tool_result` event
6. **Side-effect handling** (Anthropic: lines 784–858, OpenAI: lines 1142–1216) — TodoWrite events, EnterPlanMode, ExitPlanMode, Write artifacts, CreateDocument artifacts, Task sub-agents, Skill activation
7. **Message format conversion** (Anthropic: lines 860–884, OpenAI: lines 1218–1240) — adding tool call + result to messages in provider-specific format
8. **Post-tool error recovery + CreateDocument exit** (Anthropic: lines 889–905, OpenAI: lines 1246–1263) — final text-only turn on error, break on CreateDocument success

The ONLY difference between the two branches is message format: Anthropic uses `{ role: "assistant", content: [{ type: "tool_use", ... }] }` + `{ role: "user", content: [{ type: "tool_result", ... }] }`, while OpenAI uses `{ role: "assistant", content: null, tool_calls: [...] }` + `{ role: "tool", content: ..., tool_call_id: ... }`.

### What To Do

Create `src/lib/cowork/tool-execution.ts` with these extracted functions, then rewrite the main loop to use them.

#### 1. Types (in tool-execution.ts)

```typescript
import type { ToolContext, ToolResult } from "./tools/types";
import type {
  AgentLoopConfig,
  SSEEventSender,
  ArtifactCreator,
} from "./agent-loop";

export interface ToolCallInfo {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolExecutionFlags {
  hadError: boolean;
  createDocumentSucceeded: boolean;
  createSkillFailed: boolean;
  exitLoop: boolean; // true if ExitPlanMode was called
  activatedSkillId?: string; // set if Skill tool was invoked
}
```

#### 2. `checkWantsDocumentFollowUp()` — extract the "wants document" detection

```typescript
/**
 * Detect if the user wanted a document but the LLM responded with text only.
 * If so, inject a follow-up message asking the LLM to call CreateDocument.
 * Returns true if a follow-up was injected (caller should `continue` the loop).
 */
export function checkWantsDocumentFollowUp(
  messages: AgentMessage[],
  fullText: string,
  iterationCount: number,
  hasTools: boolean,
  getLastUserMessageText: (msgs: AgentMessage[]) => string | undefined,
): boolean;
```

Logic: same as current — regex match on last user message, check fullText.length >= 80, iterationCount === 1. Push assistant message with fullText, push user message with the "You must call CreateDocument..." instruction. Return true if injected.

#### 3. `handlePermissionCheck()` — extract the permission flow for a single tool call

```typescript
/**
 * Check permission level for a tool call. If blocked or denied, push error messages
 * and emit events. Returns { allowed: false } if the tool should be skipped,
 * or { allowed: true } if execution should proceed.
 */
export async function handlePermissionCheck(
  toolCall: ToolCallInfo,
  messages: AgentMessage[],
  provider: "anthropic" | "openai",
  sendEvent: SSEEventSender,
): Promise<{ allowed: boolean; hadError: boolean }>;
```

Logic:

- Get permission level via `getToolPermissionLevel(toolCall.name)`
- If "blocked": push error messages in provider format, emit `tool_result` event, return `{ allowed: false, hadError: true }`
- If "ask": emit `permission_request`, await `requestPermission()`, handle timeout/denial same way
- If "auto" or approved: return `{ allowed: true, hadError: false }`

**CRITICAL**: The message format differs by provider. Use a helper:

```typescript
function pushToolErrorToMessages(
  messages: AgentMessage[],
  provider: "anthropic" | "openai",
  toolCall: ToolCallInfo,
  errorResult: ToolResult,
): void;
```

For Anthropic:

```typescript
messages.push({
  role: "assistant",
  content: [
    {
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    },
  ],
});
messages.push({
  role: "user",
  content: [
    {
      type: "tool_result",
      tool_use_id: toolCall.id,
      content: errorResult.content,
      is_error: errorResult.isError,
    },
  ],
});
```

For OpenAI:

```typescript
messages.push({
  role: "assistant",
  content: null,
  tool_calls: [
    {
      id: toolCall.id,
      type: "function",
      function: {
        name: toolCall.name,
        arguments: JSON.stringify(toolCall.input),
      },
    },
  ],
} as AgentMessage);
messages.push({
  role: "tool",
  content: errorResult.content,
  tool_call_id: toolCall.id,
  name: toolCall.name,
} as AgentMessage);
```

#### 4. `prepareToolInput()` — extract input preprocessing

```typescript
/**
 * Preprocess tool input before execution (CreateDocument sections fallback,
 * AskUserQuestion event emission).
 * Returns the (possibly modified) tool input.
 */
export function prepareToolInput(
  toolCall: ToolCallInfo,
  assistantText: string,
  sendEvent: SSEEventSender,
): Record<string, unknown>;
```

Logic: handles the CreateDocument empty-sections fallback and AskUserQuestion event emission.

#### 5. `handleToolSideEffects()` — extract post-execution side effects

```typescript
/**
 * Handle side effects after a tool executes successfully.
 * Updates flags, emits events, creates artifacts.
 */
export async function handleToolSideEffects(
  toolCall: ToolCallInfo,
  toolResult: ToolResult,
  flags: ToolExecutionFlags,
  config: AgentLoopConfig,
  toolContext: ToolContext,
  sendEvent: SSEEventSender,
  activeSkills: string[],
): Promise<void>;
```

Logic: TodoWrite → `todo_update` event, EnterPlanMode → `plan_mode_changed` event, ExitPlanMode → `plan_proposed` event + set `flags.exitLoop = true`, Write artifact creation, CreateDocument artifact creation, Task sub-agent handling, Skill activation → push to `activeSkills`.

#### 6. `pushToolResultToMessages()` — extract message format conversion

```typescript
/**
 * Add tool call + result to the conversation in the correct provider format.
 */
export function pushToolResultToMessages(
  messages: AgentMessage[],
  provider: "anthropic" | "openai",
  toolCall: ToolCallInfo,
  toolResult: ToolResult,
): void;
```

Same provider-specific format as `pushToolErrorToMessages` but using the actual result.

#### 7. Rewrite the main loop

After extraction, the main `while` loop in `runAgentLoop()` becomes roughly:

```typescript
while (iterationCount < MAX_TOOL_ITERATIONS) {
  iterationCount++;

  // 1. Run provider-specific LLM iteration (keep these as-is — they handle streaming)
  const result =
    config.provider === "anthropic"
      ? await runAnthropicIteration(
          messages,
          { ...config, activeSkills },
          availableCanonicalTools,
          toolContext,
          sendEvent,
        )
      : await runOpenAIIteration(
          messages,
          { ...config, activeSkills },
          availableCanonicalTools,
          toolContext,
          sendEvent,
        );

  fullText += result.text;
  if (result.usage) totalUsage = result.usage;

  // 2. No tool calls? Check document follow-up or break
  if (result.toolCalls.length === 0) {
    if (
      checkWantsDocumentFollowUp(
        messages,
        fullText,
        iterationCount,
        availableCanonicalTools.length > 0,
        getLastUserMessageText,
      )
    ) {
      fullText = "";
      continue;
    }
    break;
  }

  // 3. Execute each tool call (shared logic)
  const flags: ToolExecutionFlags = {
    hadError: false,
    createDocumentSucceeded: false,
    createSkillFailed: false,
    exitLoop: false,
  };

  for (const toolCall of result.toolCalls) {
    // Permission check
    const perm = await handlePermissionCheck(
      toolCall,
      messages,
      config.provider,
      sendEvent,
    );
    if (!perm.allowed) {
      if (perm.hadError) flags.hadError = true;
      continue;
    }

    // Emit tool_use_start
    sendEvent("tool_use_start", {
      id: toolCall.id,
      name: toolCall.name,
      input: toolCall.input,
    });

    // Prepare input (CreateDocument sections fallback, AskUserQuestion)
    const toolInput = prepareToolInput(toolCall, result.text, sendEvent);

    // Execute
    const toolResult = await executeTool(toolCall.name, toolInput, toolContext);
    if (toolResult.isError) flags.hadError = true;
    if (toolCall.name === "CreateSkill" && toolResult.isError)
      flags.createSkillFailed = true;
    if (toolCall.name === "CreateDocument" && !toolResult.isError)
      flags.createDocumentSucceeded = true;

    // Emit result
    sendEvent("tool_result", {
      tool_use_id: toolCall.id,
      content: toolResult.content,
      is_error: toolResult.isError,
    });

    // Handle side effects
    await handleToolSideEffects(
      toolCall,
      toolResult,
      flags,
      config,
      toolContext,
      sendEvent,
      activeSkills,
    );
    if (flags.exitLoop) break;

    // Add to conversation
    pushToolResultToMessages(messages, config.provider, toolCall, toolResult);
  }

  // 4. Post-tool handling
  if (flags.hadError) {
    // One final text-only turn
    const finalResult =
      config.provider === "anthropic"
        ? await runAnthropicIteration(
            messages,
            { ...config, activeSkills },
            [],
            toolContext,
            sendEvent,
          )
        : await runOpenAIIteration(
            messages,
            { ...config, activeSkills },
            [],
            toolContext,
            sendEvent,
          );
    fullText += finalResult.text;
    if (finalResult.usage) totalUsage = finalResult.usage;
    break;
  }
  if (flags.createDocumentSucceeded || flags.exitLoop) {
    break;
  }
}
```

### Constraints

1. **DO NOT modify `runAnthropicIteration()` or `runOpenAIIteration()`** — they handle provider-specific streaming and are already separate. Leave them exactly as they are.

2. **DO NOT modify `assembleSystemPrompt()`, `SKILL_CREATOR_SYSTEM_PROMPT`, `appendSessionState()`, `agentMessagesToCanonical()`, `truncateHistory()`, `streamAgentLoop()`** — these are clean and don't contain duplication.

3. **DO NOT change the `AgentMessage` type** — both providers use it, it supports the union of both formats. The extraction should work within this existing type.

4. **Preserve all logging** — keep the `console.log("[Agent Loop] ...")` statements with provider and tool name info.

5. **Preserve the double iteration count increment bug** — the OpenAI branch (line 907) increments `iterationCount` again. When you unify the loop, the single increment at the top of the loop replaces both — just make sure the behaviour matches (OpenAI currently burns 2 iterations per loop pass; after refactor it should burn 1, which is the correct fix).

6. **Export `AgentLoopConfig`, `SSEEventSender`, `ArtifactCreator`, `AgentMessage`** from `agent-loop.ts` so that `tool-execution.ts` can import them. They're currently not exported.

7. **Import `executeTool`, `getToolPermissionLevel` from `./tools`** in tool-execution.ts.

8. **Import `requestPermission` from `./permissions`** in tool-execution.ts.

### Files to modify

- `src/lib/cowork/agent-loop.ts` — export types, rewrite the while loop to use shared helpers
- `src/lib/cowork/tool-execution.ts` — **NEW FILE** — shared tool execution logic

### Files to read (for context, DO NOT modify)

- `src/lib/cowork/tools/types.ts` — `ToolContext`, `ToolResult`, `ToolExecutor`, `PermissionLevel`
- `src/lib/cowork/tools/index.ts` — `executeTool()`, `getToolPermissionLevel()`, `getCanonicalTools()`
- `src/lib/cowork/permissions.ts` — `requestPermission()`
- `src/lib/cowork/llm/types.ts` — `CanonicalToolDefinition`, `CanonicalMessage`, etc.

### Current type definitions (for reference)

```typescript
// From tools/types.ts
export type PermissionLevel = "auto" | "ask" | "blocked";

export interface ToolContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string;
  planMode: boolean;
  sendEvent?: (eventType: string, data: unknown) => void;
}

export interface ToolResult {
  content: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

// From agent-loop.ts (currently NOT exported — you need to export these)
type AgentMessage =
  | { role: "user" | "assistant"; content: string | unknown[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string }
  | { role: "assistant"; content: null; tool_calls: unknown[] };

interface AgentLoopConfig extends LLMStreamConfig {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string;
  planMode: boolean;
  skillCreationMode?: boolean;
  isSubAgent?: boolean;
  createArtifact?: ArtifactCreator;
  sessionState?: {
    todos?: Array<{ id: string; content: string; status: string }>;
    files?: Array<{ fileName: string; category: string }>;
    subAgents?: Array<{ id: string; description: string; status: string }>;
  };
  activeSkills?: string[];
}

interface SSEEventSender {
  (eventType: string, data: unknown): void;
}

interface ArtifactCreator {
  (
    filePath: string,
    fileName: string,
    content: string | undefined,
    sessionId: string,
  ): Promise<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    storagePath: string;
    downloadUrl: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}
```

### Verification after refactoring

1. The file `agent-loop.ts` should be ~800-900 lines (down from 1,577)
2. The new file `tool-execution.ts` should be ~300-400 lines
3. `runAnthropicIteration()` and `runOpenAIIteration()` should be UNTOUCHED
4. `assembleSystemPrompt()`, `SKILL_CREATOR_SYSTEM_PROMPT`, and all helper functions above line 480 should be UNTOUCHED
5. `streamAgentLoop()` at the bottom should be UNTOUCHED
6. All SSE events should still be emitted in the same order
7. All side effects (TodoWrite, artifacts, plans, skills, sub-agents) should still work
8. Both Anthropic and OpenAI code paths should produce identical behaviour to before

Run `pnpm build` after the refactor to confirm TypeScript compiles cleanly.
