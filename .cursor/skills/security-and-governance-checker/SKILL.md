---
name: security-and-governance-checker
description: Security and governance checklist for code changes. Use before submitting code to verify all security requirements are met.
---

# Security and Governance Checker

Verify all security and governance requirements are met before submitting code.

## Security Checklist

### Input Validation

- [ ] **ALL user input validated** using Zod schemas from `@/lib/validation`
- [ ] **Query parameters sanitized** (trim, length limits, format validation)
- [ ] **No SQL injection vulnerabilities** (use Prisma, never string concatenation)
- [ ] **No command injection** (never use user input in shell commands)

### Authentication & Authorization

- [ ] **Protected routes use `checkAuthWithPermission`**
- [ ] **Permission checks happen server-side** (never trust client)
- [ ] **Resource ownership verified** (users can only modify their own resources unless admin)
- [ ] **No privilege escalation** (users cannot grant themselves permissions)

### Error Handling

- [ ] **Generic error messages** (no information leakage)
- [ ] **No sensitive data in errors** (passwords, tokens, internal details)
- [ ] **Detailed errors logged server-side only** (`console.error`)
- [ ] **Error messages don't reveal resource existence** (404 for both "not found" and "no access")

### Password & Secrets

- [ ] **No passwords in logs** (never log password fields)
- [ ] **No passwords in responses** (never return password fields)
- [ ] **Passwords hashed** (use bcrypt, never plaintext)
- [ ] **Secrets in environment variables** (never hardcoded)

### Rate Limiting

- [ ] **Rate limiting applied** to all API routes
- [ ] **Stricter limits on auth endpoints** (`RATE_LIMITS.AUTH`)
- [ ] **Rate limiting after auth** but before business logic

### CSRF Protection

- [ ] **CSRF protection on state-changing operations** (POST, PUT, DELETE)
- [ ] **CSRF token validated** using `validateCSRFToken`

### Audit Logging

- [ ] **Audit logs for create/update/delete operations**
- [ ] **Audit logs include user, timestamp, IP, user agent**
- [ ] **Audit logs never deleted** (append-only)

## Governance Checklist

### Code Conventions

- [ ] **Follows Prisma naming conventions** (PascalCase models, snake_case tables)
- [ ] **Uses `@/` path aliases** (no relative paths)
- [ ] **Uses async/await** (no `.then()` chains)
- [ ] **TypeScript strict mode compliant**

### Repository Constraints

- [ ] **No modifications to prohibited models** (Skill, SkillVersion)
- [ ] **No changes to MCP handler behavior**
- [ ] **Follows API route pattern** (CSRF → Auth → Rate Limit → Validate → Logic → Audit → Response)
- [ ] **Uses existing dependencies** (no new packages without justification)

### Database

- [ ] **No schema changes to prohibited models**
- [ ] **Migrations generated and tested**
- [ ] **Seed script updated** (if adding permissions/roles/data)
- [ ] **Indexes added** for frequently queried fields

### Testing

- [ ] **Tests cover happy path**
- [ ] **Tests cover error cases** (401, 403, 400, 404, 500)
- [ ] **Tests are isolated** (don't depend on each other)
- [ ] **Test data cleaned up** (no leftover test data)

## Security Anti-Patterns to Avoid

### ❌ DO NOT

- **Trust user input** - Always validate
- **Log sensitive data** - Passwords, tokens, PII
- **Return detailed errors** - Generic messages only
- **Use string concatenation for SQL** - Use Prisma
- **Skip authentication checks** - Always verify permissions
- **Hardcode secrets** - Use environment variables
- **Skip rate limiting** - Prevent abuse
- **Skip CSRF protection** - Prevent CSRF attacks

## Verification Steps

1. **Review code changes**
   - Check all security checklist items
   - Verify governance requirements met

2. **Run security checks**
   - Check for hardcoded secrets
   - Verify input validation
   - Check error handling

3. **Test error cases**
   - Test with invalid input
   - Test without authentication
   - Test with insufficient permissions
   - Test with missing resources

4. **Review audit logs**
   - Verify audit logging implemented
   - Check audit log format

## Files to Review

- All modified API routes
- All new database models
- All new runtime modules
- All new UI pages (for client-side security)

## Done When

- [ ] All security checklist items verified
- [ ] All governance requirements met
- [ ] No security anti-patterns present
- [ ] Code ready for review

## Quick Review Output (Lightweight)

Use this short format when you need a fast security scan summary:

```
Security Review (Light)
- Findings: <none | count>
- Highest Risk: <P0/P1/P2/P3 or none>
- Notes: <1-3 bullets>
```
