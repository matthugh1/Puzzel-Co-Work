# Web-Based Cowork — Full Product Specification

> **Purpose:** This document is a complete implementation plan for building a web-based version of Claude Cowork. It covers product architecture, UI/UX component specifications, feature logic, data flow, API contracts, and state management. Hand this to Cursor and build section by section.

> **Note:** Tech framework decisions (React, backend language, database, etc.) are already in place and are not covered here. This document focuses exclusively on **what to build and how it should behave**.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [UI/UX Layout Specification](#3-uiux-layout-specification)
4. [Core Data Models](#4-core-data-models)
5. [Feature Specifications](#5-feature-specifications)
   - 5.1 Chat & Conversation Engine
   - 5.2 Task/Todo System
   - 5.3 File Management
   - 5.4 Artifact Rendering
   - 5.5 Skills System
   - 5.6 Plugin System
   - 5.7 Sub-Agent Coordination
   - 5.8 Connector/MCP System
   - 5.9 Tool Execution Engine
   - 5.10 Plan Mode
   - 5.11 Shortcuts & Workflows
6. [API Contracts](#6-api-contracts)
7. [State Management](#7-state-management)
8. [Permissions & Security Model](#8-permissions--security-model)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Product Overview

### What Cowork Is

Cowork is a **task-centric AI agent** — not a chatbot. The user delegates goals, the agent drives tasks forward, coordinates parallel workstreams, and delivers finished outputs (documents, spreadsheets, presentations, code files, analyses). The interface prioritises **visibility** (what is Claude doing?), **controllability** (can I steer or stop it?), and **deliverability** (are the outputs real, downloadable files?).

### Core Principles

| Principle                  | Description                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| **Task-centric**           | Users delegate goals, not prompts. Claude plans, decomposes, and executes.                          |
| **Visibility**             | Every action Claude takes is visible — progress bars, todo lists, logs, plan previews.              |
| **Controllability**        | Users can pause, approve, reject, and redirect at any decision point.                               |
| **Deliverability**         | Outputs are real files (docx, pptx, xlsx, pdf, html, jsx, svg, mermaid) — not just chat text.       |
| **Parallel execution**     | Complex work is split into sub-agents that run concurrently.                                        |
| **Progressive disclosure** | Skills and context load lazily — metadata first, full instructions on trigger, resources on demand. |

---

## 2. Architecture Overview

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    WEB CLIENT                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Chat     │ │ Todo     │ │ Artifact │ │ File       │ │
│  │ Panel    │ │ Widget   │ │ Viewer   │ │ Explorer   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
│       │            │            │              │        │
│  ┌────┴────────────┴────────────┴──────────────┴──────┐ │
│  │              State Manager (Global Store)           │ │
│  └────────────────────────┬───────────────────────────┘ │
│                           │                             │
│  ┌────────────────────────┴───────────────────────────┐ │
│  │            WebSocket / SSE Connection               │ │
│  └────────────────────────┬───────────────────────────┘ │
└───────────────────────────┼─────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────┐
│                     API GATEWAY                          │
│  ┌────────────────────────┴───────────────────────────┐ │
│  │              Session Manager                        │ │
│  │  (auth, rate limiting, session lifecycle)           │ │
│  └──┬──────────┬──────────┬──────────┬───────────────┘ │
│     │          │          │          │                  │
│  ┌──┴───┐  ┌──┴───┐  ┌──┴───┐  ┌──┴──────────────┐  │
│  │Claude│  │Tool  │  │File  │  │Sub-Agent         │  │
│  │API   │  │Exec  │  │Store │  │Orchestrator      │  │
│  │Proxy │  │Engine│  │      │  │                   │  │
│  └──────┘  └──────┘  └──────┘  └───────────────────┘  │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │           Plugin / Skill / MCP Registry             │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Backend Services

| Service                       | Responsibility                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Session Manager**           | Manages user sessions, authentication, rate limiting, and session lifecycle (create, pause, resume, destroy). |
| **Claude API Proxy**          | Manages conversation context, system prompts, tool definitions, and streams responses from the Claude API.    |
| **Tool Execution Engine**     | Runs server-side tools (bash commands, file operations, code execution) in isolated containers per session.   |
| **File Store**                | Manages uploaded files, generated outputs, and temporary working files. Provides user-facing download URLs.   |
| **Sub-Agent Orchestrator**    | Spawns, monitors, and aggregates results from parallel sub-agent tasks.                                       |
| **Plugin/Skill/MCP Registry** | Stores and serves skill definitions, plugin manifests, and MCP connector configurations.                      |

### Communication Model

- **Client → Server:** REST API for CRUD operations; WebSocket for real-time streaming.
- **Server → Client:** Server-Sent Events (SSE) or WebSocket for streaming Claude responses, tool outputs, todo updates, and sub-agent progress.
- **Server → Claude API:** Standard Claude Messages API with streaming enabled.
- **Server → Tool Execution:** Internal RPC to isolated execution containers.

---

## 3. UI/UX Layout Specification

### 3.1 Overall Layout

The interface has three main zones arranged horizontally:

```
┌─────────┬───────────────────────────────┬─────────────────┐
│         │                               │                 │
│  LEFT   │         CENTRE                │     RIGHT       │
│ SIDEBAR │         PANEL                 │     PANEL       │
│         │                               │                 │
│  240px  │         flex-1                │     400px       │
│  fixed  │         (min 500px)           │   collapsible   │
│         │                               │                 │
└─────────┴───────────────────────────────┴─────────────────┘
```

### 3.2 Left Sidebar

```
┌─────────────────────┐
│  ☰  Cowork          │  ← App logo + hamburger
│─────────────────────│
│  + New Task          │  ← Primary action button
│─────────────────────│
│  RECENT SESSIONS     │  ← Section header
│  ▸ Market Analysis   │  ← Session item (clickable)
│  ▸ Q4 Report         │
│  ▸ Contract Review   │
│  ▸ Weekly Update     │
│─────────────────────│
│  PLUGINS             │  ← Section header
│  ▸ Productivity      │  ← Installed plugin
│  ▸ Legal             │
│  ▸ Product Mgmt      │
│  + Browse Library     │  ← Opens plugin marketplace
│─────────────────────│
│  ┌─────────────────┐ │
│  │  ⚙ Settings     │ │  ← Bottom-pinned
│  │  👤 Matt        │ │
│  └─────────────────┘ │
└─────────────────────┘
```

**Sidebar Component Specifications:**

| Component           | Behaviour                                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New Task Button** | Creates a new session. Navigates to empty chat view.                                                                                                                                          |
| **Session List**    | Sorted by last-active. Shows session title (auto-generated or user-set), timestamp, and a status indicator (active/completed/paused). Click to switch session. Right-click for rename/delete. |
| **Plugin Section**  | Lists installed plugins. Each is expandable to show its skills and slash commands. "Browse Library" opens a modal marketplace.                                                                |
| **Settings**        | Opens settings panel (account, connectors, permissions, appearance).                                                                                                                          |
| **User Avatar**     | Shows current user. Click for account menu.                                                                                                                                                   |

### 3.3 Centre Panel — Chat & Task View

This is the primary interaction area. It has two sub-zones stacked vertically:

```
┌─────────────────────────────────────────┐
│  [Chat] [Tasks]  ← Tab switcher         │
│─────────────────────────────────────────│
│                                         │
│  SCROLLABLE MESSAGE AREA                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 👤 User Message                 │    │
│  │ "Analyse these contracts and    │    │
│  │  create a summary report"       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🤖 Claude                       │    │
│  │ I'll analyse the contracts...   │    │
│  │                                 │    │
│  │ ┌─────────────────────────┐     │    │
│  │ │ 📋 TODO LIST WIDGET     │     │    │
│  │ │ ✅ Read uploaded files   │     │    │
│  │ │ 🔄 Analysing clause 3   │     │    │
│  │ │ ⬜ Generate summary doc  │     │    │
│  │ │ ⬜ Verify completeness   │     │    │
│  │ └─────────────────────────┘     │    │
│  │                                 │    │
│  │ [View Report](file://report.docx)   │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ ⚠️ PERMISSION REQUEST           │    │
│  │ Claude wants to delete 3 files  │    │
│  │ [Allow]  [Deny]                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│─────────────────────────────────────────│
│  INPUT AREA                             │
│  ┌───────────────────────────────────┐  │
│  │ 📎  Type a message...         ▶  │  │
│  │     [/commands] [model picker]    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**Message Types (rendered differently):**

| Type                   | Visual Treatment                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| **User message**       | Right-aligned or left-aligned with user avatar. Plain text with file attachment chips.                 |
| **Claude text**        | Left-aligned with Claude avatar. Supports markdown rendering.                                          |
| **Tool invocation**    | Collapsible card showing tool name, parameters, and output. Default: collapsed with summary.           |
| **Todo widget**        | Inline card with checkbox list. Updates in real-time via streaming.                                    |
| **Artifact link**      | Clickable file chip that opens the artifact in the right panel.                                        |
| **Permission request** | Highlighted card with action buttons (Allow/Deny). Blocks further execution until resolved.            |
| **Sub-agent status**   | Card showing spawned agents, their descriptions, and individual progress indicators.                   |
| **Plan preview**       | Expandable card showing Claude's proposed plan. "Approve" / "Reject" / "Edit" buttons.                 |
| **Ask User Question**  | Interactive card with radio buttons or multi-select options. "Other" free-text option always included. |
| **Error**              | Red-bordered card with error details and suggested remediation.                                        |

**Input Area Specifications:**

| Element                | Behaviour                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| **Text input**         | Multi-line, auto-expanding. Supports markdown. Enter to send, Shift+Enter for newline.          |
| **Attach button (📎)** | Opens file picker. Supports drag-and-drop. Shows attached files as removable chips above input. |
| **Slash commands (/)** | Typing `/` opens a searchable command palette. Lists available skills and shortcuts.            |
| **Model picker**       | Dropdown to select Claude model (Sonnet, Opus, Haiku). Persists per session.                    |
| **Send button (▶)**    | Sends message. Disabled while Claude is responding. Transforms to ■ (stop) during generation.   |

### 3.4 Right Panel — Artifact Viewer & File Explorer

The right panel is **collapsible** (toggle button on the panel edge) and has two tabs:

```
┌──────────────────────────┐
│  [Artifacts] [Files]     │  ← Tab switcher
│──────────────────────────│
│                          │
│  ARTIFACT VIEWER         │
│  (renders inline)        │
│                          │
│  ┌────────────────────┐  │
│  │                    │  │
│  │   Rendered HTML    │  │
│  │   / React / SVG    │  │
│  │   / Mermaid / MD   │  │
│  │   / PDF preview    │  │
│  │                    │  │
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │ 📥 Download        │  │
│  │ 🔗 Open in tab     │  │
│  │ 📋 Copy code       │  │
│  └────────────────────┘  │
│                          │
│──────────────────────────│
│                          │
│  FILE EXPLORER           │
│  (when Files tab active) │
│                          │
│  📁 outputs/             │
│    📄 report.docx        │
│    📄 analysis.xlsx      │
│    📄 slides.pptx        │
│  📁 uploads/             │
│    📄 contract-v1.pdf    │
│    📄 data.csv           │
│                          │
└──────────────────────────┘
```

**Artifact Viewer Specifications:**

| File Type                   | Rendering Method                                                          |
| --------------------------- | ------------------------------------------------------------------------- |
| `.html`                     | Sandboxed iframe                                                          |
| `.jsx`                      | Compiled and rendered in sandboxed iframe with React runtime              |
| `.md`                       | Rendered to HTML via markdown parser                                      |
| `.mermaid`                  | Rendered via Mermaid.js library                                           |
| `.svg`                      | Rendered inline as image                                                  |
| `.pdf`                      | Rendered via PDF.js viewer                                                |
| `.docx` / `.pptx` / `.xlsx` | Download link + optional preview (convert to PDF server-side for preview) |
| `.png` / `.jpg` / `.gif`    | Rendered inline as image                                                  |
| Code files                  | Syntax-highlighted code viewer                                            |

**File Explorer Specifications:**

| Feature          | Behaviour                                                                    |
| ---------------- | ---------------------------------------------------------------------------- |
| **Tree view**    | Shows `uploads/` and `outputs/` directories. Expandable folders.             |
| **File actions** | Click to preview in artifact viewer. Right-click for download/delete/rename. |
| **Upload**       | Drag files into the explorer to upload. Shows upload progress.               |
| **Download**     | Click download icon on any output file.                                      |

### 3.5 Responsive Behaviour

| Breakpoint     | Layout                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------- |
| **≥1200px**    | Full three-column layout                                                                      |
| **900–1199px** | Sidebar collapses to icons. Right panel becomes overlay.                                      |
| **<900px**     | Single column. Sidebar = drawer. Right panel = full-screen overlay. Bottom nav for switching. |

---

## 4. Core Data Models

### 4.1 Session

```typescript
interface Session {
  id: string; // UUID
  userId: string; // Owner
  title: string; // Auto-generated or user-set
  status: "active" | "paused" | "completed" | "error";
  model: "claude-sonnet-4-5" | "claude-opus-4-5" | "claude-haiku-4-5";
  createdAt: ISO8601;
  updatedAt: ISO8601;
  messages: Message[];
  todos: TodoItem[];
  files: FileRecord[];
  activeSubAgents: SubAgent[];
  pluginIds: string[]; // Enabled plugins for this session
  connectorIds: string[]; // Enabled connectors for this session
  systemPrompt: string; // Assembled from base + skills + plugins
}
```

### 4.2 Message

```typescript
interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: MessageContent[]; // Array of content blocks
  createdAt: ISO8601;
  metadata: {
    model?: string;
    tokenUsage?: { input: number; output: number };
    toolCalls?: ToolCall[];
    subAgentId?: string; // If from a sub-agent
  };
}

type MessageContent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: object }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error: boolean;
    }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
    }
  | {
      type: "file_reference";
      fileId: string;
      fileName: string;
      mimeType: string;
    }
  | {
      type: "artifact";
      artifactId: string;
      fileName: string;
      renderType: ArtifactType;
    }
  | { type: "todo_update"; todos: TodoItem[] }
  | {
      type: "permission_request";
      requestId: string;
      action: string;
      details: object;
    }
  | { type: "ask_user"; questionId: string; questions: AskQuestion[] }
  | {
      type: "plan";
      planId: string;
      steps: PlanStep[];
      status: "pending" | "approved" | "rejected";
    }
  | { type: "sub_agent_status"; agents: SubAgentSummary[] };
```

### 4.3 TodoItem

```typescript
interface TodoItem {
  id: string;
  sessionId: string;
  content: string; // Imperative form: "Run tests"
  activeForm: string; // Present continuous: "Running tests"
  status: "pending" | "in_progress" | "completed";
  createdAt: ISO8601;
  updatedAt: ISO8601;
}
```

### 4.4 FileRecord

```typescript
interface FileRecord {
  id: string;
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category: "upload" | "output" | "working"; // working = temp files
  storagePath: string; // Server-side path
  downloadUrl: string; // User-facing URL
  createdAt: ISO8601;
  metadata: {
    originalName?: string;
    generatedBy?: string; // Tool or sub-agent that created it
    artifactType?: ArtifactType;
  };
}

type ArtifactType =
  | "html"
  | "jsx"
  | "markdown"
  | "mermaid"
  | "svg"
  | "pdf"
  | "docx"
  | "pptx"
  | "xlsx"
  | "image"
  | "code"
  | "other";
```

### 4.5 Skill

```typescript
interface Skill {
  id: string;
  name: string;
  description: string; // Includes trigger conditions
  creatorType: "system" | "plugin" | "user";
  pluginId?: string; // Parent plugin if from a plugin
  enabled: boolean;
  contentPath: string; // Path to SKILL.md
  resourcePaths: string[]; // Paths to bundled resources
  updatedAt: ISO8601;
}
```

### 4.6 Plugin

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  scope: "user" | "org";
  installedAt: ISO8601;
  skills: Skill[];
  commands: SlashCommand[];
  connectors: ConnectorConfig[];
  enabled: boolean;
}

interface SlashCommand {
  name: string; // e.g., "review-contract"
  description: string;
  skillId: string; // Links to the skill that handles it
}
```

### 4.7 Connector (MCP)

```typescript
interface Connector {
  id: string;
  name: string; // e.g., "Slack", "Notion", "GitHub"
  description: string;
  status: "connected" | "disconnected" | "error";
  authType: "oauth" | "api_key" | "none";
  tools: ConnectorTool[]; // Tools exposed by this connector
  config: Record<string, any>; // Connector-specific configuration
}

interface ConnectorTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
    openWorld?: boolean;
  };
}
```

### 4.8 SubAgent

```typescript
interface SubAgent {
  id: string;
  parentSessionId: string;
  description: string; // 3-5 word summary
  type: "bash" | "general-purpose" | "explore" | "plan";
  status: "running" | "completed" | "failed" | "cancelled";
  prompt: string;
  result?: string;
  model?: string; // Can override parent model
  createdAt: ISO8601;
  completedAt?: ISO8601;
  turns: number; // API round-trips used
  maxTurns: number;
}
```

---

## 5. Feature Specifications

### 5.1 Chat & Conversation Engine

**Purpose:** The primary interface for user–agent interaction. Supports rich message types, streaming responses, and inline interactive elements.

#### Message Flow

```
User types message
  → Client validates (non-empty, within length limit)
  → Client adds message to local state (optimistic)
  → Client sends to server via WebSocket
  → Server adds to session history
  → Server assembles context:
      - System prompt (base + active skills + plugin instructions)
      - Conversation history (with truncation strategy)
      - Tool definitions (from skills + connectors + built-in)
      - File context (uploaded file references)
  → Server calls Claude API (streaming)
  → Server streams response tokens to client via WebSocket
  → Client renders tokens incrementally
  → If Claude calls a tool:
      → Server executes tool
      → Server sends tool result back to Claude
      → Claude continues generating
  → When complete: server persists final message
```

#### Context Assembly Strategy

The system prompt is assembled dynamically per request:

```
1. BASE_SYSTEM_PROMPT         (core agent behaviour, ~2000 tokens)
2. ACTIVE_SKILL_METADATA      (names + descriptions of all enabled skills, ~500 tokens)
3. TRIGGERED_SKILL_CONTENT    (full SKILL.md for skills matched by trigger, ~3000 tokens each)
4. PLUGIN_INSTRUCTIONS        (active plugin system prompts, ~500 tokens each)
5. CONNECTOR_TOOL_DEFS        (MCP tool schemas, ~200 tokens per tool)
6. USER_CONTEXT               (name, email, preferences)
7. SESSION_STATE              (current files, todos, active sub-agents)
```

#### Streaming Behaviour

- Text tokens render character-by-character with a slight buffer (collect 3-5 tokens before render for smoother display).
- Tool calls render as a collapsible "thinking" card that expands to show the tool name and parameters.
- Tool results render inside the same card, below the parameters.
- Todo updates trigger an in-place re-render of the todo widget (no new message).
- Artifact references render as clickable file chips that open the right panel.

#### Conversation History Truncation

When context approaches the model's limit:

1. Summarise older messages (keep last 20 full messages, summarise earlier ones).
2. Drop tool call/result details from old messages (keep just the summary).
3. Never drop: system prompt, current todos, file references, active sub-agent status.

### 5.2 Task/Todo System

**Purpose:** Visual progress tracking that updates in real-time as Claude works. Renders as an inline widget in the chat stream.

#### Todo Widget Component

```
┌─────────────────────────────────┐
│ 📋 Task Progress         3/5   │  ← Header with count
│─────────────────────────────────│
│ ✅ Read uploaded files          │  ← Completed (green check, strikethrough)
│ ✅ Extract key clauses          │  ← Completed
│ 🔄 Analysing indemnity terms   │  ← In progress (spinning icon, activeForm text)
│ ⬜ Generate summary document    │  ← Pending (grey, content text)
│ ⬜ Verify completeness          │  ← Pending
└─────────────────────────────────┘
```

#### Behaviour Rules

| Rule                          | Detail                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| **One in-progress at a time** | Exactly one todo should be `in_progress` at any time while Claude is working.          |
| **Real-time updates**         | Status changes stream to the client immediately. The widget re-renders in-place.       |
| **Display text**              | `pending` and `completed` items show `content`. `in_progress` items show `activeForm`. |
| **Auto-create**               | Claude creates the todo list at the start of any multi-step task (3+ steps).           |
| **Completion**                | Items marked complete only when truly finished. If errors occur, stays in-progress.    |
| **Persistence**               | Todos persist with the session. Visible on session resume.                             |

#### Progress Bar

A thin progress bar appears at the top of the chat area (or in the tab) showing `completed / total` as a percentage. This gives users a quick glance at overall progress without scrolling.

### 5.3 File Management

**Purpose:** Handle file uploads from the user, file generation by Claude, and file delivery back to the user.

#### Upload Flow

```
User drags file to input area or clicks 📎
  → Client validates file type and size (max 50MB per file, configurable)
  → Client uploads to server via multipart POST
  → Server stores in session's uploads/ directory
  → Server extracts text content where possible (for context injection):
      - PDF: text extraction via pdfplumber
      - DOCX: text extraction via pandoc
      - XLSX/CSV: parsed to structured data
      - Images: base64 encoded for vision
      - Code files: raw text
  → Server returns FileRecord with downloadUrl
  → Client shows file chip in input area
  → When user sends message: file references included in context
```

#### Output Delivery Flow

```
Claude generates a file (via tool execution)
  → Server saves to session's outputs/ directory
  → Server creates FileRecord
  → Server streams artifact reference to client
  → Client renders file chip in chat:
      [📄 View report.docx](download-url)
  → Client adds file to right panel file explorer
  → User clicks chip → opens in artifact viewer (if renderable) or downloads
```

#### File Storage Structure (Server-Side)

```
/sessions/{sessionId}/
  ├── uploads/          # User-uploaded files
  ├── outputs/          # Final deliverables (downloadable by user)
  └── working/          # Temporary files (not visible to user)
```

#### Supported File Types

| Category      | Extensions                             | Upload | Generate | Preview                               |
| ------------- | -------------------------------------- | ------ | -------- | ------------------------------------- |
| Documents     | .docx, .doc, .pdf, .txt, .md, .rtf     | ✅     | ✅       | ✅ (pdf via PDF.js, docx/doc convert) |
| Spreadsheets  | .xlsx, .xls, .csv, .tsv                | ✅     | ✅       | ✅ (convert to HTML table or PDF)     |
| Presentations | .pptx, .ppt                            | ✅     | ✅       | ✅ (convert to images)                |
| Images        | .png, .jpg, .gif, .svg, .webp          | ✅     | ✅       | ✅ (inline)                           |
| Code          | .js, .jsx, .ts, .tsx, .py, .html, .css | ✅     | ✅       | ✅ (syntax highlight or render)       |
| Data          | .json, .xml, .yaml                     | ✅     | ✅       | ✅ (formatted viewer)                 |
| Archives      | .zip                                   | ✅     | ✅       | ❌ (download only)                    |

### 5.4 Artifact Rendering

**Purpose:** Render Claude-generated files inline in the right panel with live preview.

#### Rendering Pipeline

```
Claude creates a file
  → Server detects artifact type from extension
  → Server streams artifact reference to client
  → Client opens right panel (if not open)
  → Client fetches file content
  → Client renders based on type:

  .html  → Sandboxed iframe (srcdoc with CSP)
  .jsx   → Compile with bundler → render in sandboxed iframe
  .md    → Parse with remark/rehype → render HTML
  .mermaid → Parse with Mermaid.js → render SVG
  .svg   → Render inline
  .pdf   → Render with PDF.js
  Other  → Show download link with file metadata
```

#### React/JSX Artifact Runtime

The JSX renderer needs a sandboxed environment with pre-loaded libraries:

| Library      | Version             | Import                                          |
| ------------ | ------------------- | ----------------------------------------------- |
| React        | 18.x                | `import { useState } from "react"`              |
| Tailwind CSS | 3.x (CDN pre-built) | Utility classes only                            |
| lucide-react | 0.263.1             | `import { Camera } from "lucide-react"`         |
| recharts     | latest              | `import { LineChart } from "recharts"`          |
| d3           | latest              | `import * as d3 from "d3"`                      |
| Three.js     | r128                | `import * as THREE from "three"`                |
| shadcn/ui    | latest              | `import { Alert } from "@/components/ui/alert"` |
| Chart.js     | latest              | `import * as Chart from "chart.js"`             |
| Papaparse    | latest              | CSV processing                                  |
| SheetJS      | latest              | Excel processing                                |
| lodash       | latest              | Utilities                                       |
| mathjs       | latest              | Math computations                               |

**Important constraints for JSX artifacts:**

- No `localStorage` or `sessionStorage` — use React state only.
- All state managed via `useState` / `useReducer`.
- Must have default export with no required props (or provide defaults).
- Single-file components only (HTML/CSS/JS in one file).

#### Artifact Viewer Controls

Each rendered artifact includes a toolbar:

```
┌────────────────────────────────────────┐
│ report.html          [📋] [↗] [📥] [×]│
│────────────────────────────────────────│
│                                        │
│  [Rendered artifact content]           │
│                                        │
└────────────────────────────────────────┘

📋 = Copy source code
↗  = Open in new browser tab
📥 = Download file
×  = Close viewer
```

### 5.5 Skills System

**Purpose:** Extend Claude's capabilities with specialised domain knowledge. Skills are loaded on-demand to conserve context.

#### Skill Lifecycle

```
1. REGISTRATION
   Skill registered in skill registry with:
   - id, name, description (trigger text)
   - path to SKILL.md content
   - paths to bundled resources

2. MATCHING (every user message)
   Server scans user message + context against skill descriptions
   If match found → skill "triggered"

3. LOADING (on trigger)
   Server reads SKILL.md content
   Injects into system prompt for current request

4. RESOURCE LOADING (on demand)
   If skill references additional files (scripts/, references/)
   Server loads them when Claude explicitly requests via Read tool

5. UNLOADING
   After task completion, skill content dropped from context
   Metadata remains for future matching
```

#### Progressive Disclosure (Context Efficiency)

| Level             | Size         | When Loaded            | Content                                 |
| ----------------- | ------------ | ---------------------- | --------------------------------------- |
| **Metadata**      | ~100 tokens  | Always in context      | `name` + `description` (trigger text)   |
| **SKILL.md body** | ~3000 tokens | On skill trigger match | Full instructions, code patterns, rules |
| **Resources**     | Unlimited    | On explicit request    | Scripts, templates, reference docs      |

#### Built-in Skills

The system ships with these core skills:

| Skill                     | Trigger                                         | Capability                                        |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| **docx**                  | Word document, .docx, report, memo, letter      | Create/edit/read Word documents using docx-js     |
| **pptx**                  | Presentation, .pptx, slides, deck               | Create/edit/read PowerPoint files using pptxgenjs |
| **xlsx**                  | Spreadsheet, .xlsx, Excel, budget, data table   | Create/edit/read Excel files with formulas        |
| **pdf**                   | PDF, .pdf, extract, merge, split, form          | Full PDF manipulation pipeline                    |
| **web-artifacts-builder** | Complex React artifacts, shadcn                 | Multi-component web artifact creation             |
| **canvas-design**         | Poster, visual design, art                      | Create PNG/PDF visual designs                     |
| **algorithmic-art**       | Generative art, p5.js, flow fields              | Code-based art with seeded randomness             |
| **theme-factory**         | Theme, styling, brand colours                   | Apply pre-set or custom themes to artifacts       |
| **internal-comms**        | Status report, newsletter, FAQ, incident report | Internal communication templates                  |
| **slack-gif-creator**     | Animated GIF, Slack                             | GIF creation optimised for Slack                  |
| **mcp-builder**           | MCP server, integrate API                       | Guide for building MCP servers                    |
| **skill-creator**         | Create a skill, new skill                       | Meta-skill for building custom skills             |

#### Custom Skill Creation

Users can create custom skills via:

1. The `skill-creator` meta-skill (guided flow)
2. Direct file creation following the skill format

Custom skill format:

```
my-skill/
├── SKILL.md            # Required: YAML frontmatter + markdown instructions
├── scripts/            # Optional: executable code
├── references/         # Optional: reference documentation
├── assets/             # Optional: templates, examples
└── LICENSE.txt         # Optional: license terms
```

SKILL.md format:

```yaml
---
name: my-custom-skill
description: "Trigger description. Use when the user asks about X, Y, Z."
---

# Skill Title

## Instructions
[Detailed instructions for Claude]

## Resources
[References to bundled files]
```

### 5.6 Plugin System

**Purpose:** Bundle skills, connectors, slash commands, and sub-agent configurations into installable packages.

#### Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json        # Plugin manifest
├── .mcp.json              # MCP connector configs (optional)
├── commands/              # Slash command definitions
│   ├── review-pr.md
│   └── daily-standup.md
├── skills/                # Domain knowledge
│   ├── code-review/
│   │   └── SKILL.md
│   └── ci-cd/
│       └── SKILL.md
└── assets/                # Templates, examples
    └── templates/
```

#### Plugin Manifest (plugin.json)

```json
{
  "name": "engineering-toolkit",
  "version": "1.0.0",
  "description": "Tools for software engineering workflows",
  "author": "Your Org",
  "skills": ["code-review", "ci-cd"],
  "commands": ["review-pr", "daily-standup"],
  "connectors": ["github", "jira"]
}
```

#### Plugin Marketplace UI

```
┌─────────────────────────────────────────────────┐
│  Plugin Library                           [×]    │
│─────────────────────────────────────────────────│
│  🔍 Search plugins...                           │
│─────────────────────────────────────────────────│
│  CATEGORIES                                      │
│  [All] [Productivity] [Legal] [Sales] [Finance] │
│  [Engineering] [Marketing] [Research]            │
│─────────────────────────────────────────────────│
│  ┌──────────────────────┐ ┌──────────────────┐  │
│  │ 🔧 Productivity      │ │ ⚖️ Legal          │  │
│  │ Task mgmt, memory,   │ │ Contract review, │  │
│  │ daily workflows      │ │ NDA triage, risk │  │
│  │ [Installed ✓]        │ │ [Install]        │  │
│  └──────────────────────┘ └──────────────────┘  │
│  ┌──────────────────────┐ ┌──────────────────┐  │
│  │ 📊 Product Mgmt      │ │ 💰 Finance       │  │
│  │ Roadmaps, specs,     │ │ Models, metrics, │  │
│  │ stakeholder comms     │ │ analysis         │  │
│  │ [Install]            │ │ [Install]        │  │
│  └──────────────────────┘ └──────────────────┘  │
│─────────────────────────────────────────────────│
│  📤 Upload Custom Plugin                        │
└─────────────────────────────────────────────────┘
```

#### Plugin Installation Flow

```
User clicks [Install] on a plugin
  → Server downloads plugin package
  → Server validates plugin manifest
  → Server registers skills, commands, and connectors
  → Server adds plugin to user's installed_plugins registry
  → Client updates sidebar plugin list
  → Plugin skills become available for trigger matching
  → Plugin commands appear in slash command palette
```

### 5.7 Sub-Agent Coordination

**Purpose:** Break complex tasks into parallel workstreams, each handled by a specialised sub-agent with its own context.

#### When to Spawn Sub-Agents

| Trigger                     | Example                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| **Parallelisable subtasks** | "Investigate these 5 competitors" → 5 parallel research agents                     |
| **Context-heavy subtasks**  | "Analyse this 200-page document" → dedicated agent to avoid polluting main context |
| **Verification**            | "Check your work" → spawn verification agent to review outputs                     |
| **Exploration**             | "Find all files related to X" → exploration agent                                  |

#### Sub-Agent Types

| Type                | Tools Available | Use Case                                         |
| ------------------- | --------------- | ------------------------------------------------ |
| **bash**            | Bash only       | Git operations, command execution                |
| **general-purpose** | All tools       | Multi-step research, file operations, web search |
| **explore**         | Read-only tools | Codebase exploration, file search, web fetch     |
| **plan**            | Read-only tools | Design implementation plans                      |

#### Sub-Agent UI

When Claude spawns sub-agents, the chat displays a coordination card:

```
┌─────────────────────────────────────────────────┐
│ 🔀 Running 3 parallel tasks                     │
│─────────────────────────────────────────────────│
│ 🔄 Researching competitor A         (Turn 3/10) │
│ 🔄 Researching competitor B         (Turn 2/10) │
│ ✅ Researching competitor C          (Complete)  │
│─────────────────────────────────────────────────│
│ [Cancel All]                                     │
└─────────────────────────────────────────────────┘
```

#### Sub-Agent Data Flow

```
Main agent decides to spawn sub-agents
  → Server creates SubAgent records
  → Server starts parallel Claude API sessions (one per agent)
  → Each sub-agent has:
      - Its own conversation context
      - Access to the same file system
      - Limited tool set based on type
      - A max turn limit
  → Server streams sub-agent status to client
  → When sub-agent completes:
      - Result string returned to main agent
      - Sub-agent context discarded
  → Main agent synthesises results and continues
```

#### Sub-Agent Lifecycle

```
CREATED → RUNNING → COMPLETED
                  → FAILED (with error)
                  → CANCELLED (by user or main agent)
```

### 5.8 Connector/MCP System

**Purpose:** Integrate external services (Slack, Notion, GitHub, Jira, etc.) so Claude can read from and write to them.

#### Connector Architecture

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐
│ Claude API  │────→│ MCP Proxy      │────→│ External     │
│ (tool call) │     │ (server-side)  │     │ Service API  │
│             │←────│                │←────│              │
└─────────────┘     └────────────────┘     └──────────────┘
```

Each connector exposes tools to Claude via the MCP (Model Context Protocol):

```json
{
  "name": "slack_search_messages",
  "description": "Search Slack messages across channels",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "channel": { "type": "string" },
      "limit": { "type": "number", "default": 20 }
    },
    "required": ["query"]
  },
  "annotations": {
    "readOnly": true,
    "openWorld": true
  }
}
```

#### Connector Management UI

```
┌─────────────────────────────────────────┐
│ ⚙ Connectors                    [×]    │
│─────────────────────────────────────────│
│  ┌────────────┐                         │
│  │ 💬 Slack   │  Connected ✅           │
│  │ 12 tools   │  [Configure] [Remove]   │
│  └────────────┘                         │
│  ┌────────────┐                         │
│  │ 📝 Notion  │  Disconnected           │
│  │            │  [Connect]              │
│  └────────────┘                         │
│  ┌────────────┐                         │
│  │ 🐙 GitHub  │  Connected ✅           │
│  │ 8 tools    │  [Configure] [Remove]   │
│  └────────────┘                         │
│─────────────────────────────────────────│
│  🔍 Search for more connectors...      │
└─────────────────────────────────────────┘
```

#### Connector Authentication Flows

| Auth Type   | Flow                                                                                 |
| ----------- | ------------------------------------------------------------------------------------ |
| **OAuth**   | Redirect to service → user authorises → server stores tokens → refresh automatically |
| **API Key** | User enters key in settings → server stores encrypted → uses in requests             |
| **None**    | Public APIs, no auth required                                                        |

#### Connector Permission Model

Each tool call through a connector is classified:

| Annotation          | Behaviour                               |
| ------------------- | --------------------------------------- |
| `readOnly: true`    | Execute without asking (data retrieval) |
| `destructive: true` | Always ask user permission first        |
| `idempotent: true`  | Safe to retry on failure                |
| `openWorld: true`   | Results may vary between calls          |

### 5.9 Tool Execution Engine

**Purpose:** Execute server-side tools (file operations, code execution, web search, etc.) on behalf of Claude.

#### Built-in Tools

| Tool                | Description                              | Permission Level           |
| ------------------- | ---------------------------------------- | -------------------------- |
| **Read**            | Read file contents                       | Auto                       |
| **Write**           | Create new files                         | Auto                       |
| **Edit**            | Edit existing files (string replacement) | Auto                       |
| **Bash**            | Execute shell commands                   | Auto (with allowlist)      |
| **Glob**            | Find files by pattern                    | Auto                       |
| **Grep**            | Search file contents                     | Auto                       |
| **WebSearch**       | Search the web                           | Auto                       |
| **WebFetch**        | Fetch and parse web page                 | Auto                       |
| **TodoWrite**       | Update todo list                         | Auto                       |
| **AskUserQuestion** | Ask user multi-choice questions          | Auto (blocks for response) |
| **Task**            | Spawn sub-agent                          | Auto                       |
| **Skill**           | Invoke a skill                           | Auto                       |
| **EnterPlanMode**   | Enter planning mode                      | Auto (blocks for approval) |
| **ExitPlanMode**    | Present plan for approval                | Auto (blocks for approval) |

#### Tool Execution Flow

```
Claude generates a tool_use content block
  → Server validates tool name and parameters
  → Server checks permission level:
      - Auto: execute immediately
      - Ask: send permission request to client, wait for response
      - Blocked: return error to Claude
  → Server routes to appropriate executor:
      - File tools → File Store service
      - Bash → Isolated container execution
      - Web tools → HTTP client with restrictions
      - Todo → Session state update
      - Task → Sub-Agent Orchestrator
      - Connector tools → MCP Proxy
  → Executor returns result
  → Server formats as tool_result
  → Server sends to Claude for next generation step
  → Server streams any side effects to client (file created, todo updated, etc.)
```

#### Bash Execution Environment

Each session gets an isolated execution environment with:

| Feature                 | Detail                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| **Working directory**   | Persistent per session (`/sessions/{id}/`)                               |
| **Timeout**             | Default 120s, max 600s per command                                       |
| **File access**         | Read/write to session directory only                                     |
| **Network**             | Outbound HTTP/HTTPS allowed (configurable)                               |
| **Packages**            | npm, pip available. Common tools pre-installed (git, python, node, etc.) |
| **Pre-installed tools** | LibreOffice, pandoc, poppler, pytesseract, pdfplumber, openpyxl          |

#### Tool Output Size Management

- Tool outputs truncated at 30,000 characters.
- Large outputs get summarised automatically.
- File contents returned as references (not inline) when over threshold.

### 5.10 Plan Mode

**Purpose:** For complex tasks, Claude enters a planning phase where it explores the problem space and presents a structured plan for user approval before executing.

#### Plan Mode Flow

```
Claude decides task is complex
  → Claude calls EnterPlanMode tool
  → Server sets session to plan_mode = true
  → Client shows planning indicator in UI
  → Claude explores (reads files, searches, etc.) — NO writes allowed
  → Claude writes plan to a plan file
  → Claude calls ExitPlanMode
  → Server sends plan to client for review
  → Client renders plan approval card:

  ┌─────────────────────────────────────────┐
  │ 📋 PLAN REVIEW                          │
  │─────────────────────────────────────────│
  │ Claude proposes the following plan:     │
  │                                         │
  │ 1. Extract text from uploaded contracts │
  │ 2. Identify key clauses (indemnity,     │
  │    liability, termination)              │
  │ 3. Compare against standard playbook    │
  │ 4. Generate redline document            │
  │ 5. Create summary report               │
  │                                         │
  │ Requires:                               │
  │ • File read access (uploads/)           │
  │ • File write access (outputs/)          │
  │ • Web search for clause precedents      │
  │                                         │
  │ [✅ Approve]  [✏️ Edit]  [❌ Reject]     │
  └─────────────────────────────────────────┘

  → User approves → Claude executes plan
  → User edits → Claude revises plan
  → User rejects → Claude asks what to do differently
```

#### Plan Mode Constraints

- Claude can only use **read-only tools** while in plan mode (Read, Glob, Grep, WebSearch, WebFetch).
- No file writes, edits, or bash commands.
- No sub-agent spawning.
- Plan must be explicitly approved before execution begins.

### 5.11 Shortcuts & Workflows

**Purpose:** Reusable, one-click automations that execute predefined sequences. Can be run on demand or scheduled.

#### Shortcut Definition

```typescript
interface Shortcut {
  id: string;
  name: string; // e.g., "Daily Briefing"
  description: string;
  command: string; // Slash command trigger: "/daily-briefing"
  prompt: string; // The actual instruction sent to Claude
  schedule?: CronExpression; // Optional: run automatically
  pluginId?: string; // If from a plugin
  isWorkflow: boolean; // True if multi-step
}
```

#### Shortcut UI

Shortcuts appear in the slash command palette and the sidebar:

```
User types "/"
  → Command palette opens:

  ┌─────────────────────────────────────┐
  │ 🔍 Search commands...               │
  │───────────────────────────────────── │
  │ /review-contract   Review a contract│
  │ /daily-briefing    Daily summary    │
  │ /stakeholder-update Write update    │
  │ /write-spec        Feature spec     │
  │ /triage-nda        Screen an NDA    │
  └─────────────────────────────────────┘
```

---

## 6. API Contracts

### 6.1 Session Management

```
POST   /api/sessions                    # Create new session
GET    /api/sessions                    # List user's sessions
GET    /api/sessions/:id                # Get session details
PATCH  /api/sessions/:id                # Update session (title, status, model)
DELETE /api/sessions/:id                # Delete session

POST   /api/sessions/:id/messages       # Send user message (returns stream)
GET    /api/sessions/:id/messages       # Get message history (paginated)
```

#### Create Session Request

```json
POST /api/sessions
{
  "model": "claude-sonnet-4-5",
  "pluginIds": ["productivity", "legal"],
  "connectorIds": ["slack", "github"]
}
```

#### Create Session Response

```json
{
  "id": "sess_abc123",
  "status": "active",
  "model": "claude-sonnet-4-5",
  "createdAt": "2026-02-06T10:00:00Z",
  "files": { "uploads": [], "outputs": [] },
  "todos": [],
  "activeSubAgents": []
}
```

#### Send Message Request

```json
POST /api/sessions/:id/messages
Content-Type: application/json

{
  "content": "Analyse the uploaded contracts and create a summary report",
  "fileIds": ["file_xyz789"],
  "model": "claude-opus-4-5"     // Optional: override session model
}
```

#### Send Message Response (SSE Stream)

```
event: message_start
data: {"messageId": "msg_001", "role": "assistant"}

event: content_delta
data: {"type": "text", "text": "I'll analyse"}

event: content_delta
data: {"type": "text", "text": " the contracts..."}

event: tool_use_start
data: {"type": "tool_use", "id": "tu_001", "name": "Read", "input": {"file_path": "/uploads/contract.pdf"}}

event: tool_result
data: {"tool_use_id": "tu_001", "content": "Contract text...", "is_error": false}

event: todo_update
data: {"todos": [{"content": "Read contracts", "status": "completed", "activeForm": "Reading contracts"}, ...]}

event: artifact_created
data: {"fileId": "file_002", "fileName": "summary.docx", "downloadUrl": "/api/files/file_002/download"}

event: content_delta
data: {"type": "text", "text": "\n\n[View your report](file://summary.docx)"}

event: message_end
data: {"messageId": "msg_001", "tokenUsage": {"input": 5000, "output": 1200}}
```

### 6.2 File Management

```
POST   /api/sessions/:id/files/upload   # Upload file(s)
GET    /api/sessions/:id/files          # List session files
GET    /api/files/:fileId               # Get file metadata
GET    /api/files/:fileId/download      # Download file
GET    /api/files/:fileId/preview       # Get preview (converted for rendering)
DELETE /api/files/:fileId               # Delete file
```

#### Upload Request

```
POST /api/sessions/:id/files/upload
Content-Type: multipart/form-data

file: [binary data]
category: "upload"
```

#### Upload Response

```json
{
  "id": "file_xyz789",
  "fileName": "contract-v1.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 245000,
  "category": "upload",
  "downloadUrl": "/api/files/file_xyz789/download",
  "createdAt": "2026-02-06T10:01:00Z"
}
```

### 6.3 Todo Management

```
GET    /api/sessions/:id/todos          # Get current todos
PUT    /api/sessions/:id/todos          # Replace all todos (used by TodoWrite)
```

### 6.4 Plugin Management

```
GET    /api/plugins                     # List available plugins (marketplace)
GET    /api/plugins/installed           # List user's installed plugins
POST   /api/plugins/:id/install         # Install a plugin
DELETE /api/plugins/:id/uninstall       # Uninstall a plugin
POST   /api/plugins/upload              # Upload custom plugin package
GET    /api/plugins/:id/skills          # List skills in a plugin
GET    /api/plugins/:id/commands        # List commands in a plugin
```

### 6.5 Connector Management

```
GET    /api/connectors                  # List available connectors
GET    /api/connectors/active           # List connected connectors
POST   /api/connectors/:id/connect      # Initiate connection (returns OAuth URL or API key form)
POST   /api/connectors/:id/callback     # OAuth callback
DELETE /api/connectors/:id/disconnect    # Disconnect
GET    /api/connectors/:id/tools        # List tools exposed by connector
```

### 6.6 Sub-Agent Management

```
GET    /api/sessions/:id/agents         # List active sub-agents
GET    /api/agents/:agentId             # Get sub-agent status and result
POST   /api/agents/:agentId/cancel      # Cancel a running sub-agent
GET    /api/agents/:agentId/output      # Get sub-agent output (streaming)
```

### 6.7 Permissions

```
POST   /api/sessions/:id/permissions/:requestId/resolve
{
  "approved": true | false
}
```

### 6.8 User Questions

```
POST   /api/sessions/:id/questions/:questionId/answer
{
  "answers": {
    "question_0": "option_label_or_custom_text"
  }
}
```

### 6.9 Plan Mode

```
POST   /api/sessions/:id/plan/approve   # Approve the proposed plan
POST   /api/sessions/:id/plan/reject    # Reject the proposed plan
POST   /api/sessions/:id/plan/edit      # Submit edited plan
{
  "editedPlan": "Modified plan text..."
}
```

---

## 7. State Management

### 7.1 Global State Shape

```typescript
interface AppState {
  // Auth
  user: User | null;

  // Sessions
  sessions: {
    list: Session[]; // All sessions (summary only)
    active: Session | null; // Currently open session (full detail)
    loading: boolean;
  };

  // Chat
  chat: {
    messages: Message[];
    isStreaming: boolean;
    streamBuffer: string; // Buffered tokens not yet rendered
    pendingPermission: PermissionRequest | null;
    pendingQuestion: AskQuestion | null;
    pendingPlan: Plan | null;
  };

  // Todos
  todos: {
    items: TodoItem[];
    lastUpdated: ISO8601;
  };

  // Files
  files: {
    uploads: FileRecord[];
    outputs: FileRecord[];
    activeArtifact: FileRecord | null; // Currently previewed artifact
    uploadProgress: { [fileId: string]: number };
  };

  // Sub-Agents
  subAgents: {
    active: SubAgent[];
  };

  // Plugins & Skills
  plugins: {
    installed: Plugin[];
    marketplace: Plugin[]; // Available for install
    loading: boolean;
  };

  // Connectors
  connectors: {
    available: Connector[];
    connected: Connector[];
    loading: boolean;
  };

  // UI State
  ui: {
    sidebarOpen: boolean;
    rightPanelOpen: boolean;
    rightPanelTab: "artifacts" | "files";
    commandPaletteOpen: boolean;
    pluginMarketplaceOpen: boolean;
    settingsOpen: boolean;
    theme: "light" | "dark" | "system";
  };
}
```

### 7.2 State Update Patterns

| Event                      | State Changes                                                             |
| -------------------------- | ------------------------------------------------------------------------- |
| **User sends message**     | Append to `chat.messages`, set `chat.isStreaming = true`                  |
| **Stream token received**  | Append to `chat.streamBuffer`, flush to last message content periodically |
| **Tool call started**      | Append tool_use block to last message                                     |
| **Tool result received**   | Append tool_result block, update related state (files, todos, etc.)       |
| **Todo update**            | Replace `todos.items` entirely                                            |
| **Artifact created**       | Add to `files.outputs`, set `files.activeArtifact`, open right panel      |
| **Sub-agent spawned**      | Add to `subAgents.active`                                                 |
| **Sub-agent completed**    | Update status in `subAgents.active`                                       |
| **Permission requested**   | Set `chat.pendingPermission`, pause stream display                        |
| **Permission resolved**    | Clear `chat.pendingPermission`, resume stream                             |
| **Question asked**         | Set `chat.pendingQuestion`, render question card                          |
| **Question answered**      | Clear `chat.pendingQuestion`, send answer to server                       |
| **Plan proposed**          | Set `chat.pendingPlan`, render plan review card                           |
| **Plan approved/rejected** | Clear `chat.pendingPlan`, continue or restart                             |
| **Stream ended**           | Set `chat.isStreaming = false`, flush buffer                              |

### 7.3 Real-Time Sync (WebSocket Events)

```typescript
// Server → Client events
type ServerEvent =
  | { type: "message_start"; data: { messageId: string; role: string } }
  | {
      type: "content_delta";
      data: { type: string; text?: string; [key: string]: any };
    }
  | { type: "tool_use_start"; data: ToolCall }
  | { type: "tool_result"; data: ToolResult }
  | { type: "todo_update"; data: { todos: TodoItem[] } }
  | { type: "artifact_created"; data: FileRecord }
  | { type: "sub_agent_update"; data: SubAgent }
  | { type: "permission_request"; data: PermissionRequest }
  | { type: "ask_question"; data: AskQuestion }
  | { type: "plan_proposed"; data: Plan }
  | { type: "message_end"; data: { messageId: string; tokenUsage: TokenUsage } }
  | { type: "error"; data: { code: string; message: string } }
  | { type: "session_status"; data: { status: SessionStatus } };

// Client → Server events
type ClientEvent =
  | { type: "send_message"; data: { content: string; fileIds?: string[] } }
  | {
      type: "resolve_permission";
      data: { requestId: string; approved: boolean };
    }
  | {
      type: "answer_question";
      data: { questionId: string; answers: Record<string, string> };
    }
  | { type: "approve_plan"; data: { planId: string } }
  | { type: "reject_plan"; data: { planId: string } }
  | { type: "cancel_agent"; data: { agentId: string } }
  | { type: "stop_generation"; data: {} };
```

---

## 8. Permissions & Security Model

### 8.1 Action Classification

Every action Claude takes is classified into one of three categories:

| Category                | Behaviour                                   | Examples                                                                                                    |
| ----------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Auto**                | Execute without asking                      | Read files, search web, update todos, spawn sub-agents                                                      |
| **Explicit Permission** | Ask user first, wait for approval           | Delete files, send messages (email/Slack), publish content, accept agreements, download files, submit forms |
| **Prohibited**          | Never execute, instruct user to do manually | Handle banking/credit card data, create accounts, modify security permissions, enter passwords              |

### 8.2 Permission Request UI

```
┌─────────────────────────────────────────────┐
│ ⚠️  Permission Required                     │
│─────────────────────────────────────────────│
│ Claude wants to:                            │
│                                             │
│ Send a Slack message to #engineering:       │
│ "Sprint review moved to Thursday 3pm"       │
│                                             │
│ [✅ Allow]  [❌ Deny]                        │
└─────────────────────────────────────────────┘
```

### 8.3 Prompt Injection Defence

All content from external sources (web pages, connector results, file contents) is treated as **untrusted data**. The system enforces:

| Defence                   | Implementation                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| **Content isolation**     | Web content, email bodies, and tool results cannot override system instructions                     |
| **Instruction detection** | If Claude finds instructions in untrusted content, it stops and asks the user before following them |
| **Source tagging**        | All content tagged with origin (user, web, connector, file) for trust assessment                    |
| **No auto-execution**     | Instructions found in documents/emails are surfaced to user for explicit approval                   |

### 8.4 File Security

- Uploaded files scanned for malware before processing.
- Session file isolation: each session can only access its own files.
- Temporary working files automatically cleaned up on session end.
- Sensitive file types (.env, credentials, etc.) flagged with warnings.

---

## 9. Implementation Phases

### Phase 1: Foundation (Weeks 1–3)

**Goal:** Basic chat with Claude that streams responses and handles simple tool calls.

| Task                     | Details                                      |
| ------------------------ | -------------------------------------------- |
| Session management API   | Create, list, get, delete sessions           |
| Chat message flow        | Send message → stream response → display     |
| WebSocket infrastructure | Real-time streaming with reconnection        |
| Basic UI layout          | Three-panel layout with responsive behaviour |
| Message rendering        | Text, markdown, code blocks                  |
| File upload              | Upload files, reference in messages          |
| Basic tool execution     | Read, Write, Edit, Glob, Grep                |

**Milestone:** User can chat with Claude, upload files, and see streamed responses with basic tool usage.

### Phase 2: Task Engine (Weeks 4–6)

**Goal:** Todo tracking, file generation, artifact rendering, and the full tool suite.

| Task                     | Details                                                   |
| ------------------------ | --------------------------------------------------------- |
| Todo system              | TodoWrite tool, real-time widget, progress bar            |
| File generation pipeline | Claude creates files, server stores, client shows         |
| Artifact viewer          | Render HTML, JSX, markdown, mermaid, SVG, PDF             |
| Bash execution           | Isolated command execution with timeout                   |
| WebSearch & WebFetch     | Web research tools                                        |
| Permission system        | Permission requests, approval flow, action classification |
| Plan mode                | EnterPlanMode, exploration, plan review, ExitPlanMode     |

**Milestone:** User can delegate complex tasks, see real-time progress, and download generated documents.

### Phase 3: Agent Intelligence (Weeks 7–9)

**Goal:** Sub-agents, skills system, and ask-user-question flow.

| Task                   | Details                                                     |
| ---------------------- | ----------------------------------------------------------- |
| Sub-agent orchestrator | Spawn, monitor, cancel, aggregate parallel agents           |
| Sub-agent UI           | Progress cards, individual status, cancel controls          |
| Skills registry        | Metadata loading, trigger matching, progressive disclosure  |
| Built-in skills        | docx, pptx, xlsx, pdf, web-artifacts-builder, canvas-design |
| AskUserQuestion tool   | Multi-choice question cards, custom input                   |
| Context management     | History truncation, skill loading/unloading                 |

**Milestone:** Claude can break tasks into parallel workstreams, use specialised skills, and ask clarifying questions.

### Phase 4: Extensibility (Weeks 10–12)

**Goal:** Plugin system, connector/MCP integration, and shortcuts.

| Task                  | Details                                                       |
| --------------------- | ------------------------------------------------------------- |
| Plugin registry       | Install, uninstall, enable, disable                           |
| Plugin marketplace UI | Browse, search, install, upload custom                        |
| Connector framework   | OAuth flow, API key storage, MCP proxy                        |
| Built-in connectors   | Slack, Notion, GitHub, Jira (or whatever your priorities are) |
| Slash commands        | Command palette, skill invocation                             |
| Shortcuts/workflows   | Create, run, schedule automations                             |
| Custom skill creation | skill-creator meta-skill, validation                          |

**Milestone:** Users can install plugins, connect external services, and create custom skills and shortcuts.

### Phase 5: Polish & Scale (Weeks 13–16)

**Goal:** Production readiness, performance, and advanced features.

| Task                | Details                                                           |
| ------------------- | ----------------------------------------------------------------- |
| Session persistence | Resume sessions across page reloads and reconnections             |
| Session history     | Search, filter, sort sessions                                     |
| Error handling      | Graceful degradation, retry logic, user-friendly errors           |
| Rate limiting       | Token budgets, concurrent session limits                          |
| Performance         | Lazy loading, virtual scrolling for long chats, debounced renders |
| Accessibility       | Keyboard navigation, screen reader support, ARIA labels           |
| Dark mode           | Full theme support                                                |
| Mobile responsive   | Touch-friendly UI, drawer navigation                              |
| Analytics           | Usage tracking, performance metrics                               |
| Testing             | E2E tests, integration tests, load tests                          |

**Milestone:** Production-ready web application with full feature parity to desktop Cowork.

---

## Appendix A: Component Tree

```
App
├── AuthProvider
├── WebSocketProvider
├── StateProvider (global store)
│
├── Layout
│   ├── LeftSidebar
│   │   ├── AppHeader
│   │   ├── NewTaskButton
│   │   ├── SessionList
│   │   │   └── SessionListItem (×n)
│   │   ├── PluginSection
│   │   │   └── PluginListItem (×n)
│   │   └── SidebarFooter (Settings, User)
│   │
│   ├── CentrePanel
│   │   ├── TabSwitcher (Chat | Tasks)
│   │   ├── ProgressBar
│   │   ├── MessageList
│   │   │   ├── UserMessage
│   │   │   ├── AssistantMessage
│   │   │   │   ├── MarkdownRenderer
│   │   │   │   ├── ToolCallCard (collapsible)
│   │   │   │   ├── TodoWidget
│   │   │   │   ├── ArtifactChip
│   │   │   │   ├── SubAgentCard
│   │   │   │   ├── PermissionCard
│   │   │   │   ├── QuestionCard
│   │   │   │   └── PlanReviewCard
│   │   │   └── SystemMessage
│   │   └── InputArea
│   │       ├── FileAttachments
│   │       ├── TextInput
│   │       ├── SlashCommandPalette
│   │       ├── ModelPicker
│   │       └── SendButton / StopButton
│   │
│   └── RightPanel (collapsible)
│       ├── TabSwitcher (Artifacts | Files)
│       ├── ArtifactViewer
│       │   ├── ArtifactToolbar
│       │   ├── HTMLRenderer (iframe)
│       │   ├── JSXRenderer (compiled iframe)
│       │   ├── MarkdownRenderer
│       │   ├── MermaidRenderer
│       │   ├── SVGRenderer
│       │   ├── PDFRenderer (PDF.js)
│       │   └── CodeViewer (syntax highlight)
│       └── FileExplorer
│           ├── FileTree
│           └── FileActions
│
├── Modals
│   ├── PluginMarketplace
│   ├── ConnectorSettings
│   ├── AppSettings
│   └── FileUploadDialog
│
└── Overlays
    ├── CommandPalette
    └── ToastNotifications
```

---

## Appendix B: Key Behavioural Rules

These rules must be enforced in the system prompt and server-side logic:

1. **Todo list for every multi-step task.** If Claude will make 3+ tool calls, it must create a todo list first.
2. **One in-progress todo at a time.** Exactly one item should be `in_progress` while Claude is working.
3. **Ask before starting.** For non-trivial tasks, Claude should use AskUserQuestion to clarify scope before beginning work.
4. **Plan mode for complex tasks.** If the task touches multiple files, has multiple valid approaches, or involves architectural decisions, Claude should enter plan mode.
5. **Progressive skill loading.** Only load full skill content when triggered. Keep metadata always available.
6. **Parallel sub-agents when possible.** If subtasks are independent, spawn them concurrently.
7. **Verification step.** Include a final verification todo item for any non-trivial task.
8. **File delivery.** All outputs must be saved as downloadable files. Never just dump content in chat.
9. **Permission before destructive actions.** Deletes, sends, publishes, and financial actions always require explicit approval.
10. **No sensitive data handling.** Never process passwords, credit cards, SSNs, or similar.

---

## Appendix C: Error Handling Matrix

| Error Type                  | Client Behaviour                                          | Server Behaviour                            |
| --------------------------- | --------------------------------------------------------- | ------------------------------------------- |
| **Claude API timeout**      | Show "Claude is taking longer than expected. Retrying..." | Retry with exponential backoff (3 attempts) |
| **Claude API rate limit**   | Show "Rate limit reached. Waiting..." with countdown      | Queue and retry after wait period           |
| **Tool execution failure**  | Show error in tool result card (collapsible)              | Return error to Claude for self-correction  |
| **File upload failure**     | Show error toast with retry button                        | Log error, return 4xx/5xx                   |
| **WebSocket disconnect**    | Show reconnection indicator, auto-reconnect               | Maintain session state for reconnection     |
| **Sub-agent failure**       | Show failed status on agent card                          | Return error to main agent                  |
| **Permission timeout**      | Show "Permission request expired" after 5 minutes         | Cancel pending tool execution               |
| **Session expired**         | Prompt to create new session or restore                   | Clean up resources                          |
| **Invalid tool parameters** | Show validation error in tool card                        | Return validation error to Claude           |
| **File not found**          | Show "File no longer available"                           | Return 404                                  |

---

_End of specification. Build phase by phase, validate each milestone before proceeding._
