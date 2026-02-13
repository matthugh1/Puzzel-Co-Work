"use client";

import { useState, useCallback } from "react";
import type { CoworkMessage, MessageContent } from "@/types/cowork";
import { CoworkTodoWidget } from "@/components/cowork/CoworkTodoWidget";
import { SkillDraftCard } from "@/components/cowork/SkillDraftCard";
import { ErrorBoundary } from "@/components/cowork/ErrorBoundary";
import {
  hasSkillDraftFormat,
  hasSkillConfirmedMarker,
} from "@/lib/cowork/skill-parser";
import { IconCheckCircle, IconCopy } from "@/components/cowork/icons";
import {
  TextBlock,
  ToolActivityBlock,
  ToolUseBlock,
  ToolResultBlock,
  PermissionRequestBlock,
  PlanBlock,
  SubAgentStatusBlock,
  SkillActivatedBlock,
  ArtifactBlock,
  AskUserBlock,
  ErrorBlock,
  MessageFeedbackBar,
} from "@/components/cowork/message-blocks";
import { useCowork } from "@/lib/cowork/context";

interface CoworkMessageItemProps {
  message: CoworkMessage;
}

/** Order for display: skill activation first, sub-agents, then tool activity, then text (final response). */
function sortContentBlocks(blocks: MessageContent[]): MessageContent[] {
  const order = (b: MessageContent) => {
    if (b.type === "skill_activated") return -1;
    if (b.type === "sub_agent_status") return 0;
    if (b.type === "tool_use" || b.type === "tool_result") return 1;
    if (b.type === "text") return 2;
    return 3;
  };
  return [...blocks].sort((a, b) => order(a) - order(b));
}

/** True if any block before idx is a sub_agent_status with all agents completed. */
function hasCompletedSubAgentsBefore(
  contents: MessageContent[],
  idx: number,
): boolean {
  return contents.slice(0, idx).some((b) => {
    if (b.type !== "sub_agent_status") return false;
    const agents = b.agents as Array<{ status: string }>;
    return agents.length > 0 && agents.every((a) => a.status === "completed");
  });
}

