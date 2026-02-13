/**
 * Shared tool execution logic for the agent loop.
 * Extracted from agent-loop.ts to eliminate duplication between Anthropic and OpenAI paths.
 */

import { executeTool, getToolPermissionLevel } from "./tools";
import type { ToolContext, ToolResult } from "./tools/types";
import { requestPermission } from "./permissions";
import type {
  AgentLoopConfig,
  SSEEventSender,
  ArtifactCreator,
  AgentMessage,
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
  exitLoop: boolean;
  activatedSkillId?: string;
}

function pushToolErrorToMessages(
  messages: AgentMessage[],
  provider: "anthropic" | "openai",
  toolCall: ToolCallInfo,
  errorResult: ToolResult,
): void {
  if (provider === "anthropic") {
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
  } else {
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
  }
}

/**
 * Detect if the user wanted a document but the LLM responded with text only.
 * If so, inject a follow-up message asking the LLM to call CreateDocument.
 * Returns true if a follow-up was injected (caller should `continue` the loop).
 *
 * IMPORTANT: Suppressed when the conversation is about skill creation to avoid
 * hijacking the flow (the word "document" appears in many skill-related messages).
 */
export function checkWantsDocumentFollowUp(
  messages: AgentMessage[],
  fullText: string,
  iterationCount: number,
  hasTools: boolean,
  getLastUserMessageText: (msgs: AgentMessage[]) => string | undefined,
): boolean {
  const lastUserContent = getLastUserMessageText(messages);
  if (!lastUserContent) return false;

  // If the conversation is about skill creation, never inject document follow-up.
  // Check last user message AND recent message history for skill creation context.
  const skillPattern =
    /\b(create|build|make|new|draft)\b.*\bskill\b|\bskill\b.*\b(create|build|make|draft)\b/i;
  if (skillPattern.test(lastUserContent)) return false;

  // Also check the LLM's response — if it mentions CreateSkill or skill drafting, skip
  if (/\bCreateSkill\b|\bskill\s+name\b|\bskill\s+draft\b/i.test(fullText))
    return false;

  // Also check recent user messages (last 4) for skill creation intent
  const recentUserMessages = messages
    .filter((m): m is AgentMessage & { role: "user" } => m.role === "user")
    .slice(-4);
  const hasSkillContext = recentUserMessages.some(
    (m) => typeof m.content === "string" && skillPattern.test(m.content),
  );
  if (hasSkillContext) return false;

  const wantsDocument =
    /(\b(word|docx|document|\.doc)\b|save.*(poem|content|file)|(poem|content).*save|write.*(poem|document))/i.test(
      lastUserContent,
    );
  const hasSubstantialResponse = fullText.length >= 80;
  if (
    wantsDocument &&
    hasSubstantialResponse &&
    iterationCount === 1 &&
    hasTools
  ) {
    console.log(
      "[Agent Loop] Document requested but no tool call; injecting CreateDocument follow-up. fullTextLen=" +
        fullText.length,
    );
    messages.push({ role: "assistant", content: fullText });
    messages.push({
      role: "user",
      content:
        "You must call the CreateDocument tool now with the content you just wrote. Use filename document.docx, a short title from your content, and one section with heading 'Content' and paragraphs containing the full text. Do not reply with text only—invoke the tool.",
    });
    return true;
  }
  return false;
}

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
  sessionId: string,
): Promise<{ allowed: boolean; hadError: boolean }> {
  const permissionLevel = getToolPermissionLevel(toolCall.name);

  if (permissionLevel === "blocked") {
    const errorResult: ToolResult = {
      content: `Tool "${toolCall.name}" is blocked and cannot be executed.`,
      isError: true,
    };
    pushToolErrorToMessages(messages, provider, toolCall, errorResult);
    sendEvent("tool_result", {
      tool_use_id: toolCall.id,
      content: errorResult.content,
      is_error: errorResult.isError,
    });
    return { allowed: false, hadError: true };
  }

  if (permissionLevel === "ask") {
    const requestId = `perm_${toolCall.id}_${Date.now()}`;

    sendEvent("permission_request", {
      requestId,
      action: toolCall.name,
      details: {
        toolName: toolCall.name,
        toolInput: toolCall.input,
      },
    });

    let approved: boolean;
    try {
      approved = await requestPermission(
        sessionId,
        requestId,
        toolCall.name,
        toolCall.input,
      );
    } catch (error) {
      const errorResult: ToolResult = {
        content: `Permission request for "${toolCall.name}" was ${
          error instanceof Error && error.message.includes("timeout")
            ? "timed out"
            : "cancelled"
        }.`,
        isError: true,
      };
      pushToolErrorToMessages(messages, provider, toolCall, errorResult);
      sendEvent("tool_result", {
        tool_use_id: toolCall.id,
        content: errorResult.content,
        is_error: errorResult.isError,
      });
      return { allowed: false, hadError: true };
    }

    if (!approved) {
      const errorResult: ToolResult = {
        content: `Permission denied for "${toolCall.name}". The tool execution was cancelled.`,
        isError: true,
      };
      pushToolErrorToMessages(messages, provider, toolCall, errorResult);
      sendEvent("tool_result", {
        tool_use_id: toolCall.id,
        content: errorResult.content,
        is_error: errorResult.isError,
      });
      return { allowed: false, hadError: true };
    }
  }

  return { allowed: true, hadError: false };
}

/**
 * Preprocess tool input before execution (CreateDocument sections fallback,
 * AskUserQuestion event emission).
 * Returns the (possibly modified) tool input.
 */
