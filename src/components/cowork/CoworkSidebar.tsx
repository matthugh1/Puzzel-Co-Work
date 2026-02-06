"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoworkSession } from "@/types/cowork";
import {
  IconPlus,
  IconMenu,
  IconMessageSquare,
  IconSettings,
  IconTrash,
  IconPackage,
} from "@/components/cowork/icons";

interface CoworkSidebarProps {
  sessions: CoworkSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onNewTask: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

export function CoworkSidebar({
  sessions,
  activeSessionId,
  isOpen,
  onToggle,
  onNewTask,
  onSelectSession,
  onDeleteSession,
}: CoworkSidebarProps) {
  const router = useRouter();
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    setContextMenu(contextMenu === sessionId ? null : sessionId);
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case "active":
        return "#22c55e";
      case "idle":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  return (
    <aside className={`cowork-sidebar ${isOpen ? "cowork-sidebar--open" : "cowork-sidebar--collapsed"}`}>
      {/* Header */}
      <div className="cowork-sidebar__header">
        <button
          className="cowork-sidebar__toggle-btn"
          onClick={onToggle}
          aria-label="Toggle sidebar"
        >
          <IconMenu size={18} />
        </button>
        <h2>Cowork</h2>
      </div>

      {/* New task button */}
      <div className="cowork-sidebar__new-task">
        <button className="cowork-sidebar__new-task-btn" onClick={onNewTask}>
          <IconPlus size={16} />
          <span>New Task</span>
        </button>
      </div>

      {/* Sessions */}
      <div className="cowork-sidebar__section-title">Recent</div>
      <div className="cowork-sidebar__list">
        {sessions.length === 0 ? (
          <div style={{ padding: "16px 10px", fontSize: "0.8125rem", color: "var(--cw-sidebar-text-muted)", textAlign: "center" }}>
            No sessions yet
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} style={{ position: "relative" }}>
              <button
                className={`cowork-sidebar__item ${
                  activeSessionId === session.id ? "cowork-sidebar__item--active" : ""
                }`}
                onClick={() => onSelectSession(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)}
                title={session.title}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: getStatusDot(session.status),
                      flexShrink: 0,
                    }}
                  />
                  <span className="cowork-sidebar__item-text" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {session.title}
                  </span>
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--cw-sidebar-text-muted)", flexShrink: 0 }}>
                  {formatTime(session.updatedAt)}
                </span>
              </button>

              {contextMenu === session.id && (
                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "100%",
                    background: "var(--cw-sidebar-bg-active)",
                    border: "1px solid var(--cw-sidebar-border)",
                    borderRadius: 8,
                    padding: 4,
                    zIndex: 100,
                    minWidth: 120,
                  }}
                >
                  <button
                    className="cowork-sidebar__item"
                    style={{ color: "#ef4444", padding: "6px 10px", fontSize: "0.8125rem", gap: "8px" }}
                    onClick={() => {
                      onDeleteSession(session.id);
                      setContextMenu(null);
                    }}
                  >
                    <IconTrash size={14} />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="cowork-sidebar__footer">
        <button className="cowork-sidebar__item" style={{ opacity: 0.5 }} disabled>
          <IconPackage size={16} />
          <span className="cowork-sidebar__footer-text">Plugins</span>
        </button>
        <button className="cowork-sidebar__item" onClick={() => router.push("/cowork/settings")}>
          <IconSettings size={16} />
          <span className="cowork-sidebar__footer-text">Settings</span>
        </button>
      </div>
    </aside>
  );
}
