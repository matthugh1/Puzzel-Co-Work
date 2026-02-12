# Puzzel Cowork — Implementation Status

Feature-by-feature status for the codebase. Use with [ACCURATE_REBUILD_GUIDE.md](ACCURATE_REBUILD_GUIDE.md).

**Legend:**

- **Done** — Implemented and in use
- **Partial** — Basic version exists; enhancements or full spec not done
- **Missing** — Not implemented (greenfield or planned only)
- **N/A** — Not applicable or out of scope

---

## Foundation & Config

| Feature                | Status | Notes / Path          |
| ---------------------- | ------ | --------------------- |
| Next.js 16 App Router  | Done   | package.json          |
| TypeScript 5.9         | Done   | tsconfig.json         |
| Tailwind CSS 4         | Done   | globals.css, config   |
| pnpm 9.0.0             | Done   | package.json          |
| Port 3002              | Done   | package.json scripts  |
| Docker PostgreSQL 5434 | Done   | docker-compose.yml    |
| Prisma schema          | Done   | prisma/schema.prisma  |
| Env config (.env)      | Done   | No quotes on API keys |

---

## Database & Schema

| Model / Area                                     | Status  | Notes              |
| ------------------------------------------------ | ------- | ------------------ |
| User, Role, Permission, UserRole, RolePermission | Done    | RBAC core          |
| Organization, OrganizationUser, OrganizationRole | Done    | Multi-tenancy      |
| AuditLog                                         | Done    | Audit logging      |
| CoworkSession                                    | Done    | AI sessions        |
| CoworkMessage                                    | Done    | Chat history       |
| CoworkTodoItem                                   | Done    | Task progress      |
| CoworkFile                                       | Done    | File metadata      |
| CoworkSettings                                   | Done    | Org-level settings |
| CoworkSubAgent                                   | Done    | Parallel agents    |
| Plugin-related models                            | Missing | No plugin schema   |

---

## Authentication & Security

| Feature                                 | Status | Notes / Path                   |
| --------------------------------------- | ------ | ------------------------------ |
| JWT auth (jose)                         | Done   | src/lib/auth/                  |
| HTTP-only session cookies               | Done   | src/lib/auth/                  |
| CSRF validation                         | Done   | src/lib/csrf.ts, middleware.ts |
| Password hashing (bcrypt)               | Done   | src/lib/password.ts            |
| Password strength (zxcvbn)              | Done   | src/lib/password.ts            |
| RBAC permissions                        | Done   | src/lib/permissions.ts         |
| Audit logging                           | Done   | src/lib/audit.ts               |
| Rate limiting                           | Done   | src/lib/rate-limit.ts          |
| Security headers (CSP, HSTS, etc.)      | Done   | next.config.ts                 |
| API route order (CSRF → Auth → Org → …) | Done   | AGENTS.md, routes              |

---

## LLM & Providers

| Feature                            | Status  | Notes / Path                               |
| ---------------------------------- | ------- | ------------------------------------------ |
| Anthropic (Claude) integration     | Done    | src/lib/cowork/llm.ts, agent-loop.ts       |
| OpenAI integration                 | Done    | src/lib/cowork/llm.ts, agent-loop.ts       |
| Provider switching (config)        | Done    | Branching in llm.ts / agent-loop           |
| Canonical format / adapters        | Missing | Plan/llm-provider-abstraction-spec.md only |
| Single llm.ts (no llm/ directory)  | Done    | src/lib/cowork/llm.ts                      |
| getAnthropicTools / getOpenAITools | Done    | src/lib/cowork/tools/index.ts              |
| Error normalization (canonical)    | Missing | Per-provider handling only                 |

---

## Tools

| Tool / Area                    | Status | Notes / Path                     |
| ------------------------------ | ------ | -------------------------------- |
| Tool registry                  | Done   | src/lib/cowork/tools/register.ts |
| Read, Write, Edit, Delete      | Done   | file-tools.ts                    |
| Glob, Grep                     | Done   | file-tools.ts                    |
| Bash                           | Done   | bash.ts (verify isolation model) |
| WebSearch, WebFetch            | Done   | web-search.ts, web-fetch.ts      |
| TodoWrite                      | Done   | todo-write.ts                    |
| AskUserQuestion                | Done   | ask-user.ts                      |
| Task (sub-agent)               | Done   | task.ts                          |
| Skill                          | Done   | skill.ts                         |
| GetSubAgentResults             | Done   | get-sub-agent-results.ts         |
| EnterPlanMode, ExitPlanMode    | Done   | plan-mode.ts                     |
| CreateDocument (docx)          | Done   | create-document.ts               |
| CreateSpreadsheet (xlsx)       | Done   | create-spreadsheet.ts            |
| ToolContext / ToolResult types | Done   | tools/types.ts                   |

