"use client";

import { useState, useCallback } from "react";
import type { CoworkMessage, MessageContent, CoworkFileRecord } from "@/types/cowork";
import { CoworkTodoWidget } from "@/components/cowork/CoworkTodoWidget";
import { useCowork, useCoworkActions } from "@/lib/cowork/context";
import {
  IconTerminal,
  IconChevronRight,
  IconChevronDown,
  IconCheckCircle,
  IconAlertTriangle,
  IconFile,
  IconGitBranch,
  IconZap,
  IconList,
} from "@/components/cowork/icons";

interface CoworkMessageItemProps {
  message: CoworkMessage;
}

/** Order for display: sub-agents first, then tool activity, then text (final response). */
function sortContentBlocks(blocks: MessageContent[]): MessageContent[] {
  const order = (b: MessageContent) => {
    if (b.type === "sub_agent_status") return 0;
    if (b.type === "tool_use" || b.type === "tool_result") return 1;
    if (b.type === "text") return 2;
    return 3;
  };
  return [...blocks].sort((a, b) => order(a) - order(b));
}

/** True if any block before idx is a sub_agent_status with all agents completed. */
function hasCompletedSubAgentsBefore(contents: MessageContent[], idx: number): boolean {
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
      <IconCheckCircle size={16} style={{ color: "var(--color-success)", flexShrink: 0 }} />
      <span>All tasks completed. Final response below:</span>
    </div>
  );
}

