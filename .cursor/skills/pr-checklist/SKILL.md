---
name: pr-checklist
description: Provide a pre-PR checklist and verification commands for Skills Library changes. Use before submitting code.
---

# PR Checklist

Use this checklist before submitting a PR.

## General

- [ ] Code follows repo contract rules
- [ ] No changes to `Skill` or `SkillVersion` models
- [ ] No secrets or sensitive data added
- [ ] Uses `@/` path aliases

## Backend

- [ ] API routes follow CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response
- [ ] Zod validation for input
- [ ] Rate limiting applied
- [ ] Generic error messages
- [ ] Audit logging for create/update/delete

## Frontend

- [ ] Design system rules followed
- [ ] CSS variables only (no hardcoded colors)
- [ ] Loading and error states present
- [ ] Accessibility basics checked

## Verify

Run only what is relevant to the change:

```bash
pnpm lint
pnpm build
pnpm check:migration-safety
pnpm pre-deploy:check
```
