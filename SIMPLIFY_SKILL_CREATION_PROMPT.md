# Simplify Skill Creation — Cursor Prompt

Use this prompt in Cursor to remove the fragile mode-switching architecture from skill creation and replace it with a single unified prompt + well-described tools.

---

## Prompt

You are simplifying the skill creation flow in a Next.js application. The current architecture uses fragile mode-switching (`skillCreationMode` flags, regex pattern matching, a dedicated 70-line `SKILL_CREATOR_SYSTEM_PROMPT`, and prompt replacement) to handle skill creation differently from normal chat. This keeps breaking because each layer (frontend flag → API route detection → agent-loop prompt switching) can fail independently.

The fix is simple: **remove all mode-switching and let one good base prompt + a well-described CreateSkill tool handle everything**, exactly like Claude Cowork does.

### The Problem

Currently, skill creation goes through this fragile chain:

1. **Frontend** (`CoworkCentrePanel.tsx` line 174): When "New Skill" is clicked, sets `skillCreationMode: true` in state, sends a starter message with `skillCreationMode` flag
2. **API route** (`messages/route.ts` lines 163, 389-399): Checks `skillCreationMode` from request body, OR session title, OR regex pattern, OR chat history scanning — all to set `isSkillCreationSession`
3. **Agent loop** (`agent-loop.ts` lines 510-517): If `skillCreationMode`, forces `"skill-creator"` into `activeSkills`
4. **System prompt** (`agent-loop.ts` lines 155-172): If `activeSkills` includes `"skill-creator"`, replaces the ENTIRE base prompt with `SKILL_CREATOR_SYSTEM_PROMPT`
5. **File-based skill** (`storage/skills/skill-creator/SKILL.md`): Also exists as a file-based skill with trigger matching, redundant with the above

Any single link in this chain can fail (and has), causing the LLM to use the generic prompt and call CreateDocument instead of CreateSkill.

### The Solution

Remove all mode-switching. Add a short skill creation section to the base system prompt. Let the CreateSkill tool description guide the LLM. The LLM is smart enough to follow a conversational flow when told to — no special modes needed.

---

## Changes Required

### 1. `src/lib/cowork/agent-loop.ts` — Remove mode-switching, enhance base prompt

#### 1a. Delete `SKILL_CREATOR_SYSTEM_PROMPT`

Delete the entire `SKILL_CREATOR_SYSTEM_PROMPT` constant (lines 35–102). It's no longer needed.

Delete the comment block above it (lines 30–34) that says "Dedicated system prompt for skill creation mode."

#### 1b. Remove `skillCreationMode` from `AgentLoopConfig`

In the `AgentLoopConfig` interface (line 336), remove:

```typescript
/** When true, force skill-creator skill active so the chat "already knows" it's creating a skill */
skillCreationMode?: boolean;
```

#### 1c. Remove skill-creator force-activation from `runAgentLoop()`

In `runAgentLoop()`, lines 509-517, replace:

```typescript
// When user explicitly opened "New Skill", force skill-creator so the chat already knows
const forceSkillCreator = config.skillCreationMode === true;
let activeSkills = [
  ...new Set([
    ...(config.activeSkills || []),
    ...matchedSkills,
    ...(forceSkillCreator ? ["skill-creator"] : []),
  ]),
];
```

With simply:

```typescript
let activeSkills = [
  ...new Set([...(config.activeSkills || []), ...matchedSkills]),
];
```

#### 1d. Remove skill-creator branch from `assembleSystemPrompt()`

In `assembleSystemPrompt()`, delete the entire skill-creator branch (lines 154-172):

```typescript
// --- Skill creation mode: use the dedicated prompt ---
if (activeSkills?.includes("skill-creator")) {
  let prompt = SKILL_CREATOR_SYSTEM_PROMPT;
  prompt = appendSessionState(prompt, sessionState);
  // ... (all the way to return prompt;)
}
```

This leaves only the normal mode path.

#### 1e. Add skill creation guidance to the default prompt

