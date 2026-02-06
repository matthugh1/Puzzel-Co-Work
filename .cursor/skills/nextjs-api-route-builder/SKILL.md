---
name: nextjs-api-route-builder
description: Creates Next.js App Router API routes following strict security and pattern requirements. Use when adding new API endpoints.
---

# Next.js API Route Builder

Create API routes following the repository's security-hardened pattern.

## Required Pattern

All protected API routes MUST follow this exact order:

```typescript
import { NextResponse } from "next/server";
import { checkAuthWithPermission, PERMISSIONS } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateCSRFToken } from "@/lib/csrf";

export async function POST(request: NextRequest, context: RouteContext) {
  // 1. CSRF Protection (POST/PUT/DELETE only)
  const csrfError = validateCSRFToken(request);
  if (csrfError) {
    return csrfError;
  }

  // 2. Authentication & Authorization
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.RESOURCE_ACTION,
  );

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;

  // 3. Rate Limiting
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // 4. Input Validation
    const body = await validateRequestBody(
      request,
      validationSchemas.createResource,
    );

    // 5. Business Logic
    const resource = await db.resource.create({
      data: {
        ...body,
        userId: user.id,
      },
    });

    // 6. Audit Logging
    await audit.resourceCreated(
      resource.id,
      user.id,
      {
        name: resource.name,
      },
      request,
    );

    // 7. Response
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    // Error Handling
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Create resource error:", error);
    return NextResponse.json(
      { error: "Failed to create resource" },
      { status: 500 },
    );
  }
}
```

## Route Context Pattern

For dynamic routes:

```typescript
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  // Use id
}
```

**Note**: `context.params` is a Promise in Next.js 15+ - always await it.

## HTTP Methods

### GET - Read Resource

```typescript
export async function GET(request: Request, context: RouteContext) {
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.RESOURCE_READ,
  );
  if (!authResult.authorized) return authResult.response;

  const { id } = await context.params;
  const resource = await db.resource.findUnique({ where: { id } });

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json({ resource });
}
```

### POST - Create Resource

See required pattern above.

### PUT - Update Resource

```typescript
export async function PUT(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  // Auth
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.RESOURCE_UPDATE,
  );
  if (!authResult.authorized) return authResult.response;

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limit
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Validate
    const body = await validateRequestBody(
      request,
      validationSchemas.updateResource,
    );

    // Update
    const resource = await db.resource.update({
      where: { id },
      data: body,
    });

    // Audit
    await audit.resourceUpdated(
      resource.id,
      user.id,
      {
        changes: body,
      },
      request,
    );

    return NextResponse.json({ resource });
  } catch (error) {
    // Error handling
    console.error("Update resource error:", error);
    return NextResponse.json(
      { error: "Failed to update resource" },
      { status: 500 },
    );
  }
}
```

### DELETE - Delete/Archive Resource

```typescript
export async function DELETE(request: NextRequest, context: RouteContext) {
  // CSRF protection
  const csrfError = validateCSRFToken(request);
  if (csrfError) return csrfError;

  // Auth
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.RESOURCE_DELETE,
  );
  if (!authResult.authorized) return authResult.response;

  const { user } = authResult;
  const { id } = await context.params;

  // Rate limit
  const rateLimitResponse = rateLimit(request, RATE_LIMITS.API, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    // Soft delete (archive)
    const resource = await db.resource.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    // Audit
    await audit.resourceArchived(
      resource.id,
      user.id,
      {
        resourceName: resource.name,
      },
      request,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete resource error:", error);
    return NextResponse.json(
      { error: "Failed to delete resource" },
      { status: 500 },
    );
  }
}
```

## Error Handling

### Generic Error Messages

**DO**: Use generic messages

```typescript
{
  error: "Invalid credentials";
}
{
  error: "Resource not found";
}
{
  error: "Failed to create resource";
}
```

**DON'T**: Leak sensitive information

```typescript
{
  error: "User not found";
} // Reveals user existence
{
  error: "Wrong password";
} // Reveals password is wrong
```

### Status Codes

- `400` - Bad Request (invalid input, validation errors)
- `401` - Unauthorized (not authenticated)
- `403` - Forbidden (authenticated but insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error (unexpected errors)

## Response Format

### Success Responses

```typescript
// Single resource
return NextResponse.json({ resource: data });

// List of resources
return NextResponse.json({ resources: data });

// Created resource
return NextResponse.json({ resource: data }, { status: 201 });

// Success without body
return NextResponse.json({ success: true });
```

## Validation Schemas

Add validation schemas to `src/lib/validation.ts`:

```typescript
export const validationSchemas = {
  // ... existing schemas

  createResource: z.object({
    name: z.string().min(1).max(200).trim(),
    description: z.string().max(1000).trim().optional(),
    // ... more fields
  }),

  updateResource: z.object({
    name: z.string().min(1).max(200).trim().optional(),
    description: z.string().max(1000).trim().optional(),
    // ... more fields
  }),
};
```

## File Structure

```
src/app/api/
└── resources/
    ├── route.ts           # GET list, POST create
    └── [id]/
        ├── route.ts       # GET, PUT, DELETE
        └── action/
            └── route.ts   # POST /api/resources/:id/action
```

## Verification Checklist

- [ ] CSRF protection (POST/PUT/DELETE)
- [ ] Authentication check
- [ ] Authorization check
- [ ] Rate limiting
- [ ] Input validation
- [ ] Generic error messages
- [ ] Audit logging
- [ ] Proper status codes
- [ ] Uses `NextResponse.json()`
- [ ] Uses `@/` path aliases

## Files Changed

- `src/app/api/resource/route.ts` - New route file
- `src/lib/validation.ts` - Validation schemas added (if needed)

## Done When

- [ ] Route file created following pattern
- [ ] All security checks in place
- [ ] Validation schemas added (if needed)
- [ ] Audit logging implemented
- [ ] Error handling with generic messages
- [ ] Route tested and working
