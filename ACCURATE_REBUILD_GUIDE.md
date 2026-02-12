# Accurate Rebuild Guide for Puzzel Cowork

This guide reflects the **actual state** of the codebase as of the last audit. It corrects architectural misrepresentations, separates implemented features from planned ones, and provides realistic timelines. Use this document (not older rebuild guides) when planning or executing a rebuild.

---

## Part 0: Current State Assessment

**Purpose:** Before rebuilding, understand exactly what exists, what is partial, and what does not exist.

### Fully Implemented (can reference existing code)

| Area                                                           | Status | Reference                                                                                                                              |
| -------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Database schema                                                | Done   | [prisma/schema.prisma](prisma/schema.prisma)                                                                                           |
| Auth (JWT, cookies, CSRF)                                      | Done   | [src/lib/auth/](src/lib/auth/), [src/lib/csrf.ts](src/lib/csrf.ts)                                                                     |
| Core tools (Read, Write, Edit, Bash, TodoWrite, Task, etc.)    | Done   | [src/lib/cowork/tools/](src/lib/cowork/tools/)                                                                                         |
| Sub-agent orchestration                                        | Done   | [src/lib/cowork/sub-agent.ts](src/lib/cowork/sub-agent.ts)                                                                             |
| Skills system (metadata, trigger matching)                     | Done   | [src/lib/cowork/skills.ts](src/lib/cowork/skills.ts)                                                                                   |
| Streaming (SSE, provider-specific)                             | Done   | [src/lib/cowork/agent-loop.ts](src/lib/cowork/agent-loop.ts), [src/lib/cowork/llm.ts](src/lib/cowork/llm.ts)                           |
| File upload/download, session storage                          | Done   | [src/app/api/cowork/sessions/[id]/files/](src/app/api/cowork/sessions/)                                                                |
| Basic chat UI (three-column layout)                            | Done   | [src/app/cowork/page.tsx](src/app/cowork/page.tsx), [src/components/cowork/](src/components/cowork/)                                   |
| Message blocks (text, tool, todo, permission, plan, sub_agent) | Done   | [src/components/cowork/CoworkMessageItem.tsx](src/components/cowork/CoworkMessageItem.tsx)                                             |
| RBAC, audit logging, rate limiting                             | Done   | [src/lib/permissions.ts](src/lib/permissions.ts), [src/lib/audit.ts](src/lib/audit.ts), [src/lib/rate-limit.ts](src/lib/rate-limit.ts) |

### Partially Implemented (basic version exists, enhancement needed)

| Area               | Status  | Notes                                                             |
| ------------------ | ------- | ----------------------------------------------------------------- |
| UX polish          | Partial | No block reordering, no collapsible sub-agents, no tool summaries |
| Admin interface    | Partial | Layout and sidebar exist; full CRUD and flows may need completion |
| Artifact rendering | Partial | Basic viewer; advanced (PDF preview, JSX runtime) may be limited  |
| Plan mode UI       | Partial | Approve/Reject exist; Edit and banner may be missing              |

### Not Implemented (greenfield or planned only)

| Area                                | Status      | Notes                                                                                                                                                                                                   |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM provider abstraction            | Not built   | Single file [src/lib/cowork/llm.ts](src/lib/cowork/llm.ts) with switch branching; no canonical format or adapters. Spec: [Plan/llm-provider-abstraction-spec.md](Plan/llm-provider-abstraction-spec.md) |
| Plugin system                       | Not started | No plugin routes, schema, or directory structure                                                                                                                                                        |
| MCP connectors                      | Not present | No MCP-related code                                                                                                                                                                                     |
| Tool Discovery / Capabilities Panel | Not built   | No empty-state widget or "What I can do" panel                                                                                                                                                          |
| Advanced UX from specs              | Not built   | Block reordering, separator banners, collapsible sub-agents, duration badges, progress bars, status line                                                                                                |

### Documentation conflicts

- [UX_IMPROVEMENTS_COMPLETE.md](UX_IMPROVEMENTS_COMPLETE.md): sub-agents expanded by default when complete; includes separator banner.
- [COLLAPSIBLE_DESIGN_COMPLETE.md](COLLAPSIBLE_DESIGN_COMPLETE.md): sub-agents collapsed by default when complete; no separator.
- **Neither design is implemented.** When rebuilding UX, choose one approach and implement it.