---

## Chat & Streaming

| Feature                                                 | Status | Notes / Path                               |
| ------------------------------------------------------- | ------ | ------------------------------------------ |
| Agent loop                                              | Done   | src/lib/cowork/agent-loop.ts               |
| runAnthropicIteration                                   | Done   | agent-loop.ts                              |
| runOpenAIIteration                                      | Done   | agent-loop.ts                              |
| Context assembly (system prompt)                        | Done   | context.tsx, agent-loop                    |
| Skills in context                                       | Done   | skills.ts + agent-loop                     |
| SSE streaming                                           | Done   | messages/route.ts                          |
| Events: content_delta, tool_use_start, tool_result      | Done   | agent-loop sendEvent                       |
| Events: todo_update, artifact_created                   | Done   | agent-loop                                 |
| Events: sub_agent_update, permission_request            | Done   | agent-loop                                 |
| Events: ask_question, plan_proposed, message_end, error | Done   | agent-loop                                 |
| Messages API POST (stream)                              | Done   | api/cowork/sessions/[id]/messages/route.ts |

---

## Todo System

| Feature                      | Status | Notes / Path                     |
| ---------------------------- | ------ | -------------------------------- |
| Todo persistence             | Done   | plan-store.ts                    |
| TodoWrite tool → DB + SSE    | Done   | todo-write.ts, agent-loop        |
| todo_update SSE event        | Done   | agent-loop                       |
| Client todo state            | Done   | context.tsx (todos in state)     |
| Tasks tab in center panel    | Done   | CoworkCentrePanel.tsx            |
| CoworkTodoWidget             | Done   | CoworkTodoWidget.tsx             |
| Real-time todo updates in UI | Done   | SSE handler in CoworkCentrePanel |

---

## File & Artifact Management

| Feature                                  | Status  | Notes / Path                 |
| ---------------------------------------- | ------- | ---------------------------- |
| Session dirs (uploads, outputs, working) | Done    | storage/sessions/{id}/       |
| File upload API                          | Done    | files/upload/route.ts        |
| File list API                            | Done    | files/route.ts               |
| File download                            | Done    | Route for file by ID         |
| CoworkFile records                       | Done    | prisma                       |
| ArtifactRenderer component               | Done    | ArtifactRenderer.tsx         |
| Right panel Artifacts tab                | Done    | CoworkRightPanel.tsx         |
| Right panel Files tab                    | Done    | CoworkRightPanel.tsx         |
| Text extraction (PDF, DOCX, etc.)        | Partial | Confirm what exists          |
| PDF in-browser preview                   | Missing | Download link only           |
| JSX runtime / sandbox                    | Partial | Spec may exceed current impl |

---

## Sub-Agents

| Feature                             | Status  | Notes / Path                                  |
| ----------------------------------- | ------- | --------------------------------------------- |
| spawnSubAgent                       | Done    | sub-agent.ts                                  |
| DB CoworkSubAgent                   | Done    | prisma                                        |
| Parallel execution                  | Done    | sub-agent.ts                                  |
| sub_agent_update events             | Done    | agent-loop, sub-agent                         |
| Cancel sub-agent API                | Done    | agents/[agentId]/cancel/route.ts              |
| Task tool registration              | Done    | tools/task.ts                                 |
| Sub-agent status in chat            | Done    | CoworkMessageItem (SubAgentStatusBlock)       |
| Turn N/M display                    | Done    | Message block                                 |
| Collapsible sub-agent section       | Missing | UX_IMPROVEMENTS / COLLAPSIBLE_DESIGN not impl |
| Block reordering (sub-agents first) | Missing | CoworkMessageItem                             |

---

## Skills

