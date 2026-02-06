---
name: runtime-module-builder
description: Creates runtime library modules in src/lib/ following repository patterns. Use when adding new utility functions, services, or runtime logic.
---

# Runtime Module Builder

Create runtime library modules in `src/lib/` following repository patterns.

## Module Location

- **Directory**: `src/lib/`
- **File naming**: kebab-case (e.g., `context-resolver.ts`, `lease-manager.ts`)
- **Export pattern**: Named exports (not default exports)

## Module Structure

### Basic Module Pattern

```typescript
/**
 * Module Name
 * Brief description of what this module does
 */

import { db } from "./db";
// Other imports

/**
 * Main function description
 */
export function mainFunction(param: string): ReturnType {
  // Implementation
}

/**
 * Helper function (if needed)
 */
function helperFunction(): void {
  // Implementation
}
```

## Common Patterns

### Service Module (Singleton Pattern)

```typescript
/**
 * Service Name
 * Service description
 */

import { db } from "./db";

export interface ServiceConfig {
  // Config interface
}

/**
 * Service function
 */
export async function serviceFunction(
  param: string,
  config?: ServiceConfig,
): Promise<Result> {
  try {
    // Implementation
    return result;
  } catch (error) {
    console.error("Service function error:", error);
    throw error;
  }
}

/**
 * Another service function
 */
export function anotherFunction(): void {
  // Implementation
}
```

### Utility Module

```typescript
/**
 * Utility Name
 * Utility description
 */

/**
 * Utility function
 */
export function utilityFunction(input: string): string {
  // Implementation
  return result;
}

/**
 * Type guard
 */
export function isType(value: unknown): value is Type {
  // Implementation
  return boolean;
}
```

### Database Helper Module

```typescript
/**
 * Database Helper Name
 * Helper functions for database operations
 */

import { db } from "./db";
import type { Model } from "@prisma/client";

/**
 * Find resource with relations
 */
export async function findResourceWithRelations(
  id: string,
): Promise<Model | null> {
  return db.model.findUnique({
    where: { id },
    include: {
      // Relations
    },
  });
}

/**
 * Create resource with transaction
 */
export async function createResourceWithTransaction(
  data: CreateData,
): Promise<Model> {
  return db.$transaction(async (tx) => {
    // Transaction logic
    return result;
  });
}
```

## Error Handling

### Pattern

```typescript
export async function functionWithErrorHandling(): Promise<Result> {
  try {
    // Operation
    return result;
  } catch (error) {
    console.error("Function name error:", error);
    throw error; // Or return error result
  }
}
```

### Custom Errors

```typescript
export class CustomError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message);
    this.name = "CustomError";
  }
}

export function functionThatThrows(): void {
  throw new CustomError("Error message", "ERROR_CODE", 400);
}
```

## Type Definitions

### Export Types

```typescript
export interface FunctionResult {
  success: boolean;
  data?: Data;
  error?: string;
}

export type FunctionParam = string | number;

export function functionWithTypes(param: FunctionParam): FunctionResult {
  // Implementation
}
```

## Imports

### Use Path Aliases

```typescript
// ✅ Correct
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { User } from "@/types";

// ❌ Incorrect
import { db } from "./db";
import { db } from "../lib/db";
```

## Testing Considerations

### Pure Functions

Make functions testable by:

- Accepting dependencies as parameters
- Returning values instead of side effects
- Avoiding global state

```typescript
// ✅ Testable
export function processData(
  data: Data,
  validator: (d: Data) => boolean,
): ProcessedData {
  if (!validator(data)) {
    throw new Error("Invalid data");
  }
  return process(data);
}

// ❌ Hard to test
export function processData(data: Data): ProcessedData {
  // Uses global validator
  if (!globalValidator(data)) {
    throw new Error("Invalid data");
  }
  return process(data);
}
```

## Documentation

### JSDoc Comments

````typescript
/**
 * Resolves runtime references in input context
 *
 * @param inputContext - Input context with references
 * @param initialContext - Initial context for $context.* references
 * @param previousSteps - Previous step outputs for $step.N.* references
 * @returns Resolved context with references replaced
 *
 * @example
 * ```typescript
 * const resolved = resolveContext(
 *   { analysis: "$step.0.output.raw" },
 *   { ticketId: "123" },
 *   [{ outputContext: { raw: "Analysis result" } }]
 * );
 * ```
 */
export function resolveContext(
  inputContext: Record<string, unknown>,
  initialContext: Record<string, unknown>,
  previousSteps: Array<{ outputContext: unknown }>,
): Record<string, unknown> {
  // Implementation
}
````

## Verification Checklist

- [ ] Module follows naming conventions (kebab-case file)
- [ ] Uses named exports (not default exports)
- [ ] Uses `@/` path aliases for imports
- [ ] Error handling with try/catch
- [ ] JSDoc comments for public functions
- [ ] Type definitions exported (if needed)
- [ ] Functions are testable (pure or dependency injection)

## Files Changed

- `src/lib/module-name.ts` - New module file

## Done When

- [ ] Module file created
- [ ] Functions implemented following patterns
- [ ] Error handling in place
- [ ] Types exported (if needed)
- [ ] Can be imported and used