---

## Prerequisites

Before following this guide, ensure:

| Requirement                | Status   | Notes                                                                                        |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Docker                     | Required | For PostgreSQL (port 5434)                                                                   |
| Node.js 20+                | Required |                                                                                              |
| pnpm 9.0.0                 | Required | See [package.json](package.json) `packageManager`                                            |
| Anthropic API key          | Required | App uses LLM; not optional for full functionality                                            |
| OpenAI API key             | Optional | For provider switching                                                                       |
| Container runtime for bash | Unclear  | Guide may claim "isolated container per session"; verify if only directory isolation is used |

---

## Part 1: Foundation Setup (Week 1)

**Status: Fully Implemented** — Recreate from scratch using existing configs.

### 1.1 Project Initialization

```bash
mkdir puzzel-co-work-rebuild
cd puzzel-co-work-rebuild
pnpm create next-app@16.1.6 . --typescript --tailwind --app --import-alias "@/*"
echo '{"packageManager":"pnpm@9.0.0"}' >> package.json
```

Key decisions: Next.js 16.1.6 (App Router), TypeScript 5.9.3, Tailwind CSS 4, pnpm 9.0.0, port 3002.

### 1.2–1.6

Install dependencies per [package.json](package.json). Set up database with [docker-compose.yml](docker-compose.yml) (port 5434). Copy [prisma/schema.prisma](prisma/schema.prisma), run `pnpm db:generate` and `pnpm db:push`. Configure `.env` (no quotes around API keys). Use [next.config.ts](next.config.ts) for security headers and `serverExternalPackages`.

---

## Part 2: Design System & Styling (Week 1–2)

**Status: Fully Implemented**

### 2.1 Global CSS

Copy [src/app/globals.css](src/app/globals.css): CSS variables (white background, dark text, purple accents), spacing, typography. No hardcoded colors.

### 2.2 Layout Structure — Correct UI Architecture

**Important:** Tasks/todos are in the **center panel**, not the right panel.

| Column     | Component                                                            | Contents                                                                                                         |
| ---------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Left**   | [CoworkSidebar.tsx](src/components/cowork/CoworkSidebar.tsx)         | Sessions list, New Task                                                                                          |
| **Center** | [CoworkCentrePanel.tsx](src/components/cowork/CoworkCentrePanel.tsx) | **Chat** tab (message stream) and **Tasks** tab ([CoworkTodoWidget](src/components/cowork/CoworkTodoWidget.tsx)) |
| **Right**  | [CoworkRightPanel.tsx](src/components/cowork/CoworkRightPanel.tsx)   | **Artifacts** tab (selected file viewer) and **Files** tab (uploads/outputs)                                     |

Tasks receive real-time updates via `todo_update` SSE events; the client updates the Tasks tab in the center panel. Reference layout: [src/app/cowork/page.tsx](src/app/cowork/page.tsx) lines 179–210.

### 2.3 Typography

Fonts in [src/app/layout.tsx](src/app/layout.tsx) (Space Grotesk, DM Sans as in original guide).

---

## Part 3: Authentication & Security (Week 2)

**Status: Fully Implemented**

Implement JWT auth ([src/lib/auth/](src/lib/auth/)), CSRF ([src/lib/csrf.ts](src/lib/csrf.ts)), password hashing ([src/lib/password.ts](src/lib/password.ts)), RBAC ([src/lib/permissions.ts](src/lib/permissions.ts)), audit ([src/lib/audit.ts](src/lib/audit.ts)), rate limiting ([src/lib/rate-limit.ts](src/lib/rate-limit.ts)). API route order: CSRF → Auth → Organization → Rate Limit → Validate → Logic → Audit → Response. See [AGENTS.md](AGENTS.md).

---

## Part 4: Database Seeding (Week 2)

**Status: Fully Implemented**

Use [prisma/seed.ts](prisma/seed.ts) for roles, permissions, admin user, default organization. Run with `ADMIN_PASSWORD=... pnpm db:seed`.

---

## Part 5: LLM Provider Abstraction Layer (Week 3)