function SubAgentSeparatorBanner() {
  return (
    <div
      className="cowork-subagent-separator"
      style={{
        marginTop: 12,
        marginBottom: 12,
        padding: "12px 16px",
        fontSize: "0.8125rem",
        background: "var(--color-surface-secondary)",
        borderLeft: "3px solid var(--color-primary)",
        borderRadius: "0 var(--radius-md) var(--radius-md) 0",
        color: "var(--color-text-secondary)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <IconCheckCircle
        size={16}
        style={{ color: "var(--color-success)", flexShrink: 0 }}
      />
      <span>All tasks completed. Final response below:</span>
    </div>
  );
}

function getTextFromContents(contents: MessageContent[]): string {
  return contents
    .filter(
      (b): b is MessageContent & { type: "text"; text: string } =>
        b.type === "text",
    )
    .map((b) => b.text)
    .join("\n");
}

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

/** Tools that have their own UI — don't show as tool activity in chat */
const HIDDEN_CHAT_TOOLS = new Set([
  "TodoWrite",
  "AskUserQuestion",
  "EnterPlanMode",
  "ExitPlanMode",
  "GetSubAgentResults",
]);

/**
 * Walk sorted content blocks and merge consecutive tool_use → tool_result pairs
 * into a single ToolActivityBlock entry. Unpaired tool_use blocks (still pending)
 * get isPending: true. Unpaired tool_result blocks render standalone.
 * Hidden tools (TodoWrite, etc.) are omitted entirely.
 */
function mergeToolBlocks(blocks: MessageContent[]): MergedBlock[] {
  const result: MergedBlock[] = [];
  const resultMap = new Map<string, { content: string; isError: boolean }>();
  for (const block of blocks) {
    if (block.type === "tool_result" && "tool_use_id" in block) {
      const tid = block.tool_use_id != null ? String(block.tool_use_id) : "";
      if (tid) {
        resultMap.set(tid, {
          content: block.content || "",
          isError: block.is_error || false,
        });
      }
    }
  }

  const consumedResultIds = new Set<string>();

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!block) continue;

    if (block.type === "tool_use" && "name" in block && "id" in block) {
      const toolId = block.id != null ? String(block.id) : "";
      if (HIDDEN_CHAT_TOOLS.has(block.name)) {
        if (toolId) consumedResultIds.add(toolId);
        continue;
      }
      const paired = toolId ? resultMap.get(toolId) : undefined;
      if (paired) {
        if (toolId) consumedResultIds.add(toolId);
        result.push({
          type: "tool_activity",
          name: block.name,
          input: block.input,
          result: paired.content,
          isError: paired.isError,
          isPending: false,
        });
      } else {
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
      const rid = block.tool_use_id != null ? String(block.tool_use_id) : "";
      if (rid && consumedResultIds.has(rid)) continue;
      result.push({
        type: "tool_activity",
        name: "Tool",
        result: block.content,
        isError: block.is_error,
        isPending: false,
      });
      continue;
    }

    result.push({ type: "other", block, originalIndex: i });
  }

  return result;
}

/** True if this id is from the DB (CUID). Temporary stream ids start with msg_, temp_, or assistant-. */
function isPersistedMessageId(id: string): boolean {
  return (
    !id.startsWith("msg_") &&
    !id.startsWith("temp_") &&
    !id.startsWith("assistant-")
  );
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      className="cw-message-copy-btn"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy message"}
      aria-label={copied ? "Copied!" : "Copy message"}
    >
      {copied ? <IconCheckCircle size={14} /> : <IconCopy size={14} />}
    </button>
  );
}

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

  // Use merged blocks when we have tool_activity entries; otherwise show raw blocks so tool calls are never hidden
  const mergedBlocks = mergeToolBlocks(contents);
  const hasToolBlocks = contents.some(
    (b) =>
      (b as { type?: string }).type === "tool_use" ||
      (b as { type?: string }).type === "tool_result",
  );
  const useMerged =
    mergedBlocks.some((item) => item.type === "tool_activity") ||
    !hasToolBlocks;
  const displayBlocks = useMerged
    ? mergedBlocks
    : contents.map((block, originalIndex) => ({
        type: "other" as const,
        block,
        originalIndex,
      }));

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
          {displayBlocks.map((item, idx) => (
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
                    {"block" in item &&
                      item.block.type === "text" &&
                      hasCompletedSubAgentsBefore(
                        contents,
                        item.originalIndex,
                      ) && <SubAgentSeparatorBanner />}
                    {"block" in item && (
                      <ContentBlock
                        block={item.block}
                        sessionId={message.sessionId}
                        stripConfirmedMarker
                      />
                    )}
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

function ContentBlock({
  block,
  sessionId,
  stripConfirmedMarker,
}: {
  block: MessageContent;
  sessionId: string;
  stripConfirmedMarker?: boolean;
}) {
  switch (block.type) {
    case "text": {
      let text = block.text;
      if (stripConfirmedMarker && hasSkillConfirmedMarker(text)) {
        text = text.replace(/\s*%%SKILL_CONFIRMED%%\s*/g, "").trim();
      }
      return <TextBlock text={text} />;
    }
    case "tool_use":
      return <ToolUseBlock name={block.name} input={block.input} />;
    case "tool_result":
      return (
        <ToolResultBlock output={block.content} isError={block.is_error} />
      );
    case "todo_update":
      return <CoworkTodoWidget items={block.todos} />;
    case "permission_request":
      return (
        <PermissionRequestBlock
          requestId={block.requestId}
          sessionId={sessionId}
          title={block.action}
          description={JSON.stringify(block.details, null, 2)}
        />
      );
    case "plan":
      return (
        <PlanBlock
          planId={block.planId}
          sessionId={sessionId}
          title="Plan"
          steps={block.steps}
          status={block.status}
        />
      );
    case "sub_agent_status":
      return (
        <SubAgentStatusBlock sessionId={sessionId} agents={block.agents} />
      );
    case "skill_activated":
      return <SkillActivatedBlock skills={block.skills} />;
    case "artifact":
      return (
        <ArtifactBlock
          artifactId={block.artifactId}
          fileName={block.fileName}
          renderType={block.renderType}
        />
      );
    case "ask_user":
      return (
        <AskUserBlock
          questionId={block.questionId}
          sessionId={sessionId}
          question={block.questions[0]}
        />
      );
    case "error":
      return <ErrorBlock message={block.message} />;
    default:
      return null;
  }
}