In the `defaultPrompt` string inside `assembleSystemPrompt()` (lines 175-187), add a skill creation section after the existing Tools section. The updated prompt should be:

```typescript
const defaultPrompt = `You are Cowork, an AI assistant built into the Puzzel Co-Work platform. You help users accomplish tasks by planning, executing, and delivering results.

Key behaviours:
- Be concise and helpful. Avoid unnecessary preamble.
- Use markdown formatting for readability (bold, lists, code blocks).
- When a task is complex, break it into steps and work through them.
- Ask clarifying questions when the request is ambiguous.
- Be honest about limitations.

Tools (critical — follow exactly):
- If the user asks for a poem, report, or any content to be saved as a Word document (.docx): you MUST first write the full content in your message, then in the same response call CreateDocument with that exact content in the sections parameter. Sections must be an array of { heading: string, paragraphs: string[] }; put the full poem or text inside paragraphs (e.g. one section with heading "Content" and paragraphs: ["line one", "line two", ...]). Never call CreateDocument with empty sections—if you get a message asking you to call again with content, call CreateDocument again and pass the full text in sections.
- For any other file deliverable (spreadsheet, code file, etc.), use CreateSpreadsheet or Write in that same turn.
- Rule: delivering a file = calling the tool. Saying you will deliver a file without calling the tool is not allowed.

Creating skills:
- When the user wants to create a reusable skill (a structured prompt template), use the CreateSkill tool.
- Do NOT use CreateDocument for skills. Skills are created with CreateSkill.
- Have a conversation first: ask 2-3 clarifying questions to understand the skill's purpose, inputs, output format, and edge cases. Wait for answers before drafting.
- Show the user a draft of the skill (name, description, system prompt, parameters, example input/output) and ask for confirmation before calling CreateSkill.
- Only call CreateSkill after the user confirms the draft.`;
```

#### 1f. Delete the stale comment at line 27-28

Remove:

```typescript
// Note: trySkillConfirmedFallback was removed. The dedicated skill creation system prompt
// (SKILL_CREATOR_SYSTEM_PROMPT) now reliably guides the LLM to call CreateSkill directly.
// If CreateSkill fails, the LLM sees the error in the tool result and retries on its own.
```

---

### 2. `src/app/api/cowork/sessions/[id]/messages/route.ts` — Remove skill detection

#### 2a. Remove skill creation detection block

Delete the entire block at lines 384-399:

```typescript
// 14. Detect if this session is in skill creation mode.
// Three ways to trigger:
//   a) Frontend sent skillCreationMode: true (user clicked "New Skill")
//   b) Session was previously identified as skill creation (title or starter message)
//   c) The user's current message explicitly asks to create a skill
const SKILL_CREATION_PATTERN =
  /\b(create|build|make|add|new)\s+(a\s+)?(new\s+)?skill\b/i;
const isSkillCreationSession =
  skillCreationMode ||
  session.title === "Create a skill" ||
  SKILL_CREATION_PATTERN.test(userMessageText) ||
  chatMessages.some(
    (m) =>
      m.role === "user" &&
      (m.content.trim() === "I'd like to create a new skill." ||
        SKILL_CREATION_PATTERN.test(m.content)),
  );
```

#### 2b. Remove `skillCreationMode` from the `streamAgentLoop` call

In the `streamAgentLoop` call (line 415), remove the `skillCreationMode` property:

```typescript
// BEFORE:
skillCreationMode: isSkillCreationSession,

// AFTER: (delete the line entirely)
```

#### 2c. Simplify the `skillCreationMode` handling at the top of the POST handler

Lines 163-174 currently handle skill creation mode for empty content and starter messages. Simplify:

Replace:

```typescript
const skillCreationMode = Boolean(body.skillCreationMode);
if (!skillCreationMode && (!body.content || body.content.length === 0)) {
  return NextResponse.json(
    { error: "Message content is required" },
    { status: 400 },
  );
}

const userMessageText =
  skillCreationMode && (!body.content || !body.content.trim())
    ? "I'd like to create a new skill."
    : body.content;
```