**Status: Not Implemented — New Development Required**

```
⚠️ GREENFIELD WORK — NOT CURRENTLY IMPLEMENTED
The codebase uses direct provider calls with switch branching.
This section describes a new abstraction layer to be built.
Estimated effort: 40–60 hours.
```

**Current implementation:**

- Single file [src/lib/cowork/llm.ts](src/lib/cowork/llm.ts) with provider switching.
- [src/lib/cowork/agent-loop.ts](src/lib/cowork/agent-loop.ts): `runAnthropicIteration()` and `runOpenAIIteration()` with provider-specific message/tool formats.
- Tools exposed per provider via [src/lib/cowork/tools/index.ts](src/lib/cowork/tools/index.ts): `getAnthropicTools()`, `getOpenAITools()`.

**Planned design (to build):** See [Plan/llm-provider-abstraction-spec.md](Plan/llm-provider-abstraction-spec.md). Implement:

- Canonical types: `CanonicalToolDefinition`, `CanonicalMessage`, `CanonicalContentBlock`, etc.
- `src/lib/cowork/llm/` directory: `types.ts`, `adapters/claude.ts`, `adapters/openai.ts`, `adapters/interface.ts`, `provider-manager.ts`, `index.ts`.
- Adapters convert to/from provider formats; application code uses only canonical format.
- Error normalization per spec.

---

## Part 6: Tool Execution Engine (Weeks 3–4)

**Status: Fully Implemented**

Tool registry: [src/lib/cowork/tools/register.ts](src/lib/cowork/tools/register.ts). Tools: [file-tools.ts](src/lib/cowork/tools/file-tools.ts), [bash.ts](src/lib/cowork/tools/bash.ts), [web-search.ts](src/lib/cowork/tools/web-search.ts), [web-fetch.ts](src/lib/cowork/tools/web-fetch.ts), [todo-write.ts](src/lib/cowork/tools/todo-write.ts), [ask-user.ts](src/lib/cowork/tools/ask-user.ts), [task.ts](src/lib/cowork/tools/task.ts), [skill.ts](src/lib/cowork/tools/skill.ts), [plan-mode.ts](src/lib/cowork/tools/plan-mode.ts), [create-document.ts](src/lib/cowork/tools/create-document.ts), [create-spreadsheet.ts](src/lib/cowork/tools/create-spreadsheet.ts). Handler pattern and `ToolContext`/`ToolResult` in [src/lib/cowork/tools/types.ts](src/lib/cowork/tools/types.ts). Bash: verify whether isolation is directory-only or container-based.

---

## Part 7: Chat Engine & Streaming (Weeks 4–5)

**Status: Fully Implemented**

Agent loop: [src/lib/cowork/agent-loop.ts](src/lib/cowork/agent-loop.ts). Context assembly: [src/lib/cowork/context.tsx](src/lib/cowork/context.tsx) (and related). Messages API: [src/app/api/cowork/sessions/[id]/messages/route.ts](src/app/api/cowork/sessions/[id]/messages/route.ts). SSE events: `message_start`, `content_delta`, `tool_use_start`, `tool_result`, `todo_update`, `artifact_created`, `sub_agent_update`, `permission_request`, `ask_question`, `plan_proposed`, `message_end`, `error`.

---

## Part 8: Todo System (Week 5)

**Status: Fully Implemented**

Todo persistence: [src/lib/cowork/plan-store.ts](src/lib/cowork/plan-store.ts). TodoWrite tool: [src/lib/cowork/tools/todo-write.ts](src/lib/cowork/tools/todo-write.ts). On TodoWrite: DB update + `todo_update` SSE. Client shows todos in **center panel Tasks tab** via [CoworkTodoWidget.tsx](src/components/cowork/CoworkTodoWidget.tsx).

---

## Part 9: File Management (Weeks 5–6)

**Status: Fully Implemented**

Session layout: `storage/sessions/{sessionId}/uploads`, `outputs`, `working`. Upload: [src/app/api/cowork/sessions/[id]/files/upload/route.ts](src/app/api/cowork/sessions/[id]/files/upload/route.ts). Download: use existing route pattern for file by ID. Text extraction: implement or confirm (PDF, DOCX, XLSX) per project needs.

