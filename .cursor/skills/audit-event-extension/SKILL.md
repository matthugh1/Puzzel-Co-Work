---
name: audit-event-extension
description: Extends audit logging service with new event types. Use when adding new audit actions for new features or resources.
---

# Audit Event Extension

Add new audit event functions to the audit service following repository patterns.

## Audit Function Pattern

### Standard Pattern

```typescript
actionName: (
  resourceId: string,
  userId: string,
  metadata?: Record<string, unknown>,
  request?: Request
) =>
  logAudit({
    action: 'resource.action',
    resourceType: 'resource',
    resourceId,
    userId,
    details: metadata,
    ipAddress: request ? getIpAddress(request) : undefined,
    userAgent: request ? getUserAgent(request) : undefined,
  }),
```

## Steps

### 1. Update ResourceType

**File**: `src/lib/audit.ts`

Add new resource type to union:

```typescript
export type ResourceType =
  | "skill"
  | "version"
  | "user"
  | "auth"
  | "mcp"
  | "agent"; // New resource type
```

### 2. Add Audit Function

**File**: `src/lib/audit.ts`

Add to `audit` object:

```typescript
export const audit = {
  // ... existing functions

  // Agent run events
  agentRunCreated: (
    runId: string,
    userId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "agent.run.created",
      resourceType: "agent",
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  agentRunCompleted: (
    runId: string,
    userId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "agent.run.completed",
      resourceType: "agent",
      resourceId: runId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // ... more functions
};
```

## Action Naming Convention

### Pattern

`resource.action` or `resource.subresource.action` (dot notation)

### Examples

- `skill.created`
- `version.approved`
- `agent.run.created`
- `agent.run.completed`
- `agent.step.executed`
- `agent.approval.requested`

## Usage in API Routes

### Log Audit Event

```typescript
import { audit } from "@/lib/audit";

// After creating a resource
await audit.agentRunCreated(
  runId,
  user.id,
  {
    goal: run.goal,
    policyId: run.policyId,
  },
  request,
);

// After completing an operation
await audit.agentRunCompleted(
  runId,
  user.id,
  {
    stepsExecuted: run.currentStepIndex,
    duration: completedAt - startedAt,
  },
  request,
);
```

## Verification

- [ ] ResourceType updated (if new resource type)
- [ ] Audit function added to `audit` object
- [ ] Function follows standard pattern
- [ ] Action name follows naming convention
- [ ] Function can be imported and used

## Files Changed

- `src/lib/audit.ts` - New audit functions added

## Done When

- [ ] Audit functions added to `audit` object
- [ ] ResourceType updated (if needed)
- [ ] Functions follow standard pattern
- [ ] Can be imported and used in API routes
