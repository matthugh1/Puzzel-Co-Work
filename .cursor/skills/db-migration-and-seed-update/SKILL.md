---
name: db-migration-and-seed-update
description: Generates Prisma migrations and updates seed script for new models, permissions, or roles. Use after adding Prisma models or extending RBAC. Includes migration safety checks to prevent data loss.
---

# Database Migration and Seed Update

Generate Prisma migrations and update seed scripts after schema changes. **CRITICAL: Always check migration safety before deploying to production.**

## ⚠️ Critical Safety Rules

### Repository Constraints (Non-Negotiable)

- **DO NOT modify `Skill` or `SkillVersion` models** (no fields, types, or relations)
- **DO NOT add relations to `Skill` or `SkillVersion`** (use separate tables)
- If a change touches skills metadata, add a separate model (e.g., `SkillVersionMetadata`)

### NEVER Use in Production

- **`prisma db push --force-reset`** - DROPS ALL TABLES
- **`prisma migrate reset`** - DROPS ENTIRE DATABASE
- **`pnpm db:reset`** - Uses `--force-reset` (development only)

### Always Use for Production

- **`npx prisma migrate deploy`** - Safely applies pending migrations
- **`pnpm check:migration-safety`** - Validates migrations before deployment
- **`pnpm pre-deploy:check`** - Includes migration safety check

See [Migration Safety Guide](../../docs/migration-safety.md) for detailed best practices.

## Prerequisites

- Schema changes completed in `prisma/schema.prisma`
- Schema validated (`npx prisma validate`)
- Schema formatted (`npx prisma format`)

## Migration Generation

### Steps

1. **Review schema changes**
   - Verify all new models are correct
   - Check indexes and constraints
   - Ensure no prohibited models were modified

2. **Generate migration**

   ```bash
   npx prisma migrate dev --name descriptive-migration-name
   ```

   - Use descriptive names: `add_agent_run_model`, `add_runs_approve_permission`
   - Migration files created in `prisma/migrations/`

3. **Check migration safety** (REQUIRED)

   ```bash
   pnpm check:migration-safety
   ```

   - Scans for dangerous operations (`DROP TABLE`, `TRUNCATE`, `DELETE FROM`, etc.)
   - Flags risky operations (`ALTER COLUMN`, `RENAME`, etc.)
   - In production/CI mode, warnings are treated as errors

4. **Review migration SQL manually**
   - Check migration SQL in `prisma/migrations/XXXXX_descriptive_name/migration.sql`
   - Ensure it matches expected changes
   - Verify no unexpected DROP or ALTER statements on prohibited tables
   - Look for dangerous patterns (see Dangerous Operations section below)

## Seed Script Update

### When to Update

Update `prisma/seed.ts` when:

- Adding new permissions
- Adding new roles
- Adding default data for new models
- Updating role-permission mappings

### Permission Pattern

```typescript
const newPermission = await prisma.permission.upsert({
  where: { name: "resource:action" },
  update: {},
  create: {
    name: "resource:action",
    description: "Human-readable description",
  },
});
```

### Role-Permission Mapping Pattern

```typescript
// Find role
const approverRole = await prisma.role.findUnique({
  where: { name: "approver" },
});

// Assign permission
if (approverRole) {
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: approverRole.id,
        permissionId: newPermission.id,
      },
    },
    update: {},
    create: {
      roleId: approverRole.id,
      permissionId: newPermission.id,
    },
  });
}
```

### Default Data Pattern

```typescript
// Create default policy
const defaultPolicy = await prisma.runPolicy.upsert({
  where: { name: "default" },
  update: {},
  create: {
    name: "default",
    description: "Default policy for agent runs",
    maxSteps: 10,
    maxRetriesPerStep: 3,
    maxDurationSeconds: 3600,
    requiresApproval: false,
    allowedCategories: [],
    blockedCategories: [],
    allowedCapabilities: [],
    blockedCapabilities: [],
    allowedTags: [],
    blockedTags: [],
    maxArtefactsPerRun: 100,
    maxInitialContextBytes: 100000,
    createdById: adminUser.id,
  },
});
```

## Migration Safety

### Dangerous Operations (Blocked)

The migration safety checker flags these patterns as dangerous:

