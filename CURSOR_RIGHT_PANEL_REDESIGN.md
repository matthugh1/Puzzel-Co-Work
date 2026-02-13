# Cursor Implementation Plan: Right Panel Redesign

**Problem:** The right panel is static, cluttered, and shows too many empty sections. It currently has 7 sections, most of which show placeholder text when empty. The "Context" section is a wall of tool pills that never changes. The "Workflow" section says "Coming soon". It feels like a settings dump, not a dynamic companion panel.

**Goal:** Make the right panel feel alive, contextual, and useful — only showing sections that have content, with better visual hierarchy and a cleaner information density.

---

## Design Principles

1. **Hide empty sections entirely** — don't show a section with "No artifacts yet" placeholder text. Only show sections that have data.
2. **Collapse Context by default** — the tools/connectors list is static reference info, not something users look at every session. Start it collapsed and tuck it at the bottom.
3. **Remove "Workflow - Coming soon"** — unfinished features shouldn't be visible.
4. **Remove "Create skill" from the panel body** — it's a one-off action, not a persistent section. Move it to a small button in the panel header or keep it only as the existing right-panel action.
5. **Add a panel header with session title** — gives the panel visual identity instead of just stacked sections.
6. **Improve empty state** — when there's truly nothing to show (new session, no messages yet), show ONE clean empty state, not 7 collapsed sections.

---

## Task 1: Restructure CoworkRightPanel.tsx

### File: `src/components/cowork/CoworkRightPanel.tsx`

Replace the entire file content with the redesigned version below. The key changes are:

- **Panel header** with session title and a "Create skill" action button
- **Conditional sections** — only render Progress, Feedback, Artifacts, and Working Folder when they have content
- **Context section** starts collapsed, moved to bottom
- **Workflow section removed** entirely (the state + toggle logic can be deleted)
- **Smart empty state** — if no sections have content, show a single helpful message
- **Section animations** — add a CSS class for smooth open/close

```tsx
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
              {todos.length > 0 && (
                <span className="cowork-right-panel__section-badge">
                  {todos.filter((t) => t.status === "completed").length}/
                  {todos.length}
                </span>
              )}
            </button>
            {progressOpen && (
              <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
                {recentSteps.length > 0 && (
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
                {todos.length > 0 && (
                  <div className="cowork-right-panel__progress-tasks">
                    <CoworkTodoWidget items={todos} />
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
```

### Key changes from original:

- **Removed** `workflowOpen`, `workflowStepIds`, `toggleWorkflowStep` state + the entire Workflow section
- **Removed** the "Create skill" body section — it's now a header button
- **Removed** `IconGitBranch` import (no longer needed)
- **Conditional rendering** — Progress, Artifacts, Working folder only render when they have data
- **New panel header** with "Session details" title and "Create skill" button
- **Empty state** — single, clean message when nothing exists
- **Section badges** show counts (e.g. "3/5" for todos, "2" for artifacts)
- **Context starts collapsed** and sits at the bottom
- **Animation class** `cw-rpanel-animate-in` on section content for smooth appearance

---

## Task 2: Add New CSS Classes

### File: `src/app/globals.css`

Add these styles at the end of the file (after existing rules):

```css
/* ============================================================================
   RIGHT PANEL REDESIGN — Header, Empty State, Animations
   ============================================================================ */

/* Panel header */
.cw-rpanel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border-muted);
}

.cw-rpanel-header__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.01em;
}

.cw-rpanel-header__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: var(--font-body);
  color: var(--cw-accent);
  background: var(--cw-accent-soft);
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cw-rpanel-header__action:hover {
  background: var(--color-primary-20);
  border-color: var(--cw-accent);
}

/* Empty state (full panel) */
.cw-rpanel-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 48px 32px;
  flex: 1;
}

.cw-rpanel-empty-state__icon {
  color: var(--color-border-strong);
  margin-bottom: 16px;
}

.cw-rpanel-empty-state__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin: 0 0 6px;
}

.cw-rpanel-empty-state__desc {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 240px;
  line-height: 1.5;
}

/* Section content fade-in animation */
@keyframes rpanelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cw-rpanel-animate-in {
  animation: rpanelSlideIn 0.2s ease both;
}

/* Icon utility classes (replace inline style={{ color, opacity }}) */
.cw-rpanel-icon--success {
  color: var(--cw-success);
  flex-shrink: 0;
}

.cw-rpanel-icon--muted {
  opacity: 0.7;
}

/* Context section — sits at the bottom with subtle separation */
.cw-rpanel-context-section {
  margin-top: auto;
  border-top: 1px solid var(--color-border-muted);
  border-bottom: none !important;
}

/* Context "used in chat" sub-section */
.cw-rpanel-context-used {
  margin-bottom: 12px;
}

.cw-rpanel-context-used__label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: 6px;
}

.cw-rpanel-context-used__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
```

---

## Task 3: Update FeedbackSummarySection to Hide When Empty

The FeedbackSummarySection currently always shows even when collapsed and there's no feedback. Update it so it only renders when there IS feedback, or when the user has explicitly opened it.

### File: `src/components/cowork/FeedbackSummarySection.tsx`

