# Puzzel Co-Work: Skills & Agent Architecture PRD

> **How Claude Cowork works, how Puzzel Co-Work works today, and what needs to change.**
>
> Version 1.0 · February 2026 · Author: Claude (AI) for Matt Hughes

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How Claude Cowork Works](#2-how-claude-cowork-works)
   - 2.1 [System Prompt Structure](#21-system-prompt-structure)
   - 2.2 [Skill System Architecture](#22-skill-system-architecture)
   - 2.3 [Tool System](#23-tool-system)
   - 2.4 [Agent Loop](#24-agent-loop)
   - 2.5 [Sub-Agent System](#25-sub-agent-system-task-tool)
   - 2.6 [Clarifying Questions](#26-clarifying-questions-askuserquestion)
   - 2.7 [Plan Mode](#27-plan-mode)
   - 2.8 [Task Tracking](#28-task-tracking-todowrite)
   - 2.9 [SSE Events](#29-server-sent-events-sse)
3. [Current Puzzel Co-Work State](#3-current-puzzel-co-work-state)
   - 3.1 [Tools](#31-tools-18-registered)
   - 3.2 [Agent Loop](#32-agent-loop)
   - 3.3 [Skill System (Before)](#33-skill-system-before-this-prd)
   - 3.4 [Skill System (After)](#34-skill-system-after-this-prd)
   - 3.5 [Database Schema](#35-database-schema)
   - 3.6 [Frontend Components](#36-frontend-components)
   - 3.7 [API Routes](#37-api-routes)
4. [Gap Analysis](#4-gap-analysis-puzzel-vs-claude-cowork)
5. [Recommended Next Steps](#5-recommended-next-steps)
6. [Files Modified](#6-files-modified-in-this-session)
7. [Architecture Flow](#7-architecture-flow)

---

## 1. Executive Summary

This PRD documents how Claude Cowork (Anthropic's desktop agent) implements its skill system, tool architecture, and agent loop, then maps each component to the equivalent in Puzzel Co-Work. The goal is to provide an authoritative reference so that the Puzzel skill system can be rebuilt to match Claude Cowork's proven patterns.

Claude Cowork is a desktop agent built on the Claude Agent SDK. It runs in a lightweight Linux VM, has access to a curated set of tools (Read, Write, Edit, Bash, Glob, Grep, etc.), and uses a structured skill system that lets users invoke specialised capabilities via tool calls.

**The key architectural insight:** skills are NOT injected as full content into the system prompt. Instead, skills are listed compactly (name + description) and the LLM explicitly calls a `Skill` tool to load their instructions on demand.

---

## 2. How Claude Cowork Works

### 2.1 System Prompt Structure

The Claude Cowork system prompt is a large, structured document organised with XML tags. Each section controls a specific behaviour domain:

| Section                  | Purpose                                                                  | XML Tag                     |
| ------------------------ | ------------------------------------------------------------------------ | --------------------------- |
| Application Details      | Identifies the product context (Cowork mode, Claude Agent SDK, Linux VM) | `<application_details>`     |
| Claude Behaviour         | Product info, refusal handling, tone/formatting, knowledge cutoff        | `<claude_behavior>`         |
| AskUserQuestion Guidance | When and how to ask clarifying questions                                 | `<ask_user_question_tool>`  |
| TodoList Guidance        | When to use TodoWrite and status rules                                   | `<todo_list_tool>`          |
| Citation Requirements    | When to include Sources: section                                         | `<citation_requirements>`   |
| Computer Use             | Skills, file creation, artifacts, file handling, package management      | `<computer_use>`            |
| User Context             | User name, email                                                         | `<user>`                    |
| Environment              | Today's date, model, folder access                                       | `<env>`                     |
| Skills Instructions      | How to invoke skills, available skills listing                           | `<skills_instructions>`     |
| Available Skills         | Full list of skills with name + description                              | `<available_skills>`        |
| Security Rules           | Injection defense, privacy, download rules, copyright                    | `<critical_security_rules>` |

**Key design principle:** the prompt is layered from general context down to specific instructions, with security rules forming an immutable boundary that cannot be overridden by any input.

---

### 2.2 Skill System Architecture

**This is the most critical section for the Puzzel implementation.** Claude Cowork's skill system uses a three-phase pattern:

#### Phase 1: Compact Listing in System Prompt

All available skills are listed in the system prompt inside an `<available_skills>` XML block. Each skill entry contains ONLY:

- **name**: The skill identifier (e.g., `pdf`, `xlsx`, `docx`, `web-artifacts-builder`)
- **description**: A one-line summary of when to use the skill
- **location**: The file path where the skill's SKILL.md lives (for the Skill tool to load)

**Crucially, the full skill content (the detailed instructions) is NOT included in the system prompt.** This keeps the prompt compact and avoids signal dilution when many skills exist.

Example of how skills appear in the system prompt:

```xml
<available_skills>
  <skill>
    <name>pdf</name>
    <description>
      Use this skill whenever the user wants to do anything with PDF files.
      This includes reading, extracting, merging, splitting, creating...
    </description>
    <location>/path/to/skills/pdf</location>
  </skill>
  <skill>
    <name>docx</name>
    <description>
      Use this skill whenever the user wants to create, read, edit Word documents...
    </description>
    <location>/path/to/skills/docx</location>
  </skill>
</available_skills>
```

#### Phase 2: LLM Decides to Invoke a Skill

The system prompt contains explicit instructions telling the LLM how to use skills:

> "When users ask you to perform tasks, check if any of the available skills can help complete the task more effectively."

> "When a skill matches the user's request, **this is a BLOCKING REQUIREMENT**: invoke the relevant Skill tool BEFORE generating any other response about the task."

> "NEVER mention a skill without actually calling this tool."

> "If you see a `<command-name>` tag in the current conversation turn, the skill has ALREADY been loaded — follow the instructions directly instead of calling this tool again."

**The LLM reads the user's message, scans the available skills list, and if a skill matches, it calls the Skill tool.** There is NO trigger matching, NO regex, NO spelling normalisation. The LLM itself decides whether a skill is relevant based on the description.

#### Phase 3: Skill Tool Returns Full Content

The Skill tool is a standard tool registered in the tool system. When called:

1. The LLM calls the Skill tool with the skill name (e.g., `skill: "pdf"`)
2. The Skill tool reads the skill's SKILL.md file from the file system
3. **The full skill content is returned as the tool result** (not injected into the system prompt)
4. The LLM reads the returned content and follows the skill's instructions precisely

**This is the critical difference from the old Puzzel implementation.** The skill content lives in the tool result, not the system prompt. This means:

- The system prompt stays small regardless of how many skills exist
- Only the relevant skill's content is loaded (on-demand, not all-at-once)
- The LLM sees the skill instructions in its most recent context (tool result), where attention is highest
- No fragile trigger matching is needed — the LLM's own reasoning decides which skill to use

#### Skill Tool Schema

```
Name: Skill
Parameters: {
  skill: string (required)   — The skill name
  args: string (optional)    — Optional arguments
}
Description: "Execute a skill within the main conversation..."
```

#### Skill File Structure

Each skill is a directory containing at minimum a `SKILL.md` file:

```
skills/
├── pdf/
│   └── SKILL.md           # Full instructions for PDF handling
├── docx/
│   ├── SKILL.md           # Full instructions for Word doc handling
│   └── scripts/           # Helper scripts
├── xlsx/
│   └── SKILL.md
└── web-artifacts-builder/
    └── SKILL.md
```

The SKILL.md file contains everything the LLM needs: step-by-step instructions, code examples, validation commands, critical rules, and common pitfalls.

---

### 2.3 Tool System

Claude Cowork provides a curated set of tools. Each tool has a name, description, parameter schema, and execution function.

#### Core Tools

| Tool            | Permission | Purpose                                                                 |
| --------------- | ---------- | ----------------------------------------------------------------------- |
| Read            | auto       | Read files from the filesystem (supports text, images, PDFs, notebooks) |
| Write           | auto       | Create new files or overwrite existing ones                             |
| Edit            | auto       | Exact string replacement in files (requires Read first)                 |
| Bash            | auto       | Execute terminal commands (git, npm, docker, etc.)                      |
| Glob            | auto       | Fast file pattern matching (e.g., `**/*.ts`)                            |
| Grep            | auto       | Regex content search across files (ripgrep-based)                       |
| WebFetch        | auto       | Fetch and process web URL content                                       |
| WebSearch       | auto       | Web search with current date awareness                                  |
| TodoWrite       | auto       | Create and manage structured task lists                                 |
| AskUserQuestion | auto       | Ask multiple-choice clarifying questions                                |
| EnterPlanMode   | auto       | Switch to planning mode (read-only tools)                               |
| ExitPlanMode    | auto       | Propose plan for user approval                                          |
| Task            | auto       | Launch sub-agents for complex multi-step work                           |
| Skill           | auto       | Load a skill's full instructions by name                                |
| NotebookEdit    | auto       | Edit Jupyter notebook cells                                             |

#### Tool Execution Flow

1. LLM decides to call a tool based on the user's request and available tool descriptions
2. Tool call is validated (parameter schema check)
3. Permission check: `auto` = execute immediately; `ask` = prompt user; `blocked` = deny
4. Tool executes and returns a result (content string + metadata)
5. Result is added to conversation as a `tool_result` message
6. Side effects fire (SSE events, DB updates, artifact creation)
7. LLM reads the tool result and continues (may call more tools or respond to user)

#### Tool Interface

```typescript
interface ToolExecutor {
  name: string;
  description: string;
  parameters: JSONSchema; // JSON Schema for input validation
  permissionLevel: "auto" | "ask" | "blocked";
  execute(
    input: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult>;
}

interface ToolResult {
  content: string; // Text returned to the LLM
  isError: boolean;
  metadata?: Record<string, unknown>; // Side-channel data (not visible to LLM)
}

interface ToolContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string; // Absolute path to session working directory
  planMode: boolean;
  sendEvent?: SSEEventSender; // For emitting real-time events
}
```

---

### 2.4 Agent Loop

The agent loop is the core runtime. It iterates between LLM calls and tool executions until either no more tool calls are needed or a maximum iteration limit is reached (25 iterations).

```
function runAgentLoop(messages, config):
  systemPrompt = assembleSystemPrompt(config)

  while iterations < MAX_ITERATIONS (25):
    result = callLLM(systemPrompt, messages, tools)
    streamTextToUser(result.text)

    if result.toolCalls.length === 0:
      break  // LLM is done, no more tools to call

    for each toolCall in result.toolCalls:
      checkPermission(toolCall)
      toolResult = executeTool(toolCall)
      emitSSEEvents(toolResult)
      addToConversation(toolCall, toolResult)

    // Loop: LLM sees tool results in the conversation and decides next action
```

#### System Prompt Assembly

The system prompt is assembled dynamically each time the agent loop starts:

1. **Base prompt** — Role, behaviours, tool usage rules
2. **Session state** — Pending todos, output files, active sub-agents
3. **Skill listing** — Compact list of available skills (name + description only)

#### History Management

Conversation history is managed to fit within token limits:

- **Last 20 messages** are kept in full
- **Older messages** are summarised (role + content type, tool names used)
- Tool call/result pairs from old messages are simplified to "Used tools: X, Y"

---

### 2.5 Sub-Agent System (Task Tool)

The Task tool spawns independent sub-agents that handle complex, multi-step work autonomously. Each sub-agent runs its own agent loop with restricted tool access.

| Type            | Tools Available       | Use Case                             |
| --------------- | --------------------- | ------------------------------------ |
| Bash            | Bash only             | Git operations, command execution    |
| general-purpose | All (minus recursive) | Complex multi-step tasks             |
| Explore         | Read-only tools       | Codebase exploration, file searching |
| Plan            | Read-only tools       | Designing implementation plans       |

**Restrictions:** Sub-agents cannot call Task, AskUserQuestion, GetSubAgentResults, Skill, or CreateSkill (prevents recursion and unsafe escalation).

Sub-agents can be launched in parallel. The parent agent can resume sub-agents by ID to continue their work.

---

### 2.6 Clarifying Questions (AskUserQuestion)

Claude Cowork uses a structured tool for gathering user input, not free-form text questions. The AskUserQuestion tool presents multiple-choice options with descriptions, supports multi-select, and always includes an "Other" option for custom input.

**Key rules:**

- Use it proactively before starting work (not after)
- 2–4 options per question, 1–4 questions per call
- Never use it to ask "is my plan ready?" (use ExitPlanMode instead)
- Each option has a label and description explaining what it means

---

### 2.7 Plan Mode

Plan mode is a read-only state where the LLM can only explore (Read, Glob, Grep, WebSearch, WebFetch) but cannot modify anything.

**Flow:**

```
EnterPlanMode (switches to read-only)
  → Explore codebase
  → Write plan to file
  → ExitPlanMode (presents plan for user approval)
  → User approves
  → Implementation begins with full tool access
```

**When to use:** New features, multiple valid approaches, architectural decisions, multi-file changes, unclear requirements.

**When NOT to use:** Single-line fixes, trivial tasks, pure research/exploration.

---

### 2.8 Task Tracking (TodoWrite)

TodoWrite manages a structured task list displayed as a widget in the UI.

Each task has three fields:

- **content**: Imperative form — "Run tests"
- **activeForm**: Present continuous — "Running tests"
- **status**: `pending` | `in_progress` | `completed`

**Rules:**

- Exactly ONE task `in_progress` at a time
- Mark complete immediately on finish
- Never mark incomplete tasks as done
- Include a verification step for non-trivial work

---

### 2.9 Server-Sent Events (SSE)

The agent loop communicates with the frontend via SSE. Events are emitted in real-time as the agent works.

| Event                | When Emitted             | Data                                    |
| -------------------- | ------------------------ | --------------------------------------- |
| `text_delta`         | LLM generates text       | `{ delta: string }`                     |
| `tool_use_start`     | Tool execution begins    | `{ id, name, input }`                   |
| `tool_result`        | Tool execution completes | `{ id, name, content, isError }`        |
| `todo_update`        | TodoWrite called         | `{ todos: TodoItem[] }`                 |
| `skill_activated`    | Skill tool invoked       | `{ skills: [{id, name, description}] }` |
| `permission_request` | Tool requires approval   | `{ requestId, toolName, input }`        |
| `ask_question`       | AskUserQuestion called   | `{ questionId, questions }`             |
| `plan_proposed`      | ExitPlanMode called      | `{ planContent }`                       |
| `artifact_created`   | File artifact created    | `{ id, fileName, mimeType }`            |
| `sub_agent_update`   | Sub-agent status change  | `{ agentId, status, description }`      |
| `message_end`        | Agent loop completes     | `{ usage }`                             |

---

## 3. Current Puzzel Co-Work State

### 3.1 Tools (18 Registered)

| Tool               | Permission | Status     | Notes                                   |
| ------------------ | ---------- | ---------- | --------------------------------------- |
| TodoWrite          | auto       | ✅ Working | Persists to DB via CoworkTodoItem model |
| Read               | auto       | ✅ Working | 10MB file limit                         |
| Write              | auto       | ✅ Working | Outputs in `outputs/` become artifacts  |
| Edit               | auto       | ✅ Working | String replacement                      |
| Glob               | auto       | ✅ Working | Pattern matching                        |
| Grep               | auto       | ✅ Working | Regex search                            |
| Bash               | ask        | ✅ Working | 2min default timeout, 10min max         |
| WebSearch          | auto       | ✅ Working | DuckDuckGo JSON API (free, unreliable)  |
| WebFetch           | auto       | ✅ Working | Fetch and process URLs                  |
| EnterPlanMode      | auto       | ✅ Working | Restricts to read-only tools            |
| ExitPlanMode       | auto       | ✅ Working | Proposes plan for approval              |
| AskUserQuestion    | auto       | ✅ Working | Multi-choice with blocking              |
| Task               | auto       | ✅ Working | Sub-agents (bash/general/explore/plan)  |
| GetSubAgentResults | auto       | ✅ Working | Poll sub-agent results                  |
| CreateDocument     | auto       | ✅ Working | Generate .docx files                    |
| CreateSpreadsheet  | auto       | ⚠️ Partial | Minimal implementation                  |
| Skill              | auto       | ✅ Fixed   | Now returns full content (was broken)   |
| CreateSkill        | auto       | ✅ Working | Create reusable skills in DB            |

All tools are registered in `src/lib/cowork/tools/register.ts` and follow the `ToolExecutor` interface.

---

### 3.2 Agent Loop

**File:** `src/lib/cowork/agent-loop.ts`

The Puzzel agent loop follows the same pattern as Claude Cowork: iterate between LLM calls and tool executions up to 25 times. It supports both Anthropic and OpenAI providers with a canonical message format that translates between them.

**Key differences from Claude Cowork:**

- **Multi-provider support:** Supports OpenAI as a provider (Claude Cowork is Anthropic-only). This requires translating between Anthropic's `tool_use`/`tool_result` content blocks and OpenAI's `tool_calls` array format.
- **Document follow-up heuristic:** Injects a CreateDocument prompt if the LLM generates document-like content but doesn't call CreateDocument. Claude Cowork doesn't have this.
- **History truncation:** Keeps last 20 messages and summarises older ones (simplistic — loses semantic context).
- **Permission requests:** Uses an in-memory map with 5-minute timeout (not production-ready for multi-instance deployments).
- **OpenAI streaming fix:** Tool call arguments are accumulated across multiple chunks using an `indexToIdMap` (OpenAI only sends `id` on the first chunk, subsequent chunks use `index`).

---

### 3.3 Skill System (Before This PRD)

The Puzzel skill system had been through multiple failed iterations. The fundamental problems were:

**Problem 1: Full content injection.** All skill content was dumped into the system prompt. With multiple skills, this bloated the prompt and diluted the signal, causing the LLM to ignore skills entirely.

**Problem 2: Broken Skill tool.** The Skill tool existed but returned just `"Skill loaded successfully"` instead of the actual skill content. The LLM had no way to read a skill's instructions.

**Problem 3: No prompt guidance.** The base prompt never told the LLM to call the Skill tool. The LLM defaulted to CreateDocument for everything.

**Problem 4: Fragile trigger matching.** Hacks like regex-based trigger matching, British/American spelling normalisation, and document follow-up suppression were applied as workarounds. None solved the root problem.

---

### 3.4 Skill System (After This PRD)

The fixes applied in this session replicate Claude Cowork's three-phase pattern:

1. **Compact listing:** Skills are listed in the system prompt as name + description only. Full content is NOT injected.
2. **LLM decides:** The base prompt explicitly tells the LLM to call the Skill tool when a request matches a listed skill.
3. **Tool returns content:** The Skill tool now returns the full skill instructions as the tool result. The LLM reads and follows them.

**Files changed:**

| File                               | Change                                                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/cowork/tools/skill.ts`    | Returns full skill content as tool result (was returning just "loaded successfully")                                                                       |
| `src/lib/cowork/agent-loop.ts`     | System prompt lists skills compactly (name + description); base prompt tells LLM to call Skill tool; removed trigger matching and `sessionHasSkills` hacks |
| `src/lib/cowork/tool-execution.ts` | Emits `skill_activated` SSE event when Skill tool executes (for frontend UI pill)                                                                          |

---

### 3.5 Database Schema

**File:** `prisma/schema.prisma`

#### CoworkSession

```
id, userId, organizationId, title,
status (ACTIVE | PAUSED | COMPLETED | ERROR),
model, systemPrompt?, planMode (bool),
→ messages[], todos[], files[], subAgents[], skills[]
```

#### CoworkMessage

```
id, sessionId, role (USER | ASSISTANT | SYSTEM),
content (JSON: MessageContent[]),
metadata (JSON: tokenUsage, toolCalls, subAgentId),
createdAt
```

#### CoworkTodoItem

```
id, sessionId, content (imperative), activeForm (present continuous),
status (PENDING | IN_PROGRESS | COMPLETED),
sortOrder (int), createdAt, updatedAt
```

#### CoworkFile

```
id, sessionId, fileName, mimeType, sizeBytes,
category (UPLOAD | OUTPUT | WORKING),
storagePath, downloadUrl,
metadata (JSON: artifactType, generatedBy),
createdAt
```

#### CoworkSubAgent

```
id, sessionId, description,
type (BASH | GENERAL_PURPOSE | EXPLORE | PLAN),
status (RUNNING | COMPLETED | FAILED | CANCELLED),
prompt (text), result (text?), model?,
turns (int), maxTurns (int),
createdAt, completedAt?
```

#### CoworkSkill

```
id, organizationId, sessionId? (null = org-wide),
name, description (text), category,
triggers (JSON: string[]), tags (JSON: string[]),
content (text), parameters (JSON: SkillParameter[]),
exampleInput (text?), exampleOutput (text?),
version (int), status (draft | published),
createdById?, createdAt, updatedAt
```

#### CoworkSettings

```
id, organizationId (unique),
defaultProvider (anthropic | openai),
defaultModel, temperature (float), maxTokens (int),
systemPrompt (text?), createdAt, updatedAt
```

---

### 3.6 Frontend Components

**State management:** React Context + useReducer for global `CoworkAppState`. Tracks sessions, messages, todos, files, sub-agents, UI state. 50+ action types.

| Component           | Purpose                                             | Status     |
| ------------------- | --------------------------------------------------- | ---------- |
| `CoworkCentrePanel` | Main chat area with message history + SSE streaming | ✅ Working |
| `CoworkMessageItem` | Single message renderer with sub-blocks             | ✅ Working |
| `CoworkInputArea`   | User input + file upload                            | ✅ Working |
| `CoworkSidebar`     | Session list + navigation                           | ✅ Working |
| `CoworkRightPanel`  | Artifacts, files, tasks, tools panels               | ✅ Working |
| `CapabilitiesPanel` | List of available tools/skills                      | ✅ Working |
| `CoworkTodoWidget`  | Inline todo list display                            | ✅ Working |
| `SkillDraftCard`    | Skill creation review UI                            | ✅ Working |
| `EmptyStateWidget`  | Initial session state                               | ✅ Working |

#### Message Block Renderers

| Block Type           | Renderer               | Behaviour                                    |
| -------------------- | ---------------------- | -------------------------------------------- |
| `text`               | TextBlock              | Markdown formatting                          |
| `tool_use`           | ToolUseBlock           | Show tool name + input JSON                  |
| `tool_result`        | ToolResultBlock        | Show result, highlight errors in red         |
| `permission_request` | PermissionRequestBlock | Approval/denial buttons                      |
| `plan`               | PlanBlock              | Show steps with status badges                |
| `sub_agent_status`   | SubAgentStatusBlock    | List agents with status + turn counts        |
| `skill_activated`    | SkillActivatedBlock    | Purple pill: "Using skill: X"                |
| `ask_user`           | AskUserBlock           | Multi-choice question with buttons           |
| `artifact`           | ArtifactBlock          | Preview artifact (HTML, MD, SVG, code, etc.) |
| `error`              | ErrorBlock             | Error message with code                      |
| `todo_update`        | CoworkTodoWidget       | Inline todo list                             |

---

### 3.7 API Routes

#### Session Management

| Endpoint                   | Method | Purpose                               |
| -------------------------- | ------ | ------------------------------------- |
| `/api/cowork/sessions`     | GET    | List user's sessions                  |
| `/api/cowork/sessions`     | POST   | Create new session                    |
| `/api/cowork/sessions/:id` | GET    | Get session details                   |
| `/api/cowork/sessions/:id` | PATCH  | Update session (title, status, model) |
| `/api/cowork/sessions/:id` | DELETE | Delete session                        |

#### Message Streaming

| Endpoint                            | Method | Purpose                            |
| ----------------------------------- | ------ | ---------------------------------- |
| `/api/cowork/sessions/:id/messages` | GET    | Paginated message history          |
| `/api/cowork/sessions/:id/messages` | POST   | Send message → stream SSE response |

#### Sub-agents

| Endpoint                                          | Method | Purpose                  |
| ------------------------------------------------- | ------ | ------------------------ |
| `/api/cowork/sessions/:id/agents`                 | GET    | List active sub-agents   |
| `/api/cowork/sessions/:id/agents/:agentId/cancel` | POST   | Cancel running sub-agent |

#### Files & Artifacts

| Endpoint                                   | Method | Purpose            |
| ------------------------------------------ | ------ | ------------------ |
| `/api/cowork/sessions/:id/files`           | GET    | List session files |
| `/api/cowork/sessions/:id/files`           | POST   | Create file record |
| `/api/cowork/sessions/:id/files/upload`    | POST   | Client file upload |
| `/api/cowork/sessions/:id/files/:filename` | GET    | Download file      |

#### Permissions & Plan

| Endpoint                                          | Method | Purpose                         |
| ------------------------------------------------- | ------ | ------------------------------- |
| `/api/cowork/sessions/:id/permissions/:requestId` | POST   | Approve/deny permission request |
| `/api/cowork/sessions/:id/plan/approve`           | POST   | Approve proposed plan           |
| `/api/cowork/sessions/:id/plan/reject`            | POST   | Reject proposed plan            |

#### Skills

| Endpoint                 | Method | Purpose                   |
| ------------------------ | ------ | ------------------------- |
| `/api/cowork/skills`     | GET    | List org + session skills |
| `/api/cowork/skills`     | POST   | Create skill              |
| `/api/cowork/skills/:id` | GET    | Get skill details         |
| `/api/cowork/skills/:id` | PATCH  | Update skill              |
| `/api/cowork/skills/:id` | DELETE | Delete skill              |

#### Settings

| Endpoint               | Method | Purpose                                |
| ---------------------- | ------ | -------------------------------------- |
| `/api/cowork/settings` | GET    | Org settings (default provider, model) |
| `/api/cowork/settings` | PATCH  | Update org settings                    |

---

## 4. Gap Analysis: Puzzel vs Claude Cowork

| Area                   | Claude Cowork                                              | Puzzel Co-Work                                        | Gap                 |
| ---------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | ------------------- |
| Skill listing format   | XML block with `<skill>` tags: name, description, location | Markdown list: `- **Name**: description`              | 🟢 Minor            |
| Skill content delivery | Reads SKILL.md file from filesystem via tool result        | Reads from DB (content field) or file via tool result | 🟢 Resolved         |
| Skill invocation       | Skill tool called with skill name; returns full content    | Same pattern (fixed in this session)                  | 🟢 Resolved         |
| Prompt guidance        | BLOCKING REQUIREMENT to call Skill before other responses  | "MUST call Skill tool BEFORE doing anything else"     | 🟢 Resolved         |
| Trigger matching       | None — LLM decides based on description                    | Legacy code exists but no longer on critical path     | 🟢 Resolved         |
| Slash commands         | Users type `/skill-name` to invoke skills directly         | Not implemented — no slash command detection          | 🟡 Medium           |
| Skill file structure   | Each skill is a directory with SKILL.md file               | DB-backed with content field; file-based for built-in | 🟢 Minor            |
| Parameter handling     | `{{parameter}}` placeholders in skill content              | Defined in schema but not enforced at runtime         | 🟡 Medium           |
| User skill feedback    | Skill activated UI indicator                               | SkillActivatedBlock component (purple pill)           | 🟢 Resolved         |
| Permission system      | Sandboxed VM environment                                   | In-memory map with 5min timeout                       | 🔴 Major            |
| History management     | Full context window with truncation                        | Keeps last 20, summarises rest (lossy)                | 🟡 Medium           |
| Sub-agent results      | Auto-injected into parent context                          | Requires explicit GetSubAgentResults call             | 🟡 Medium           |
| Skill versioning       | N/A (file-based, git-tracked)                              | `version` field exists but no logic                   | 🟢 Low              |
| Skill deletion         | Delete directory                                           | DELETE endpoint exists                                | 🟢 Resolved         |
| WebSearch reliability  | Anthropic's infrastructure                                 | DuckDuckGo free API (can fail)                        | 🟡 Medium           |
| Multi-provider support | Anthropic only                                             | Anthropic + OpenAI                                    | 🟢 Puzzel advantage |

---

## 5. Recommended Next Steps

The skill system's core architecture is now aligned with Claude Cowork. The following improvements are recommended in priority order:

### 5.1 Slash Command Support (High Priority)

Claude Cowork allows users to type `/skill-name` to invoke skills directly. This is a significant UX improvement.

**Implementation:**

- Detect messages starting with `/` in the frontend input handler
- Extract the skill name and pass it as a tool call hint to the agent loop
- The agent loop pre-populates a Skill tool call before running the LLM iteration

### 5.2 Parameter Binding (High Priority)

Skills define parameters with `{{parameter_name}}` placeholders, but these aren't enforced at runtime. When a skill has required parameters, the agent should ask for them before proceeding.

**Implementation:**

- When the Skill tool returns content with `{{param}}` placeholders, the LLM should call AskUserQuestion for missing values
- The base prompt should include guidance: "If a skill has `{{parameter}}` placeholders, ask the user for values before proceeding"
- Consider extracting parameter definitions from the skill and including them in the Skill tool result

### 5.3 Permission System Hardening (Medium Priority)

The current in-memory permission map won't survive server restarts or work in multi-instance deployments.

**Options:**

- Move permission state to the database (CoworkPermissionRequest model)
- Use Redis for distributed state if running multiple instances
- Add configurable timeout (currently hardcoded to 5 minutes)

### 5.4 Sub-Agent Results Auto-Injection (Medium Priority)

Currently, the parent agent must call GetSubAgentResults to see what sub-agents produced. In Claude Cowork, results flow automatically.

**Implementation:**

- When a sub-agent completes, inject its result into the parent's message history
- Continue the parent's agent loop with the injected result
- Emit an SSE event so the frontend can show the result immediately

### 5.5 History Preservation (Low Priority)

The current truncation strategy (keep last 20 messages, summarise the rest) loses semantic context.

**Options:**

- Use an LLM call to generate a proper summary of older messages
- Keep tool call/result pairs intact (don't split them across the truncation boundary)
- Implement token counting before hitting API limits

### 5.6 Skill Quality Enforcement (Low Priority)

When users create skills via the chat, the generated prompts vary in quality. Consider:

- Minimum word count validation in CreateSkill tool
- A skill quality scoring step (LLM evaluates the prompt before saving)
- Skill templates for common categories (Analysis, Writing, Code, etc.)

---

## 6. Files Modified in This Session

| File                               | Change                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/cowork/tools/skill.ts`    | Skill tool now returns full skill content as tool result (was returning just "loaded successfully"). Updated tool description.                                                                                                                                      |
| `src/lib/cowork/agent-loop.ts`     | System prompt lists skills compactly (name + description only). Added "Using custom skills" section to base prompt telling LLM to call Skill tool. Removed trigger matching, `sessionHasSkills` flag, and `matchSkills()` calls. Removed `loadSkillContent` import. |
| `src/lib/cowork/tool-execution.ts` | Emits `skill_activated` SSE event with skill name when Skill tool executes (for frontend UI pill).                                                                                                                                                                  |

No new files were created. No frontend changes were needed — `SkillActivatedBlock` and the SSE handler already existed.

---

## 7. Architecture Flow

The complete flow from user message to skill execution:

```
User: "analyse this legal document for short notice periods"
  │
  ▼
System Prompt (assembled):
  ├── Base behaviours and tool guidance
  ├── "Using custom skills: MUST call Skill tool when request matches..."
  ├── Available Custom Skills:
  │     - Legal Document Analyser: Analyse contracts for notice period issues
  │     - Email Drafter: Draft professional emails
  └── Session state (todos, files, sub-agents)
  │
  ▼
LLM reads prompt + user message, decides to call Skill tool
  │
  ▼
Tool Call: Skill({ skillName: "Legal Document Analyser" })
  │
  ▼
Skill tool loads content from DB:
  "# Skill: Legal Document Analyser
   Description: Analyse contracts for notice period issues
   You are an expert legal analyst specialising in contract compliance...
   Step 1: Identify all clauses containing notice periods...
   Step 2: Flag any notice period under 30 days..."
  │
  ▼
SSE Event: skill_activated { skills: [{name: "Legal Document Analyser"}] }
  │
  ▼
Frontend: Shows purple pill "Using skill: Legal Document Analyser"
  │
  ▼
LLM reads skill content from tool result, follows instructions
  │
  ▼
LLM responds with structured analysis (per skill instructions)
```

This matches the Claude Cowork pattern exactly: compact listing in prompt → LLM calls tool → tool returns content → LLM follows instructions.
