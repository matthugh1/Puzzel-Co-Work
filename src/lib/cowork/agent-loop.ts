/**
 * Agentic Loop
 * Core loop that handles tool calling, execution, and re-prompting
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getCanonicalTools, executeTool } from "./tools";
import type { ToolContext } from "./tools/types";
import type { LLMStreamConfig, TokenUsage } from "./llm";
import { getAdapter } from "./llm/index";
import type { CanonicalMessage, CanonicalToolDefinition } from "./llm/types";
import {
  checkWantsDocumentFollowUp,
  handlePermissionCheck,
  prepareToolInput,
  handleToolSideEffects,
  pushToolResultToMessages,
  type ToolExecutionFlags,
} from "./tool-execution";
import { loadSessionSkills } from "./skills";
// Skill parser is used by components (SkillDraftCard, CoworkMessageItem) — not needed here.

const MAX_TOOL_ITERATIONS = 25;

/**
 * Append session state context (pending todos, output files, active sub-agents)
 * to a prompt string. Shared between normal and skill-creator modes.
 */
function appendSessionState(
  prompt: string,
  sessionState?: AgentLoopConfig["sessionState"],
): string {
  if (!sessionState) return prompt;

  const stateParts: string[] = [];

  if (sessionState.todos && sessionState.todos.length > 0) {
    const pendingTodos = sessionState.todos.filter((t) => t.status === "pending" || t.status === "in_progress");
    if (pendingTodos.length > 0) {
      stateParts.push(`\n\nCurrent tasks:\n${pendingTodos.map((t) => `- ${t.content} (${t.status})`).join("\n")}`);
    }
  }

  if (sessionState.files && sessionState.files.length > 0) {
    const outputs = sessionState.files.filter((f) => f.category === "output");
    if (outputs.length > 0) {
      stateParts.push(`\n\nGenerated files:\n${outputs.map((f) => `- ${f.fileName}`).join("\n")}`);
    }
  }

  if (sessionState.subAgents && sessionState.subAgents.length > 0) {
    const activeAgents = sessionState.subAgents.filter((a) => a.status === "running");
    if (activeAgents.length > 0) {
      stateParts.push(`\n\nActive sub-agents:\n${activeAgents.map((a) => `- ${a.description} (${a.status})`).join("\n")}`);
    }
  }

  if (stateParts.length > 0) {
    return prompt + stateParts.join("");
  }
  return prompt;
}

/**
 * Assemble dynamic system prompt including session state and skills.
 */