Replace the component with this version that hides itself when there's no feedback and it's closed:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { IconChevronDown, IconChevronRight } from "@/components/cowork/icons";

export interface SessionFeedbackItem {
  id: string;
  messageId: string;
  rating: string;
  comment: string | null;
  createdAt: string;
}

interface FeedbackSummarySectionProps {
  sessionId: string | null;
  messageIdsInOrder?: string[];
}

export function FeedbackSummarySection({
  sessionId,
  messageIdsInOrder = [],
}: FeedbackSummarySectionProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<SessionFeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!sessionId) {
      setFeedback([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cowork/sessions/${sessionId}/feedback`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback || []);
      } else {
        setFeedback([]);
      }
    } catch {
      setFeedback([]);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [sessionId]);

  // Fetch once on mount (to know if there's feedback to show the section)
  useEffect(() => {
    if (sessionId && !hasFetched) {
      fetchFeedback();
    }
  }, [sessionId, hasFetched, fetchFeedback]);

  // Re-fetch when opened
  useEffect(() => {
    if (open && sessionId) {
      fetchFeedback();
    }
  }, [open, sessionId, fetchFeedback]);

  const negativeFeedback = feedback.filter((f) => f.rating === "negative");

  // If we've fetched and there's no feedback, hide the section entirely
  if (hasFetched && negativeFeedback.length === 0 && !open) {
    return null;
  }

  const getMessageLabel = (messageId: string): string => {
    const idx = messageIdsInOrder.indexOf(messageId);
    if (idx >= 0) return `Message #${idx + 1}`;
    return "Message";
  };

  return (
    <section className="cowork-right-panel__section">
      <button
        type="button"
        className="cowork-right-panel__section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? (
          <IconChevronDown size={14} aria-hidden />
        ) : (
          <IconChevronRight size={14} aria-hidden />
        )}
        <span>Feedback</span>
        {negativeFeedback.length > 0 && !open && (
          <span
            className="cowork-right-panel__section-badge"
            aria-label={`${negativeFeedback.length} issues flagged`}
          >
            {negativeFeedback.length}
          </span>
        )}
      </button>
      {open && (
        <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
          {loading ? (
            <div className="cowork-right-panel__empty">
              <span>Loading feedback...</span>
            </div>
          ) : negativeFeedback.length === 0 ? (
            <div className="cowork-right-panel__empty">
              <span>No issues flagged in this session</span>
            </div>
          ) : (
            <>
              <p className="cw-rpanel-feedback-count">
                {negativeFeedback.length} message
                {negativeFeedback.length !== 1 ? "s" : ""} flagged
              </p>
              <ul className="cw-rpanel-feedback-list">
                {negativeFeedback.map((f) => (
                  <li key={f.id} className="cw-rpanel-feedback-item">
                    <span className="cw-rpanel-feedback-item__label">
                      {getMessageLabel(f.messageId)}:
                    </span>{" "}
                    {f.comment?.trim() || "No comment"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
```

### Add to `globals.css`:

```css
/* Feedback section (right panel) */
.cw-rpanel-feedback-count {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 8px;
}

.cw-rpanel-feedback-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cw-rpanel-feedback-item {
  font-size: 0.8125rem;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-muted);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.cw-rpanel-feedback-item:last-child {
  border-bottom: none;
}

.cw-rpanel-feedback-item__label {
  font-weight: 600;
  color: var(--color-text);
}
```

---

## Task 4: Verify & Clean Up

### Verify these behaviours:

1. **New session (no messages sent yet):**
   - Panel shows header "Session details" with "Create skill" button
   - Single clean empty state: "Nothing here yet" with folder icon
   - Context section collapsed at the bottom
   - NO empty sections for Progress, Feedback, Artifacts, or Working Folder

2. **After sending a message that produces todos:**
   - Progress section appears with todo widget
   - Badge shows "2/5" style progress count

3. **After agent creates a file:**
   - Artifacts section appears with file list
   - Badge shows file count
   - Clicking a file shows the artifact preview

4. **After uploading a file:**
   - Working folder section appears
   - Badge shows total file count

5. **Expanding Context:**
   - Shows connectors and tool pills
   - Badge on collapsed state shows "N used" if tools have been used

6. **After giving negative feedback:**
   - Feedback section appears with badge count
   - Expanding shows feedback items

7. **No section shows empty placeholder text** — sections simply don't exist until they have data.

### Check build:

```bash
npm run build
```

Must compile cleanly with no TypeScript errors.

---

## Summary of What Changed

| Before                                            | After                                     |
| ------------------------------------------------- | ----------------------------------------- |
| 7 sections always visible                         | 2–5 sections, only when they have content |
| Empty state per section ("No artifacts yet")      | Single panel-level empty state            |
| "Workflow — Coming soon"                          | Removed entirely                          |
| "Create skill" as a body section with description | Small pill button in panel header         |
| Context section open by default, huge tool wall   | Collapsed by default, tucked at bottom    |
| Feedback section always visible even with no data | Hidden until there's negative feedback    |
| No section badges or counts                       | Badges showing "3/5", "2", "N used"       |
| No panel header                                   | Clean header with title + action          |
| No animations on section open                     | Subtle fade-in animation on expand        |
| Inline styles on icons and text                   | CSS utility classes                       |
