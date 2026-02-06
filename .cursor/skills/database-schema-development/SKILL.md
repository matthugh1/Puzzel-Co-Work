---
name: database-schema-development
description: Enforces Prisma schema conventions for database models. Use when creating or modifying Prisma schema files in prisma/schema.prisma, including model definitions, relations, indexes, and naming conventions.
---

# Database Schema Development

Follow these Prisma schema conventions for all database models in the Puzzel Co-Work project.

## Repository Constraints (Non-Negotiable)

- **DO NOT modify `Skill` or `SkillVersion` models** (no fields, types, or relations)
- **DO NOT add relations to `Skill` or `SkillVersion`** (use separate models such as `SkillVersionMetadata`)

## Organization Separation (Required for Tenant-Scoped Models)

All tenant-scoped models MUST include organization isolation:

```prisma
model TenantScopedModel {
  id             String   @id @default(cuid())
  organizationId String   // REQUIRED for tenant-scoped models
  // ... other fields ...
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])  // REQUIRED for query performance
  @@map("tenant_scoped_models")
}
```

**Global Models** (do NOT include `organizationId`):
- `Organization` - Organization itself
- `User` - Users are global, memberships via `OrganizationUser`
- `Role` - Global/system roles
- `Permission` - Global/system permissions

**Tenant-Scoped Models** (MUST include `organizationId`):
- All business data models (Projects, Tasks, Documents, etc.)
- `AuditLog` - Includes `organizationId` (nullable for system-level audits)
- `OrganizationRole` - Organization-specific roles
- `OrganizationUser` - Organization memberships

## Required Model Fields

Every model must include these standard fields:

```prisma
model ExampleModel {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Your fields here

  @@map("example_models")
}
```

### Field Requirements

- **id**: Always `String @id @default(cuid())` - never use auto-increment integers
- **createdAt**: Always `DateTime @default(now())` - tracks creation time
- **updatedAt**: Always `DateTime @updatedAt` - automatically updates on changes

## Naming Conventions

### Models (PascalCase)

```prisma
model User { }
model Skill { }
model SkillVersion { }
model AuditLog { }
```

### Tables (snake_case via @@map)

```prisma
model User {
  @@map("users")
}

model SkillVersion {
  @@map("skill_versions")
}

model UserRole {
  @@map("user_roles")
}
```

### Fields (camelCase)

```prisma
model Skill {
  ownerId     String
  createdAt   DateTime
  updatedAt   DateTime
}
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
enum SkillStatus {
  DRAFT
  PENDING_APPROVAL
  PUBLISHED
  ARCHIVED
}

model Skill {
  status SkillStatus @default(DRAFT)
}
```

### Dates

```prisma
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
approvedAt  DateTime?
```

### JSON

```prisma
details Json?  // Optional JSON field for flexible data
```

## Relations

### One-to-Many

```prisma
model Skill {
  ownerId String
  owner   User @relation("SkillOwner", fields: [ownerId], references: [id])
}

model User {
  ownedSkills Skill[] @relation("SkillOwner")
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
model SkillVersion {
  approvedById String?
  approvedBy   User? @relation("VersionApprover", fields: [approvedById], references: [id])
  approvedAt   DateTime?
}
```

### Cascade Deletes

```prisma
// When parent is deleted, children are deleted
model SkillVersion {
  skill Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)
}
```

## Indexes

Add indexes for frequently queried fields:

```prisma
model Skill {
  ownerId String
  category String?
  status  SkillStatus

  @@index([ownerId])
  @@index([category])
  @@index([status])
  @@map("skills")
}
```

### Composite Indexes

```prisma
model AuditLog {
  resourceType String
  resourceId   String

  @@index([resourceType, resourceId])
  @@map("audit_logs")
}
```

### Unique Constraints

```prisma
model User {
  email String @unique
}

model SkillVersion {
  skillId String
  version Int

  @@unique([skillId, version])
  @@map("skill_versions")
}
```

## Special Field Names

### Skill Versions

- Use `changeNotes` (not `changelog` or `changeLog`)

```prisma
model SkillVersion {
  changeNotes String?
}
```