async function assembleSystemPrompt(
  basePrompt: string | undefined,
  sessionState?: AgentLoopConfig["sessionState"],
  sessionId?: string,
): Promise<string> {
  const defaultPrompt = `You are Cowork, an AI assistant built into the Puzzel Co-Work platform. You help users accomplish tasks by planning, executing, and delivering results.

Key behaviours:
- Be concise and helpful. Avoid unnecessary preamble.
- Use markdown formatting for readability (bold, lists, code blocks).
- When a task is complex, break it into steps and work through them.
- Ask clarifying questions when the request is ambiguous.
- Be honest about limitations.

Using custom skills (IMPORTANT):
When a user's message matches one of your Available Custom Skills (listed at the end of this prompt), you MUST call the Skill tool with that skill's name BEFORE doing anything else. The Skill tool will return the skill's detailed instructions — follow them precisely.
- Do NOT try to handle the request yourself if a matching skill exists — call the Skill tool first.
- Do NOT call CreateDocument when a skill should be used instead.
- If unsure whether a skill applies, call the Skill tool — the returned instructions will clarify.

Creating skills (IMPORTANT — read carefully):
When a user asks to create, build, or make a "skill", they want a reusable AI prompt template — NOT a document. Follow this process strictly:
1. Ask 2-3 short clarifying questions about the skill (purpose, inputs, output format, edge cases). STOP your message after the questions. Do NOT continue. Wait for the user to reply.
2. After the user answers, draft the skill and show it (name, description, category, system prompt, parameters, example input/output, triggers, tags). Ask "Does this look right?" then STOP. Do NOT call any tool yet. Wait for confirmation.
3. Only after the user confirms (says "yes", "looks good", "create it", etc.), call the CreateSkill tool with the exact values from your draft.
Rules for skill creation:
- NEVER call CreateDocument when creating a skill. Skills use CreateSkill, not CreateDocument.
- NEVER call any tool until step 3. The first two messages should be text only.
- Keep each message short. Do NOT combine steps — one step per message.

Writing a high-quality skill prompt (the "content" field):
The system prompt is the core of the skill — it must be detailed and specific enough to produce excellent results without further tweaking. A one-liner like "Analyze documents for X" is NOT acceptable. A good skill prompt should include:
- A clear role statement (e.g. "You are an expert legal analyst specialising in contract compliance.")
- Step-by-step instructions for how to approach the task
- Specific criteria or rules to apply (e.g. "Flag any notice period under 30 days. Also flag periods under 90 days if the contract term exceeds 2 years.")
- Output format requirements (e.g. headings, tables, sections, what each section should contain)
- Edge cases and what to do about them (e.g. "If no notice period is found in a clause, note it as 'Not specified'.")
- Use {{parameter_name}} placeholders for any configurable inputs
Aim for 150-400 words in the system prompt. Think of it as writing instructions detailed enough that any competent person could follow them and get the same result.

Document creation:
- If the user asks for content to be saved as a Word document (.docx), write the full content in your message, then call CreateDocument with that content in the sections parameter. Sections must be an array of { heading: string, paragraphs: string[] }. Never call CreateDocument with empty sections.
- For spreadsheets, code files, etc., use CreateSpreadsheet or Write in the same turn.
- Rule: delivering a file = calling the tool. Saying you will deliver a file without calling the tool is not allowed.
- Exception: do NOT use CreateDocument when the user is creating a skill (use CreateSkill instead).`;

  let prompt = basePrompt || defaultPrompt;
  prompt = appendSessionState(prompt, sessionState);

  // List available skills compactly (name + description only).
  // The LLM calls the Skill tool to load full instructions when needed —
  // this avoids bloating the system prompt with all skill content.
  if (sessionId) {
    try {
      const registry = await loadSessionSkills(sessionId);
      if (registry && registry.length > 0) {
        const listing = registry
          .map((s) => `- **${s.name}**: ${s.description}`)
          .join("\n");
        prompt += `\n\n## Available Custom Skills\nYou have access to these custom skills. When a user's request clearly matches one of these skills, invoke it by calling the Skill tool with the skill name. Do NOT try to handle the task yourself without first loading the relevant skill.\n\n${listing}\n\nTo use a skill: call the Skill tool with skillName set to the exact skill name. The tool will return the skill's full instructions, which you must then follow precisely.`;
      }
    } catch (err) {
      console.error("[Agent Loop] Error loading skills:", err);
    }
  }

  return prompt;
}

const LLM_LOG_PREFIX = "[LLM]";

/** Summarise agent messages for logging (role + content type/length). */
function summariseAgentMessages(messages: AgentMessage[]): string {
  return messages
    .map((m) => {
      if (m.role === "tool") return "tool";
      if (typeof m.content === "string") return `${m.role}(${m.content.length})`;
      if (m.content === null && "tool_calls" in m) return `assistant(tool_calls:${(m as { tool_calls: unknown[] }).tool_calls?.length ?? 0})`;
      if (Array.isArray(m.content)) {
        const types = m.content.map((c) => (typeof c === "object" && c !== null && "type" in c ? (c as { type: string }).type : "?"));
        return `${m.role}[${types.join(",")}]`;
      }
      return m.role;
    })
    .join(" ");
}

/** Summarise canonical messages for logging. */
function summariseCanonicalMessages(messages: CanonicalMessage[]): string {
  return messages
    .map((m) => {
      const contentLen = m.content?.length ?? 0;
      const types = m.content?.map((b) => b.type).join(",") ?? "";
      return `${m.role}(${contentLen}:${types || "-"})`;
    })
    .join(" ");
}

/**
 * Get the last user message as plain text (for document follow-up detection).
 */
function getLastUserMessageText(messages: AgentMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        const textBlock = m.content.find(
          (c): c is { type: "text"; text: string } =>
            typeof c === "object" && c !== null && "type" in c && (c as { type: string }).type === "text" && "text" in c,
        );
        return textBlock && typeof textBlock.text === "string" ? textBlock.text : undefined;
      }
      return undefined;
    }
  }
  return undefined;
}

