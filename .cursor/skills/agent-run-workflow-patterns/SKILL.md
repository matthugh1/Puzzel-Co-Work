---
name: agent-run-workflow-patterns
description: Add or modify agent run, batch, and workflow features safely. Use when working with AgentRun, BatchRun, Workflow, WorkflowTrigger, RunPolicy, or related API routes.
---

# Agent Run and Workflow Patterns

Implement agent runs, batches, and workflows without breaking governance rules.

## Scope

Use when:

- Adding or updating workflow routes under `src/app/api/workflows`
- Creating run/batch endpoints under `src/app/api/runs` or `src/app/api/batches`
- Modifying `AgentRun`, `BatchRun`, `Workflow`, `WorkflowTrigger`, `RunPolicy`, `RunArtefact`, or `RunApproval`

## Repository Constraints

- Do not modify `Skill` or `SkillVersion` models
- Follow API route order: CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response

## Core Patterns

- Create runs with `status: PLANNING` or `RUNNING` only after validation
- Use `idempotencyKey` to prevent duplicate runs when appropriate
- Track lifecycle timestamps (`startedAt`, `completedAt`, `failedAt`, `cancelledAt`)
- Use `RunPolicy` to enforce constraints (max steps, duration, approval)
- Log audit events for run creation, approval, cancellation, and completion

## Approval and Blocking

- Use `RunApproval` for approval flows
- Use `RunTask` or `DataInputRequest` for human-in-the-loop steps
- Set `RunStatus.BLOCKED` with `blockedReason` when waiting on input

## Checklist

- [ ] CSRF validation on state-changing routes
- [ ] Auth and permission checks in place
- [ ] Rate limiting applied
- [ ] Zod validation for input
- [ ] Audit logging for create/update/approve/cancel
- [ ] Policy constraints enforced
- [ ] Idempotency handled when needed
