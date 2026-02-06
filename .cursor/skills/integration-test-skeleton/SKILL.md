---
name: integration-test-skeleton
description: Creates integration test skeletons for API routes and runtime modules. Use when adding tests for new features.
---

# Integration Test Skeleton

Create integration test skeletons following repository testing patterns.

## Test Location

- **Directory**: `__tests__/` or `tests/` (if exists)
- **File naming**: `*.test.ts` or `*.spec.ts`
- **Example**: `__tests__/api/runs.test.ts`

## Test Structure

### Basic Test File

```typescript
/**
 * Integration tests for Resource API
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
// or
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Resource API", () => {
  beforeAll(async () => {
    // Setup: seed test data, start test server
  });

  afterAll(async () => {
    // Cleanup: remove test data, stop test server
  });

  describe("POST /api/resources", () => {
    it("should create a resource", async () => {
      // Test implementation
    });

    it("should return 401 when unauthenticated", async () => {
      // Test implementation
    });

    it("should return 400 for invalid input", async () => {
      // Test implementation
    });
  });

  describe("GET /api/resources/:id", () => {
    it("should return resource by id", async () => {
      // Test implementation
    });

    it("should return 404 for non-existent resource", async () => {
      // Test implementation
    });
  });
});
```

## API Route Testing

### Pattern

```typescript
import { POST } from "@/app/api/resources/route";
import { createMockRequest } from "./test-helpers";

describe("POST /api/resources", () => {
  it("should create a resource", async () => {
    const request = createMockRequest({
      method: "POST",
      body: {
        name: "Test Resource",
        description: "Test description",
      },
      headers: {
        authorization: `Bearer ${testToken}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.resource).toBeDefined();
    expect(data.resource.name).toBe("Test Resource");
  });

  it("should return 401 when unauthenticated", async () => {
    const request = createMockRequest({
      method: "POST",
      body: { name: "Test" },
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("should return 400 for invalid input", async () => {
    const request = createMockRequest({
      method: "POST",
      body: { name: "" }, // Invalid: empty name
      headers: {
        authorization: `Bearer ${testToken}`,
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
  });
});
```

## Test Helpers

### Mock Request Helper

```typescript
// __tests__/test-helpers.ts

export function createMockRequest(options: {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Request {
  const url = options.url || "http://localhost/api/test";
  const headers = new Headers(options.headers || {});

  if (options.body) {
    headers.set("content-type", "application/json");
  }

  return new Request(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

export function createMockContext(params: Record<string, string>): {
  params: Promise<Record<string, string>>;
} {
  return {
    params: Promise.resolve(params),
  };
}
```

## Database Testing

### Pattern

```typescript
import { db } from "@/lib/db";
import { PrismaClient } from "@prisma/client";

describe("Database Operations", () => {
  let testDb: PrismaClient;

  beforeAll(async () => {
    // Use test database
    testDb = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL,
        },
      },
    });
  });

  afterAll(async () => {
    await testDb.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await testDb.resource.deleteMany();
  });

  it("should create a resource", async () => {
    const resource = await testDb.resource.create({
      data: {
        name: "Test",
        userId: "test-user-id",
      },
    });

    expect(resource.id).toBeDefined();
    expect(resource.name).toBe("Test");
  });
});
```

## Runtime Module Testing

### Pattern

```typescript
import { runtimeFunction } from "@/lib/runtime-module";

describe("Runtime Module", () => {
  it("should process input correctly", () => {
    const input = { field: "value" };
    const result = runtimeFunction(input);

    expect(result).toBeDefined();
    expect(result.processed).toBe(true);
  });

  it("should handle errors gracefully", () => {
    const invalidInput = null;

    expect(() => {
      runtimeFunction(invalidInput);
    }).toThrow("Invalid input");
  });
});
```

## Test Data Setup

### Seed Test Data

```typescript
import { db } from "@/lib/db";

export async function seedTestData() {
  const testUser = await db.user.create({
    data: {
      email: "test@example.com",
      name: "Test User",
      passwordHash: "hashed-password",
    },
  });

  return { testUser };
}

export async function cleanupTestData() {
  await db.resource.deleteMany();
  await db.user.deleteMany({
    where: {
      email: { startsWith: "test@" },
    },
  });
}
```

## Verification Checklist

- [ ] Test file created in correct location
- [ ] Tests cover happy path
- [ ] Tests cover error cases (401, 403, 400, 404, 500)
- [ ] Tests cover edge cases
- [ ] Test data setup and cleanup
- [ ] Mock helpers created (if needed)
- [ ] Tests are isolated (don't depend on each other)

## Files Changed

- `__tests__/api/resource.test.ts` - Test file
- `__tests__/test-helpers.ts` - Test helpers (if needed)

## Done When

- [ ] Test file created with skeleton tests
- [ ] Test helpers created (if needed)
- [ ] Tests can run (may fail until implementation)
- [ ] Test structure follows patterns
