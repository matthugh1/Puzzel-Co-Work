---
name: api-route-development
description: Enforces standard API route patterns for Next.js App Router routes. Use when creating or modifying API routes in src/app/api/, including authentication checks, error handling, response formatting, and audit logging.
---

# API Route Development

Follow these patterns for all API routes in the Puzzel Co-Work project to ensure consistency, security, and proper error handling.

## Required Pattern for Protected Routes

All protected API routes must follow this security-hardened pattern and the exact order:
**CSRF → Auth → Organization → Rate Limit → Validate → Logic → Audit → Response**.

For tenant-scoped routes, organization context extraction and membership validation is REQUIRED after authentication.

```typescript
import { NextResponse } from "next/server";
import { validateCSRFToken } from "@/lib/csrf";
import { checkAuthWithPermission, PERMISSIONS } from "@/lib/permissions";
import { requireOrganization, isOrganizationMember } from "@/lib/organization";
import { audit } from "@/lib/audit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: Request, context: RouteContext) {
  // 1. CSRF protection (state-changing)
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 2. Authentication & Authorization
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.SKILLS_CREATE,
  );

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // 2.5. Organization Context (REQUIRED for tenant-scoped routes)
  const org = await requireOrganization(request);

  // Verify user is member of organization
  if (!await isOrganizationMember(user.id, org.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 4. Input Validation
    const body = await validateRequestBody(
      request,
      validationSchemas.createSkill,
    );

    // 5. Business logic - All queries automatically filtered by organizationId
    // Prisma middleware ensures organizationId is included in all queries
    // ... database operations ...

    // 6. Audit logging (include organizationId for tenant-scoped actions)
    await audit.skillCreated(skillId, user.id, { name: body.name, organizationId: org.id }, request);

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    // 7. Error handling with validation support
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Create skill error:", error);
    return NextResponse.json(
      { error: "Failed to create skill" },
      { status: 500 },
    );
  }
}
```

## CSRF Protection

### Required for State-Changing Routes

- Always call `validateCSRFToken(request)` at the top of `POST`, `PUT`, `PATCH`, and `DELETE`
- Return the `NextResponse` it provides when invalid
- Use `@/lib/csrf`

## Authentication & Authorization

### Protected Routes

- Always use `checkAuthWithPermission(request, PERMISSION)` for routes requiring authentication
- Import `PERMISSIONS` from `@/lib/permissions`
- Check `authResult.authorized` and return `authResult.response` if false
- Extract `user` from `authResult` after authorization check

### Public Routes

- Use `getUserFromRequest(request)` for optional authentication
- Handle both authenticated and unauthenticated cases
- Example: Published skills visible to all, drafts only to owner/admin

### Permission Constants

Available permissions:

- `PERMISSIONS.SKILLS_READ`, `SKILLS_CREATE`, `SKILLS_UPDATE`, `SKILLS_DELETE`, `SKILLS_APPROVE`, `SKILLS_ADMIN`
- `PERMISSIONS.USERS_READ`, `USERS_ADMIN`
- `PERMISSIONS.AUDIT_READ`

## Error Handling

### Required Pattern

```typescript
try {
  // Database operations and business logic
} catch (error) {
  console.error("Operation error:", error);
  return NextResponse.json(
    { error: "Descriptive error message" },
    { status: 500 },
  );
}
```

### HTTP Status Codes

