---
name: permission-and-rbac-extension
description: Extends RBAC system with new permissions and role assignments. Use when adding new permission constants and updating role-permission mappings.
---

# Permission and RBAC Extension

Add new permissions and update role-permission mappings following repository patterns.

## Repository Constraints (Non-Negotiable)

- **Do not modify** the `checkAuthWithPermission` signature
- Extend permissions and seed data instead of changing auth helpers

## Permission Naming Convention

### Pattern

`resource:action` (lowercase, colon separator)

### Examples

- `skills:read`
- `skills:create`
- `runs:approve`
- `users:admin`

## Steps

### 1. Add Permission Constant

**File**: `src/lib/permissions.ts`

Add to `PERMISSIONS` object:

```typescript
export const PERMISSIONS = {
  // ... existing permissions
  RUNS_APPROVE: "runs:approve",
} as const;
```

### 2. Update Permission Type

The `Permission` type is automatically inferred from `PERMISSIONS`, so no changes needed if using `as const`.

### 3. Add Permission to Seed Script

**File**: `prisma/seed.ts`

Add permission creation:

```typescript
const runsApprovePermission = await prisma.permission.upsert({
  where: { name: "runs:approve" },
  update: {},
  create: {
    name: "runs:approve",
    description: "Approve or reject agent runs",
  },
});
```

### 4. Assign Permission to Roles

**File**: `prisma/seed.ts`

Find existing role-permission mapping code and add:

```typescript
// Find roles
const approverRole = await prisma.role.findUnique({
  where: { name: "approver" },
});

const adminRole = await prisma.role.findUnique({
  where: { name: "admin" },
});

// Assign to approver role
if (approverRole) {
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: approverRole.id,
        permissionId: runsApprovePermission.id,
      },
    },
    update: {},
    create: {
      roleId: approverRole.id,
      permissionId: runsApprovePermission.id,
    },
  });
}

// Assign to admin role
if (adminRole) {
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: runsApprovePermission.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: runsApprovePermission.id,
    },
  });
}
```

## Usage in API Routes

### Check Permission

```typescript
import { checkAuthWithPermission, PERMISSIONS } from "@/lib/permissions";

export async function POST(request: Request) {
  const authResult = await checkAuthWithPermission(
    request,
    PERMISSIONS.RUNS_APPROVE,
  );

  if (!authResult.authorized) {
    return authResult.response;
  }

  const { user } = authResult;
  // ... proceed with authorized user
}
```

## Verification

- [ ] Permission constant added to `PERMISSIONS` object
- [ ] Permission seeded in database
- [ ] Permission assigned to appropriate roles
- [ ] Seed script runs successfully
- [ ] Permission check works in API routes

## Files Changed

- `src/lib/permissions.ts` - Permission constant added
- `prisma/seed.ts` - Permission creation and role assignment added

## Done When

- [ ] Permission constant defined
- [ ] Permission seeded in database
- [ ] Permission assigned to roles
- [ ] Can be used in `checkAuthWithPermission` calls
