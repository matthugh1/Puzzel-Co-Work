---
name: code-style-conventions
description: Enforces TypeScript code style and conventions. Use when writing or modifying TypeScript/TSX code, including async/await patterns, path aliases, error handling, type safety, and import organization.
---

# Code Style & Conventions

Follow these TypeScript and code style conventions for consistent, maintainable code.

## TypeScript Configuration

The project uses TypeScript strict mode with additional safety checks:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `forceConsistentCasingInFileNames: true`

## Async/Await Pattern

### ✅ Always Use async/await

```typescript
// GOOD
export async function getSkill(id: string) {
  const skill = await db.skill.findUnique({
    where: { id },
  });
  return skill;
}
```

### ❌ Never Use .then() Chains

```typescript
// BAD
export function getSkill(id: string) {
  return db.skill
    .findUnique({
      where: { id },
    })
    .then((skill) => skill);
}
```

## Path Aliases

Always use `@/` path aliases for imports. Never use relative paths.

### ✅ Correct Imports

```typescript
import { db } from "@/lib/db";
import { checkAuthWithPermission } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { getUserFromRequest } from "@/lib/auth";
import { Skill } from "@/types";
import { SkillCard } from "@/components/skills/SkillCard";
```

### ❌ Incorrect Imports

```typescript
// BAD - relative paths
import { db } from "../../lib/db";
import { Skill } from "../../../types";

// BAD - missing @/
import { db } from "lib/db";
```

### Common Import Paths

- `@/lib/*` - Utility libraries (db, auth, permissions, audit)
- `@/components/*` - React components
- `@/types` - TypeScript types
- `@/app/*` - Next.js app directory (rarely imported)

## Error Handling

### Try/Catch Pattern

Always wrap database operations and async operations in try/catch:

```typescript
export async function createSkill(data: SkillData) {
  try {
    const skill = await db.skill.create({
      data,
    });
    return skill;
  } catch (error) {
    console.error("Create skill error:", error);
    throw error; // Or return error response
  }
}
```

### Error Logging

Always log errors with context:

```typescript
try {
  // Operation
} catch (error) {
  console.error("Operation name error:", error);
  // Handle error
}
```

## Type Safety

### Avoid `any`

```typescript
// BAD
function processData(data: any) {
  return data.value;
}

// GOOD
interface Data {
  value: string;
}

function processData(data: Data) {
  return data.value;
}
```

### Use Proper Types

```typescript
// GOOD - explicit types
export async function GET(request: Request): Promise<NextResponse> {
  const body: { name: string; description?: string } = await request.json();
  // ...
}

// GOOD - interface definitions
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  // ...
}
```

### Type Assertions (Use Sparingly)

```typescript
// Only when absolutely necessary and safe
const value = data as ExpectedType;
```

## Function Return Types

### Explicit Return Types for Public Functions

```typescript
// GOOD
export async function getSkill(id: string): Promise<Skill | null> {
  return await db.skill.findUnique({ where: { id } });
}

// GOOD - Next.js route handlers
export async function GET(request: Request): Promise<NextResponse> {
  return NextResponse.json({ data });
}
```

### Type Inference for Simple Functions

```typescript
// OK for simple, internal functions
function calculateTotal(items: number[]) {
  return items.reduce((sum, item) => sum + item, 0);
}
```

## Import Organization

### Order of Imports

1. External libraries (React, Next.js, etc.)
2. Internal utilities (`@/lib/*`)
3. Types (`@/types`)
4. Components (`@/components/*`)
5. Relative imports (only if absolutely necessary)

```typescript
// GOOD
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAuthWithPermission, PERMISSIONS } from "@/lib/permissions";
import { audit } from "@/lib/audit";
import { Skill } from "@/types";
import { SkillCard } from "@/components/skills/SkillCard";
```

## Variable Naming

### camelCase for Variables and Functions

```typescript
const skillId = "abc123";
const userName = "John Doe";

function getUserSkills(userId: string) {
  // ...
}
```

### PascalCase for Types, Interfaces, Classes