- `DROP TABLE` - Deletes entire tables
- `DROP DATABASE` - Deletes entire database
- `TRUNCATE` - Deletes all rows from table
- `DELETE FROM` - Deletes rows (without WHERE clause)
- `ALTER TABLE ... DROP COLUMN` - Removes columns
- `ALTER TABLE ... DROP CONSTRAINT` - Removes constraints

### Warning Operations (Review Required)

These operations are flagged for review:

- `ALTER TABLE ... ALTER COLUMN` - Changes column types (may lose data)
- `ALTER TABLE ... RENAME` - Renames tables/columns
- `DROP INDEX` - Removes indexes (may impact performance)
- `DROP TYPE` - Removes custom types

### Safe Migration Patterns

**Adding new tables/columns:**

```sql
-- ✅ Safe: Adding new nullable column
ALTER TABLE "users" ADD COLUMN "new_field" TEXT;

-- ✅ Safe: Adding new table
CREATE TABLE "new_table" (...);
```

**Modifying existing data:**

```sql
-- ✅ Safe: Adding default value
ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'active';

-- ⚠️ Review: Changing column type (may lose data)
ALTER TABLE "users" ALTER COLUMN "age" TYPE INTEGER USING age::integer;
```

**Removing columns (use multi-step process):**

```sql
-- Step 1: Stop using column in application code
-- Step 2: Deploy application
-- Step 3: Drop column in next migration
ALTER TABLE "users" DROP COLUMN "old_field";
```

## Production Deployment Checklist

Before deploying migrations to production:

- [ ] Migration safety check passes (`pnpm check:migration-safety`)
- [ ] Migration SQL reviewed manually
- [ ] Database backup created
- [ ] Migration tested on staging/dev database
- [ ] Rollback plan documented
- [ ] Team notified (if significant changes)
- [ ] Low-traffic window scheduled (if major changes)

## Verification

### Migration Verification

- [ ] Migration file created in `prisma/migrations/`
- [ ] Migration safety check passes (`pnpm check:migration-safety`)
- [ ] Migration SQL reviewed manually
- [ ] Migration SQL matches expected changes
- [ ] No modifications to prohibited tables
- [ ] No dangerous operations detected
- [ ] Migration applies successfully (`npx prisma migrate dev`)

### Seed Verification

- [ ] Seed script updated with new permissions/roles/data
- [ ] Seed runs successfully (`pnpm db:seed`)
- [ ] Data appears in database after seeding

### Production Deployment

- [ ] Pre-deployment check passes (`pnpm pre-deploy:check`)
- [ ] Database backup created
- [ ] Migration tested on staging environment
- [ ] Ready to run `npx prisma migrate deploy` in production

## Files Changed

- `prisma/migrations/XXXXX_migration_name/migration.sql` - Auto-generated
- `prisma/seed.ts` - Updated with new permissions/roles/data

## Development vs Production

### Development Workflow

```bash
# 1. Make schema changes
# Edit prisma/schema.prisma

# 2. Create migration
npx prisma migrate dev --name descriptive_name

# 3. Check migration safety
pnpm check:migration-safety

# 4. Review migration SQL
cat prisma/migrations/[timestamp]_descriptive_name/migration.sql

# 5. Test locally
pnpm db:seed  # If needed
```

### Production Deployment

```bash
# 1. Pre-deployment checks (includes migration safety)
pnpm pre-deploy:check

# 2. Backup database (CRITICAL)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Apply migrations
npx prisma migrate deploy

# 4. Verify application works
# Test critical paths after migration
```

## Emergency Rollback

If a migration causes issues:

1. **Stop the application** (prevent further damage)
2. **Restore from backup**:
   ```bash
   psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
   ```
3. **Revert application code** to previous version
4. **Investigate** what went wrong
5. **Fix migration** and test thoroughly before retrying

## Done When

- [ ] Migration generated and verified
- [ ] Migration safety check passes
- [ ] Migration SQL reviewed manually
- [ ] Seed script updated (if needed)
- [ ] Migration applies successfully
- [ ] Seed runs successfully
- [ ] Database is in expected state
- [ ] Production deployment checklist completed (if deploying)

## Resources

- [Migration Safety Guide](../../docs/migration-safety.md) - Comprehensive guide
- [Prisma Migration Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
