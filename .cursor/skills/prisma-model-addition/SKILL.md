---
name: prisma-model-addition
description: Adds new Prisma models to the schema following strict conventions. Use when creating new database models, ensuring no modifications to prohibited models (e.g., Skill, SkillVersion).
---

# Prisma Model Addition

Add new Prisma models to the schema following repository conventions and constraints.

## Critical Constraints

### DO NOT MODIFY

- **DO NOT modify `Skill` model** - No field additions, removals, or type changes
- **DO NOT modify `SkillVersion` model** - No field additions, removals, or type changes
- **DO NOT add relations to `Skill` or `SkillVersion`** - Use separate tables instead

## Organization Separation Requirement

**For Tenant-Scoped Models** (most business data):

```prisma
model NewTenantModel {
  id             String   @id @default(cuid())
  organizationId String   // REQUIRED - organization isolation
  // ... your fields ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])  // REQUIRED for performance
  @@map("new_tenant_models")
}
```

**For Global Models** (Organization, User, Role, Permission):
- Do NOT include `organizationId`
- These models are shared across all organizations

**Decision Guide**:
- If the model represents data that should be isolated per organization → Include `organizationId`
- If the model represents system-level configuration or users → Do NOT include `organizationId`

### Required Pattern

All new models must follow this exact pattern:

```prisma
model NewModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt  // Only if model is mutable

  // Your fields here

  @@map("new_models")  // snake_case table name
}
```

## Naming Conventions

### Models

- **PascalCase**: `AgentRun`, `RunStep`, `RunPolicy`
- **Singular**: Use singular form (Model, not Models)

### Tables

- **snake_case via @@map()**: `@@map("agent_runs")`, `@@map("run_steps")`
- **Plural**: Use plural form (agent_runs, not agent_run)

### Fields

- **camelCase**: `ownerId`, `createdAt`, `updatedAt`
- **IDs**: Always `String @id @default(cuid())` - never auto-increment integers
- **Timestamps**: `DateTime` type, use `@default(now())` for `createdAt`

## Required Fields

Every model MUST include:

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt  // Only if model is mutable
```

## Field Types

### Strings

```prisma
name        String      // Required string
description String?     // Optional string
tags        String[]    // Array of strings
```

### Enums

```prisma
enum Status {
  PENDING
  ACTIVE
  COMPLETE
}

model Example {
  status Status @default(PENDING)
}
```

### Dates

```prisma
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
approvedAt  DateTime?  // Optional date
```

### JSON

```prisma
metadata Json?  // Optional JSON field for flexible data
```

## Relations

### One-to-Many

```prisma
model Parent {
  id     String @id @default(cuid())
  children Child[]
}

model Child {
  id       String @id @default(cuid())
  parentId String
  parent   Parent @relation(fields: [parentId], references: [id], onDelete: Cascade)
}
```

### Many-to-Many (Junction Table)

```prisma
model UserRole {
  userId    String
  roleId    String
  assignedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}
```

### Optional Relations

```prisma
model Example {
  approvedById String?
  approvedBy   User? @relation(fields: [approvedById], references: [id])
}
```

## Indexes

Add indexes for frequently queried fields:

```prisma
model Example {
  userId String
  status Status

  @@index([userId])
  @@index([status])
  @@map("examples")
}
```

### Composite Indexes

```prisma
model Example {
  resourceType String
  resourceId   String

  @@index([resourceType, resourceId])
  @@map("examples")
}
```

### Unique Constraints

```prisma
model Example {
  email String @unique
  // or
  @@unique([field1, field2])
  @@map("examples")
}
```

## Special Field Names

Follow existing conventions:

- Use `changeNotes` (not `changelog` or `changeLog`)
- Use `rejectionReason` (not `rejection_message` or `reason`)

## Steps

1. **Read existing schema**: `prisma/schema.prisma`
2. **Verify constraints**: Ensure no modifications to prohibited models
3. **Add enum definitions** (if needed) before models
4. **Add model definition** following naming conventions
5. **Add relations** to existing models (if needed, but NOT to Skill/SkillVersion)
6. **Add indexes** for frequently queried fields
7. **Verify syntax**: Run `npx prisma format`
8. **Validate schema**: Run `npx prisma validate`

## Example

```prisma
enum RunStatus {
  PLANNING
  RUNNING
  COMPLETE
  FAILED
}

model AgentRun {
  id          String    @id @default(cuid())
  userId      String
  status      RunStatus @default(PLANNING)
  goal        String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @default(now())

  user User @relation("RunInitiator", fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
  @@map("agent_runs")
}
```

## Verification

Before proceeding:

- [ ] Model follows naming conventions (PascalCase model, snake_case table)
- [ ] Required fields present (id, createdAt, updatedAt)
- [ ] No modifications to Skill or SkillVersion models
- [ ] Relations use proper onDelete behavior
- [ ] Indexes added for frequently queried fields
- [ ] Schema formatted (`npx prisma format`)
- [ ] Schema validated (`npx prisma validate`)
- [ ] Determined if model is tenant-scoped or global
- [ ] Tenant-scoped models include `organizationId` field and relation
- [ ] Tenant-scoped models include `@@index([organizationId])`
- [ ] Global models do NOT include `organizationId`

## Files Changed

- `prisma/schema.prisma` - Model definitions added

## Done When

- [ ] New model(s) added to schema
- [ ] No modifications to prohibited models
- [ ] Schema formatted and validated
- [ ] Ready for migration generation