/**
 * Truncate conversation history to fit within token limits
 * Keeps last 20 full messages, summarises older ones
 */
function truncateHistory(
  messages: AgentMessage[],
  maxTokens: number,
): AgentMessage[] {
  if (messages.length === 0) return messages;

  // Keep last 20 messages fully
  const keepCount = 20;
  if (messages.length <= keepCount) {
    return messages;
  }

  const recentMessages = messages.slice(-keepCount);
  const oldMessages = messages.slice(0, -keepCount);

  // Summarise old messages
  const summaryText = `[Previous conversation summary: ${oldMessages.length} messages about various topics. User and assistant discussed tasks, used tools, and made progress.]`;

  // Drop tool call/result details from old messages, keep brief summaries
  const simplifiedOld: AgentMessage[] = oldMessages
    .filter((m): m is AgentMessage => m.role === "user" || m.role === "assistant")
    .map((m): AgentMessage => {
      if (typeof m.content === "string") {
        // Truncate long text messages
        const truncated = m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content;
        return { role: m.role as "user" | "assistant", content: truncated };
      }
      // OpenAI assistant messages can have content: null when they only have tool_calls
      if (m.content == null || !Array.isArray(m.content)) {
        return { role: m.role as "user" | "assistant", content: "Previous assistant message (tool use)" };
      }
      // For messages with tool_use/tool_result blocks, create a summary
      const contentArray = m.content as Array<{ type: string; name?: string; [key: string]: unknown }>;
      const toolUses = contentArray.filter((c) => c.type === "tool_use").map((c) => c.name || "tool");
      const summary = toolUses.length > 0
        ? `Used tools: ${toolUses.join(", ")}`
        : "Previous assistant message";
      return { role: m.role as "user" | "assistant", content: summary };
    });

  // Combine summary + recent messages
  const summaryMessage: AgentMessage = {
    role: "user",
    content: summaryText,
  };

  return [summaryMessage, ...simplifiedOld.slice(-5), ...recentMessages];
}

export interface AgentLoopConfig extends LLMStreamConfig {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string;
  planMode: boolean;
  isSubAgent?: boolean; // True if this is a sub-agent (prevents recursive tool usage)
  createArtifact?: ArtifactCreator; // Optional callback to create artifact DB records
  sessionState?: {
    todos?: Array<{ id: string; content: string; status: string }>;
    files?: Array<{ fileName: string; category: string }>;
    subAgents?: Array<{ id: string; description: string; status: string }>;
  };
  activeSkills?: string[]; // Skill IDs to inject into system prompt
}

export interface SSEEventSender {
  (eventType: string, data: unknown): void;
}

