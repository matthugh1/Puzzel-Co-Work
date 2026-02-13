# Skills PRD Implementation Plan

Full implementation plan to bring the Cowork skills system up to the PRD spec ([skills-generator-spec.md](file:///Users/matthewhughes/Library/Application%20Support/Claude/local-agent-mode-sessions/562fec87-ee82-4bb3-874b-42ce4783efae/0ff4db44-06d5-4e5d-8dfe-8568ffe69a81/local_3f223198-5612-4888-b37b-18804b9b383e/outputs/skills-generator-spec.md)).

---

## Phase 1: Schema and Data Model

### 1.1 Extend CoworkSkill schema

**File:** [prisma/schema.prisma](prisma/schema.prisma)

Add columns to CoworkSkill:

| Column          | Type    | Default   | Notes                                                                       |
| --------------- | ------- | --------- | --------------------------------------------------------------------------- |
| `category`      | String  | "General" | Writing, Analysis, Code, Research                                           |
| `parameters`    | Json    | []        | Array of `{ name, label, type, required, default?, description, options? }` |
| `exampleInput`  | String? | null      | Optional example user input                                                 |
| `exampleOutput` | String? | null      | Optional example output                                                     |
| `version`       | Int     | 1         | Incremented on each edit                                                    |
| `status`        | Enum    | "draft"   | `draft` \| `published`                                                      |
| `tags`          | Json    | []        | string[] for search (separate from triggers)                                |

**Keep:** `content` (maps to PRD `systemPrompt`), `triggers` (activation phrases).

### 1.2 Migration and validation

- Create Prisma migration: `pnpm prisma migrate dev`
- Update [src/lib/validation.ts](src/lib/validation.ts): extend `createCoworkSkill` and `updateCoworkSkill` schemas
- Add Zod schema for `SkillParameter` type

### 1.3 Types

**File:** [src/types/cowork.ts](src/types/cowork.ts) (or new `src/types/skill.ts`)

```typescript
export type SkillParameterType =
  | "text"
  | "textarea"
  | "select"
  | "number"
  | "boolean";

export interface SkillParameter {
  name: string;
  label: string;
  type: SkillParameterType;
  description: string;
  required: boolean;
  default?: string;
  options?: string[]; // for select
}
```

---

## Phase 2: Skill Creator — PRD Draft Format

### 2.1 Update skill-creator SKILL.md

**File:** [storage/skills/skill-creator/SKILL.md](storage/skills/skill-creator/SKILL.md)

Rewrite to output the **exact PRD structured format**:

```
---
**Skill Name:** [name]
**Category:** [category]
**Description:** [one-line summary]

**System Prompt:**
```

[Full prompt template. Use {{parameter_name}} for dynamic inputs.]

```

**Parameters:**
| Name | Label | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| ... | ... | ... | ... | ... | ... |

**Example Input:** [what a user might say when using this skill]
**Example Output:** [abbreviated example]
**Tags:** [comma-separated tags]
**Triggers:** [comma-separated activation phrases]
---
```

Add rule: when user confirms, output `%%SKILL_CONFIRMED%%` on its own line.

### 2.2 Skill parser

**File:** [src/lib/cowork/skill-parser.ts](src/lib/cowork/skill-parser.ts) (new)

Create `parseSkillFromMarkdown(markdown: string): Partial<Skill> | null` that:

- Extracts fields via `**Label:** value` patterns
- Extracts system prompt from first fenced code block
- Extracts parameters from markdown table
- Returns structured skill object or null

Use string splitting and structured extraction (minimal regex; PRD uses it for known format).

### 2.3 %%SKILL_CONFIRMED%% detection

**File:** [src/lib/cowork/agent-loop.ts](src/lib/cowork/agent-loop.ts)

In the stream finish handler (or when processing final assistant message):

- If `result.text.includes('%%SKILL_CONFIRMED%%')`:
  - Find the most recent assistant message containing `**Skill Name:**`
  - Call `parseSkillFromMarkdown(message.content)`
  - If parsed, call CreateSkill tool programmatically (or POST to skills API) with parsed data
  - Emit event so frontend shows success

Alternative: keep CreateSkill tool as primary path; use %%SKILL_CONFIRMED%% as fallback when tool fails.

---

## Phase 3: Skill Draft UI

### 3.1 SkillDraftCard component

**File:** [src/components/cowork/SkillDraftCard.tsx](src/components/cowork/SkillDraftCard.tsx) (new)

- Props: `content: string` (assistant message with draft)
- Use `parseSkillFromMarkdown` to get structured data
- If parsed, render a card with:
  - Name, category badge, description
  - System prompt (collapsible or truncated)
  - Parameters table
  - Example input/output
  - Tags and triggers
- Style with Puzzel design system (CSS variables, `.card`)

### 3.2 Integrate into chat

**File:** [src/components/cowork/CoworkMessageItem.tsx](src/components/cowork/CoworkMessageItem.tsx) (or CoworkCentrePanel)

When rendering assistant messages:

- If content includes `**Skill Name:**`, render `SkillDraftCard` below the message bubble
- Strip `%%SKILL_CONFIRMED%%` from displayed text

---

## Phase 4: Conversation Phase Tracking

### 4.1 Session metadata for phase

Options:

- Add `skillCreationPhase?: ConversationStatus` to CoworkSession or session metadata
- Store in a separate `CoworkSkillCreationState` table
- Derive from messages (detect draft, confirmation) — no DB change

**Recommended:** Add `skillCreationPhase` to session metadata JSON or a lightweight column.

### 4.2 Phase enum

```typescript
type SkillCreationPhase =
  | "gathering"
  | "clarifying"
  | "drafting"
  | "reviewing"
  | "confirmed"
  | "editing";
```

### 4.3 Update phase in agent loop

When processing messages, set phase based on content (e.g. draft present → `reviewing`; confirmation → `confirmed`). Emit phase in SSE for UI.

---

## Phase 5: Skill Parameters and Runner

### 5.1 Parameter support in content

- Skills with `parameters` use `{{name}}` placeholders in `content`
- `buildPromptFromSkill(skill, values): string` replaces `{{name}}` with `values[name]`

**File:** [src/lib/cowork/skill-runner.ts](src/lib/cowork/skill-runner.ts) (new)

```typescript
export function buildPromptFromSkill(
  content: string,
  parameters: SkillParameter[],
  values: Record<string, string>,
): string;
```

### 5.2 Skill detail page

**File:** [src/app/cowork/skills/[id]/page.tsx](src/app/cowork/skills/[id]/page.tsx) (new)

- GET skill by ID (use existing `GET /api/cowork/skills/[id]`)
- Show skill name, description, category, example
- If skill has parameters: render form (text, textarea, select, number, boolean from schema)
- "Run" button: build prompt from skill + form values, start a chat with that system prompt (or call a run endpoint)
- Output area for streaming result

### 5.3 Skill runner API (optional)

**File:** [src/app/api/cowork/skills/[id]/run/route.ts](src/app/api/cowork/skills/[id]/run/route.ts) (new)

- POST with `{ parameterValues: Record<string, string>, userInput?: string }`
- Load skill, build prompt, call LLM with skill as system prompt
- Stream response

Alternatively: skill runner opens a new Cowork chat session with the skill pre-loaded as system context (no new API).

---

## Phase 6: Skills Library Enhancements

### 6.1 Category and tags

- Add category filter (dropdown or chips)
- Add tag filter (multi-select or search)
- Add search bar (name, description, tags)
- Update `GET /api/cowork/skills` to accept `?category=&search=&tags=`

### 6.2 Skill cards

- Show category badge on each card
- Show tags
- "Use" button → navigate to `/cowork/skills/[id]` (runner)

### 6.3 Filters UI

**File:** [src/app/cowork/skills/page.tsx](src/app/cowork/skills/page.tsx)

- Sidebar or top bar with category checkboxes, tag pills, search input
- Filter state in URL search params for shareable links

---

## Phase 7: CreateSkill Tool and API Updates

### 7.1 CreateSkill tool

**File:** [src/lib/cowork/tools/create-skill.ts](src/lib/cowork/tools/create-skill.ts)

- Accept new fields: `category`, `parameters`, `exampleInput`, `exampleOutput`, `tags`, `status`
- Validate parameters array shape
- Pass through to `db.coworkSkill.create`

### 7.2 POST /api/cowork/skills

- Extend validation schema
- Create with all new fields
- Default `status: 'published'` when created via tool; `draft` when coming from confirmation flow until we implement status

### 7.3 PATCH /api/cowork/skills/[id]

- Allow updating category, parameters, exampleInput, exampleOutput, tags, status
- Increment `version` on update

---

## Phase 8: Audit and Audit Events

### 8.1 Audit events

**File:** [src/lib/audit.ts](src/lib/audit.ts)

- Ensure `coworkSkillCreated`, `coworkSkillUpdated` include new fields in details
- Add `coworkSkillRun` if we add run endpoint (optional)

---

## Implementation Order (Recommended)

| Order | Phase   | Deliverable                               |
| ----- | ------- | ----------------------------------------- |
| 1     | 1.1–1.3 | Schema, migration, types                  |
| 2     | 7.1–7.3 | CreateSkill tool + API support new fields |
| 3     | 2.1–2.2 | Skill-creator PRD format + parser         |
| 4     | 3.1–3.2 | SkillDraftCard + chat integration         |
| 5     | 2.3     | %%SKILL_CONFIRMED%% detection + save      |
| 6     | 4.1–4.3 | Phase tracking (optional; can defer)      |
| 7     | 6.1–6.3 | Library filters (category, tags, search)  |
| 8     | 5.1–5.3 | Skill Runner (detail page + run flow)     |

---

## Files to Create

| File                                                     | Purpose                                    |
| -------------------------------------------------------- | ------------------------------------------ |
| `src/lib/cowork/skill-parser.ts`                         | Parse markdown draft into Skill            |
| `src/lib/cowork/skill-runner.ts`                         | Build prompt from skill + parameter values |
| `src/components/cowork/SkillDraftCard.tsx`               | Rich draft card                            |
| `src/app/cowork/skills/[id]/page.tsx`                    | Skill detail + runner                      |
| `src/types/skill.ts` (optional)                          | SkillParameter and related types           |
| `src/app/api/cowork/skills/[id]/run/route.ts` (optional) | Run skill API                              |

## Files to Modify

| File                                          | Changes                              |
| --------------------------------------------- | ------------------------------------ |
| `prisma/schema.prisma`                        | CoworkSkill columns                  |
| `src/lib/validation.ts`                       | Validation schemas                   |
| `src/lib/cowork/tools/create-skill.ts`        | New fields                           |
| `src/lib/cowork/agent-loop.ts`                | %%SKILL_CONFIRMED%% detection        |
| `storage/skills/skill-creator/SKILL.md`       | PRD format                           |
| `src/app/api/cowork/skills/route.ts`          | Create with new fields, list filters |
| `src/app/api/cowork/skills/[id]/route.ts`     | Update with new fields, version bump |
| `src/app/cowork/skills/page.tsx`              | Filters, Use button                  |
| `src/components/cowork/CoworkMessageItem.tsx` | SkillDraftCard integration           |

---

## Testing Checklist

- [ ] Create skill with category, parameters, examples via chat
- [ ] Confirm draft triggers save (CreateSkill or %%SKILL_CONFIRMED%%)
- [ ] SkillDraftCard renders correctly
- [ ] Skills library filters by category, tags, search
- [ ] Skill detail page loads
- [ ] Skill runner: form generated from parameters, prompt built correctly, output streams
- [ ] Edit skill increments version
- [ ] Draft vs published status (if used)
