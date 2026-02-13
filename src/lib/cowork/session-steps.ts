/**
 * Derive ordered session steps from chat messages (tool_use + tool_result).
 * Used for Progress panel and future "save as workflow" data.
 */

import type {
  CoworkMessage,
  MessageContent,
  SessionStep,
  SessionWorkflowSeed,
  ToolResultContent,
  ToolUseContent,
} from "@/types/cowork";

/** Tools that should not appear as session steps because they have their
 *  own UI representation or are internal bookkeeping. */
const HIDDEN_STEP_TOOLS = new Set([
  "TodoWrite", // Has its own todo widget in the Progress section
  "AskUserQuestion", // Has its own interactive block in the chat
  "EnterPlanMode", // Has its own plan block in the chat
  "ExitPlanMode", // Has its own plan block in the chat
  "GetSubAgentResults", // Internal coordination
]);

const SUMMARY_MAX = 60;

function summarizeInput(input: Record<string, unknown>): string | undefined {
  const path = ["path", "filePath", "file", "fileName"].find(
    (k) => typeof input[k] === "string",
  );
  const pathVal = path ? (input[path] as string) : undefined;
  const command = typeof input.command === "string" ? input.command : undefined;
  const query = typeof input.query === "string" ? input.query : undefined;
  const title = typeof input.title === "string" ? input.title : undefined;
  const str = pathVal ?? command ?? query ?? title;
  if (!str) return undefined;
  return str.length > SUMMARY_MAX ? str.slice(0, SUMMARY_MAX - 1) + "…" : str;
}

function summarizeResult(content: string, isError: boolean): string {
  const raw = content.trim();
  if (!raw) return isError ? "Error" : "Done";
  const oneLine = raw.replace(/\s+/g, " ").trim();
  if (oneLine.length > SUMMARY_MAX)
    return oneLine.slice(0, SUMMARY_MAX - 1) + "…";
  return oneLine;
}

function isToolUse(block: MessageContent): block is ToolUseContent {
  return block.type === "tool_use" && "id" in block && "name" in block;
}

function isToolResult(block: MessageContent): block is ToolResultContent {
  return block.type === "tool_result" && "tool_use_id" in block;
}

function getAssistantTextSummary(content: MessageContent[]): string | null {
  const parts: string[] = [];
  for (const block of content) {
    if (
      block.type === "text" &&
      "text" in block &&
      typeof block.text === "string"
    ) {
      parts.push(block.text.trim());
    }
  }
  const combined = parts.join("\n").trim();
  if (combined.length < 40) return null;
  const firstLine = combined.split(/\n/)[0]?.trim() ?? combined;
  return firstLine.length > SUMMARY_MAX
    ? firstLine.slice(0, SUMMARY_MAX - 1) + "…"
    : firstLine;
}

/**
 * Build ordered SessionStep[] from all messages: each tool_use is paired with
 * its tool_result (by id) when present; order is preserved.
 * Tool_result is matched in the same message (streaming) or in a later user message (saved DB).
 * When an assistant message has substantial text before tool calls (e.g. poem
 * then CreateDocument), a "Response" step is added so Progress shows the full flow.
 */
export function getSessionStepsFromMessages(
  messages: CoworkMessage[],
): SessionStep[] {
  interface Pending {
    id: string;
    name: string;
    inputSummary?: string;
    resultSummary?: string;
    order: number;
  }
  const pending = new Map<string, Pending>();
  const result: SessionStep[] = [];
  let order = 0;

  for (const msg of messages) {
    const content = msg.content ?? [];
    // Response step first (so it sorts before tool steps in this message)
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
    // Process content in order so we pair tool_use with tool_result in the same
    // message (streaming) or across messages (DB) — Progress updates as each result arrives
    for (const block of content) {
      if (isToolUse(block)) {
        // Skip tools that have their own UI (todo widget, plan block, etc.)
        if (HIDDEN_STEP_TOOLS.has(block.name)) continue;

        const input =
          block.input && typeof block.input === "object" ? block.input : {};
        pending.set(block.id, {
          id: block.id,
          name: block.name,
          inputSummary: summarizeInput(input),
          order: order++,
        });
        continue;
      }
      if (isToolResult(block)) {
        const p = pending.get(block.tool_use_id);
        if (p) {
          result.push({
            id: p.id,
            name: p.name,
            inputSummary: p.inputSummary,
            resultSummary: summarizeResult(
              block.content,
              block.is_error ?? false,
            ),
            order: p.order,
          });
          pending.delete(block.tool_use_id);
        }
        continue;
      }
    }
  }

  // Append any tool_uses that never got a result (e.g. in-flight or error)
  const remaining = Array.from(pending.values()).sort(
    (a, b) => a.order - b.order,
  );
  for (const p of remaining) {
    result.push({
      id: p.id,
      name: p.name,
      inputSummary: p.inputSummary,
      order: p.order,
    });
  }
  result.sort((a, b) => a.order - b.order);
  return result;
}

/**
 * Build a workflow seed from messages so a saved workflow "knows what it was
 * doing from the start": initialPrompt (first user message) + ordered steps.
 * Optional sessionTitle can be passed from the session for a human-readable label.
 */
export function getSessionWorkflowSeed(
  messages: CoworkMessage[],
  options?: { sessionTitle?: string },
): SessionWorkflowSeed | null {
  const firstUser = messages.find((m) => m.role === "user");
  const initialPrompt =
    firstUser?.content
      ?.filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("\n")
      .trim() ?? "";
  if (!initialPrompt) return null;
  const steps = getSessionStepsFromMessages(messages);
  return {
    initialPrompt,
    sessionTitle: options?.sessionTitle,
    steps,
  };
}