```typescript
interface SkillData {
  name: string;
}

type SkillStatus = "DRAFT" | "PUBLISHED";

class SkillManager {
  // ...
}
```

### UPPER_CASE for Constants

```typescript
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
```

## Optional Chaining and Nullish Coalescing

### Use Optional Chaining

```typescript
// GOOD
const userName = user?.name ?? "Unknown";
const skillName = skill?.versions?.[0]?.content;

// BAD
const userName = user && user.name ? user.name : "Unknown";
```

### Use Nullish Coalescing

```typescript
// GOOD
const count = items?.length ?? 0;
const name = skill.name ?? "Untitled";

// BAD
const count = items?.length || 0; // Wrong if length is 0
```

## Array and Object Methods

### Prefer Modern Array Methods

```typescript
// GOOD
const published = skills.filter((s) => s.status === "PUBLISHED");
const names = skills.map((s) => s.name);
const hasDraft = skills.some((s) => s.status === "DRAFT");

// BAD - avoid for loops when possible
for (let i = 0; i < skills.length; i++) {
  if (skills[i].status === "PUBLISHED") {
    // ...
  }
}
```

## Destructuring

### Use Destructuring for Clean Code

```typescript
// GOOD
const { name, description, category } = skill;
const { user } = authResult;

// GOOD - function parameters
function updateSkill({ id, name, description }: UpdateSkillData) {
  // ...
}
```

## Comments

### Use Comments Sparingly

```typescript
// GOOD - explains why, not what
// Check access: published skills visible to all, others only to owner/admin
if (skill.status !== "PUBLISHED") {
  // ...
}

// BAD - obvious comments
// Get skill by id
const skill = await db.skill.findUnique({ where: { id } });
```

### JSDoc for Public Functions

```typescript
/**
 * Get a skill with its versions
 * Allows unauthenticated access to published skills only
 */
export async function GET(request: Request, context: RouteContext) {
  // ...
}
```

## Security Requirements

### Input Validation

- **MUST** validate all user input using Zod schemas
- **MUST** sanitize strings (trim, length limits)
- **MUST** validate data types before use
- See `security-best-practices` skill for details

### Error Handling

- **NEVER** expose sensitive information in error messages
- **NEVER** log passwords or secrets
- Use generic error messages for security-related failures
- Log detailed errors server-side only

### Async Operations

- **MUST** use async/await for all async operations
- **MUST** handle errors with try/catch
- **MUST** await all promises (no floating promises)

## Checklist

Before submitting code:

- [ ] Uses async/await (no `.then()` chains)
- [ ] Uses `@/` path aliases for all imports
- [ ] Wraps async operations in try/catch
- [ ] Logs errors with context
- [ ] Avoids `any` type
- [ ] Uses explicit return types for public functions
- [ ] Uses optional chaining and nullish coalescing appropriately
- [ ] Uses modern array methods
- [ ] Uses destructuring where helpful
- [ ] Comments explain why, not what
- [ ] Follows camelCase/PascalCase naming conventions

## Common Mistakes

### ❌ Relative Imports

```typescript
// BAD
import { db } from "../../lib/db";

// GOOD
import { db } from "@/lib/db";
```

### ❌ Promise Chains

```typescript
// BAD
db.skill.findMany().then((skills) => {
  return skills.map((s) => s.name);
});

// GOOD
const skills = await db.skill.findMany();
return skills.map((s) => s.name);
```

### ❌ Missing Error Handling

```typescript
// BAD
export async function createSkill(data: SkillData) {
  const skill = await db.skill.create({ data });
  return skill;
}

// GOOD
export async function createSkill(data: SkillData) {
  try {
    const skill = await db.skill.create({ data });
    return skill;
  } catch (error) {
    console.error("Create skill error:", error);
    throw error;
  }
}
```

## Reference

- TypeScript Config: `tsconfig.json`
- Path Aliases: Configured in `tsconfig.json` paths
- Example Files: `src/app/api/skills/route.ts`, `src/lib/permissions.ts`
