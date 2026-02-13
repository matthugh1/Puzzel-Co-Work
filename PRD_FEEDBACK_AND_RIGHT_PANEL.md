# Puzzel Co-Work: Feedback & Right Panel PRD

> **How Claude Cowork handles user feedback and the right-hand panel, how Puzzel Co-Work works today, and what needs to change.**
>
> Version 1.0 · February 2026 · Author: Claude (AI) for Matt Hughes

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How Claude Cowork Handles Feedback](#2-how-claude-cowork-handles-feedback)
   - 2.1 [Message-Level Feedback (Thumbs Up/Down)](#21-message-level-feedback-thumbs-updown)
   - 2.2 [Inline Feedback During Execution](#22-inline-feedback-during-execution)
   - 2.3 [Artifact Feedback](#23-artifact-feedback)
   - 2.4 [Iterative Correction (Chat-Based Feedback)](#24-iterative-correction-chat-based-feedback)
   - 2.5 [TodoWrite as Progress Feedback](#25-todowrite-as-progress-feedback)
   - 2.6 [Skill Activation Feedback](#26-skill-activation-feedback)
   - 2.7 [Permission Requests as Feedback Gates](#27-permission-requests-as-feedback-gates)
   - 2.8 [Plan Mode as Structured Feedback](#28-plan-mode-as-structured-feedback)
   - 2.9 [AskUserQuestion as Proactive Feedback](#29-askuserquestion-as-proactive-feedback)
3. [How Claude Cowork's Right Panel Works](#3-how-claude-coworks-right-panel-works)
   - 3.1 [Panel Layout and Behaviour](#31-panel-layout-and-behaviour)
   - 3.2 [File Sharing and computer:// Links](#32-file-sharing-and-computer-links)
   - 3.3 [Artifact Rendering](#33-artifact-rendering)
   - 3.4 [TodoList Widget](#34-todolist-widget)
4. [Current Puzzel Co-Work State](#4-current-puzzel-co-work-state)
   - 4.1 [Right Panel (5 Sections)](#41-right-panel-5-sections)
   - 4.2 [Message Feedback](#42-message-feedback)
   - 4.3 [Artifact System](#43-artifact-system)
   - 4.4 [Inline Feedback Mechanisms](#44-inline-feedback-mechanisms)
5. [Gap Analysis](#5-gap-analysis)
6. [Implementation Plan](#6-implementation-plan)
   - 6.1 [Phase 1: Message-Level Thumbs Up/Down](#61-phase-1-message-level-thumbs-updown)
   - 6.2 [Phase 2: Artifact Feedback Actions](#62-phase-2-artifact-feedback-actions)
   - 6.3 [Phase 3: Right Panel Enhancements](#63-phase-3-right-panel-enhancements)
   - 6.4 [Phase 4: Iterative Feedback Loop](#64-phase-4-iterative-feedback-loop)
7. [Database Schema Changes](#7-database-schema-changes)
8. [API Routes](#8-api-routes)
9. [Component Architecture](#9-component-architecture)
10. [SSE Events](#10-sse-events)

---

## 1. Executive Summary

Claude Cowork's feedback system is **not** a single feature — it's a collection of mechanisms woven throughout the entire user experience. There is no standalone "feedback panel." Instead, feedback flows through multiple channels: thumbs up/down on messages, iterative corrections via chat, permission approval/denial gates, plan approval/rejection, AskUserQuestion interactions, and TodoWrite progress visibility.

The right-hand panel in Claude Cowork is primarily a **file workspace** — it shows artifacts (files the agent created) with inline previews, not a feedback dashboard. Feedback happens in the chat itself.

This PRD documents every feedback mechanism in Claude Cowork, maps it to the current Puzzel implementation, and provides a detailed implementation plan for closing the gaps.

---

## 2. How Claude Cowork Handles Feedback

### 2.1 Message-Level Feedback (Thumbs Up/Down)

Every assistant message in Claude Cowork has a **thumbs down button** that appears on hover. This is the primary explicit feedback mechanism.

**How it works:**

- A thumbs-down icon appears at the bottom-right of every assistant message when the user hovers over it
- Clicking it opens a feedback form where the user can optionally describe what went wrong
- The feedback is sent to Anthropic for model improvement
- The system prompt references this: _"If the person seems unhappy or unsatisfied with Claude or Claude's responses, Claude can let the person know that they can press the 'thumbs down' button below any of Claude's responses to provide feedback to Anthropic."_
- There is no thumbs-up button in the standard interface — the assumption is that no feedback = positive

**Key design decisions:**

- Feedback is **per-message**, not per-session
- It's **unobtrusive** — only appears on hover, doesn't clutter the UI
- It's **optional** — clicking sends a signal, the text description is optional
- There is no explicit "thumbs up" — absence of negative feedback is implicitly positive
- The assistant itself can reference this mechanism when it detects user frustration

### 2.2 Inline Feedback During Execution

While the agent is working, Claude Cowork provides continuous visual feedback in the chat:

**Tool execution visibility:**

- When a tool is called, a collapsible block appears showing the tool name and input
- When the tool returns, the result appears (collapsible, with error highlighting in red)
- This gives the user real-time visibility into what the agent is doing
- The user can see if the agent is going down the wrong path and interrupt

**Text streaming:**

- The assistant's response streams in real-time (character by character)
- This gives immediate feedback that the agent is working, not stuck
- Users can read the response as it forms and decide whether to interrupt

**SSE events that provide execution feedback:**

| Event              | Visual Feedback                                     |
| ------------------ | --------------------------------------------------- |
| `text_delta`       | Text appearing character by character               |
| `tool_use_start`   | "Using tool: X" block appears                       |
| `tool_result`      | Result block appears (green = success, red = error) |
| `todo_update`      | TodoList widget updates in real-time                |
| `skill_activated`  | "Using skill: X" pill appears                       |
| `sub_agent_update` | Sub-agent status badges update                      |
| `message_end`      | Streaming stops, response is complete               |

### 2.3 Artifact Feedback

When the agent creates a file (document, spreadsheet, code, HTML, etc.), Claude Cowork provides immediate feedback through the artifact system:

**How artifacts work:**

1. The agent creates a file using Write, CreateDocument, etc.
2. A `computer://` link is provided in the chat response (e.g., `[View your report](computer:///path/to/file.docx)`)
3. The file appears in the user's workspace folder (persists on their computer)
4. Supported file types render inline: `.md`, `.html`, `.jsx`, `.mermaid`, `.svg`, `.pdf`
5. Other files are downloadable

**Artifact feedback mechanisms:**

- **Visual preview:** The user can see the artifact immediately without opening a separate app
- **Iterative refinement:** If the artifact isn't right, the user can say "change the heading" or "make it more formal" and the agent modifies the file
- **No explicit rating:** There's no thumbs up/down on artifacts — feedback is implicit through whether the user asks for changes

**Key design principle:** The artifact IS the feedback. If the user is happy, they use the file. If not, they ask for changes in the chat. There's no separate rating widget.

### 2.4 Iterative Correction (Chat-Based Feedback)

The most important feedback mechanism in Claude Cowork is **the chat itself**. The user provides feedback by:

- Saying "that's not what I wanted" → the agent corrects course
- Saying "change X to Y" → the agent edits the artifact
- Saying "start over" → the agent re-approaches the task
- Saying "perfect" or "looks good" → the agent knows to proceed
- Uploading a screenshot showing a problem → the agent analyses and fixes it

**The agent is designed to be responsive to this feedback:**

- The system prompt says: _"When Claude makes mistakes, it should own them honestly and work to fix them."_
- The prompt also says: _"If the person seems unhappy or unsatisfied... Claude can let the person know that they can press the 'thumbs down' button."_
- The agent maintains context across the conversation, so corrections build on previous work

**This is the primary feedback loop.** Everything else (thumbs down, permission gates, plan approval) is secondary to the conversational back-and-forth.

### 2.5 TodoWrite as Progress Feedback

The TodoList widget provides **structured progress feedback** to the user:

**How it works:**

- The agent creates a todo list at the start of a complex task
- Each item transitions through states: `pending` → `in_progress` → `completed`
- The widget updates in real-time via SSE `todo_update` events
- The user can see at a glance how far along the agent is
- The `activeForm` field shows what's happening right now (e.g., "Running tests")

**This IS feedback** — it tells the user:

- What the agent plans to do (the full list)
- What it's doing right now (the `in_progress` item)
- What it has completed (the `completed` items)
- How much is left (remaining `pending` items)

**Key rule from the system prompt:** _"Exactly ONE task must be in_progress at any time (not less, not more)."_ This ensures the user always knows exactly what the agent is working on.

### 2.6 Skill Activation Feedback

When the agent invokes a skill, a visual indicator appears:

- A pill/badge appears in the chat: "Using skill: Legal Document Analyser"
- This tells the user which specialised capability is being used
- The `skill_activated` SSE event triggers this UI element

This is a form of **transparency feedback** — the user knows the agent isn't just winging it, it's using a structured skill for the task.

### 2.7 Permission Requests as Feedback Gates

Some tools require user approval before executing. This is a **blocking feedback mechanism**:

- The agent wants to run a Bash command → a permission card appears
- The card shows what the agent wants to do (tool name + input)
- The user clicks "Approve" or "Deny"
- If approved, execution continues; if denied, the agent gets an error and adjusts

**This serves two purposes:**

1. **Security** — prevents the agent from doing something dangerous
2. **Feedback** — the user can redirect the agent by denying and explaining why

### 2.8 Plan Mode as Structured Feedback

When the agent enters plan mode, it proposes a structured plan for user approval:

1. Agent enters plan mode (read-only tools only)
2. Agent explores the codebase and designs an approach
3. Agent calls ExitPlanMode with a plan
4. A plan card appears in the chat with "Approve" / "Reject" buttons
5. User reviews the plan and approves or rejects
6. If rejected, the agent can revise and re-propose

**This is high-level feedback** — the user reviews the agent's strategy before any code is written.

### 2.9 AskUserQuestion as Proactive Feedback

The AskUserQuestion tool lets the agent proactively gather feedback:

- The agent presents multiple-choice options with descriptions
- The user selects one or more options (or types custom input via "Other")
- The agent uses the response to guide its work

**From the system prompt:** _"Claude should always use this tool before starting any real work — research, multi-step tasks, file creation, or any workflow involving multiple steps or tool calls."_

**This is pre-emptive feedback** — the agent asks for direction before going down a path, preventing wasted effort.

---

## 3. How Claude Cowork's Right Panel Works

### 3.1 Panel Layout and Behaviour

Claude Cowork's right panel is **not a feedback dashboard**. It's a **file workspace** that shows:

1. **Artifact previews** — when the agent creates a file, it can be previewed inline
2. **File list** — all files in the workspace folder
3. **TodoList** — the current task list (also shown inline in chat)

The right panel is **secondary to the chat**. Most interaction happens in the centre panel (chat). The right panel supplements it by providing persistent views of files and progress.

**Behaviour:**

- Opens automatically when an artifact is created or selected
- Can be toggled open/closed by the user
- Collapsible sections for different content types
- Artifact preview takes up the main area when a file is selected

### 3.2 File Sharing and computer:// Links

A critical feature of Claude Cowork's feedback loop is the `computer://` link system:

- When the agent creates a file, it provides a clickable link: `[View your report](computer:///path/to/file.docx)`
- Clicking the link opens the file on the user's computer
- The file persists in the user's selected workspace folder
- This is the primary delivery mechanism — the user gets the actual file, not just a preview

**Key rules from the system prompt:**

- _"It is imperative to give users the ability to view their files by putting them in the workspace folder and using computer:// links."_
- _"Claude refrains from excessive or overly descriptive post-ambles after linking the contents."_
- _"The most important thing is that Claude gives the user direct access to their documents — NOT that Claude explains the work it did."_

### 3.3 Artifact Rendering

Claude Cowork renders certain file types inline (without needing to open a separate app):

| File Type | Extension  | Rendering                    |
| --------- | ---------- | ---------------------------- |
| Markdown  | `.md`      | Rendered as formatted HTML   |
| HTML      | `.html`    | Rendered in sandboxed iframe |
| React     | `.jsx`     | Rendered with React runtime  |
| Mermaid   | `.mermaid` | Rendered as diagram          |
| SVG       | `.svg`     | Rendered as vector graphic   |
| PDF       | `.pdf`     | Rendered in PDF viewer       |

Other file types (`.docx`, `.xlsx`, `.py`, etc.) are provided as download links.

### 3.4 TodoList Widget

The TodoList appears both **in the chat** (inline, as a `todo_update` block) and **in the right panel** (persistent, always showing current state).

**In-chat appearance:** Each time TodoWrite is called, a widget appears at that point in the conversation showing the current state of all tasks.

**Right panel appearance:** The right panel's "Progress" section always shows the latest todo state, regardless of where the user has scrolled in the chat.

This dual placement ensures the user always has visibility into progress.

---

## 4. Current Puzzel Co-Work State

### 4.1 Right Panel (5 Sections)

The Puzzel right panel (`CoworkRightPanel.tsx`) currently has 5 collapsible sections:

| Section            | Status         | Contents                                                            |
| ------------------ | -------------- | ------------------------------------------------------------------- |
| **Progress**       | ✅ Working     | Recent steps (tool calls with summaries) + TodoWidget               |
| **Working Folder** | ✅ Working     | Uploads + Outputs file list + ArtifactRenderer preview              |
| **Workflow**       | ⚠️ Placeholder | Checkbox step selection + "Create workflow" button (not functional) |
| **Create Skill**   | ✅ Working     | Opens skill creation modal                                          |
| **Context**        | ✅ Working     | Connectors + Tools list with "used" highlighting                    |

**Props accepted:**

```typescript
interface CoworkRightPanelProps {
  isOpen: boolean;
  activeSessionId: string | null;
  activeArtifact: CoworkFileRecord | null;
  uploads: CoworkFileRecord[];
  outputs: CoworkFileRecord[];
  todos: CoworkTodoItem[];
  toolsUsedInChat: string[];
  sessionSteps: SessionStep[];
  onToggle: () => void;
  onSelectFile: (file: CoworkFileRecord | null) => void;
  onOpenCreateSkill?: () => void;
}
```

### 4.2 Message Feedback

**Status: NOT IMPLEMENTED**

- No thumbs up/down buttons on any messages
- No message rating system
- No feedback form or modal
- No database table for storing feedback
- No API endpoint for submitting feedback
- No state management for feedback
- No CSS classes for feedback UI

The `CoworkMessageItem` component renders message content blocks (text, tool_use, tool_result, etc.) but has no feedback controls at the message level.

### 4.3 Artifact System

**Status: FULLY WORKING**

The `ArtifactRenderer` component supports:

- HTML (sandboxed iframe with CSP)
- Markdown (client-side conversion)
- SVG (inline, script-stripped)
- Images (direct rendering)
- Code (syntax-highlighted)
- PDF (download link)
- Other files (download link with metadata)

**Toolbar actions:** Copy source, open in new tab, download, close.

**No feedback on artifacts** — no rating, no "this is good/bad" UI.

### 4.4 Inline Feedback Mechanisms

**What already works (matching Claude Cowork):**

| Mechanism             | Status     | Notes                                    |
| --------------------- | ---------- | ---------------------------------------- |
| Tool execution blocks | ✅ Working | Shows tool name, input, result           |
| Text streaming        | ✅ Working | Real-time character streaming via SSE    |
| TodoList widget       | ✅ Working | In chat + right panel Progress section   |
| Skill activation pill | ✅ Working | Purple "Using skill: X" badge            |
| Permission requests   | ✅ Working | Approve/Deny cards in chat               |
| Plan approval         | ✅ Working | Plan card with Approve/Reject buttons    |
| AskUserQuestion       | ✅ Working | Multi-choice with radio/checkbox options |
| Sub-agent status      | ✅ Working | Status badges with turn counts           |

**What's missing:**

| Mechanism                  | Status             | Notes                                                        |
| -------------------------- | ------------------ | ------------------------------------------------------------ |
| Thumbs down on messages    | 🔴 Not implemented | No UI, no DB, no API                                         |
| Feedback form/modal        | 🔴 Not implemented | Nowhere for user to describe the issue                       |
| Artifact "View" links      | ⚠️ Partial         | Files are in right panel but no `computer://` style delivery |
| Iterative artifact editing | ⚠️ Partial         | Agent can edit files but no "Edit this" button on artifacts  |

---

## 5. Gap Analysis

| Feature                       | Claude Cowork                         | Puzzel Co-Work     | Priority       |
| ----------------------------- | ------------------------------------- | ------------------ | -------------- |
| Thumbs down on messages       | Hover to reveal, click to open form   | Not implemented    | 🔴 High        |
| Thumbs up on messages         | Not present (no feedback = positive)  | Not implemented    | — (not needed) |
| Feedback text form            | Optional description when thumbs down | Not implemented    | 🔴 High        |
| Tool execution visibility     | Collapsible tool blocks               | ✅ Implemented     | 🟢 Done        |
| Text streaming                | Character-by-character                | ✅ Implemented     | 🟢 Done        |
| TodoList progress             | In-chat + right panel                 | ✅ Implemented     | 🟢 Done        |
| Skill activation indicator    | Pill badge                            | ✅ Implemented     | 🟢 Done        |
| Permission gates              | Approve/Deny cards                    | ✅ Implemented     | 🟢 Done        |
| Plan approval                 | Approve/Reject                        | ✅ Implemented     | 🟢 Done        |
| AskUserQuestion               | Multi-choice options                  | ✅ Implemented     | 🟢 Done        |
| Sub-agent status              | Status badges                         | ✅ Implemented     | 🟢 Done        |
| Artifact inline preview       | Right panel renderer                  | ✅ Implemented     | 🟢 Done        |
| computer:// file links        | Clickable file delivery in chat       | Not implemented    | 🟡 Medium      |
| Artifact copy/download/open   | Toolbar buttons                       | ✅ Implemented     | 🟢 Done        |
| Iterative correction via chat | User says "change X" → agent edits    | ✅ Works naturally | 🟢 Done        |
| Right panel file browser      | Uploads + Outputs                     | ✅ Implemented     | 🟢 Done        |
| Right panel progress          | Steps + todos                         | ✅ Implemented     | 🟢 Done        |
| Right panel context/tools     | Tool listing with "used" highlight    | ✅ Implemented     | 🟢 Done        |
| Workflow builder              | Create workflow from steps            | ⚠️ Placeholder     | 🟡 Medium      |

**Summary:** The only significant gap is **message-level thumbs down + feedback form**. Everything else is either already implemented or works naturally through the chat.

---

## 6. Implementation Plan

### 6.1 Phase 1: Message-Level Thumbs Down (High Priority)

This is the primary feedback mechanism missing from Puzzel Co-Work.

#### 6.1.1 UI Component: MessageFeedbackButton

Add a feedback button that appears on hover for every assistant message.

**Location:** Inside `CoworkMessageItem.tsx`, after the message content.

**Behaviour:**

- Hidden by default, appears on hover over the message (CSS `:hover` on `.cowork-message--assistant`)
- Shows a single thumbs-down icon (small, muted colour, bottom-right of message)
- Clicking the icon toggles a compact feedback form inline (not a modal)
- The form has: optional text input ("What went wrong?") + "Submit" button
- After submission: icon changes to "Feedback sent" state (muted, non-interactive)
- Optionally include a thumbs-up icon as well (Claude Cowork doesn't, but it's useful for Puzzel's own analytics)

**Component structure:**

```
CoworkMessageItem
  ├── Avatar
  ├── Message body
  │   ├── Role label
  │   ├── Content blocks (text, tools, etc.)
  │   └── MessageFeedbackBar (NEW)
  │       ├── ThumbsDown button (always visible on hover)
  │       ├── ThumbsUp button (optional, always visible on hover)
  │       └── FeedbackForm (shown when thumbs down clicked)
  │           ├── Text input ("What went wrong?")
  │           └── Submit button
  └──
```

#### 6.1.2 CSS

```css
/* Feedback bar — appears on hover */
.cowork-message-feedback {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.cowork-message--assistant:hover .cowork-message-feedback {
  opacity: 1;
}

.cowork-message-feedback__btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition:
    color 0.15s ease,
    background 0.15s ease;
}

.cowork-message-feedback__btn:hover {
  color: var(--color-text);
  background: var(--color-surface-secondary);
}

.cowork-message-feedback__btn--active {
  color: var(--color-primary);
}

.cowork-message-feedback__btn--submitted {
  color: var(--color-text-muted);
  cursor: default;
  opacity: 0.5;
}

/* Feedback form — slides down when thumbs down clicked */
.cowork-message-feedback__form {
  margin-top: 8px;
  padding: 12px;
  background: var(--color-surface-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.cowork-message-feedback__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  background: var(--color-background);
  color: var(--color-text);
  resize: vertical;
  min-height: 60px;
}

.cowork-message-feedback__submit {
  margin-top: 8px;
  padding: 6px 16px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  cursor: pointer;
}
```

#### 6.1.3 Database Model

```prisma
model CoworkMessageFeedback {
  id            String   @id @default(cuid())
  messageId     String
  sessionId     String
  userId        String
  organizationId String
  rating        String   // "positive" | "negative"
  comment       String?  @db.Text
  createdAt     DateTime @default(now())

  message       CoworkMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  session       CoworkSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([messageId])
  @@index([sessionId])
  @@index([organizationId])
}
```

#### 6.1.4 API Route

```
POST /api/cowork/sessions/:sessionId/messages/:messageId/feedback
Body: { rating: "positive" | "negative", comment?: string }
Response: { id: string, rating: string }
```

#### 6.1.5 State Management

Add to `CoworkAppState.chat`:

```typescript
messageFeedback: Record<string, "positive" | "negative">; // messageId → rating
```

Add actions:

```typescript
SET_MESSAGE_FEEDBACK: {
  messageId: string;
  rating: "positive" | "negative";
}
```

---

### 6.2 Phase 2: Artifact Feedback Actions (Medium Priority)

Enhance the artifact toolbar in the right panel to include feedback-like actions.

#### Current Toolbar

- Copy source
- Open in new tab
- Download
- Close

#### Proposed Additions

- **"Ask to edit" button** — Pre-fills the chat input with "Please edit [filename]: " so the user can describe changes
- **"Regenerate" button** — Sends a message to the agent: "Please regenerate [filename] with the same requirements"

These aren't traditional feedback buttons, but they enable the iterative correction loop that Claude Cowork relies on.

**Implementation:** Add two buttons to `ArtifactRenderer.tsx` toolbar. Each dispatches a message to the chat input area.

---

### 6.3 Phase 3: Right Panel Enhancements (Medium Priority)

Align the right panel more closely with Claude Cowork's file workspace model.

#### 6.3.1 Remove Workflow Section (or keep as future feature)

The "Workflow" section is a placeholder that doesn't function. Either:

- Remove it entirely to reduce clutter
- Or keep it but collapse it by default with a "Coming soon" label

#### 6.3.2 Add Feedback Summary Section

Add a new collapsible section to the right panel showing session feedback at a glance:

```
Feedback
  2 messages rated 👎
  "The document formatting was wrong" (message #5)
  "Missed the deadline clause" (message #12)
```

This gives the user a persistent view of issues they've flagged, and helps the agent (if re-prompted) to address outstanding concerns.

#### 6.3.3 File Link Delivery

Implement a `puzzel://` or inline download link system similar to Claude Cowork's `computer://` links:

- When the agent creates a file, include a clickable link in the chat response
- Clicking the link either downloads the file or opens it in the right panel preview
- The link should be clearly visible (not buried in text)

---

### 6.4 Phase 4: Iterative Feedback Loop (Low Priority)

These are refinements that make the feedback loop smoother:

#### 6.4.1 "Edit This" Context Menu on Text Blocks

When the user hovers over a text block in an assistant message, show a subtle "Edit" icon. Clicking it pre-fills the input with the selected text for refinement.

#### 6.4.2 Copy Button on Text Blocks

Add a small "Copy" button on hover for any text block, so users can easily copy portions of the response.

#### 6.4.3 Agent Feedback Awareness

Update the system prompt to tell the agent about the feedback system:

```
User feedback:
Users can rate your messages with thumbs up/down and leave comments. If a user has given
negative feedback on a previous message in this session, take extra care to address their
concerns in subsequent responses. Check the session feedback before responding to follow-up
messages.
```

---

## 7. Database Schema Changes

### New Model: CoworkMessageFeedback

```prisma
model CoworkMessageFeedback {
  id              String   @id @default(cuid())
  messageId       String
  sessionId       String
  userId          String
  organizationId  String
  rating          String   // "positive" | "negative"
  comment         String?  @db.Text
  metadata        Json?    // Optional: browser info, feature flags, etc.
  createdAt       DateTime @default(now())

  message         CoworkMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)
  session         CoworkSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId])  // One rating per user per message
  @@index([messageId])
  @@index([sessionId])
  @@index([organizationId])
  @@index([createdAt])
}
```

### Relation Updates

Add to `CoworkMessage`:

```prisma
model CoworkMessage {
  // ... existing fields ...
  feedback  CoworkMessageFeedback[]
}
```

Add to `CoworkSession`:

```prisma
model CoworkSession {
  // ... existing fields ...
  messageFeedback  CoworkMessageFeedback[]
}
```

---

## 8. API Routes

### Message Feedback

| Endpoint                                                       | Method | Purpose                         | Auth     |
| -------------------------------------------------------------- | ------ | ------------------------------- | -------- |
| `/api/cowork/sessions/:sessionId/messages/:messageId/feedback` | POST   | Submit or update feedback       | Required |
| `/api/cowork/sessions/:sessionId/messages/:messageId/feedback` | GET    | Get feedback for a message      | Required |
| `/api/cowork/sessions/:sessionId/feedback`                     | GET    | List all feedback for a session | Required |

### POST Request Body

```typescript
{
  rating: "positive" | "negative";
  comment?: string;
}
```

### POST Response

```typescript
{
  id: string;
  messageId: string;
  rating: string;
  comment: string | null;
  createdAt: string;
}
```

### GET Session Feedback Response

```typescript
{
  feedback: Array<{
    id: string;
    messageId: string;
    rating: string;
    comment: string | null;
    createdAt: string;
  }>;
  summary: {
    total: number;
    positive: number;
    negative: number;
  }
}
```

---

## 9. Component Architecture

### New Components

| Component                | Location                                                      | Purpose                        |
| ------------------------ | ------------------------------------------------------------- | ------------------------------ |
| `MessageFeedbackBar`     | `src/components/cowork/message-blocks/MessageFeedbackBar.tsx` | Thumbs up/down + feedback form |
| `FeedbackSummarySection` | `src/components/cowork/FeedbackSummarySection.tsx`            | Right panel feedback summary   |

### Modified Components

| Component               | Change                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `CoworkMessageItem.tsx` | Add `<MessageFeedbackBar>` after message content for assistant messages |
| `CoworkRightPanel.tsx`  | Add `FeedbackSummarySection` as a new collapsible section               |
| `ArtifactRenderer.tsx`  | Add "Ask to edit" and "Regenerate" buttons to toolbar                   |
| `CoworkCentrePanel.tsx` | Handle feedback state, pass feedback data to message items              |

### Component Tree

```
CoworkMessageItem (modified)
  ├── Avatar
  ├── Message body
  │   ├── Role label
  │   ├── Content blocks
  │   └── MessageFeedbackBar (NEW) — only for assistant messages
  │       ├── 👍 button
  │       ├── 👎 button
  │       └── FeedbackForm (expandable)
  │           ├── textarea ("What went wrong?")
  │           └── Submit button
  └──

CoworkRightPanel (modified)
  ├── Progress section
  ├── Working Folder section
  ├── Feedback section (NEW)
  │   ├── Summary: "2 issues flagged"
  │   └── List of negative feedback with message references
  ├── Workflow section (existing, collapsed)
  ├── Create Skill section
  └── Context section
```

---

## 10. SSE Events

No new SSE events are needed for the feedback system. Feedback is submitted via REST API calls (POST), not through the streaming connection.

**Rationale:** Feedback is a user-initiated action that happens after the agent has finished responding. It doesn't need real-time streaming — a simple REST call is sufficient.

However, if we implement "agent feedback awareness" (Phase 4.3), the session feedback could be loaded when assembling the system prompt, using the existing `sessionState` mechanism:

```typescript
// In assembleSystemPrompt():
if (
  sessionState.feedback &&
  sessionState.feedback.some((f) => f.rating === "negative")
) {
  prompt +=
    "\n\nNote: The user has flagged issues with some of your previous responses in this session. " +
    "Take extra care to be accurate and address their concerns.";
}
```

---

## Appendix A: Claude Cowork Feedback Mechanisms Summary

| Mechanism          | Type      | Where       | User Action                | Agent Sees It?             |
| ------------------ | --------- | ----------- | -------------------------- | -------------------------- |
| Thumbs down        | Explicit  | Per message | Click icon + optional text | No (sent to Anthropic)     |
| Chat correction    | Implicit  | Chat        | "Change X to Y"            | Yes (in conversation)      |
| Permission deny    | Explicit  | Inline card | Click "Deny"               | Yes (tool error)           |
| Plan reject        | Explicit  | Inline card | Click "Reject"             | Yes (re-enters plan mode)  |
| AskUserQuestion    | Proactive | Inline card | Select option(s)           | Yes (tool result)          |
| No feedback        | Implicit  | —           | User continues             | Yes (silence = acceptance) |
| File not used      | Implicit  | —           | User doesn't download      | No                         |
| Iterative requests | Implicit  | Chat        | "Make it more formal"      | Yes (in conversation)      |

## Appendix B: Files to Modify

| File                                                                      | Phase | Change                                                  |
| ------------------------------------------------------------------------- | ----- | ------------------------------------------------------- |
| `prisma/schema.prisma`                                                    | 1     | Add CoworkMessageFeedback model + relations             |
| `src/components/cowork/message-blocks/MessageFeedbackBar.tsx`             | 1     | New component                                           |
| `src/components/cowork/CoworkMessageItem.tsx`                             | 1     | Add MessageFeedbackBar for assistant messages           |
| `src/lib/cowork/context.tsx`                                              | 1     | Add messageFeedback state + SET_MESSAGE_FEEDBACK action |
| `src/app/api/cowork/sessions/[id]/messages/[messageId]/feedback/route.ts` | 1     | New API route                                           |
| `src/app/api/cowork/sessions/[id]/feedback/route.ts`                      | 1     | New API route (session summary)                         |
| `src/app/globals.css`                                                     | 1     | Feedback bar + form styles                              |
| `src/components/cowork/ArtifactRenderer.tsx`                              | 2     | Add "Ask to edit" + "Regenerate" toolbar buttons        |
| `src/components/cowork/FeedbackSummarySection.tsx`                        | 3     | New component for right panel                           |
| `src/components/cowork/CoworkRightPanel.tsx`                              | 3     | Add FeedbackSummarySection                              |
| `src/lib/cowork/agent-loop.ts`                                            | 4     | Load session feedback into system prompt                |