- `400` - Bad Request (invalid input, missing required fields)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (authenticated but insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (unexpected errors)

### Error Response Format

Always use `NextResponse.json()` with consistent error format:

```typescript
return NextResponse.json({ error: "Error message here" }, { status: 400 });
```

## Response Formatting

### Success Responses

```typescript
// Single resource
return NextResponse.json({ skill: data });

// List of resources
return NextResponse.json({ skills: data });

// Created resource
return NextResponse.json({ skill: data }, { status: 201 });

// Success without body
return NextResponse.json({ success: true });
```

### Always Use NextResponse.json()

- Never use `Response.json()` - always `NextResponse.json()`
- Include status code for non-200 responses
- Use consistent property names (singular for single items, plural for arrays)

## Audit Logging

Log audit events for all create, update, delete, and approval operations:

```typescript
import { audit } from "@/lib/audit";

// After creating a resource
await audit.skillCreated(
  skillId,
  user.id,
  {
    name: skill.name,
    category: skill.category,
  },
  request,
);

// After updating a resource
await audit.skillUpdated(
  skillId,
  user.id,
  {
    oldValues: { name: oldName },
    newValues: { name: newName },
  },
  request,
);

// After deleting/archiving
await audit.skillArchived(
  skillId,
  user.id,
  {
    skillName: skill.name,
  },
  request,
);
```

### When to Log

- Resource creation (skills, versions, users)
- Resource updates (metadata changes)
- Resource deletion/archiving
- Approval actions (approve, reject, submit)
- Authentication events (login, logout, failed login)

## Route Context Pattern

For dynamic routes with parameters:

```typescript
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  // Use id in your logic
}
```

Note: `context.params` is a Promise in Next.js 15+ - always await it.

## Organization Context

**Required for Tenant-Scoped Routes**:

- Extract organization from JWT: `const org = await requireOrganization(request)`
- Validate membership: `await isOrganizationMember(user.id, org.id)`
- Return 403 if user not member
- All database queries automatically filtered by `organizationId` via Prisma middleware
- Include `organizationId` in audit logs: `await audit.action(resourceId, user.id, { organizationId: org.id }, request)`

**Global Routes** (do NOT require organization):
- `/api/organizations/*` - Organization management
- `/api/auth/*` - Authentication (organization set after login)
- `/api/users/*` - User management (system-level)

## Imports

Use path aliases for all imports:

- `@/lib/permissions` - Auth and permissions
- `@/lib/auth` - Authentication utilities
- `@/lib/organization` - Organization context utilities
- `@/lib/db` - Prisma client
- `@/lib/audit` - Audit logging
- `@/types` - TypeScript types

## Security Requirements (CRITICAL)

### Input Validation

- **ALWAYS** validate all user input using Zod schemas from `@/lib/validation`
- Use `validateRequestBody(request, schema)` for POST/PUT requests
- Validate and sanitize query parameters (limit length, trim, validate format)
- Never trust user input - validate even if it seems safe

### Rate Limiting

- **ALWAYS** apply rate limiting to prevent abuse
- Use `rateLimit(request, RATE_LIMITS.API, user.id)` for authenticated routes
- Use `RATE_LIMITS.AUTH` for authentication endpoints (stricter limits)
- Rate limiting must be applied AFTER authentication but BEFORE business logic

### Error Messages

- **NEVER** leak sensitive information in error messages
- Use generic messages: "Invalid credentials" instead of "User not found" or "Wrong password"
- Log detailed errors server-side only (console.error)
- Don't reveal whether resources exist or not (404 for both "not found" and "no access")

### Password Handling

- **NEVER** log or return passwords in responses
- Use password strength validation from `@/lib/password`
- Hash passwords with bcrypt (async) - never store plaintext

### SQL Injection Prevention

- Prisma ORM protects against SQL injection, but:
- **NEVER** use string concatenation for queries
- **NEVER** use `Prisma.raw()` with user input
- Always use Prisma's type-safe query builders

## Checklist

Before submitting an API route:

### Security (MANDATORY)

- [ ] Input validation using Zod schemas
- [ ] Rate limiting applied
- [ ] Generic error messages (no information leakage)
- [ ] Query parameters sanitized (trim, length limits)
- [ ] No passwords in logs or responses
- [ ] No SQL injection vulnerabilities

### Functionality

- [ ] Uses `checkAuthWithPermission` for protected routes
- [ ] Returns `authResult.response` if not authorized
- [ ] Wraps database operations in try/catch
- [ ] Uses `NextResponse.json()` for all responses
- [ ] Returns appropriate HTTP status codes
- [ ] Logs audit events for create/update/delete operations
- [ ] Uses `@/` path aliases for imports
- [ ] Handles errors with descriptive messages
- [ ] Awaits `context.params` for dynamic routes
- [ ] Organization context extracted for tenant-scoped routes
- [ ] Organization membership validated
- [ ] Audit logs include `organizationId` for tenant-scoped actions

## Examples

See existing routes for reference:

- `src/app/api/skills/route.ts` - List and create skills
- `src/app/api/skills/[id]/route.ts` - Get, update, delete skill
- `src/app/api/skills/[id]/approve/route.ts` - Approval workflow
- `src/app/api/auth/login/route.ts` - Authentication
