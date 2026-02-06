---
name: repo-discovery-and-constraints
description: Discovers repository structure, identifies constraints, and documents "do not modify" rules before starting any feature work. Use at the start of any new feature to understand codebase patterns and avoid breaking changes.
---

# Repository Discovery and Constraints

This skill guides you through discovering repository structure, understanding constraints, and identifying what must NOT be modified.

## Purpose

Before writing any code, you must:

1. Understand the repository structure
2. Identify existing patterns and conventions
3. Document constraints and "do not modify" rules
4. Verify you understand the codebase before proceeding

## Discovery Steps

### 1. Locate Skills System

- **Check**: Where are skills stored? (usually `.cursor/skills/`)
- **Check**: What is the file format? (usually `SKILL.md` with frontmatter)
- **Check**: What metadata fields are required? (name, description)
- **Document**: Skills location, format, and conventions

### 2. Locate Code Conventions

- **Prisma schema**: Find `prisma/schema.prisma`
  - Check naming conventions (models PascalCase, tables snake_case)
  - Check required fields (id, createdAt, updatedAt)
  - Identify "do not modify" models (e.g., `Skill`, `SkillVersion`)
- **API routes**: Find `src/app/api/`
  - Check authentication pattern (`checkAuthWithPermission`)
  - Check error handling pattern (try/catch, generic messages)
  - Check response format (`NextResponse.json()`)
- **Auth/Permissions**: Find `src/lib/permissions.ts`
  - Check permission naming pattern
  - Check how permissions are checked
- **Audit service**: Find `src/lib/audit.ts`
  - Check audit function pattern
  - Check resource types
- **Runtime libs**: Find `src/lib/`
  - Check module organization
  - Check export patterns

### 3. Read Repo Contract

- **Read**: `docs/repo-contract.md` (create if missing)
- **Verify**: All constraints are documented
- **Update**: Add any missing constraints discovered

### 4. Identify "Do Not Modify" List

- **Check**: Are there models/files explicitly prohibited from modification?
- **Document**: List all prohibited modifications
- **Example**: "DO NOT modify Skill or SkillVersion schema"

### 5. Check Dependency Policy

- **Read**: `package.json`
- **Document**: What packages are available?
- **Rule**: Only use existing packages unless absolutely necessary

## Output

Create or update `docs/repo-contract.md` with:

1. **Skills System Section**
   - Location of skills
   - File format
   - Required metadata

2. **Code Conventions Section**
   - Prisma schema patterns
   - API route patterns
   - Auth/permissions patterns
   - Audit logging patterns
   - Runtime library patterns

3. **Do Not Modify Section**
   - List of models/files that must not be changed
   - Rationale for each prohibition

4. **Dependency Policy Section**
   - List of available packages
   - Policy for adding new dependencies

## Verification

Before proceeding with feature work:

- [ ] Repo contract document exists and is up-to-date
- [ ] All code conventions are documented
- [ ] "Do not modify" list is complete
- [ ] Dependency policy is clear
- [ ] You understand the existing patterns

## Example Output

```markdown
# Repository Contract

## Skills System

- Location: `.cursor/skills/`
- Format: Markdown with YAML frontmatter
- Required fields: name, description

## Code Conventions

- Prisma: Models PascalCase, tables snake_case via @@map()
- API routes: checkAuthWithPermission → rateLimit → validate → logic → audit → response
- Path aliases: Always use @/ prefix

## Do Not Modify

- Skill model (core to system)
- SkillVersion model (core to system)
- /api/mcp handler behavior (MCP protocol compatibility)

## Dependencies

- Available: @prisma/client, zod, jose, bcryptjs, next, react
- Policy: Minimal dependencies, only add if absolutely necessary
```

## Done When

- [ ] Repo contract document created/updated
- [ ] All conventions documented
- [ ] "Do not modify" list complete
- [ ] Ready to proceed with feature work