With:

```typescript
if (!body.content || body.content.length === 0) {
  return NextResponse.json(
    { error: "Message content is required" },
    { status: 400 },
  );
}

const userMessageText = body.content;
```

#### 2d. Simplify auto-title logic

Lines 190-201, replace:

```typescript
    if (messageCount === 1) {
      const title =
        userMessageText.length > 60
          ? userMessageText.substring(0, 57) + "..."
          : skillCreationMode
            ? "Create a skill"
            : userMessageText;
```

With:

```typescript
    if (messageCount === 1) {
      const title =
        userMessageText.length > 60
          ? userMessageText.substring(0, 57) + "..."
          : userMessageText;
```

---

### 3. `src/components/cowork/CoworkCentrePanel.tsx` — Remove skill mode UI

#### 3a. Remove skill creation banner

Delete the entire skill creation banner block (lines 583-605):

```tsx
      {/* Skill creation mode — chat already knows it's for creating a skill */}
      {state.chat.skillCreationMode && (
        <div className="cowork-skill-creation-banner" ...>
          ...
        </div>
      )}
```

#### 3b. Simplify starter message effect

Lines 168-176, the starter message effect currently clears skillCreationMode and sends with the flag. Simplify:

Replace:

```typescript
useEffect(() => {
  const msg = state.chat.starterMessage;
  if (!msg || !session || state.chat.isStreaming) return;
  actions.setStarterMessage(null);
  actions.setSkillCreationMode(false);
  handleSendMessage(msg, undefined, undefined, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state.chat.starterMessage]);
```

With:

```typescript
useEffect(() => {
  const msg = state.chat.starterMessage;
  if (!msg || !session || state.chat.isStreaming) return;
  actions.setStarterMessage(null);
  handleSendMessage(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [state.chat.starterMessage]);
```

#### 3c. Remove `skillCreationMode` parameter from `handleSendMessage`

In `handleSendMessage` (line 179), remove the 4th parameter:

Replace:

```typescript
  const handleSendMessage = useCallback(
    async (text: string, provider?: string, model?: string, skillCreationMode?: boolean) => {
```

With:

```typescript
  const handleSendMessage = useCallback(
    async (text: string, provider?: string, model?: string) => {
```

And in the body (lines 197-198), remove the skillCreationMode body property:

Replace:

```typescript
const body: Record<string, unknown> = { content: text, provider, model };
if (skillCreationMode === true) body.skillCreationMode = true;
```

With:

```typescript
const body: Record<string, unknown> = { content: text, provider, model };
```

---

### 4. `src/app/cowork/page.tsx` — Simplify "New Skill" button handlers

#### 4a. Simplify `onOpenCreateSkill` callbacks

There are two `onOpenCreateSkill` callbacks (lines 281-286 and 311-316). Both currently set `skillCreationMode(true)` + `setStarterMessage(...)`. Remove the `setSkillCreationMode` call — just set the starter message:

Replace both instances of:

```typescript
onOpenCreateSkill={() => {
  actions.setSkillCreationMode(true);
  actions.setStarterMessage(
      "What kind of skill would you like to create? ..."
    );
  if (!state.sessions.active) {
    handleCreateSession();
  }
}}
```

With:

```typescript
onOpenCreateSkill={() => {
  actions.setStarterMessage(
    "I'd like to create a new skill."
  );
  if (!state.sessions.active) {
    handleCreateSession();
  }
}}
```

**Important change**: The starter message is now a simple user intent message ("I'd like to create a new skill.") rather than a prompt-like question from the AI's perspective. This lets the LLM receive the message naturally and kick off its skill creation flow using the guidance in its base system prompt.

---

### 5. `src/lib/cowork/context.tsx` — Remove `skillCreationMode` state

#### 5a. Remove the action type

In the `CoworkAction` union type (line 76), remove:

```typescript
  | { type: "SET_SKILL_CREATION_MODE"; payload: boolean };
```

#### 5b. Remove from initial state

In `initialState` (line 96), remove:

```typescript
    skillCreationMode: false,
```

