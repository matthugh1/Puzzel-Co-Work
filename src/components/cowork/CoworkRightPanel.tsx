"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  CoworkFileRecord,
  CoworkTodoItem,
  SessionStep,
} from "@/types/cowork";
import { ArtifactRenderer } from "@/components/cowork/ArtifactRenderer";
import { CoworkTodoWidget } from "@/components/cowork/CoworkTodoWidget";
import {
  IconChevronRight,
  IconChevronDown,
  IconFile,
  IconFolder,
  IconCheckCircle,
  IconExternalLink,
  IconZap,
} from "@/components/cowork/icons";
import { FeedbackSummarySection } from "@/components/cowork/FeedbackSummarySection";

const TOOL_CATEGORIES = [
  {
    title: "File Operations",
    tools: ["Read", "Write", "Edit", "Delete", "Glob", "Grep"],
  },
  { title: "Commands & Shell", tools: ["Bash"] },
  { title: "Web", tools: ["WebSearch", "WebFetch"] },
  { title: "Documents", tools: ["CreateDocument", "CreateSpreadsheet"] },
  {
    title: "Task & Coordination",
    tools: [
      "TodoWrite",
      "Task",
      "Skill",
      "AskUserQuestion",
      "GetSubAgentResults",
    ],
  },
  { title: "Plan", tools: ["EnterPlanMode", "ExitPlanMode"] },
];

const CONNECTORS = [
  { name: "Web search", icon: IconExternalLink },
  { name: "Web fetch", icon: IconExternalLink },
];

interface CoworkRightPanelProps {
  isOpen: boolean;
  activeSessionId: string | null;
  activeArtifact: CoworkFileRecord | null;
  uploads: CoworkFileRecord[];
  outputs: CoworkFileRecord[];
  todos: CoworkTodoItem[];
  toolsUsedInChat: string[];
  sessionSteps: SessionStep[];
  assistantMessageIds?: string[];
  onToggle: () => void;
  onSelectFile: (file: CoworkFileRecord | null) => void;
  onOpenCreateSkill?: () => void;
}

