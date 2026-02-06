---
name: backend-validation-errors
description: Standardize backend request validation and error handling with Zod, ValidationError, and safe responses. Use when building or updating API routes and request parsing.
---

# Backend Validation and Errors

Standardize request validation and error responses for API routes.

## Required Validation Pattern

Use `validateRequestBody` and `validationSchemas` from `@/lib/validation`:

```typescript
import { NextResponse } from "next/server";
import {
  validateRequestBody,
  validationSchemas,
  ValidationError,
} from "@/lib/validation";

try {
  const body = await validateRequestBody(
    request,
    validationSchemas.createSkill,
  );
  // Use validated body
} catch (error) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      { error: "Invalid request data", details: error.errors },
      { status: 400 },
    );
  }

  console.error("Operation error:", error);
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}
```

## Query Param Validation

- Parse and validate query params with Zod
- Trim strings and enforce length limits
- Validate IDs with `z.string().cuid()`

## Error Response Rules

- Always use `NextResponse.json()`
- 400 for validation errors
- 401/403 for auth issues
- 404 for missing resources
- 500 for unexpected errors
- Never include stack traces or internal details

## Checklist

- [ ] Zod validation for body and query params
- [ ] `ValidationError` handled with 400
- [ ] Generic error messages only
- [ ] No sensitive data in logs or responses