export function CoworkMessageItem({ message }: CoworkMessageItemProps) {
  const isUser = message.role === "user";
  const rawContents: MessageContent[] = Array.isArray(message.content)
    ? message.content
    : [{ type: "text", text: String(message.content) }];
  const contents = sortContentBlocks(rawContents);

  return (
    <div className={`cowork-message cowork-message--${message.role}`}>
      <div className={`cowork-message__avatar cowork-message__avatar--${message.role}`}>
        {isUser ? "U" : "C"}
      </div>
      <div className="cowork-message__body">
        <div className="cowork-message__role">
          {isUser ? "You" : "Cowork"}
        </div>
        <div className="cowork-message__content">
          {contents.map((block, idx) => (
            <span key={idx} style={{ display: "block" }}>
              {block.type === "text" && hasCompletedSubAgentsBefore(contents, idx) && (
                <SubAgentSeparatorBanner />
              )}
              <ContentBlock block={block} sessionId={message.sessionId} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContentBlock({ block, sessionId }: { block: MessageContent; sessionId: string }) {
  switch (block.type) {
    case "text":
      return <TextBlock text={block.text} />;
    case "tool_use":
      return <ToolUseBlock name={block.name} input={block.input} />;
    case "tool_result":
      return <ToolResultBlock output={block.content} isError={block.is_error} />;
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
      return <SubAgentStatusBlock sessionId={sessionId} agents={block.agents} />;
    case "artifact":
      return <ArtifactBlock artifactId={block.artifactId} fileName={block.fileName} renderType={block.renderType} />;
    case "ask_user":
      return <AskUserBlock questionId={block.questionId} sessionId={sessionId} question={block.questions[0]} />;
    case "error":
      return <ErrorBlock message={block.message} />;
    default:
      return null;
  }
}

function TextBlock({ text }: { text: string }) {
  // Simple markdown-like rendering
  const renderText = (raw: string) => {
    return raw.split("\n").map((line, i) => {
      // Code block detection
      if (line.startsWith("```")) return null;

      // Bold
      let processed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      // Italic
      processed = processed.replace(/\*(.*?)\*/g, "<em>$1</em>");
      // Inline code
      processed = processed.replace(/`([^`]+)`/g, '<code>$1</code>');
      // Links
      processed = processed.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener" style="color:var(--cw-accent);text-decoration:underline">$1</a>'
      );

      return (
        <p key={i} dangerouslySetInnerHTML={{ __html: processed || "&nbsp;" }} />
      );
    });
  };

  // Handle code blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>{renderText(text.slice(lastIndex, match.index))}</span>
      );
    }
    parts.push(
      <pre key={`code-${match.index}`}>
        <code>{match[2]}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>{renderText(text.slice(lastIndex))}</span>
    );
  }

  return <>{parts}</>;
}

function ToolUseBlock({ name, input }: { name: string; input?: Record<string, unknown> }) {
  // Important tools start expanded
  const importantTools = ["AskUserQuestion", "Task", "EnterPlanMode", "GetSubAgentResults"];
  const [open, setOpen] = useState(importantTools.includes(name));
  
  return (
    <div className="cowork-tool-card cowork-tool-card--compact">
      <button className="cowork-tool-card__header" onClick={() => setOpen(!open)}>
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        <IconTerminal size={14} />
        <span className="cowork-tool-card__name">{name}</span>
      </button>
      {open && (
        <div className="cowork-tool-card__content">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultBlock({ output, isError }: { output?: string; isError?: boolean }) {
  // Errors and important results start expanded
  const [open, setOpen] = useState(isError || false);
  
  // Show preview for collapsed results (first 100 chars)
  const preview = output && !open && output.length > 100 
    ? output.slice(0, 100) + "..." 
    : null;
  
  return (
    <div className="cowork-tool-card cowork-tool-card--compact">
      <button className="cowork-tool-card__header" onClick={() => setOpen(!open)}>
        {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        {isError ? (
          <IconAlertTriangle size={14} />
        ) : (
          <IconCheckCircle size={14} />
        )}
        <span style={{ color: isError ? "var(--cw-danger)" : "var(--cw-success)" }}>
          {isError ? "Error" : "Result"}
        </span>
        {preview && (
          <span style={{ 
            marginLeft: "8px", 
            fontSize: "12px", 
            opacity: 0.7,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1
          }}>
            {preview}
          </span>
        )}
      </button>
      {open && (
        <div className="cowork-tool-card__content">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {output || "(empty)"}
          </pre>
        </div>
      )}
    </div>
  );
}

function PermissionRequestBlock({
  requestId,
  sessionId,
  title,
  description,
}: {
  requestId: string;
  sessionId: string;
  title: string;
  description: string;
}) {
  const [resolved, setResolved] = useState<"approved" | "denied" | null>(null);
  const [loading, setLoading] = useState(false);
  const { dispatch } = useCowork();

  const handleResolve = useCallback(
    async (approved: boolean) => {
      setLoading(true);
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        await fetch(`/api/cowork/sessions/${sessionId}/permissions/${requestId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
          body: JSON.stringify({ approved }),
        });

        setResolved(approved ? "approved" : "denied");
        dispatch({ type: "SET_PENDING_PERMISSION", payload: null });
      } catch (err) {
        console.error("Permission resolve error:", err);
      } finally {
        setLoading(false);
      }
    },
    [requestId, sessionId, dispatch],
  );

  return (
    <div className="cowork-interactive-card cowork-interactive-card--permission">
      <div className="cowork-interactive-card__title">
        <IconAlertTriangle size={16} />
        {title}
      </div>
      <div className="cowork-interactive-card__body">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8125rem" }}>
          {description}
        </pre>
      </div>
      <div className="cowork-interactive-card__actions">
        {resolved ? (
          <span style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: resolved === "approved" ? "var(--cw-success)" : "var(--cw-danger)",
          }}>
            {resolved === "approved" ? "Allowed" : "Denied"}
          </span>
        ) : (
          <>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={() => handleResolve(true)}
              disabled={loading}
            >
              {loading ? "..." : "Allow"}
            </button>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--danger"
              onClick={() => handleResolve(false)}
              disabled={loading}
            >
              {loading ? "..." : "Deny"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PlanBlock({
  planId,
  sessionId,
  title,
  steps,
  status,
}: {
  planId: string;
  sessionId: string;
  title: string;
  steps: Array<{ id?: string; description: string; status?: string }>;
  status?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : null,
  );
  const [loading, setLoading] = useState(false);
  const { dispatch } = useCowork();

  const handlePlanAction = useCallback(
    async (action: "approve" | "reject") => {
      setLoading(true);
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        await fetch(`/api/cowork/sessions/${sessionId}/plan/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
          body: JSON.stringify({ planId }),
        });

        setResolved(action === "approve" ? "approved" : "rejected");
        dispatch({ type: "SET_PENDING_PLAN", payload: null });
      } catch (err) {
        console.error("Plan action error:", err);
      } finally {
        setLoading(false);
      }
    },
    [planId, sessionId, dispatch],
  );

  return (
    <div className="cowork-interactive-card cowork-interactive-card--plan">
      <div className="cowork-interactive-card__title">
        <IconList size={16} />
        {title || "Plan"}
      </div>
      <ol style={{ margin: "8px 0", paddingLeft: 20, fontSize: "0.875rem", lineHeight: 1.7 }}>
        {steps.map((step, i) => (
          <li key={step.id || i} style={{
            marginBottom: 4,
            color: step.status === "completed"
              ? "var(--cw-success)"
              : step.status === "in_progress"
                ? "var(--cw-accent)"
                : undefined,
          }}>
            {step.description}
          </li>
        ))}
      </ol>
      <div className="cowork-interactive-card__actions">
        {resolved ? (
          <span style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: resolved === "approved" ? "var(--cw-success)" : "var(--cw-danger)",
          }}>
            {resolved === "approved" ? "Plan approved" : "Plan rejected"}
          </span>
        ) : (
          <>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={() => handlePlanAction("approve")}
              disabled={loading}
            >
              {loading ? "..." : "Approve"}
            </button>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--danger"
              onClick={() => handlePlanAction("reject")}
              disabled={loading}
            >
              {loading ? "..." : "Reject"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SubAgentStatusBlock({
  sessionId,
  agents,
}: {
  sessionId: string;
  agents: Array<{ id: string; description: string; status: string; turns?: number; maxTurns?: number }>;
}) {
  const { state } = useCowork();
  const [cancelling, setCancelling] = useState<Set<string>>(new Set());

  // Merge with live state from context (if available)
  const liveAgents = agents.map((agent) => {
    const live = state.subAgents.active.find((a) => a.id === agent.id);
    return live || agent;
  });

  const handleCancel = useCallback(
    async (agentId: string) => {
      setCancelling((prev) => new Set(prev).add(agentId));
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        await fetch(`/api/cowork/sessions/${sessionId}/agents/${agentId}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
        });
      } catch (err) {
        console.error("Cancel agent error:", err);
      } finally {
        setCancelling((prev) => {
          const next = new Set(prev);
          next.delete(agentId);
          return next;
        });
      }
    },
    [sessionId],
  );

  const handleCancelAll = useCallback(async () => {
    const runningAgents = liveAgents.filter((a) => a.status === "running");
    await Promise.all(runningAgents.map((a) => handleCancel(a.id)));
  }, [liveAgents, handleCancel]);

  const completedCount = liveAgents.filter((a) => a.status === "completed").length;
  const runningCount = liveAgents.filter((a) => a.status === "running").length;
  const allCompleted = liveAgents.length > 0 && completedCount === liveAgents.length;
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapsed = useCallback(() => {
    if (allCompleted) setIsCollapsed((c) => !c);
  }, [allCompleted]);

  const showList = !allCompleted || !isCollapsed;

  return (
    <div className="cowork-agent-card">
      <div
        className="cowork-agent-card__header"
        role={allCompleted ? "button" : undefined}
        onClick={allCompleted ? toggleCollapsed : undefined}
        onKeyDown={
          allCompleted
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleCollapsed();
                }
              }
            : undefined
        }
        tabIndex={allCompleted ? 0 : undefined}
        style={allCompleted ? { cursor: "pointer" } : undefined}
        aria-expanded={allCompleted ? !isCollapsed : undefined}
        aria-label={allCompleted ? (isCollapsed ? "Expand sub-agents" : "Collapse sub-agents") : undefined}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {allCompleted ? (
            isCollapsed ? (
              <IconChevronRight size={14} aria-hidden />
            ) : (
              <IconChevronDown size={14} aria-hidden />
            )
          ) : (
            <IconGitBranch size={14} />
          )}
          {allCompleted && isCollapsed ? (
            <>Completed {completedCount} task{completedCount !== 1 ? "s" : ""}</>
          ) : (
            <>Sub-agents</>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
            {completedCount}/{liveAgents.length} completed
          </span>
          {runningCount > 0 && (
            <button
              className="cowork-input__btn"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelAll();
              }}
              style={{ fontSize: "0.6875rem", padding: "2px 8px" }}
              title="Cancel all running agents"
            >
              Cancel All
            </button>
          )}
        </div>
      </div>
      {showList && (
      <div className="cowork-agent-card__list">
        {liveAgents.map((agent) => {
          const isRunning = agent.status === "running";
          const isCompleted = agent.status === "completed";
          const isFailed = agent.status === "failed";
          const isCancelled = agent.status === "cancelled";
          const isCancelling = cancelling.has(agent.id);

          return (
            <div key={agent.id} className="cowork-agent-card__item">
              <div className="cowork-agent-card__item-name">
                <IconZap size={12} />
                <span>{agent.description}</span>
                {isRunning && agent.turns !== undefined && agent.maxTurns !== undefined && (
                  <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", marginLeft: 8 }}>
                    Turn {agent.turns}/{agent.maxTurns}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className={`cowork-agent-card__item-status cowork-agent-card__item-status--${
                    isCompleted
                      ? "done"
                      : isFailed
                        ? "failed"
                        : isCancelled
                          ? "cancelled"
                          : "running"
                  }`}
                >
                  {agent.status}
                </span>
                {isRunning && (
                  <button
                    className="cowork-input__btn"
                    onClick={() => handleCancel(agent.id)}
                    disabled={isCancelling}
                    style={{ fontSize: "0.6875rem", padding: "2px 6px" }}
                    title="Cancel this agent"
                  >
                    {isCancelling ? "..." : "Cancel"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function ArtifactBlock({
  artifactId,
  fileName,
  renderType,
}: {
  artifactId: string;
  fileName: string;
  renderType?: string;
}) {
  const { state } = useCowork();
  const actions = useCoworkActions();

  const handleClick = useCallback(() => {
    // Look up the file record from outputs
    const file = state.files.outputs.find(
      (f) => f.id === artifactId || f.fileName === fileName,
    );
    if (file) {
      actions.setActiveArtifact(file);
      actions.setRightPanelTab("artifacts");
    }
  }, [artifactId, fileName, state.files.outputs, actions]);

  return (
    <button className="cowork-artifact-chip" onClick={handleClick}>
      <IconFile size={14} />
      <span>{fileName}</span>
      {renderType && (
        <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
          {renderType}
        </span>
      )}
    </button>
  );
}

function AskUserBlock({
  questionId,
  sessionId,
  question,
}: {
  questionId: string;
  sessionId: string;
  question: { id: string; prompt: string; options: Array<{ id: string; label: string }>; allowMultiple?: boolean } | undefined;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const { dispatch } = useCowork();

  if (!question) {
    return null;
  }

  const handleOptionToggle = (optionId: string, label: string) => {
    if (question.allowMultiple) {
      // Multi-select: toggle
      setSelectedAnswers((prev) => {
        const next = { ...prev };
        if (next[optionId]) {
          delete next[optionId];
        } else {
          next[optionId] = label;
        }
        return next;
      });
    } else {
      // Single-select: replace
      setSelectedAnswers({ [optionId]: label });
    }
  };

  const handleSubmit = useCallback(async () => {
    if (Object.keys(selectedAnswers).length === 0) {
      return; // No selection made
    }

    setLoading(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();

      await fetch(`/api/cowork/sessions/${sessionId}/questions/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({ answers: selectedAnswers }),
      });

      setResolved(true);
      dispatch({ type: "SET_PENDING_QUESTION", payload: null });
    } catch (err) {
      console.error("Answer question error:", err);
    } finally {
      setLoading(false);
    }
  }, [questionId, sessionId, selectedAnswers, dispatch]);

  return (
    <div className="cowork-interactive-card cowork-interactive-card--question">
      <div className="cowork-interactive-card__title">
        <IconAlertTriangle size={16} />
        Question
      </div>
      <div className="cowork-interactive-card__body">{question.prompt}</div>
      {resolved ? (
        <div className="cowork-interactive-card__actions">
          <span style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--cw-success)",
          }}>
            Answered: {Object.values(selectedAnswers).join(", ")}
          </span>
        </div>
      ) : (
        <>
          <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {question.options.map((opt) => {
              const isSelected = !!selectedAnswers[opt.id];
              return (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: "0.8125rem",
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: isSelected ? "var(--cw-accent-soft, rgba(139, 92, 246, 0.1))" : "transparent",
                    border: `1px solid ${isSelected ? "var(--cw-accent)" : "var(--color-border-muted)"}`,
                  }}
                >
                  <input
                    type={question.allowMultiple ? "checkbox" : "radio"}
                    name={`question_${questionId}`}
                    checked={isSelected}
                    onChange={() => handleOptionToggle(opt.id, opt.label)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          <div className="cowork-interactive-card__actions">
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={handleSubmit}
              disabled={loading || Object.keys(selectedAnswers).length === 0}
            >
              {loading ? "..." : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="cowork-interactive-card cowork-interactive-card--error">
      <div className="cowork-interactive-card__title" style={{ color: "var(--cw-danger)" }}>
        <IconAlertTriangle size={16} />
        Error
      </div>
      <div className="cowork-interactive-card__body">{message}</div>
    </div>
  );
}
