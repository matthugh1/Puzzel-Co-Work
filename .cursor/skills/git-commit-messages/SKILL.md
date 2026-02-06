---
name: git-commit-messages
description: Enforces conventional commit message format. Use when creating git commits to ensure consistent, meaningful commit messages that follow the project's conventional commit standard.
---

# Git Commit Messages

Follow the conventional commit format for all git commits in the Skills Library project.

## Format

```
<type>: <subject>

[optional body]

[optional footer]
```

## Commit Types

### feat: New Feature

Use for new functionality or features.

```
feat: add skill approval workflow
feat: implement user role management
feat(api): add MCP server endpoint
```

### fix: Bug Fix

Use for bug fixes and corrections.

```
fix: correct date formatting in skill cards
fix: resolve authentication token expiration issue
fix(ui): prevent page overflow on mobile devices
```

### refactor: Code Refactoring

Use for code restructuring without changing functionality.

```
refactor: simplify permission check logic
refactor(api): extract auth middleware to separate function
refactor: reorganize component file structure
```

### docs: Documentation

Use for documentation changes only.

```
docs: update API route documentation
docs: add design system reference guide
docs: clarify RBAC permission model
```

### chore: Maintenance

Use for maintenance tasks, dependencies, build configs.

```
chore: update dependencies
chore: configure ESLint rules
chore: add database seed script
```

## Subject Line Rules

### Format

- Start with type prefix followed by colon and space
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("fix bug" not "fixes bug" or "fixed bug")
- Keep under 72 characters
- Don't end with a period
- Use lowercase (except for proper nouns)

### ✅ Good Examples

```
feat: add skill version history view
fix: handle null skill owner gracefully
refactor: extract audit logging to service
docs: document API authentication flow
chore: update Prisma to latest version
```

### ❌ Bad Examples

```
Added new feature          // Missing type prefix
feat: Added new feature   // Past tense
feat: adds new feature    // Wrong verb form
feat: New Feature        // Title case
feat: add new feature.   // Ends with period
feat: add a really long feature name that exceeds the recommended character limit and makes the commit message hard to read
```

## Scope (Optional)

You can optionally include a scope in parentheses after the type:

```
feat(api): add skill approval endpoint
fix(ui): correct button styling
refactor(db): optimize skill query performance
```

Common scopes:

- `api` - API routes
- `ui` - UI components/pages
- `db` - Database schema
- `auth` - Authentication
- `permissions` - Authorization
- `types` - TypeScript types

## Body (Optional)

Use body for detailed explanation when needed:

```
feat: add skill approval workflow

Implement the approval workflow for skill versions:
- Add pending approval status
- Create approval request endpoint
- Add approver role check
- Log approval actions to audit log
```

### Body Rules

- Separate from subject with blank line
- Wrap at 72 characters
- Explain what and why, not how
- Use bullet points for multiple changes

## Footer (Optional)

Use footer for breaking changes or issue references:

```
feat: migrate to Next.js 15

BREAKING CHANGE: API route handlers now require async params

Closes #123
Fixes #456
```

## Examples

### Simple Feature

```
feat: add category filter to skills browser
```

### Feature with Scope

```
feat(api): add skill version submission endpoint
```

### Bug Fix with Details

```
fix: prevent skill deletion when versions exist

Add check to prevent deleting skills that have published
versions. Archive instead to maintain audit trail.
```

### Refactoring

```
refactor: extract permission check to utility function

Move checkAuthWithPermission logic to reusable function
to reduce code duplication across API routes.
```

### Documentation

```
docs: add API route development guidelines

Document standard patterns for authentication, error
handling, and response formatting in API routes.
```

### Maintenance

```
chore: update dependencies to latest versions

- Next.js 15.1.0
- Prisma 5.22.0
- TypeScript 5.6.0
```

## Multiple Changes

If a commit includes multiple related changes, group them:

```
feat: add skill approval workflow

- Add pending approval status to skill versions
- Create approval request endpoint
- Add approver role permissions
- Implement approval/rejection actions
- Add audit logging for approvals
```

## Breaking Changes

Always note breaking changes in the footer:

```
refactor: restructure API response format

BREAKING CHANGE: API responses now wrap data in 'data'
property instead of returning objects directly.

Before: { skills: [...] }
After: { data: { skills: [...] } }
```

## Checklist

Before committing:

- [ ] Commit message starts with type prefix (`feat:`, `fix:`, etc.)
- [ ] Subject uses present tense and imperative mood
- [ ] Subject is under 72 characters
- [ ] Subject doesn't end with period
- [ ] Scope included if helpful (optional)
- [ ] Body explains what and why (if needed)
- [ ] Breaking changes noted in footer (if any)
- [ ] Issue references included (if applicable)

## Quick Reference

| Type        | When to Use        | Example                                |
| ----------- | ------------------ | -------------------------------------- |
| `feat:`     | New feature        | `feat: add user profile page`          |
| `fix:`      | Bug fix            | `fix: resolve login redirect issue`    |
| `refactor:` | Code restructuring | `refactor: simplify auth middleware`   |
| `docs:`     | Documentation      | `docs: update README with setup steps` |
| `chore:`    | Maintenance        | `chore: update package dependencies`   |

## Reference

See `.cursor/.cursorrules` for project commit conventions.