| Feature                            | Status | Notes / Path    |
| ---------------------------------- | ------ | --------------- |
| storage/skills/ (docx, xlsx, etc.) | Done   | storage/skills/ |
| loadSkillRegistry / metadata       | Done   | skills.ts       |
| Trigger matching                   | Done   | skills.ts       |
| loadSkillContent                   | Done   | skills.ts       |
| Skill tool                         | Done   | tools/skill.ts  |
| Skills in system prompt            | Done   | agent-loop      |

---

## Permissions & Plan Mode

| Feature                         | Status  | Notes / Path                           |
| ------------------------------- | ------- | -------------------------------------- |
| Permission request (tool level) | Done    | agent-loop, permissions                |
| permission_request event        | Done    | agent-loop                             |
| Permission allow/deny API       | Done    | permissions/[requestId]/route.ts       |
| Permission cards in UI          | Done    | CoworkMessageItem                      |
| Plan propose / approve / reject | Done    | plan-store, plan API routes            |
| Plan block in chat              | Done    | CoworkMessageItem                      |
| Plan mode banner                | Missing | Spec only                              |
| Plan Edit flow                  | Partial | edit/route exists; UI completeness TBD |

---

## Frontend UI

| Feature                                 | Status  | Notes / Path          |
| --------------------------------------- | ------- | --------------------- |
| Three-column layout                     | Done    | cowork/page.tsx       |
| Left: sessions sidebar                  | Done    | CoworkSidebar.tsx     |
| Center: Chat tab                        | Done    | CoworkCentrePanel.tsx |
| Center: Tasks tab                       | Done    | CoworkCentrePanel.tsx |
| Right: Artifacts tab                    | Done    | CoworkRightPanel.tsx  |
| Right: Files tab                        | Done    | CoworkRightPanel.tsx  |
| Message blocks (text, tool, todo, etc.) | Done    | CoworkMessageItem.tsx |
| Tool cards (collapsible JSON)           | Done    | CoworkMessageItem     |
| Artifact chips (click → right panel)    | Done    | CoworkMessageItem     |
| AskUser block (single/multi select)     | Done    | CoworkMessageItem     |
| Input area                              | Done    | CoworkInputArea.tsx   |
| Progress bar (todos) in center          | Done    | CoworkCentrePanel     |
| Streaming indicator                     | Done    | CoworkCentrePanel     |
| Block reordering                        | Missing |                       |
| Collapsible sub-agents                  | Missing |                       |
| Separator banner                        | Missing |                       |
| Tool one-line summaries                 | Missing |                       |
| Top progress bar                        | Missing |                       |
| Status line below messages              | Missing |                       |
| Tool Discovery / Capabilities panel     | Missing |                       |
| Empty state widget                      | Missing |                       |
| Tab title indicators (e.g. ⏳/✅)       | Missing |                       |

---

## Admin

| Feature                       | Status  | Notes / Path             |
| ----------------------------- | ------- | ------------------------ |
| Admin layout                  | Done    | app/admin/layout.tsx     |
| Admin sidebar                 | Done    | AdminSidebar.tsx         |
| Organizations list/detail/new | Done    | app/admin/organizations/ |
| Users list/detail/new         | Done    | app/admin/users/         |
| Full CRUD and flows           | Partial | Verify all flows         |

---

## Plugins & Extensibility

| Feature                            | Status  | Notes |
| ---------------------------------- | ------- | ----- |
| Plugin directory structure         | Missing |       |
| Plugin manifest (e.g. plugin.json) | Missing |       |
| Plugin API routes                  | Missing |       |
| Plugin install/uninstall           | Missing |       |
| MCP connectors                     | Missing |       |

---

## Testing & QA

| Feature                       | Status  | Notes                   |
| ----------------------------- | ------- | ----------------------- |
| Integration tests             | Missing |                         |
| E2E tests                     | Missing |                         |
| Provider compatibility matrix | N/A     | Once abstraction exists |
| Test script in package.json   | Partial | Check scripts           |

---

## Summary Counts

| Status  | Count (approximate) |
| ------- | ------------------- |
| Done    | 80+                 |
| Partial | 10+                 |
| Missing | 25+                 |
| N/A     | 1                   |

Use this table for prioritisation and for aligning the rebuild guide with reality. When implementing missing items, start with [ACCURATE_REBUILD_GUIDE.md](ACCURATE_REBUILD_GUIDE.md) and the Plan/ specs.
