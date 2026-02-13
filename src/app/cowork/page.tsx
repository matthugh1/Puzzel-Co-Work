"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useCowork, useCoworkActions } from "@/lib/cowork/context";
import { CoworkSidebar } from "@/components/cowork/CoworkSidebar";
import { CoworkCentrePanel } from "@/components/cowork/CoworkCentrePanel";
import { CoworkRightPanel } from "@/components/cowork/CoworkRightPanel";
import { CreateSkillModal } from "@/components/cowork/CreateSkillModal";
import type { CoworkSession } from "@/types/cowork";
import { getSessionStepsFromMessages } from "@/lib/cowork/session-steps";

export type SessionError =
  | "unauthorized"
  | "forbidden"
  | "create_failed"
  | null;

export default function CoworkPage() {
  const { state } = useCowork();
  const actions = useCoworkActions();
  const [sessionError, setSessionError] = useState<SessionError>(null);
  const [createSkillModalOpen, setCreateSkillModalOpen] = useState(false);

  const toolsUsedInChat = useMemo(() => {
    const names = new Set<string>();
    for (const msg of state.chat.messages) {
      if (msg.role !== "assistant") continue;
      for (const block of msg.content ?? []) {
        if (block.type === "tool_use" && "name" in block) names.add(block.name);
      }
    }
    return Array.from(names);
  }, [state.chat.messages]);

  const sessionSteps = useMemo(
    () => getSessionStepsFromMessages(state.chat.messages),
    [state.chat.messages],
  );

  // Load sessions and settings on mount
  useEffect(() => {
    loadSessions();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = useCallback(async () => {
    actions.setSessionsLoading(true);
    setSessionError(null);
    try {
      const res = await fetch("/api/cowork/sessions");
      if (res.ok) {
        const data = await res.json();
        actions.setSessions(data.sessions || []);
      } else if (res.status === 401) {
        setSessionError("unauthorized");
      } else if (res.status === 403) {
        setSessionError("forbidden");
      }
    } catch {
      setSessionError("unauthorized");
    } finally {
      actions.setSessionsLoading(false);
    }
  }, [actions]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/cowork/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          actions.setSettings({
            defaultProvider: data.settings.defaultProvider as
              | "anthropic"
              | "openai",
            defaultModel: data.settings.defaultModel,
          });
        }
      }
    } catch {
      // Silently handle - will use component defaults
    }
  }, [actions]);

  const handleCreateSession = useCallback(async () => {
    setSessionError(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();

      const res = await fetch("/api/cowork/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({ model: "claude-sonnet-4-5" }),
      });

      if (res.ok) {
        const data = await res.json();
        const session: CoworkSession = data.session;
        actions.addSession(session);
        actions.setActiveSession(session);
        actions.setMessages([]);
        actions.setTodos([]);
        actions.setUploads([]);
        actions.setOutputs([]);
        actions.setSubAgents([]);
        actions.setActiveArtifact(null);
        actions.setMessageFeedbackMap({});
      } else if (res.status === 401) {
        setSessionError("unauthorized");
      } else if (res.status === 403) {
        setSessionError("forbidden");
      } else {
        setSessionError("create_failed");
      }
    } catch {
      setSessionError("create_failed");
    }
  }, [actions]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      try {
        // Load session, messages, and todos
        const res = await fetch(`/api/cowork/sessions/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          actions.setActiveSession(data.session);
          actions.setMessages(data.messages || []);
          actions.setTodos(data.todos || []);
          actions.setActiveArtifact(null);
        }

        // Load files for this session
        const filesRes = await fetch(`/api/cowork/sessions/${sessionId}/files`);
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          const files = filesData.files || [];
          actions.setUploads(
            files.filter((f: { category: string }) => f.category === "upload"),
          );
          actions.setOutputs(
            files.filter((f: { category: string }) => f.category === "output"),
          );
        } else {
          actions.setUploads([]);
          actions.setOutputs([]);
        }

        // Load session feedback (for message thumbs state)
        const feedbackRes = await fetch(
          `/api/cowork/sessions/${sessionId}/feedback`,
        );
        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json();
          const feedbackList = feedbackData.feedback || [];
          const feedbackMap: Record<string, "positive" | "negative"> = {};
          for (const f of feedbackList) {
            feedbackMap[f.messageId] = f.rating;
          }
          actions.setMessageFeedbackMap(feedbackMap);
        } else {
          actions.setMessageFeedbackMap({});
        }

        // Load sub-agents for this session
        const agentsRes = await fetch(
          `/api/cowork/sessions/${sessionId}/agents`,
        );
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          const agents = agentsData.agents || [];
          actions.setSubAgents(
            agents.map(
              (a: {
                id: string;
                description: string;
                type: string;
                status: string;
                prompt: string;
                result?: string;
                model?: string;
                turns: number;
                maxTurns: number;
                createdAt: string;
                completedAt?: string;
              }) => ({
                id: a.id,
                parentSessionId: sessionId,
                description: a.description,
                type: a.type as "bash" | "general-purpose" | "explore" | "plan",
                status: a.status as
                  | "running"
                  | "completed"
                  | "failed"
                  | "cancelled",
                prompt: a.prompt,
                result: a.result,
                model: a.model,
                createdAt: a.createdAt,
                completedAt: a.completedAt,
                turns: a.turns,
                maxTurns: a.maxTurns,
              }),
            ),
          );
        } else {
          actions.setSubAgents([]);
        }
      } catch {
        // Handle error silently
      }
    },
    [actions],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        const res = await fetch(`/api/cowork/sessions/${sessionId}`, {
          method: "DELETE",
          headers: { "X-CSRF-Token": csrfData.token },
        });

        if (res.ok) {
          actions.removeSession(sessionId);
          if (state.sessions.active?.id === sessionId) {
            actions.setActiveSession(null);
            actions.setMessages([]);
            actions.setTodos([]);
            actions.setUploads([]);
            actions.setOutputs([]);
            actions.setActiveArtifact(null);
            actions.setSubAgents([]);
            actions.setMessageFeedbackMap({});
          }
        }
      } catch {
        // Handle error silently
      }
    },
    [actions, state.sessions.active?.id],
  );

  return (
    <div
      className="cowork-layout"
      style={sessionError ? { paddingTop: 52 } : undefined}
    >
      {sessionError && (
        <div
          className="cowork-session-error"
          role="alert"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            padding: "12px 20px",
            background:
              sessionError === "unauthorized"
                ? "var(--cw-danger-subtle, rgba(239,68,68,0.1))"
                : "var(--color-surface-secondary)",
            borderBottom: "1px solid var(--color-border-muted)",
            fontSize: "0.875rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {sessionError === "unauthorized" && (
            <>
              <span>Please log in to use Cowork.</span>
              <Link
                href="/login"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
              >
                Log in
              </Link>
            </>
          )}
          {sessionError === "forbidden" && (
            <>
              <span>Select an organization to use Cowork.</span>
              <Link
                href="/"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
              >
                Go to app
              </Link>
            </>
          )}
          {sessionError === "create_failed" && (
            <>
              <span>
                Could not create task. Check you are logged in and have an
                organization selected.
              </span>
              <Link
                href="/login"
                style={{ color: "var(--color-accent)", fontWeight: 500 }}
              >
                Log in
              </Link>
            </>
          )}
        </div>
      )}
      <CoworkSidebar
        sessions={state.sessions.list}
        activeSessionId={state.sessions.active?.id || null}
        isOpen={state.ui.sidebarOpen}
        onToggle={actions.toggleSidebar}
        onNewTask={handleCreateSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onOpenCreateSkill={() => {
          actions.setStarterMessage("I'd like to create a new skill.");
          if (!state.sessions.active) {
            handleCreateSession();
          }
        }}
      />

      <CoworkCentrePanel
        session={state.sessions.active}
        messages={state.chat.messages}
        isStreaming={state.chat.isStreaming}
        settings={state.settings}
        onToggleSidebar={actions.toggleSidebar}
      />

      <CoworkRightPanel
        isOpen={state.ui.rightPanelOpen}
        activeSessionId={state.sessions.active?.id ?? null}
        activeArtifact={state.files.activeArtifact}
        uploads={state.files.uploads}
        outputs={state.files.outputs}
        todos={state.todos.items}
        toolsUsedInChat={toolsUsedInChat}
        sessionSteps={sessionSteps}
        assistantMessageIds={state.chat.messages
          .filter((m) => m.role === "assistant")
          .map((m) => m.id)}
        onToggle={actions.toggleRightPanel}
        onSelectFile={actions.setActiveArtifact}
        onOpenCreateSkill={() => {
          actions.setStarterMessage("I'd like to create a new skill.");
          if (!state.sessions.active) {
            handleCreateSession();
          }
        }}
      />

      {createSkillModalOpen && (
        <CreateSkillModal
          sessionId={state.sessions.active?.id ?? null}
          onClose={() => setCreateSkillModalOpen(false)}
          onSuccess={() => setCreateSkillModalOpen(false)}
        />
      )}
    </div>
  );
}