---

## Part 10: Artifact Rendering (Week 6)

**Status: Partially Implemented**

[src/components/cowork/ArtifactRenderer.tsx](src/components/cowork/ArtifactRenderer.tsx) handles artifact types. Enhance per [Plan/cowork-web-specification.md](Plan/cowork-web-specification.md) Section 5.4 (HTML, JSX, PDF, etc.) as needed.

---

## Part 11: Sub-Agent System (Weeks 6–7)

**Status: Fully Implemented**

Orchestrator: [src/lib/cowork/sub-agent.ts](src/lib/cowork/sub-agent.ts) (`spawnSubAgent`, status, cancel). Task tool: [src/lib/cowork/tools/task.ts](src/lib/cowork/tools/task.ts). DB: `CoworkSubAgent` in [prisma/schema.prisma](prisma/schema.prisma). Parallel execution and `sub_agent_update` events are implemented.

---

## Part 12: Skills System (Weeks 7–8)

**Status: Fully Implemented**

Skills under [storage/skills/](storage/skills/) (docx, xlsx, web-artifacts-builder, internal-comms). Registry: [src/lib/cowork/skills.ts](src/lib/cowork/skills.ts) (metadata, trigger matching, content loading). Skill tool: [src/lib/cowork/tools/skill.ts](src/lib/cowork/tools/skill.ts).

---

## Part 13: Plugin System (Weeks 8–9)

**Status: Future Feature — Not Started**

```
🔮 FUTURE FEATURE — NOT STARTED
No plugin infrastructure exists in the current codebase.
Estimated effort: 80–120 hours (new system).
Decision: Include in rebuild? Yes / No / Phase 2
```

No plugin routes, schema, or directory structure. Omit or plan as Phase 2.

---

## Part 14: Frontend UI (Weeks 9–12)

**Status: Partially Implemented**

### 14A. Current Implementation (What Exists)

- **Layout:** Three columns as in Part 2 (sidebar, center with Chat + Tasks tabs, right with Artifacts + Files).
- **Message blocks:** Text, tool_use, tool_result, todo, permission, plan, sub_agent_status, artifact, ask_user, error — see [CoworkMessageItem.tsx](src/components/cowork/CoworkMessageItem.tsx).
- **CoworkTodoWidget:** List with icons (pending/in_progress/completed), completed count — [CoworkTodoWidget.tsx](src/components/cowork/CoworkTodoWidget.tsx).
- **Tool cards:** Collapsible, show JSON input/result.
- **Sub-agent status:** Turn N/M, per-agent Cancel.
- **Permission cards:** Allow/Deny.
- **Artifact chips:** Click opens right panel Artifacts tab.
- **Input:** [CoworkInputArea.tsx](src/components/cowork/CoworkInputArea.tsx).

### 14B. Advanced UX (Planned, Not Implemented)

- Block reordering (e.g. sub_agent_status before text).
- Collapsible sub-agent sections (choose UX_IMPROVEMENTS vs COLLAPSIBLE_DESIGN approach).
- Separator banners (“All tasks completed. Final response below.”).
- Tool-specific one-line summaries (“Read file.pdf • 0.3s”).
- Progress bars (top bar, todo widget).
- Status line below messages.
- Plan mode banner.
- Tool Discovery / Capabilities Panel (Part 15 — new work).
- Duration badges, success animations, tab title indicators (e.g. ⏳/✅).

Reference: [Plan/cowork-chat-ux-specification.md](Plan/cowork-chat-ux-specification.md).

---

## Part 15: Tool Discovery UI (Week 12)

**Status: Not Implemented — New Work**

Capabilities panel (“What I can do”), search, category cards, and empty-state widget with “See all capabilities” are specified in the UX spec but not built. Implement when prioritising discoverability.

---

## Part 16: Admin Interface (Week 13)

**Status: Partially Implemented**

Admin layout and sidebar: [src/app/admin/](src/app/admin/), [src/components/admin/AdminSidebar.tsx](src/components/admin/AdminSidebar.tsx). Organizations and users pages exist; complete CRUD and flows as needed.

---

## Part 17: Deployment & Production (Week 14)