export interface ArtifactCreator {
  (filePath: string, fileName: string, content: string | undefined, sessionId: string): Promise<{
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

export type AgentMessage =
  | { role: "user" | "assistant"; content: string | unknown[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string }
  | { role: "assistant"; content: null; tool_calls: unknown[] };

/** Generate a stable id for canonical messages. */
let _canonicalIdCounter = 0;
function nextCanonicalId(): string {
  return `msg_${++_canonicalIdCounter}`;
}

/**
 * Convert agent loop messages (mixed Anthropic/OpenAI style) to canonical format for the LLM abstraction.
 */
function agentMessagesToCanonical(messages: AgentMessage[]): CanonicalMessage[] {
  const out: CanonicalMessage[] = [];
  const toolResultBuffer: Array<{ toolUseId: string; content: string; isError: boolean }> = [];

  function flushToolResults(): void {
    if (toolResultBuffer.length === 0) return;
    out.push({
      id: nextCanonicalId(),
      role: "user",
      content: toolResultBuffer.map((t) => ({
        type: "tool_result" as const,
        toolUseId: t.toolUseId,
        content: t.content,
        isError: t.isError,
      })),
    });
    toolResultBuffer.length = 0;
  }

  for (const m of messages) {
    if (m.role === "tool") {
      toolResultBuffer.push({
        toolUseId: m.tool_call_id,
        content: m.content,
        isError: false,
      });
      continue;
    }

    flushToolResults();

    if (m.role === "user") {
      if (typeof m.content === "string") {
        out.push({
          id: nextCanonicalId(),
          role: "user",
          content: [{ type: "text", text: m.content }],
        });
      } else if (Array.isArray(m.content)) {
        const blocks = m.content.map((c: unknown) => {
          if (typeof c === "object" && c !== null && "type" in c) {
            const b = c as { type: string; tool_use_id?: string; content?: string; is_error?: boolean };
            if (b.type === "tool_result" && b.tool_use_id != null) {
              return {
                type: "tool_result" as const,
                toolUseId: b.tool_use_id,
                content: typeof b.content === "string" ? b.content : "",
                isError: Boolean(b.is_error),
              };
            }
            if (b.type === "text" && "text" in b) {
              return { type: "text" as const, text: (b as { text: string }).text };
            }
          }
          return { type: "text" as const, text: JSON.stringify(c) };
        });
        out.push({ id: nextCanonicalId(), role: "user", content: blocks });
      }
      continue;
    }

    if (m.role === "assistant") {
      if (typeof m.content === "string") {
        out.push({
          id: nextCanonicalId(),
          role: "assistant",
          content: [{ type: "text", text: m.content }],
        });
      } else if (m.content === null && "tool_calls" in m && Array.isArray(m.tool_calls)) {
        const content = (m.tool_calls as Array<{ id?: string; function?: { name?: string; arguments?: string } }>).map(
          (tc) => ({
            type: "tool_use" as const,
            id: tc.id ?? nextCanonicalId(),
            name: tc.function?.name ?? "",
            input: (() => {
              try {
                return JSON.parse(tc.function?.arguments ?? "{}") as Record<string, unknown>;
              } catch {
                return {};
              }
            })(),
          })
        );
        out.push({ id: nextCanonicalId(), role: "assistant", content });
      } else if (Array.isArray(m.content)) {
        const content = m.content.map((c: unknown) => {
          const b = c as { type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string };
          if (b.type === "tool_use" && b.id != null && b.name != null) {
            return { type: "tool_use" as const, id: b.id, name: b.name, input: b.input ?? {} };
          }
          if (b.type === "text" || "text" in b) {
            return { type: "text" as const, text: b.text ?? "" };
          }
          return { type: "text" as const, text: JSON.stringify(c) };
        });
        out.push({ id: nextCanonicalId(), role: "assistant", content });
      }
    }
  }

  flushToolResults();
  return out;
}

/**
 * Run the agentic loop with tool calling support
 */
export async function runAgentLoop(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  sendEvent: SSEEventSender,
): Promise<{ fullText: string; usage?: TokenUsage }> {
  try {
    // Skill activation is now handled by the Skill tool itself.
    // The LLM sees a compact skill listing in the system prompt and calls the Skill tool
    // when a request matches — the tool returns full content and emits skill_activated SSE.
    // No trigger matching needed here.

  let activeSkills = [...(config.activeSkills || [])];
  const allCanonicalTools = getCanonicalTools();

  const toolContext: ToolContext = {
    sessionId: config.sessionId,
    userId: config.userId,
    organizationId: config.organizationId,
    sessionDir: config.sessionDir,
    planMode: config.planMode,
    sendEvent, // Pass sendEvent to tools (e.g., Task tool for sub-agents)
  };

  let fullText = "";
  let iterationCount = 0;
  let totalUsage: TokenUsage | undefined;

  // Filter tools based on plan mode and whether this is a sub-agent
  // Sub-agents should NEVER have access to Task, AskUserQuestion, GetSubAgentResults, or Skill tools (prevent recursion)
  const subAgentBlocklist = ["Task", "AskUserQuestion", "GetSubAgentResults", "Skill", "CreateSkill"];

  let availableCanonicalTools: CanonicalToolDefinition[] = config.planMode
    ? allCanonicalTools.filter((t) => ["Read", "Glob", "Grep", "WebSearch", "WebFetch"].includes(t.name))
    : allCanonicalTools;

  if (config.isSubAgent) {
    availableCanonicalTools = availableCanonicalTools.filter((t) => !subAgentBlocklist.includes(t.name));
  }

  // Track completed sub-agents to inject their results
  // Note: Sub-agent results are injected via sub_agent_update events handled by the frontend
  // The main agent will see results when the user sends the next message (sessionState refreshed)
  // For now, we rely on the sub-agent orchestrator to emit events that the frontend displays

  console.log("[Agent Loop] Provider:", config.provider, "| tools:", availableCanonicalTools.length);

  while (iterationCount < MAX_TOOL_ITERATIONS) {
    iterationCount++;

    // 1. Run provider-specific LLM iteration (unchanged — handles streaming)
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

    const toolNames = result.toolCalls.map((tc) => tc.name);
    console.log(
      "[Agent Loop] Iteration",
      iterationCount,
      "| toolCalls:",
      toolNames.length ? toolNames.join(", ") : "(none)",
    );

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

      sendEvent("tool_use_start", {
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
      });

      const toolInput = prepareToolInput(
        toolCall,
        result.text,
        sendEvent,
      );

      const toolResult = await executeTool(
        toolCall.name,
        toolInput,
        toolContext,
      );
      if (toolResult.isError) flags.hadError = true;
      if (toolCall.name === "CreateSkill" && toolResult.isError)
        flags.createSkillFailed = true;
      if (toolCall.name === "CreateDocument" && !toolResult.isError)
        flags.createDocumentSucceeded = true;

      sendEvent("tool_result", {
        tool_use_id: toolCall.id,
        content: toolResult.content,
        is_error: toolResult.isError,
      });
      console.log(
        "[Agent Loop] Tool executed provider=" +
          config.provider +
          " name=" +
          toolCall.name +
          " result=" +
          (toolResult.isError ? "error" : "ok") +
          " contentLen=" +
          toolResult.content.length +
          (toolResult.isError
            ? " contentPreview=" + String(toolResult.content).slice(0, 80)
            : ""),
      );

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

      pushToolResultToMessages(
        messages,
        config.provider,
        toolCall,
        toolResult,
      );
    }

    // 4. Post-tool handling
    if (flags.hadError) {
      console.log(
        "[Agent Loop] Tool error occurred; one final text-only turn then ending. messageCount=" +
          messages.length,
      );
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
      if (flags.createDocumentSucceeded) {
        console.log("[Agent Loop] CreateDocument succeeded; ending turn.");
      }
      break;
    }
  }

    if (iterationCount >= MAX_TOOL_ITERATIONS) {
      console.log("[Agent Loop] Exit reason=max_iterations iterationCount=" + iterationCount);
      sendEvent("error", {
        code: "max_iterations",
        message: `Reached maximum tool call iterations (${MAX_TOOL_ITERATIONS})`,
      });
    } else {
      console.log("[Agent Loop] Done iterationCount=" + iterationCount + " fullTextLen=" + fullText.length + (totalUsage ? " inputTokens=" + totalUsage.inputTokens + " outputTokens=" + totalUsage.outputTokens : ""));
    }

    return { fullText, usage: totalUsage };
  } catch (error) {
    const adapter = config.provider === "anthropic" ? getAdapter("anthropic") : getAdapter("openai");
    const normalised = adapter.normaliseError(error);
    console.error("[Run Agent Loop] Fatal error:", error);
    sendEvent("error", { code: normalised.code, message: normalised.message });
    throw error;
  }
}

interface AnthropicIterationResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  usage?: TokenUsage;
}

async function runAnthropicIteration(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  canonicalTools: CanonicalToolDefinition[],
  toolContext: ToolContext,
  sendEvent: SSEEventSender,
): Promise<AnthropicIterationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const adapter = getAdapter("anthropic");

