---
name: prompt-router
description: Analyze a user prompt, select the best matching skill/agent role, and generate a handoff prompt with rationale and a checklist. Use when a task needs routing to frontend, backend, security, database, or workflow specialists.
---

# Prompt Router

Route tasks to the most appropriate skill or role and output a clear handoff prompt.

## Output Format (Required)

Return exactly these sections in order:

1. Skill Choice
2. Rationale
3. Handoff Prompt
4. Checklist

## Skill Selection Rules

- Choose the single best matching skill or role based on task content.
- If a task clearly spans two domains, choose the primary skill and note the secondary in the rationale.
- Prefer repo skills over general advice.

## Handoff Prompt Template

Use this structure inside the Handoff Prompt section:

```text
Handoff: [Backend | Frontend | Security | Database | Workflow]
Owner: [role or team]
Date: [YYYY-MM-DD]

Context
- Goal:
- Current status:
- Key constraints:
- Related files:

Scope
- In scope:
- Out of scope:

Requirements
- Functional:
- Security:
- UX/UI (if frontend):

Contracts
- API routes:
- Request/response shape:
- Errors/edge cases:
- Auth/permissions:
```

## Checklist (Default)

Tailor the checklist to the chosen skill, but start from this base:

- [ ] Scope and constraints confirmed
- [ ] Required skill identified
- [ ] API order (CSRF -> Auth -> Rate Limit -> Validate -> Logic -> Audit -> Response) considered
- [ ] Validation and error handling plan defined
- [ ] Security requirements identified
- [ ] Verification steps listed

## Examples

### Example Input

"Add a new endpoint to archive workflows and update the UI button."

### Example Output

Skill Choice
api-route-development (primary), ui-page-builder (secondary)

Rationale
Backend route change is the core requirement; UI changes follow once the API is available.

Handoff Prompt
Handoff: Backend
Owner: Backend
Date: 2026-02-03

Context

- Goal: Add workflow archive API endpoint
- Current status: Endpoint missing
- Key constraints: Follow API order, audit logging
- Related files: src/app/api/workflows/[id]/archive/route.ts

Scope

- In scope: API endpoint and permissions
- Out of scope: UI changes

Requirements

- Functional: Archive workflow by id
- Security: CSRF + auth + rate limit + validation
- UX/UI (if frontend): N/A

Contracts

- API routes: POST /api/workflows/[id]/archive
- Request/response shape: { success: boolean }
- Errors/edge cases: 404 not found, 403 forbidden
- Auth/permissions: PERMISSIONS.WORKFLOWS_UPDATE

Checklist

- [ ] Scope and constraints confirmed
- [ ] Required skill identified
- [ ] API order considered
- [ ] Validation and error handling plan defined
- [ ] Security requirements identified
- [ ] Verification steps listed
