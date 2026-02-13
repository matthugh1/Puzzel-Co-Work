"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoworkSession } from "@/types/cowork";
import {
  IconPlus,
  IconMenu,
  IconSettings,
  IconTrash,
  IconZap,
  IconWrench,
  IconList,
} from "@/components/cowork/icons";

interface CoworkSidebarProps {
  sessions: CoworkSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onNewTask: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenCreateSkill?: () => void;
}

export function CoworkSidebar({
  sessions,
  activeSessionId,
  isOpen,
  onToggle,
  onNewTask,
  onSelectSession,
  onDeleteSession,
  onOpenCreateSkill,
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
    <aside
      className={`cowork-sidebar ${isOpen ? "cowork-sidebar--open" : "cowork-sidebar--collapsed"}`}
    >
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
          <div
            style={{
              padding: "16px 10px",
              fontSize: "0.8125rem",
              color: "var(--cw-sidebar-text-muted)",
              textAlign: "center",
            }}
          >
            No sessions yet
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} style={{ position: "relative" }}>
              <button
                className={`cowork-sidebar__item ${
                  activeSessionId === session.id
                    ? "cowork-sidebar__item--active"
                    : ""
                }`}
                onClick={() => onSelectSession(session.id)}
                onContextMenu={(e) => handleContextMenu(e, session.id)}
                title={session.title}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: getStatusDot(session.status),
                      flexShrink: 0,
                    }}
                  />
                  <span
                    className="cowork-sidebar__item-text"
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {session.title}
                  </span>
                </span>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--cw-sidebar-text-muted)",
                    flexShrink: 0,
                  }}
                >
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
                    style={{
                      color: "#ef4444",
                      padding: "6px 10px",
                      fontSize: "0.8125rem",
                      gap: "8px",
                    }}
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

      {/* Skills & Tools */}
      <div className="cowork-sidebar__section-title">Extensions</div>
      <div className="cowork-sidebar__list" style={{ marginBottom: 8 }}>
        <button
          className="cowork-sidebar__item"
          onClick={() =>
            onOpenCreateSkill
              ? onOpenCreateSkill()
              : router.push("/cowork/skills")
          }
          title="Create a skill in chat"
        >
          <IconZap size={16} />
          <span className="cowork-sidebar__footer-text">New Skill</span>
        </button>
        <button
          className="cowork-sidebar__item"
          onClick={() =>
            router.push(
              activeSessionId
                ? `/cowork/skills?sessionId=${encodeURIComponent(activeSessionId)}`
                : "/cowork/skills",
            )
          }
          title="View built-in and custom skills"
        >
          <IconList size={16} />
          <span className="cowork-sidebar__footer-text">Skills</span>
        </button>
        <button
          className="cowork-sidebar__item"
          onClick={() => router.push("/cowork/settings?tab=tools")}
          title="Add MCP or connector tools"
        >
          <IconWrench size={16} />
          <span className="cowork-sidebar__footer-text">New Tool</span>
        </button>
      </div>

      {/* Footer */}
      <div className="cowork-sidebar__footer">
        <button
          className="cowork-sidebar__item"
          onClick={() => router.push("/cowork/settings")}
        >
          <IconSettings size={16} />
          <span className="cowork-sidebar__footer-text">Settings</span>
        </button>
      </div>
    </aside>
  );
}