**Status: Fully Implemented (configs)**

Production env vars, security headers in [next.config.ts](next.config.ts), use `prisma migrate deploy` in production. Build: `pnpm build`, `pnpm start` (port 3002). Follow [AGENTS.md](AGENTS.md) and deployment security practices.

---

## Part 18: Testing & QA (Week 15+)

**Status: Not Implemented**

No test suite found. Add integration tests (auth, API, tools, streaming) and E2E as per original guide. Provider compatibility matrix (Claude vs OpenAI) is relevant once LLM abstraction exists.

---

## Timeline Summary

| Phase           | Weeks | Status                                              |
| --------------- | ----- | --------------------------------------------------- |
| Foundation      | 1–2   | Done                                                |
| Security        | 2–3   | Done                                                |
| LLM abstraction | +2    | New work (40–60 h)                                  |
| Tools           | 3–5   | Done                                                |
| Chat + features | 5–7   | Done / partial                                      |
| Plugins         | 8–9   | Optional future                                     |
| Frontend        | 9–14  | Partial; advanced UX + Tool Discovery add 2–3 weeks |
| Admin           | 13    | Partial; +1 week                                    |
| Production      | 14    | Done                                                |
| Testing         | 15+   | New; 1–2 weeks                                      |

**Realistic total: 20–24 weeks** (original 15-week estimate did not account for missing abstraction and optional/future work).

---

## Appendix A: Key File References

- Config: [package.json](package.json), [prisma/schema.prisma](prisma/schema.prisma), [docker-compose.yml](docker-compose.yml), [next.config.ts](next.config.ts), [middleware.ts](middleware.ts)
- Styling: [src/app/globals.css](src/app/globals.css)
- Docs: [README.md](README.md), [AGENTS.md](AGENTS.md), [Plan/cowork-web-specification.md](Plan/cowork-web-specification.md), [Plan/llm-provider-abstraction-spec.md](Plan/llm-provider-abstraction-spec.md), [Plan/cowork-chat-ux-specification.md](Plan/cowork-chat-ux-specification.md)
- Skills: [.cursor/skills/](.cursor/skills/), [storage/skills/](storage/skills/)

---

## Appendix B: Documentation Conflicts (UX)

Two docs describe different UX for the same features; neither is fully implemented:

| Topic                           | UX_IMPROVEMENTS_COMPLETE.md                        | COLLAPSIBLE_DESIGN_COMPLETE.md           |
| ------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| Sub-agent default when complete | Expanded                                           | Collapsed                                |
| Separator after sub-agents      | Yes (“All tasks completed. Final response below.”) | No (removed)                             |
| Tool grouping                   | Not specified                                      | Single ToolActivityBlock, “Used N tools” |

**Recommendation:** Pick one approach (e.g. COLLAPSIBLE_DESIGN for less clutter) and implement it consistently; remove or update the other doc to avoid confusion.

---

## Appendix C: Implementation Checklist (Summary)

- Foundation (Weeks 1–2): Done.
- Security (Week 2): Done.
- LLM abstraction (Week 3): Not implemented; 40–60 h new work.
- Tools (Weeks 3–4): Done.
- Chat + streaming (Weeks 4–5): Done.
- Todo, files, artifacts (Weeks 5–6): Done / partial.
- Sub-agents, skills (Weeks 6–8): Done.
- Plugins (Weeks 8–9): Future; optional.
- Frontend (Weeks 9–12): Basic done; advanced UX and Tool Discovery new.
- Admin (Week 13): Partial.
- Production (Week 14): Done.
- Testing (Week 15+): To be added.

---

## Appendix D: Critical Success Factors

- Multi-tenancy: all tenant data filtered by `organizationId`.
- Auth and CSRF on every state-changing API route.
- Tool permission model (auto/ask/blocked) enforced.
- Provider switching: currently via branching; target canonical abstraction.
- Streaming: reliable SSE, no dropped events.
- File handling: session-scoped paths, size limits.
- Audit logging for sensitive actions.
- Todo updates: real-time in center panel Tasks tab.
- Sub-agent coordination: parallel execution and cancellation as implemented.

---

_End of Accurate Rebuild Guide. Use [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for a feature-by-feature status table._