  // Assemble dynamic system prompt with session state and skills
  const systemPrompt = await assembleSystemPrompt(
    config.systemPrompt,
    config.sessionState,
    config.sessionId,
  );

  // Truncate history if needed (keep last 20 messages, summarise older ones)
  const truncatedMessages = truncateHistory(messages, config.maxTokens || 4096);
  const canonicalMessages = agentMessagesToCanonical(truncatedMessages);

  const canonicalRequest = {
    model: config.model,
    systemPrompt,
    messages: canonicalMessages,
    tools: canonicalTools,
    toolChoice: { type: "auto" as const },
    maxTokens: config.maxTokens ?? 4096,
    temperature: config.temperature ?? 0.7,
    stream: true,
  };
  const body = adapter.buildRequest(canonicalRequest);

  const toolNames = canonicalTools.map((t) => t.name);
  console.log(
    `${LLM_LOG_PREFIX} Request provider=anthropic model=${config.model} messages=${canonicalMessages.length} systemChars=${systemPrompt.length} tools=[${toolNames.join(",")}] messageSummary=${summariseCanonicalMessages(canonicalMessages)}`
  );

  let stream;
  try {
    stream = client.messages.stream(body as Anthropic.MessageCreateParams);
  } catch (error: unknown) {
    const normalised = adapter.normaliseError(error);
    console.error(`${LLM_LOG_PREFIX} Request failed provider=anthropic error=${normalised.message}`);
    sendEvent("error", { code: normalised.code, message: normalised.message });
    throw new Error(normalised.message);
  }