export function prepareToolInput(
  toolCall: ToolCallInfo,
  assistantText: string,
  sendEvent: SSEEventSender,
): Record<string, unknown> {
  let toolInput = toolCall.input;

  // Emit preliminary todo_update when TodoWrite is about to run so the plan appears immediately
  if (toolCall.name === "TodoWrite") {
    const input = toolCall.input as {
      todos?: Array<{
        id?: string;
        content?: string;
        activeForm?: string;
        status?: string;
        sortOrder?: number;
      }>;
    };
    if (Array.isArray(input.todos) && input.todos.length > 0) {
      const now = new Date().toISOString();
      const preliminaryTodos = input.todos.map((t, i) => ({
        id:
          t.id && String(t.id).trim() !== ""
            ? String(t.id)
            : `prelim-${toolCall.id}-${i}`,
        sessionId: "",
        content: typeof t.content === "string" ? t.content : "Task",
        activeForm: typeof t.activeForm === "string" ? t.activeForm : "Working",
        status: (t.status === "in_progress" || t.status === "completed"
          ? t.status
          : "pending") as "pending" | "in_progress" | "completed",
        createdAt: now,
        updatedAt: now,
      }));
      sendEvent("todo_update", { todos: preliminaryTodos });
    }
  }

  if (toolCall.name === "CreateDocument") {
    const input = toolCall.input as {
      filename?: string;
      title?: string;
      sections?: unknown[];
    };
    const hasSections =
      Array.isArray(input.sections) &&
      input.sections.some(
        (s) =>
          s &&
          typeof s === "object" &&
          Array.isArray((s as { paragraphs?: unknown }).paragraphs) &&
          (s as { paragraphs: unknown[] }).paragraphs.some(
            (p) => typeof p === "string" && (p as string).trim().length > 0,
          ),
      );
    if (!hasSections && assistantText && assistantText.trim().length > 0) {
      const paragraphs = assistantText
        .trim()
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0);
      if (paragraphs.length === 0) paragraphs.push(assistantText.trim());
      toolInput = {
        ...input,
        sections: [{ heading: "Content", paragraphs }],
      };
      console.log(
        "[Agent Loop] CreateDocument had no sections; using assistant text from this turn paragraphs=" +
          paragraphs.length,
      );
    }
  }

  if (toolCall.name === "AskUserQuestion") {
    const questionInput = toolCall.input as {
      prompt: string;
      options: Array<{ id: string; label: string }>;
      allowMultiple?: boolean;
    };
    const questionId = `question_${toolCall.id}_${Date.now()}`;

    toolInput = {
      ...questionInput,
      questionId,
    };

    sendEvent("ask_question", {
      id: questionId,
      prompt: questionInput.prompt,
      options: questionInput.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
      })),
      allowMultiple: questionInput.allowMultiple || false,
    });
  }

  return toolInput;
}

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
): Promise<void> {
  if (toolCall.name === "TodoWrite" && toolResult.metadata?.todos) {
    sendEvent("todo_update", { todos: toolResult.metadata.todos });
  }

  if (toolCall.name === "EnterPlanMode" && toolResult.metadata?.planMode) {
    toolContext.planMode = true;
    sendEvent("plan_mode_changed", { planMode: true });
  }

  if (toolCall.name === "ExitPlanMode" && toolResult.metadata?.planId) {
    sendEvent("plan_proposed", {
      planId: toolResult.metadata.planId,
      steps: toolResult.metadata.steps || [],
    });
    flags.exitLoop = true;
    return;
  }

  if (
    toolCall.name === "Write" &&
    toolResult.metadata?.isArtifact &&
    config.createArtifact
  ) {
    try {
      const artifactPath = toolResult.metadata.artifactPath as string;
      const artifactFileName = toolResult.metadata.artifactFileName as string;
      const fileContent = (toolCall.input as { content: string }).content;

      const artifact = await config.createArtifact(
        artifactPath,
        artifactFileName,
        fileContent,
        config.sessionId,
      );

      sendEvent("artifact_created", artifact);
    } catch (error) {
      console.error("[Agent Loop] Error creating artifact:", error);
    }
  }

  if (
    toolCall.name === "CreateDocument" &&
    !toolResult.isError &&
    toolResult.metadata?.path &&
    config.createArtifact
  ) {
    try {
      const artifactPath = toolResult.metadata.path as string;
      const artifactFileName =
        (toolResult.metadata.filename as string) || "document.docx";
      const artifact = await config.createArtifact(
        artifactPath,
        artifactFileName,
        undefined,
        config.sessionId,
      );
      sendEvent("artifact_created", artifact);
    } catch (error) {
      console.error(
        "[Agent Loop] Error creating artifact for CreateDocument:",
        error,
      );
    }
  }

  if (toolCall.name === "Task" && toolResult.metadata?.agentId) {
    // The Task tool already emits sub_agent_update; frontend handles it
  }

  if (toolCall.name === "Skill" && toolResult.metadata?.skillId) {
    const skillId = toolResult.metadata.skillId as string;
    const skillName = (toolResult.metadata.skillName as string) || skillId;
    if (!activeSkills.includes(skillId)) {
      activeSkills.push(skillId);
    }
    flags.activatedSkillId = skillId;

    // Emit skill activation event for the frontend "Using skill: X" UI pill
    sendEvent("skill_activated", {
      skills: [{ id: skillId, name: skillName, description: "" }],
    });
  }
}

/**
 * Add tool call + result to the conversation in the correct provider format.
 */
export function pushToolResultToMessages(
  messages: AgentMessage[],
  provider: "anthropic" | "openai",
  toolCall: ToolCallInfo,
  toolResult: ToolResult,
): void {
  if (provider === "anthropic") {
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
          content: toolResult.content,
          is_error: toolResult.isError,
        },
      ],
    });
  } else {
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
      content: toolResult.content,
      tool_call_id: toolCall.id,
      name: toolCall.name,
    } as AgentMessage);
  }
}