### Rejections

- Use `rejectionReason` (not `rejection_message` or `reason`)

```prisma
model SkillVersion {
  rejectionReason String?
}
```

## Enums

Define enums before models that use them:

```prisma
enum SkillStatus {
  DRAFT
  PENDING_APPROVAL
  PUBLISHED
  ARCHIVED
}

enum VersionStatus {
  DRAFT
  PENDING_APPROVAL
  PUBLISHED
  REJECTED
}

enum Visibility {
  TEAM
  ORG
}
```

## Comments

Add comments for clarity:

```prisma
model User {
  externalId    String?   // Azure AD object ID (for future SSO)
  passwordHash  String?   // Only for local auth
}

model Role {
  name String @unique // admin, approver, creator, viewer
}
```

## Schema Organization

Organize schema with section comments:

```prisma
// ============================================================================
// AUTH & RBAC
// ============================================================================

model User { }
model Role { }

// ============================================================================
// SKILLS
// ============================================================================

model Skill { }
model SkillVersion { }

// ============================================================================
// AUDIT
// ============================================================================

model AuditLog { }
```

## Security Considerations

### Sensitive Data

- **NEVER** store plaintext passwords - use `passwordHash` field
- **NEVER** store secrets or API keys in database (use environment variables)
- Consider encryption for sensitive fields (PII, payment info)

### Field Length Limits

- Add `@db.VarChar(255)` or similar for string fields to prevent DoS
- Limit text field lengths appropriately:
  - Email: 255 characters
  - Name: 255 characters
  - Description: 1000-5000 characters (based on use case)
  - Content: 50000 characters max (for large text fields)

### Indexes for Security

- Index fields used in WHERE clauses for performance
- Index foreign keys for efficient joins
- Consider indexes for audit fields (userId, createdAt)

### Soft Deletes

- Prefer archiving (status field) over hard deletes
- Preserve audit trail by not deleting records
- Use `status` enum instead of `deletedAt` timestamp when possible

### Example: Secure User Model

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique @db.VarChar(255)
  name          String?   @db.VarChar(255)
  passwordHash  String?   // Never store plaintext passwords
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([email])
  @@map("users")
}
```

## Checklist

Before submitting schema changes:

- [ ] Model name is PascalCase
- [ ] Table name is snake_case via `@@map()`
- [ ] Model has `id String @id @default(cuid())`
- [ ] Model has `createdAt DateTime @default(now())`
- [ ] Model has `updatedAt DateTime @updatedAt`
- [ ] Relations use proper `@relation` syntax
- [ ] Foreign keys use `fields` and `references`
- [ ] Cascade deletes specified where needed (`onDelete: Cascade`)
- [ ] Indexes added for frequently queried fields
- [ ] Unique constraints added where needed
- [ ] Enums defined before models that use them
- [ ] Field names use camelCase
- [ ] Skill versions use `changeNotes` (not changelog)
- [ ] Rejections use `rejectionReason`
- [ ] Tenant-scoped models include `organizationId` field
- [ ] Tenant-scoped models include `organization` relation
- [ ] Tenant-scoped models include `@@index([organizationId])`
- [ ] Global models do NOT include `organizationId`

## Common Patterns

### Owner Pattern

```prisma
model Skill {
  ownerId String
  owner   User @relation("SkillOwner", fields: [ownerId], references: [id])
}

model User {
  ownedSkills Skill[] @relation("SkillOwner")
}
```

### Created By Pattern

```prisma
model SkillVersion {
  createdById String
  createdBy   User @relation("VersionCreator", fields: [createdById], references: [id])
}

model User {
  createdVersions SkillVersion[] @relation("VersionCreator")
}
```

### Timestamps Pattern

```prisma
model SkillVersion {
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  approvedAt DateTime?
}
```

## Migration Notes

After schema changes:

1. Run `pnpm db:generate` to regenerate Prisma client
2. Run `pnpm db:push` to push schema to database (dev)
3. For production, create migration: `npx prisma migrate dev --name description`

## Reference

See `prisma/schema.prisma` for complete examples of all patterns.
