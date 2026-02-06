"use client";

import { useEffect, useCallback } from "react";
import { useCowork, useCoworkActions } from "@/lib/cowork/context";
import { CoworkSidebar } from "@/components/cowork/CoworkSidebar";
import { CoworkCentrePanel } from "@/components/cowork/CoworkCentrePanel";
import { CoworkRightPanel } from "@/components/cowork/CoworkRightPanel";
import type { CoworkSession } from "@/types/cowork";

export default function CoworkPage() {
  const { state } = useCowork();
  const actions = useCoworkActions();

  // Load sessions and settings on mount
  useEffect(() => {
    loadSessions();
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessions = useCallback(async () => {
    actions.setSessionsLoading(true);
    try {
      const res = await fetch("/api/cowork/sessions");
      if (res.ok) {
        const data = await res.json();
        actions.setSessions(data.sessions || []);
      }
    } catch {
      // Silently handle - sessions list will be empty
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
            defaultProvider: data.settings.defaultProvider as "anthropic" | "openai",
            defaultModel: data.settings.defaultModel,
          });
        }
      }
    } catch {
      // Silently handle - will use component defaults
    }
  }, [actions]);

  const handleCreateSession = useCallback(async () => {
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
      }
    } catch {
      // Handle error silently
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
          actions.setUploads(files.filter((f: { category: string }) => f.category === "upload"));
          actions.setOutputs(files.filter((f: { category: string }) => f.category === "output"));
        } else {
          actions.setUploads([]);
          actions.setOutputs([]);
        }

        // Load sub-agents for this session
        const agentsRes = await fetch(`/api/cowork/sessions/${sessionId}/agents`);
        if (agentsRes.ok) {
          const agentsData = await agentsRes.json();
          const agents = agentsData.agents || [];
          actions.setSubAgents(agents.map((a: {
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
            status: a.status as "running" | "completed" | "failed" | "cancelled",
            prompt: a.prompt,
            result: a.result,
            model: a.model,
            createdAt: a.createdAt,
            completedAt: a.completedAt,
            turns: a.turns,
            maxTurns: a.maxTurns,
          })));
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
          }
        }
      } catch {
        // Handle error silently
      }
    },
    [actions, state.sessions.active?.id],
  );

  return (
    <div className="cowork-layout">
      <CoworkSidebar
        sessions={state.sessions.list}
        activeSessionId={state.sessions.active?.id || null}
        isOpen={state.ui.sidebarOpen}
        onToggle={actions.toggleSidebar}
        onNewTask={handleCreateSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
      />

      <CoworkCentrePanel
        session={state.sessions.active}
        messages={state.chat.messages}
        todos={state.todos.items}
        isStreaming={state.chat.isStreaming}
        settings={state.settings}
        onToggleSidebar={actions.toggleSidebar}
      />

      <CoworkRightPanel
        isOpen={state.ui.rightPanelOpen}
        activeTab={state.ui.rightPanelTab}
        activeArtifact={state.files.activeArtifact}
        uploads={state.files.uploads}
        outputs={state.files.outputs}
        onToggle={actions.toggleRightPanel}
        onTabChange={actions.setRightPanelTab}
        onSelectFile={actions.setActiveArtifact}
      />
    </div>
  );
}