  let text = "";
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

  // Stream text deltas
  stream.on("text", (delta) => {
    text += delta;
    sendEvent("content_delta", { text: delta });
  });

  let finalMessage;
  try {
    finalMessage = await stream.finalMessage();
  } catch (error: unknown) {
    const normalised = adapter.normaliseError(error);
    sendEvent("error", { code: normalised.code, message: normalised.message });
    throw new Error(normalised.message);
  }

  // Extract tool_use blocks and any text from final message content (text may not arrive via stream if tool_use is first)
  if (finalMessage.content) {
    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      } else if (block.type === "text" && block.text) {
        if (text.length === 0) text = block.text;
        else if (!text.includes(block.text)) text += block.text; // Multiple text blocks
      }
    }
  }

  const usage: TokenUsage = {
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };

  const toolNamesOut = toolCalls.map((tc) => tc.name);
  console.log(
    `${LLM_LOG_PREFIX} Response provider=anthropic textLen=${text.length} toolCalls=[${toolNamesOut.join(",") || "none"}] inputTokens=${usage.inputTokens} outputTokens=${usage.outputTokens}`
  );
  return { text, toolCalls, usage };
}

interface OpenAIIterationResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  usage?: TokenUsage;
}

async function runOpenAIIteration(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  canonicalTools: CanonicalToolDefinition[],
  toolContext: ToolContext,
  sendEvent: SSEEventSender,
): Promise<OpenAIIterationResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const adapter = getAdapter("openai");

  // Assemble dynamic system prompt with session state and skills
  const systemPrompt = await assembleSystemPrompt(
    config.systemPrompt,
    config.sessionState,
    config.sessionId,
  );

  // Truncate history if needed (keep last 20 messages, summarise older ones)
  const truncatedMessages = truncateHistory(messages, config.maxTokens || 4096);
  const canonicalMessages = agentMessagesToCanonical(truncatedMessages);

  // o1/o3 models don't support temperature or tools
  const isO1Model = config.model.includes("o1");
  const isO3Model = config.model.includes("o3");
  const isReasoningModel = isO1Model || isO3Model;
  const toolsForRequest = isReasoningModel ? [] : canonicalTools;
  if (isReasoningModel && canonicalTools.length > 0) {
    console.warn(
      `[Agent Loop] Model ${config.model} does not support tool calling. Tools will be disabled for this session.`
    );
  }

  const canonicalRequest = {
    model: config.model,
    systemPrompt,
    messages: canonicalMessages,
    tools: toolsForRequest,
    toolChoice: toolsForRequest.length > 0 ? { type: "auto" as const } : undefined,
    maxTokens: config.maxTokens ?? 4096,
    temperature: isReasoningModel ? undefined : (config.temperature ?? 0.7),
    stream: true,
  };
  const body = adapter.buildRequest(canonicalRequest);

  const toolNamesForLog = toolsForRequest.map((t) => t.name);
  console.log(
    `${LLM_LOG_PREFIX} Request provider=openai model=${config.model} messages=${canonicalMessages.length} systemChars=${systemPrompt.length} tools=[${toolNamesForLog.join(",") || "none"}] toolChoice=${toolsForRequest.length > 0 ? "auto" : "none"} messageSummary=${summariseCanonicalMessages(canonicalMessages)}`
  );

  let stream;
  try {
    stream = await client.chat.completions.create({
      ...(body as OpenAI.Chat.ChatCompletionCreateParamsStreaming),
      stream_options: { include_usage: true },
    });
  } catch (error: unknown) {
    const normalised = adapter.normaliseError(error);
    console.error(`${LLM_LOG_PREFIX} Request failed provider=openai error=${normalised.message}`);
    sendEvent("error", { code: normalised.code, message: normalised.message });
    throw new Error(normalised.message);
  }

  let text = "";
  const toolCallMap = new Map<string, { id: string; name: string; arguments: string }>();
  // OpenAI streams tool call deltas with `index` to identify which tool call they belong to.
  // The `id` is only present in the FIRST chunk; continuation chunks have id=undefined.
  // We must use `index` to map continuation chunks back to the correct tool call.
  const indexToIdMap = new Map<number, string>();
  let usage: TokenUsage | undefined;

  try {
    for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.content) {
      text += delta.content;
      sendEvent("content_delta", { text: delta.content });
    }

    if (delta?.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const index = toolCallDelta.index;
        const callId = toolCallDelta.id;

        if (callId) {
          // First chunk for this tool call — has the id
          const existing = toolCallMap.get(callId);
          if (existing) {
            existing.arguments += toolCallDelta.function?.arguments || "";
            if (toolCallDelta.function?.name) {
              existing.name = toolCallDelta.function.name;
            }
          } else {
            toolCallMap.set(callId, {
              id: callId,
              name: toolCallDelta.function?.name || "",
              arguments: toolCallDelta.function?.arguments || "",
            });
          }
          // Track index → id so continuation chunks can find this tool call
          if (index !== undefined) {
            indexToIdMap.set(index, callId);
          }
        } else if (index !== undefined) {
          // Continuation chunk — no id, use index to find the tool call
          const existingId = indexToIdMap.get(index);
          if (existingId) {
            const existing = toolCallMap.get(existingId);
            if (existing) {
              existing.arguments += toolCallDelta.function?.arguments || "";
              if (toolCallDelta.function?.name) {
                existing.name = toolCallDelta.function.name;
              }
            }
          }
        }
      }
    }

    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      };
    }
  }
  } catch (error: unknown) {
    const normalised = adapter.normaliseError(error);
    sendEvent("error", { code: normalised.code, message: normalised.message });
    throw new Error(normalised.message);
  }

  // Convert accumulated tool calls to our format
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  for (const [id, call] of toolCallMap) {
    try {
      toolCalls.push({
        id,
        name: call.name,
        input: JSON.parse(call.arguments || "{}"),
      });
    } catch (error) {
      console.error(`[Agent Loop] Failed to parse tool call arguments for ${call.name}:`, error);
    }
  }

  const toolNamesOut = toolCalls.map((tc) => tc.name);
  const usageStr = usage ? `inputTokens=${usage.inputTokens} outputTokens=${usage.outputTokens}` : "usage=unknown";
  console.log(
    `${LLM_LOG_PREFIX} Response provider=openai textLen=${text.length} toolCalls=[${toolNamesOut.join(",") || "none"}] ${usageStr}`
  );
  return { text, toolCalls, usage };
}

/**
 * Create an SSE stream from the agent loop
 * This is the main entry point for the message API route
 */
export function streamAgentLoop(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  config: AgentLoopConfig,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        const payload = JSON.stringify({ type: eventType, ...(typeof data === 'object' && data !== null ? data : { data }) });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const assistantMessageId = `msg_${Date.now()}`;
      send("message_start", { messageId: assistantMessageId, role: "assistant" });

      try {
        // Convert simple messages to agent format
        const agentMessages: AgentMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        console.log(
          "[Agent Loop] Start provider=" + config.provider + " model=" + (config.model ?? "default") + " messageCount=" + agentMessages.length + " summary=" + summariseAgentMessages(agentMessages)
        );
        const result = await runAgentLoop(agentMessages, config, send);

        send("message_end", {
          messageId: assistantMessageId,
          tokenUsage: result.usage
            ? { input: result.usage.inputTokens, output: result.usage.outputTokens }
            : undefined,
        });
      } catch (error) {
        const adapter = config.provider === "anthropic" ? getAdapter("anthropic") : getAdapter("openai");
        const normalised = adapter.normaliseError(error);
        console.error("[Stream Agent Loop] Error:", error);
        send("error", { code: normalised.code, message: normalised.message });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