#### 5c. Remove the reducer case

Remove the `SET_SKILL_CREATION_MODE` case from the reducer (lines 390-394):

```typescript
    case "SET_SKILL_CREATION_MODE":
      return {
        ...state,
        chat: { ...state.chat, skillCreationMode: action.payload },
      };
```

#### 5d. Remove the action helper

In `useCoworkActions()`, remove the `setSkillCreationMode` helper (lines 576-580):

```typescript
    setSkillCreationMode: useCallback(
      (enabled: boolean) =>
        dispatch({ type: "SET_SKILL_CREATION_MODE", payload: enabled }),
      [dispatch],
    ),
```

---

### 6. `src/types/cowork.ts` — Remove from type definition

In the `CoworkAppState` type, in the `chat` section, remove:

```typescript
/** True when user opened "New Skill" so the chat explicitly runs in skill-creation mode. */
skillCreationMode: boolean;
```

---

### 7. `src/lib/validation.ts` — Remove from validation schema

In the `sendCoworkMessage` schema (line 109), remove:

```typescript
    /** When true, backend forces skill-creator context for this turn; content may be empty. */
    skillCreationMode: z.boolean().optional().default(false),
```

---

### 8. `storage/skills/skill-creator/SKILL.md` — Delete the file

Delete the entire `storage/skills/skill-creator/` directory. This was the file-based skill that provided redundant skill creation instructions. The base prompt now handles skill creation guidance directly.

**IMPORTANT**: Make sure to delete the entire `storage/skills/skill-creator/` directory, not just the SKILL.md file.

---

### 9. `src/lib/cowork/tools/create-skill.ts` — Enhance tool description

Update the `description` field to give the LLM clear guidance about the conversational flow. The description is the LLM's primary reference for how to use the tool.

Replace the current description (lines 52-58):

```typescript
  description:
    "Create a new reusable skill. Call this ONLY after the user has confirmed the drafted skill. " +
    "You MUST provide these fields: name (string), description (string), content (string — the full system prompt/instructions in markdown). " +
    "Also provide: category (string — one of: Writing, Analysis, Code, Research, General), " +
    "triggers (string array — phrases that activate the skill), tags (string array — searchable keywords). " +
    "Optional: parameters (array of {name, label, type, description, required, default, options}), " +
    "exampleInput (string), exampleOutput (string). " +
    "Copy the EXACT values you showed the user in your draft. Do not omit or abbreviate any field.",
```

With:

```typescript
  description:
    "Create a new reusable AI skill (a structured prompt template the user can invoke later). " +
    "IMPORTANT WORKFLOW: Do NOT call this tool immediately. First have a conversation: " +
    "(1) Ask 2-3 clarifying questions about the skill's purpose, inputs, and expected output format. " +
    "(2) Draft the skill and show it to the user for review: name, description, system prompt, parameters, example input/output. " +
    "(3) Only call CreateSkill AFTER the user confirms the draft (says 'yes', 'looks good', 'create it', etc.). " +
    "Required fields: name (string), description (string), content (string — the full system prompt in markdown, use {{param}} for dynamic inputs), " +
    "category (string — one of: Writing, Analysis, Code, Research, General), " +
    "triggers (string array — phrases that activate the skill), tags (string array — searchable keywords), " +
    "parameters (JSON string — array of {name, label, type, description, required, default, options}, or '[]' if none), " +
    "exampleInput (string or null), exampleOutput (string or null). " +
    "Copy the EXACT values from the draft the user confirmed.",
```

---

## Files Changed Summary