export function CoworkRightPanel({
  isOpen,
  activeSessionId,
  activeArtifact,
  uploads,
  outputs,
  todos,
  toolsUsedInChat,
  sessionSteps,
  assistantMessageIds = [],
  onToggle,
  onSelectFile,
  onOpenCreateSkill,
}: CoworkRightPanelProps) {
  const [progressOpen, setProgressOpen] = useState(true);
  const [artifactsOpen, setArtifactsOpen] = useState(true);
  const [workingOpen, setWorkingOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const recentSteps = useMemo(
    () =>
      sessionSteps.map((s) => ({
        name: s.name,
        summary: s.resultSummary ?? s.inputSummary,
      })),
    [sessionSteps],
  );

  // When user selects a file, expand the relevant section
  useEffect(() => {
    if (activeArtifact) {
      const isOutput = outputs.some((f) => f.id === activeArtifact.id);
      if (isOutput) setArtifactsOpen(true);
      else setWorkingOpen(true);
    }
  }, [activeArtifact, outputs]);

  if (!isOpen) {
    return null;
  }

  // Determine which sections have content
  const hasProgress = recentSteps.length > 0 || todos.length > 0;
  const hasArtifacts = outputs.length > 0;
  const hasFiles = uploads.length > 0;
  const hasAnything = hasProgress || hasArtifacts || hasFiles;
  const allFiles = [...uploads, ...outputs];

  return (
    <div className="cowork-right-panel" style={{ position: "relative" }}>
      <button
        className="cowork-right-panel__toggle"
        onClick={onToggle}
        aria-label="Close panel"
      >
        <IconChevronRight size={14} />
      </button>

      {/* ── Panel header ── */}
      <div className="cw-rpanel-header">
        <span className="cw-rpanel-header__title">Session details</span>
        {onOpenCreateSkill && (
          <button
            type="button"
            className="cw-rpanel-header__action"
            onClick={onOpenCreateSkill}
            title="Create a skill for this session"
          >
            <IconZap size={14} />
            <span>Create skill</span>
          </button>
        )}
      </div>

      <div className="cowork-right-panel__sections">
        {/* ── Progress — only when there are steps or todos ── */}
        {hasProgress && (
          <section className="cowork-right-panel__section">
            <button
              type="button"
              className="cowork-right-panel__section-header"
              onClick={() => setProgressOpen(!progressOpen)}
              aria-expanded={progressOpen}
            >
              {progressOpen ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
              <span>Progress</span>
              {todos.length > 0 ? (
                <span className="cowork-right-panel__section-badge">
                  {todos.filter((t) => t.status === "completed").length}/
                  {todos.length}
                </span>
              ) : recentSteps.length > 0 ? (
                <span className="cowork-right-panel__section-badge">
                  {recentSteps.length} steps
                </span>
              ) : null}
            </button>
            {progressOpen && (
              <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
                {/* Todo widget is the primary progress view */}
                {todos.length > 0 && (
                  <div className="cowork-right-panel__progress-tasks">
                    <CoworkTodoWidget items={todos} />
                  </div>
                )}
                {/* Session steps are secondary — only show when no todos, or as a compact log */}
                {recentSteps.length > 0 && todos.length === 0 && (
                  <div className="cowork-right-panel__progress-list">
                    {recentSteps.map((step, i) => (
                      <div
                        key={`${step.name}-${i}`}
                        className="cowork-right-panel__progress-item"
                      >
                        <IconCheckCircle
                          size={14}
                          className="cw-rpanel-icon--success"
                          aria-hidden
                        />
                        <span className="cowork-right-panel__progress-label">
                          {step.summary
                            ? `${step.name}: ${step.summary}`
                            : step.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Feedback — always rendered (FeedbackSummarySection handles its own visibility) ── */}
        <FeedbackSummarySection
          sessionId={activeSessionId}
          messageIdsInOrder={assistantMessageIds}
        />

        {/* ── Artifacts — only when there are generated files ── */}
        {hasArtifacts && (
          <section className="cowork-right-panel__section">
            <button
              type="button"
              className="cowork-right-panel__section-header"
              onClick={() => setArtifactsOpen(!artifactsOpen)}
              aria-expanded={artifactsOpen}
            >
              {artifactsOpen ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
              <span>Artifacts</span>
              <span className="cowork-right-panel__section-badge">
                {outputs.length}
              </span>
            </button>
            {artifactsOpen && (
              <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
                <div className="cowork-right-panel__file-list">
                  <div className="cowork-right-panel__file-group">
                    {outputs.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        className={`cowork-right-panel__file-item ${activeArtifact?.id === file.id ? "cowork-right-panel__file-item--active" : ""}`}
                        onClick={() =>
                          onSelectFile(
                            activeArtifact?.id === file.id ? null : file,
                          )
                        }
                      >
                        <IconFile size={14} />
                        <span>{file.fileName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {activeArtifact &&
                  outputs.some((f) => f.id === activeArtifact.id) && (
                    <div className="cowork-right-panel__artifact-preview">
                      <ArtifactRenderer
                        artifact={activeArtifact}
                        onClose={() => onSelectFile(null)}
                      />
                    </div>
                  )}
              </div>
            )}
          </section>
        )}

        {/* ── Working folder — only when there are uploads ── */}
        {hasFiles && (
          <section className="cowork-right-panel__section">
            <button
              type="button"
              className="cowork-right-panel__section-header"
              onClick={() => setWorkingOpen(!workingOpen)}
              aria-expanded={workingOpen}
            >
              {workingOpen ? (
                <IconChevronDown size={14} />
              ) : (
                <IconChevronRight size={14} />
              )}
              <span>Working folder</span>
              <span className="cowork-right-panel__section-badge">
                {allFiles.length}
              </span>
            </button>
            {workingOpen && (
              <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
                <div className="cowork-right-panel__file-list">
                  {uploads.length > 0 && (
                    <div className="cowork-right-panel__file-group">
                      <span className="cowork-right-panel__file-group-title">
                        Uploads
                      </span>
                      {uploads.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className={`cowork-right-panel__file-item ${activeArtifact?.id === file.id ? "cowork-right-panel__file-item--active" : ""}`}
                          onClick={() =>
                            onSelectFile(
                              activeArtifact?.id === file.id ? null : file,
                            )
                          }
                        >
                          <IconFile size={14} />
                          <span>{file.fileName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {outputs.length > 0 && (
                    <div className="cowork-right-panel__file-group">
                      <span className="cowork-right-panel__file-group-title">
                        Outputs
                      </span>
                      {outputs.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          className={`cowork-right-panel__file-item ${activeArtifact?.id === file.id ? "cowork-right-panel__file-item--active" : ""}`}
                          onClick={() =>
                            onSelectFile(
                              activeArtifact?.id === file.id ? null : file,
                            )
                          }
                        >
                          <IconFile size={14} />
                          <span>{file.fileName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Empty state — only when nothing to show at all ── */}
        {!hasAnything && (
          <div className="cw-rpanel-empty-state">
            <div className="cw-rpanel-empty-state__icon">
              <IconFolder size={32} />
            </div>
            <p className="cw-rpanel-empty-state__title">Nothing here yet</p>
            <p className="cw-rpanel-empty-state__desc">
              As you work with the agent, progress, files, and artifacts will
              appear here.
            </p>
          </div>
        )}

        {/* ── Context — always available but collapsed by default, at the bottom ── */}
        <section className="cowork-right-panel__section cw-rpanel-context-section">
          <button
            type="button"
            className="cowork-right-panel__section-header"
            onClick={() => setContextOpen(!contextOpen)}
            aria-expanded={contextOpen}
          >
            {contextOpen ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
            <span>Context</span>
            {toolsUsedInChat.length > 0 && !contextOpen && (
              <span className="cowork-right-panel__section-badge">
                {toolsUsedInChat.length} used
              </span>
            )}
          </button>
          {contextOpen && (
            <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
              {toolsUsedInChat.length > 0 && (
                <div className="cw-rpanel-context-used">
                  <span className="cw-rpanel-context-used__label">
                    Used in this chat
                  </span>
                  <div className="cw-rpanel-context-used__pills">
                    {toolsUsedInChat.map((name) => (
                      <span
                        key={name}
                        className="cowork-right-panel__context-pill cowork-right-panel__context-pill--used"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="cowork-right-panel__context-group">
                <span className="cowork-right-panel__context-group-title">
                  Connectors
                </span>
                <div className="cowork-right-panel__context-items">
                  {CONNECTORS.map((c) => (
                    <div
                      key={c.name}
                      className="cowork-right-panel__context-item"
                    >
                      <c.icon size={14} className="cw-rpanel-icon--muted" />
                      <span>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cowork-right-panel__context-group">
                <span className="cowork-right-panel__context-group-title">
                  Available tools
                </span>
                <div className="cowork-right-panel__context-tools">
                  {TOOL_CATEGORIES.map((cat) => (
                    <div
                      key={cat.title}
                      className="cowork-right-panel__context-tools-cat"
                    >
                      <span className="cowork-right-panel__context-tools-cat-title">
                        {cat.title}
                      </span>
                      <div className="cowork-right-panel__context-tools-pills">
                        {cat.tools.map((name) => (
                          <span
                            key={name}
                            className={`cowork-right-panel__context-pill ${toolsUsedInChat.includes(name) ? "cowork-right-panel__context-pill--used" : ""}`}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
