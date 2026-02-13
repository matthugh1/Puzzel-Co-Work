"use client";

import { useState, useCallback } from "react";
import { useCowork } from "@/lib/cowork/context";
import {
  IconChevronRight,
  IconChevronDown,
  IconCheckCircle,
  IconGitBranch,
  IconZap,
} from "@/components/cowork/icons";

export function SubAgentStatusBlock({
  sessionId,
  agents,
}: {
  sessionId: string;
  agents: Array<{
    id: string;
    description: string;
    status: string;
    turns?: number;
    maxTurns?: number;
  }>;
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

        await fetch(
          `/api/cowork/sessions/${sessionId}/agents/${agentId}/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfData.token,
            },
          },
        );
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

  const completedCount = liveAgents.filter(
    (a) => a.status === "completed",
  ).length;
  const runningCount = liveAgents.filter((a) => a.status === "running").length;
  const allCompleted =
    liveAgents.length > 0 && completedCount === liveAgents.length;
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
        aria-label={
          allCompleted
            ? isCollapsed
              ? "Expand sub-agents"
              : "Collapse sub-agents"
            : undefined
        }
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
            <>
              Completed {completedCount} task{completedCount !== 1 ? "s" : ""}
            </>
          ) : (
            <>Sub-agents</>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="cw-agent-turn-counter">
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
                  {isRunning &&
                    agent.turns !== undefined &&
                    agent.maxTurns !== undefined && (
                      <span className="cw-agent-turn-counter">
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
