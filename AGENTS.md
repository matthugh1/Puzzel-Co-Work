# Agents Guide

This document is the shared operating guide for humans and agents working in this repository.

## Purpose

- Keep development consistent, secure, and reviewable.
- Encode non-negotiable constraints so changes stay safe.
- Provide a fast path for common tasks.

## Repository Contract (Non-Negotiable)

- Do not modify core User/Role/Permission/AuditLog models in `prisma/schema.prisma` without careful consideration.
- Do not change `/api/auth` handler behavior or authentication flow.
- Do not modify the `checkAuthWithPermission` signature.
- Do not modify the `AuditLog` model structure.
- **DO NOT create tenant-scoped models without `organizationId` field**
- **DO NOT query tenant-scoped data without organization filter**
- **DO NOT create API routes that don't validate organization membership**
- **DO NOT bypass organization context extraction in API routes**

## API Route Order (Required)

All state-changing API routes must follow this exact order:

CSRF -> Auth -> Organization -> Rate Limit -> Validate -> Logic -> Audit -> Response

For tenant-scoped routes, organization context extraction and membership validation is REQUIRED after authentication.

## Security Standards

- Validate all input with Zod (`@/lib/validation`).
- Use `validateCSRFToken` for POST/PUT/PATCH/DELETE.
- Apply rate limiting (`@/lib/rate-limit`).
- Use generic error messages only, no sensitive details.
- Never log or return secrets, tokens, or passwords.

## Frontend Design Rules

- Use CSS variables only. No hardcoded colors.
- White backgrounds, dark text, purple accents only.
- Use `.page-container`, `.page-header`, `.page-content` layout.
- Max height 100vh for pages.

## Database and Migrations

- Follow Prisma conventions: PascalCase models, snake_case tables, camelCase fields.
- Always run migration safety checks for schema changes.
- Use `pnpm db:push` for development, `prisma migrate deploy` for production.

## Multi-Tenancy Requirements

**Organization Separation (Mandatory)**:

- All tenant-scoped database models must include `organizationId` field and relation
- All database queries must filter by organization (automatic via Prisma middleware)
- All API routes must extract organization from JWT: `const org = await requireOrganization(request)`
- All API routes must validate user is member: `await isOrganizationMember(user.id, org.id)`
- Organization context comes from JWT token (stored via `/api/organizations/switch`)
- Global models (Organization, User, Role, Permission) do NOT have `organizationId`
- Audit logs include `organizationId` for tenant-scoped actions

## Skills Usage

- Skills live in `.cursor/skills` and also in Codex UI at `~/.codex/skills`.
- If a request matches a skill description, use it.
- Prefer existing skills over creating new ones.

### Key Skills (Quick Links)

- API routes: `.cursor/skills/api-route-development/SKILL.md`
- Database schema: `.cursor/skills/database-schema-development/SKILL.md`
- Migrations/seed: `.cursor/skills/db-migration-and-seed-update/SKILL.md`
- RBAC/permissions: `.cursor/skills/permission-and-rbac-extension/SKILL.md`
- Security checklist: `.cursor/skills/security-and-governance-checker/SKILL.md`
- UI pages: `.cursor/skills/ui-page-builder/SKILL.md`
- UI components: `.cursor/skills/ui-component-development/SKILL.md`
- Frontend forms: `.cursor/skills/frontend-form-patterns/SKILL.md`
- Frontend lists: `.cursor/skills/frontend-table-listing/SKILL.md`
- Frontend auth: `.cursor/skills/frontend-auth-flows/SKILL.md`
- Frontend data: `.cursor/skills/frontend-state-data/SKILL.md`
- Frontend a11y: `.cursor/skills/frontend-accessibility/SKILL.md`

## Verification Commands

Run only what is relevant:

- `pnpm lint`
- `pnpm build`
- `pnpm db:push` (development)
- `prisma migrate deploy` (production)

## Default Expectations

- Use `@/` path aliases, no relative imports.
- Use async/await, not `.then()` chains.
- Wrap API handlers in try/catch and return `NextResponse.json()`.
- Use audit logging for create/update/delete/approve actions.

## PR Review Do/Don't

Do:

- Check API order and security (CSRF, auth, rate limit, validation).
- Verify migrations are safe and core models are handled carefully.
- Confirm UI uses CSS variables only and the standard page layout.
- Confirm audit logging on sensitive actions.

Don't:

- Allow hardcoded colors or design drift.
- Allow missing input validation or generic error handling.
- Allow changes to core authentication or audit logging without review.
- Allow tenant-scoped models without `organizationId` field.
- Allow API routes without organization context extraction and membership validation.
- Allow database queries that don't filter by organization.