| File                                                 | Action | What Changes                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/cowork/agent-loop.ts`                       | Modify | Delete `SKILL_CREATOR_SYSTEM_PROMPT` (~70 lines), delete skill-creator branch in `assembleSystemPrompt()` (~18 lines), remove `skillCreationMode` from config, remove force-activation logic, add skill creation section to base prompt (~6 lines) |
| `src/app/api/cowork/sessions/[id]/messages/route.ts` | Modify | Delete `SKILL_CREATION_PATTERN` regex, delete `isSkillCreationSession` detection (~15 lines), remove `skillCreationMode` from streamAgentLoop call, simplify content validation                                                                    |
| `src/components/cowork/CoworkCentrePanel.tsx`        | Modify | Delete skill creation banner (~22 lines), remove `skillCreationMode` parameter from `handleSendMessage`, simplify starter message effect                                                                                                           |
| `src/app/cowork/page.tsx`                            | Modify | Remove `setSkillCreationMode(true)` calls, change starter message text                                                                                                                                                                             |
| `src/lib/cowork/context.tsx`                         | Modify | Remove `SET_SKILL_CREATION_MODE` action, reducer case, and action helper                                                                                                                                                                           |
| `src/types/cowork.ts`                                | Modify | Remove `skillCreationMode` from `CoworkAppState.chat`                                                                                                                                                                                              |
| `src/lib/validation.ts`                              | Modify | Remove `skillCreationMode` from `sendCoworkMessage` schema                                                                                                                                                                                         |
| `src/lib/cowork/tools/create-skill.ts`               | Modify | Enhanced tool description with conversational workflow guidance                                                                                                                                                                                    |
| `storage/skills/skill-creator/`                      | Delete | Remove entire directory (file-based skill no longer needed)                                                                                                                                                                                        |

---

## What NOT to Change

1. **`src/lib/cowork/tool-execution.ts`** — Leave untouched. The extracted tool execution helpers are clean.
2. **`src/lib/cowork/skills.ts`** — Leave untouched. The skill registry, `matchSkills()`, `loadSessionSkills()` etc. are still needed for OTHER skills (user-created skills that get matched via triggers). The only skill we're removing is the built-in `skill-creator`.
3. **`src/lib/cowork/skill-parser.ts`** — Leave untouched. Still needed for SkillDraftCard rendering.
4. **`src/components/cowork/SkillDraftCard.tsx`** — Leave untouched. Still renders skill drafts in chat.
5. **`runAnthropicIteration()` and `runOpenAIIteration()`** — Leave untouched.
6. **`streamAgentLoop()`** — Leave untouched.
7. **`src/lib/cowork/llm/utils.ts`** — Leave untouched. The `enforceStrictSchema()` function is clean.
8. **`src/components/cowork/CoworkSidebar.tsx`** — Leave untouched. The "New Skill" button's `onOpenCreateSkill` callback is defined in `page.tsx`, not here.
9. **`src/components/cowork/CoworkRightPanel.tsx`** — Leave untouched. Same — callback defined in `page.tsx`.
10. **The CreateSkill tool schema (parameters object)** — Leave the `parameters` property definition untouched. It currently uses a flattened JSON string format that works with OpenAI strict mode. Do NOT change it.

---

## Verification

After making all changes:

1. Run `pnpm build` — must compile with zero TypeScript errors
2. Search the entire `src/` directory for `skillCreationMode` — should return **zero** results
3. Search for `SKILL_CREATOR_SYSTEM_PROMPT` — should return **zero** results
4. Search for `SKILL_CREATION_PATTERN` — should return **zero** results
5. Search for `isSkillCreationSession` — should return **zero** results
6. Verify `storage/skills/skill-creator/` directory is deleted
7. Verify the base prompt in `assembleSystemPrompt()` includes the "Creating skills:" section
8. Verify the CreateSkill tool description includes "IMPORTANT WORKFLOW"

### Manual testing (after deploy):

- Start a new chat, type "create a skill that reviews legal documents" — the LLM should ask clarifying questions, draft the skill, ask for confirmation, then call CreateSkill
- Start a new chat, type "write me a poem about cats" — should call CreateDocument, NOT CreateSkill (verifying skills section doesn't interfere)
- Click "New Skill" in sidebar — should create a session and send "I'd like to create a new skill." as a user message, which the LLM picks up naturally
- Create a skill, then in a new chat type something that matches the skill's triggers — should still match via `matchSkills()` and inject the skill content (this tests that the general skill system still works)
