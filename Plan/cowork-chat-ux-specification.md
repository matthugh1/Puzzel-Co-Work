# Cowork Chat Screen — UX Specification for Progress Display

> **Purpose:** This document specifies exactly how the Cowork chat screen communicates progress, tool execution, sub-agent coordination, and task status to the user. It covers every visual element, animation, state transition, and interaction pattern the user sees while Claude works. Hand this to Cursor alongside the main Cowork spec and the provider abstraction spec.

> **Why this matters:** The difference between "capable agent" and "fancy chatbot" lives entirely in this layer. Users need to feel confident that work is happening, understand what's happening, and have control at every decision point — without being overwhelmed.

---

## Table of Contents

1. [Chat Screen Anatomy](#1-chat-screen-anatomy)
2. [The Streaming Experience](#2-the-streaming-experience)
3. [Todo List Widget](#3-todo-list-widget)
4. [Tool Execution Cards](#4-tool-execution-cards)
5. [Sub-Agent Progress Cards](#5-sub-agent-progress-cards)
6. [Permission Request Cards](#6-permission-request-cards)
7. [Ask User Question Cards](#7-ask-user-question-cards)
8. [Plan Mode UI](#8-plan-mode-ui)
9. [Artifact & File Links](#9-artifact--file-links)
10. [Global Progress Indicators](#10-global-progress-indicators)
11. [Status Line](#11-status-line)
12. [Loading & Transition States](#12-loading--transition-states)
13. [Error States](#13-error-states)
14. [Timing & Animation Spec](#14-timing--animation-spec)
15. [Tool Discovery & Capabilities UI](#15-tool-discovery--capabilities-ui)

---

## 1. Chat Screen Anatomy

### What the user sees at rest (no active generation)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Messages scroll area (takes full height)            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 👤 User                                        │  │
│  │ Analyse these 3 contracts and create a          │  │
│  │ comparison report highlighting key risks        │  │
│  │ 📎 contract-a.pdf  📎 contract-b.pdf           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 🤖 Claude                                      │  │
│  │                                                 │  │
│  │ I'll analyse all three contracts and build a    │  │
│  │ comparison report. Let me start by reading      │  │
│  │ each one.                                       │  │
│  │                                                 │  │
│  │ ┌──────────────────────────────────────────┐    │  │
│  │ │ 📋 Task Progress                   2/5  │    │  │
│  │ │──────────────────────────────────────────│    │  │
│  │ │ ✅ Read all three contracts              │    │  │
│  │ │ ✅ Extract key clauses from each         │    │  │
│  │ │ 🔄 Comparing indemnity and liability     │    │  │
│  │ │ ⬜ Generate comparison report             │    │  │
│  │ │ ⬜ Verify accuracy                        │    │  │
│  │ └──────────────────────────────────────────┘    │  │
│  │                                                 │  │
│  │ ▸ 🔧 Read  contract-a.pdf              0.3s    │  │
│  │ ▸ 🔧 Read  contract-b.pdf              0.2s    │  │
│  │ ▸ 🔧 Read  contract-c.pdf              0.3s    │  │
│  │                                                 │  │
│  │ All three contracts are standard MSAs with      │  │
│  │ notable differences in indemnification...       │  │
│  │                                                 │  │
│  │ ▸ 🔧 Write  comparison-report.docx     1.2s    │  │
│  │                                                 │  │
│  │ Here's your comparison report:                  │  │
│  │ 📄 comparison-report.docx                      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│──────────────────────────────────────────────────────│
│  📎 │ Message Claude...                          ▶  │
│──────────────────────────────────────────────────────│
└──────────────────────────────────────────────────────┘
```

### Key layout rules

- Claude's entire response is **one continuous message block** — text, tool cards, todo widgets, artifact links all appear inline within the same message, in the order Claude produces them.
- Tool cards, todo widgets, and other interactive elements are **interspersed with text**, not grouped at the top or bottom.
- The chat auto-scrolls to the bottom as new content streams in, **unless** the user has manually scrolled up (then it shows a "↓ New content" pill).

---

## 2. The Streaming Experience

This is what the user sees in real time as Claude works. The experience is continuous — text appears token by token, tool cards materialize inline, and the todo widget updates in place.

### 2.1 Text Streaming

**What the user sees:**

```
Frame 1:  "I'll"
Frame 2:  "I'll analyse"
Frame 3:  "I'll analyse all three"
Frame 4:  "I'll analyse all three contracts..."
```

**Behaviour:**

- Tokens appear left-to-right as received from the API.
- Buffer 3–5 tokens before rendering to avoid single-character jitter.
- Cursor blinks at the end of the current text (thin vertical bar, blinking at 530ms interval).
- Markdown renders progressively — when a heading or bold marker completes, the formatting applies immediately.
- Code blocks render with syntax highlighting as they stream (detect language from opening fence).

### 2.2 What Happens When Claude Calls a Tool

This is the critical UX moment. Claude stops producing text and starts a tool call. Here's the exact sequence:

```
Timeline:
─────────────────────────────────────────────────────────

T+0s    Claude is streaming text:
        "I'll start by reading the contracts..."
        Cursor blinks at end of text.

T+0.1s  Claude initiates a tool call.
        Text streaming pauses.
        A tool card MATERIALIZES below the text:

        ┌────────────────────────────────────────┐
        │ 🔧 Read                        ⏳      │
        │ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
        │ file_path: /uploads/contract-a.pdf     │
        └────────────────────────────────────────┘

        Card appears with a fade-in (150ms).
        Spinner icon (⏳) pulses.
        The card is EXPANDED by default while running.

T+0.4s  Tool execution completes on the server.
        The card updates:

        ┌────────────────────────────────────────┐
        │ ▸ 🔧 Read  contract-a.pdf       0.3s  │
        └────────────────────────────────────────┘

        Card COLLAPSES to a single line.
        Spinner replaced with duration badge.
        Green left-border flash (200ms) to signal success.

T+0.5s  Claude resumes text streaming below the card:
        "The first contract is a standard MSA with..."

─────────────────────────────────────────────────────────
```

**Why collapsed by default after completion:** Tool calls are "plumbing" — the user needs to know they happened and that they succeeded, but doesn't need to see the raw parameters and output unless they want to. Collapsing keeps the chat clean.

### 2.3 Parallel Tool Calls

When Claude calls multiple tools simultaneously:

```
Timeline:
─────────────────────────────────────────────────────────

T+0s    Claude initiates 3 tool calls at once.
        THREE cards appear together (stagger animation: 50ms gap):

        ┌────────────────────────────────────────┐
        │ 🔧 Read                        ⏳      │
        │ file_path: /uploads/contract-a.pdf     │
        └────────────────────────────────────────┘
        ┌────────────────────────────────────────┐
        │ 🔧 Read                        ⏳      │
        │ file_path: /uploads/contract-b.pdf     │
        └────────────────────────────────────────┘
        ┌────────────────────────────────────────┐
        │ 🔧 Read                        ⏳      │
        │ file_path: /uploads/contract-c.pdf     │
        └────────────────────────────────────────┘

T+0.2s  First tool completes → its card collapses:
        ▸ 🔧 Read  contract-a.pdf          0.2s

T+0.3s  Third tool completes → its card collapses:
        ▸ 🔧 Read  contract-c.pdf          0.3s

T+0.4s  Second tool completes → its card collapses:
        ▸ 🔧 Read  contract-b.pdf          0.4s

        All three now shown as collapsed single-line items.

T+0.5s  Claude resumes streaming text below.

─────────────────────────────────────────────────────────
```

**Key detail:** Cards collapse individually as each tool finishes — they don't wait for all to complete. This gives the user a sense of parallel progress.

### 2.4 Long-Running Tool Calls (Bash, Code Execution)

For tools that take >2 seconds:

```
┌────────────────────────────────────────────────────┐
│ 🔧 Bash                                    12s ⏳  │
│ ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ │
│ $ python scripts/analyse_contracts.py              │
│                                                    │
│ Processing contract-a.pdf... done                  │
│ Processing contract-b.pdf... done                  │
│ Processing contract-c.pdf...                       │
│ █████████████████░░░░░░░░░░░░░  58%               │
│                                                    │
│ ──────────────────────────────────── elapsed: 12s  │
└────────────────────────────────────────────────────┘
```

**Behaviour:**

- Card stays EXPANDED while running.
- Shows live output if the tool streams output (bash stdout).
- Elapsed time counter ticks every second in the top-right.
- Output area is scrollable if it exceeds 10 lines (max-height with overflow).
- On completion: collapses to single line like all other tools.

---

## 3. Todo List Widget

The todo widget is the primary progress indicator. It appears inline in Claude's message and updates in real-time.

### 3.1 Appearance

```
┌──────────────────────────────────────────────────────┐
│ 📋 Task Progress                              3/5   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░  60%   │
│──────────────────────────────────────────────────────│
│ ✅  Read all three contracts                         │
│ ✅  Extract key clauses from each                    │
│ 🔄  Comparing indemnity and liability terms          │
│ ⬜  Generate comparison report                       │
│ ⬜  Verify accuracy and completeness                 │
└──────────────────────────────────────────────────────┘
```

### 3.2 Visual States Per Item

| State           | Icon                            | Text Style                                          | Background                          |
| --------------- | ------------------------------- | --------------------------------------------------- | ----------------------------------- |
| **Pending**     | ⬜ (empty square, grey)         | Normal weight, muted text colour                    | None                                |
| **In Progress** | 🔄 (spinner, animated rotation) | Semi-bold, primary text colour                      | Faint highlight row (e.g., blue-50) |
| **Completed**   | ✅ (green check)                | Normal weight, muted text colour, ~~strikethrough~~ | None                                |

### 3.3 Text Display Rules

| State           | Which text field is displayed                                                          |
| --------------- | -------------------------------------------------------------------------------------- |
| **Pending**     | `content` — the imperative form ("Generate comparison report")                         |
| **In Progress** | `activeForm` — the present continuous form ("Comparing indemnity and liability terms") |
| **Completed**   | `content` — reverts to imperative form with strikethrough                              |

### 3.4 Progress Bar

- Thin horizontal bar at the top of the widget.
- Width = `(completed / total) * 100%`.
- Colour: accent colour (blue/purple).
- The percentage and fraction (`3/5`) are shown at the far right of the header row.
- Progress bar animates smoothly (CSS transition 300ms ease) when percentage changes.

### 3.5 Real-Time Update Behaviour

```
Timeline of a todo update:
─────────────────────────────────────────────────────────

T+0s    Widget shows:
        ✅  Read all three contracts
        🔄  Extracting key clauses
        ⬜  Compare indemnity terms
        ⬜  Generate report
        ⬜  Verify accuracy

T+5s    Server streams a todo_update event.
        "Extract key clauses" moves to completed.
        "Compare indemnity terms" moves to in_progress.

        Animation sequence (all in ~300ms):
        1. Row 2: spinner stops → green check morphs in (scale 0→1, 150ms)
        2. Row 2: text changes to strikethrough (fade, 100ms)
        3. Row 3: highlight background fades in (100ms)
        4. Row 3: empty square → spinner morphs in (rotation starts)
        5. Row 3: text changes from "content" to "activeForm"
        6. Progress bar width animates from 20% → 40%
        7. Counter updates from "1/5" → "2/5"

        Result:
        ✅  Read all three contracts
        ✅  Extract key clauses from each
        🔄  Comparing indemnity and liability terms
        ⬜  Generate comparison report
        ⬜  Verify accuracy
```

### 3.6 Widget Persistence

- The todo widget renders at the **position where Claude first created it** in the message stream.
- It does **not** move — it stays at that scroll position.
- All subsequent updates modify it **in place** (no new widget rendered).
- If the user scrolls up past the widget, updates still happen silently. When they scroll back, they see the current state.

### 3.7 Edge Cases

| Scenario                          | Behaviour                                                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Claude adds new items to the list | New items animate in at the bottom (slide down + fade in, 200ms)                                      |
| Claude removes items              | Items slide up + fade out (200ms). Remaining items reflow smoothly.                                   |
| All items completed               | Progress bar fills to 100%. A subtle "✨ Complete" badge appears next to the header.                  |
| Only 1 item                       | Widget still renders, but without progress bar (too trivial). Just shows the single item with status. |
| 10+ items                         | Widget becomes scrollable (max-height) with a subtle inner scroll indicator.                          |

---

## 4. Tool Execution Cards

### 4.1 Anatomy of a Tool Card

**Expanded (while running or when user clicks to expand):**

```
┌──────────────────────────────────────────────────────┐
│ 🔧 Read                                     ⏳ 0.3s │
│──────────────────────────────────────────────────────│
│ PARAMETERS                                           │
│ file_path    /uploads/contract-a.pdf                 │
│ offset       (not set)                               │
│ limit        (not set)                               │
│──────────────────────────────────────────────────────│
│ OUTPUT                                               │
│ ┌────────────────────────────────────────────────┐   │
│ │ MASTER SERVICES AGREEMENT                      │   │
│ │ This Master Services Agreement ("Agreement")   │   │
│ │ is entered into as of January 15, 2026...      │   │
│ │ ...                                            │   │
│ │              [truncated — 2,400 lines]         │   │
│ └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Collapsed (default after completion):**

```
▸ 🔧 Read  contract-a.pdf                       0.3s
```

### 4.2 Card States

| State         | Visual                     | Icon          | Right Badge                  |
| ------------- | -------------------------- | ------------- | ---------------------------- |
| **Running**   | Expanded, pulsing border   | ⏳ (spinning) | Elapsed time counter (ticks) |
| **Succeeded** | Collapsed to one line      | 🔧 (static)   | Duration (e.g., "0.3s")      |
| **Failed**    | Collapsed, red left border | ❌            | "Error" label                |

### 4.3 Collapse/Expand Interaction

- Click anywhere on the collapsed card → expands with slide-down animation (200ms).
- Click the chevron (▸/▾) or card header → collapses with slide-up animation (200ms).
- Expanded view shows parameters table + output.
- Output is in a scrollable code-style container (max-height 200px).
- Output over 500 characters shows a "Show more" toggle.

### 4.4 Tool-Specific Visual Treatments

Not all tools look the same. Some tools get special visual treatment:

| Tool                 | Collapsed Summary            | Special Treatment                        |
| -------------------- | ---------------------------- | ---------------------------------------- |
| **Read**             | `Read  filename.ext`         | Shows filename, not full path            |
| **Write**            | `Write  filename.ext`        | Shows filename + file size badge         |
| **Edit**             | `Edit  filename.ext`         | Shows filename + "N lines changed"       |
| **Bash**             | `Bash  command summary`      | Shows truncated command (first 40 chars) |
| **Grep**             | `Grep  "pattern"  N matches` | Shows pattern and match count            |
| **Glob**             | `Glob  "pattern"  N files`   | Shows pattern and file count             |
| **WebSearch**        | `WebSearch  "query"`         | Shows search query                       |
| **WebFetch**         | `WebFetch  domain.com`       | Shows domain only                        |
| **TodoWrite**        | _Not rendered as a card_     | Updates the todo widget directly         |
| **AskUserQuestion**  | _Rendered as question card_  | See Section 7                            |
| **Task** (sub-agent) | _Rendered as agent card_     | See Section 5                            |
| **Skill**            | `Skill  skill-name`          | Shows skill name                         |
| **EnterPlanMode**    | _Triggers plan mode UI_      | See Section 8                            |

**Note:** To see what tools are available and learn about their capabilities, users can access the Tool Discovery UI (see Section 15) via the help button in the chat header or the empty state widget.

### 4.5 Nested Tool Calls (Tool → Claude → Tool)

When a tool call leads to another round of Claude thinking and more tool calls, the visual flow is sequential — no nesting:

```
Text from Claude...

▸ 🔧 Read  contract-a.pdf                       0.3s

More text from Claude about what it found...

▸ 🔧 Grep  "indemnification"  12 matches        0.1s

More text about the grep results...

▸ 🔧 Write  report.docx                         1.2s

Final text with the file link.
```

Each tool card appears at the position in the stream where Claude called it. The user reads the conversation top-to-bottom and sees the natural flow of work.

---

## 5. Sub-Agent Progress Cards

When Claude spawns sub-agents (parallel workers), a special coordination card appears.

### 5.1 Anatomy

```
┌──────────────────────────────────────────────────────┐
│ 🔀 Running 3 parallel tasks                         │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░  67%   │
│──────────────────────────────────────────────────────│
│                                                      │
│ ✅  Analysing contract A              Done    8.2s   │
│     Identified 3 high-risk clauses                   │
│                                                      │
│ ✅  Analysing contract B              Done    6.5s   │
│     Standard terms, 1 deviation noted                │
│                                                      │
│ 🔄  Analysing contract C              Turn 4/10      │
│     Currently reviewing termination clause           │
│                                                      │
│──────────────────────────────────────────────────────│
│ [Cancel All]                                         │
└──────────────────────────────────────────────────────┘
```

### 5.2 Individual Agent Row States

| State         | Icon         | Status Badge              | Detail Line                                                                |
| ------------- | ------------ | ------------------------- | -------------------------------------------------------------------------- |
| **Running**   | 🔄 (spinner) | `Turn N/M` (updates live) | Current activity description (from agent's activeForm or latest tool call) |
| **Completed** | ✅           | `Done` + duration         | Result summary (first 60 chars of agent result)                            |
| **Failed**    | ❌           | `Failed`                  | Error message (first 60 chars)                                             |
| **Cancelled** | ⛔           | `Cancelled`               | "Cancelled by user"                                                        |

### 5.3 Live Update Behaviour

```
Timeline:
─────────────────────────────────────────────────────────

T+0s    Card appears with 3 agents, all running:
        🔄  Analysing contract A     Turn 1/10
        🔄  Analysing contract B     Turn 1/10
        🔄  Analysing contract C     Turn 1/10

T+2s    Agent B advances:
        🔄  Analysing contract A     Turn 2/10
        🔄  Analysing contract B     Turn 3/10     ← jumped ahead
            Reading indemnification clause
        🔄  Analysing contract C     Turn 1/10

T+6.5s  Agent B completes:
        🔄  Analysing contract A     Turn 5/10
        ✅  Analysing contract B     Done  6.5s    ← check + duration
            Standard terms, 1 deviation noted       ← result summary
        🔄  Analysing contract C     Turn 3/10

        Progress bar: 33% → animates smoothly.

T+8.2s  Agent A completes:
        ✅  Analysing contract A     Done  8.2s
            Identified 3 high-risk clauses
        ✅  Analysing contract B     Done  6.5s
            Standard terms, 1 deviation noted
        🔄  Analysing contract C     Turn 4/10

        Progress bar: 67%.

T+11s   Agent C completes:
        All three ✅.
        Progress bar: 100%.
        Card header changes to:
        "✅ Completed 3 parallel tasks"
        [Cancel All] button disappears.

T+11.1s Claude resumes text streaming below the card,
        synthesizing all three results.

─────────────────────────────────────────────────────────
```

### 5.4 Cancel Interaction

- "Cancel All" button is always visible while any agent is running.
- Clicking it shows a confirmation: "Cancel all running tasks?" [Yes] [No].
- On confirm: all running agents transition to ⛔ Cancelled state.
- Claude receives the cancellation and continues without those results.

### 5.5 Card Lifecycle

- Card appears when Claude spawns agents.
- Card updates in place as agents progress and complete.
- Card stays visible after all agents complete (does not collapse like tool cards).
- User can collapse it manually if desired.

---

## 6. Permission Request Cards

When Claude needs to do something destructive or sensitive, the entire response pauses until the user decides.

### 6.1 Anatomy

```
┌──────────────────────────────────────────────────────┐
│ ⚠️  Permission Required                              │
│──────────────────────────────────────────────────────│
│                                                      │
│ Claude wants to delete 3 files:                      │
│                                                      │
│   • /outputs/old-report-v1.docx                      │
│   • /outputs/old-report-v2.docx                      │
│   • /outputs/draft-notes.txt                         │
│                                                      │
│ This action cannot be undone.                        │
│                                                      │
│              [✅ Allow]    [❌ Deny]                   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 6.2 Blocking Behaviour

- **The stream STOPS.** No more text or tool calls until the user responds.
- The input area shows a subtle indicator: "⏸ Waiting for your permission above..."
- The user can still type a message (which will queue behind the permission resolution).
- The card has a faint amber/yellow left border and background to draw attention.
- Auto-scroll ensures the card is visible.

### 6.3 After Resolution

| Action    | What happens                                                                                                                                                     |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Allow** | Card updates to show "✅ Allowed" with muted styling. Claude resumes.                                                                                            |
| **Deny**  | Card updates to show "❌ Denied" with muted styling. Claude receives the denial and adjusts (typically explains why it can't continue or offers an alternative). |

### 6.4 Permission Types and Messages

| Permission Type                     | Card Message                                               |
| ----------------------------------- | ---------------------------------------------------------- |
| **File deletion**                   | "Claude wants to delete N files: [list]"                   |
| **Send message** (email, Slack)     | "Claude wants to send a message to [recipient]: [preview]" |
| **Publish content**                 | "Claude wants to publish to [platform]: [preview]"         |
| **Submit form**                     | "Claude wants to submit a form on [domain]"                |
| **Download file**                   | "Claude wants to download [filename] (N MB) from [domain]" |
| **Accept terms**                    | "Claude wants to accept terms and conditions on [domain]"  |
| **External API call** (destructive) | "Claude wants to [action] via [connector]: [details]"      |

---

## 7. Ask User Question Cards

When Claude needs input to proceed (clarifying scope, choosing an approach, etc.).

### 7.1 Single-Select Question

```
┌──────────────────────────────────────────────────────┐
│ 💬 Claude has a question                             │
│──────────────────────────────────────────────────────│
│                                                      │
│ What level of detail should the report include?      │
│                                                      │
│ ┌────────────────────────────────────────────────┐   │
│ │ ◉  Executive summary (Recommended)             │   │
│ │    1-2 pages, key findings and risks only      │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ○  Detailed analysis                           │   │
│ │    5-10 pages, clause-by-clause comparison     │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ○  Full legal review                           │   │
│ │    Comprehensive with tracked changes          │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ○  Other                                       │   │
│ │    [Type your preference...]                   │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│                                        [Submit]      │
└──────────────────────────────────────────────────────┘
```

### 7.2 Multi-Select Question

```
┌──────────────────────────────────────────────────────┐
│ 💬 Claude has a question                             │
│──────────────────────────────────────────────────────│
│                                                      │
│ Which clauses should I focus on?                     │
│ (Select all that apply)                              │
│                                                      │
│ ┌────────────────────────────────────────────────┐   │
│ │ ☑  Indemnification                             │   │
│ │    Allocation of financial liability            │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ☑  Termination                                 │   │
│ │    Conditions and notice periods               │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ☐  IP ownership                                │   │
│ │    Who owns deliverables and pre-existing IP   │   │
│ └────────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────────┐   │
│ │ ☐  Other                                       │   │
│ │    [Type your preference...]                   │   │
│ └────────────────────────────────────────────────┘   │
│                                                      │
│                                        [Submit]      │
└──────────────────────────────────────────────────────┘
```

### 7.3 Behaviour

- **Blocks the stream** just like permission requests.
- Input indicator: "⏸ Answering Claude's question above..."
- "Other" option always present — clicking it reveals a text input field.
- Selecting an option highlights it (filled radio/checkbox + subtle background).
- [Submit] is disabled until at least one option selected.
- After submission: card updates to show what the user chose (muted styling), marked as answered.

### 7.4 Multiple Questions

When Claude asks multiple questions at once (up to 4), they appear in a single card with tabs or sections:

```
┌──────────────────────────────────────────────────────┐
│ 💬 Claude has 2 questions                            │
│──────────────────────────────────────────────────────│
│                                                      │
│ ❶ Report format                                     │
│   What format should the report be in?               │
│   ◉ Word document (.docx)                            │
│   ○ PDF                                              │
│   ○ Markdown                                         │
│                                                      │
│ ❷ Audience                                          │
│   Who is the primary audience?                       │
│   ○ Legal team                                       │
│   ○ Executive leadership                             │
│   ○ External stakeholders                            │
│                                                      │
│                                        [Submit All]  │
└──────────────────────────────────────────────────────┘
```

---

## 8. Plan Mode UI

When Claude enters plan mode for complex tasks.

### 8.1 Plan Mode Indicator

When Claude enters plan mode, a persistent banner appears at the top of the chat:

```
┌──────────────────────────────────────────────────────┐
│ 📐 PLAN MODE — Claude is exploring before acting     │
│ Claude can read and search but won't make changes    │
│ until you approve a plan.                            │
└──────────────────────────────────────────────────────┘
```

- Banner is sticky at the top of the message area.
- Subtle blue/purple background.
- Persists until plan is approved or rejected.

### 8.2 During Planning

Claude's messages during plan mode look normal (text + read-only tool calls), but tool cards have a visual indicator that they're read-only:

```
▸ 🔍 Read  contract-a.pdf                       0.3s
▸ 🔍 Grep  "indemnification"  12 matches        0.1s
▸ 🔍 Glob  "**/*.pdf"  3 files                  0.1s
```

Note: icon is 🔍 (search) instead of 🔧 (wrench) to indicate exploration, not modification.

### 8.3 Plan Review Card

When Claude finishes planning and presents its plan:

```
┌──────────────────────────────────────────────────────┐
│ 📋 PROPOSED PLAN                                     │
│──────────────────────────────────────────────────────│
│                                                      │
│ Based on my analysis of all three contracts,         │
│ here's my approach:                                  │
│                                                      │
│ 1. Extract key clauses from each contract            │
│    (indemnity, liability, termination, IP)            │
│                                                      │
│ 2. Build a comparison matrix highlighting            │
│    differences and risk levels                       │
│                                                      │
│ 3. Generate a Word document with:                    │
│    - Executive summary of key risks                  │
│    - Clause-by-clause comparison table               │
│    - Recommended negotiation points                  │
│                                                      │
│ 4. Verify all clause references are accurate         │
│                                                      │
│ Estimated time: ~2 minutes                           │
│                                                      │
│     [✅ Approve]    [✏️ Edit]    [❌ Reject]          │
└──────────────────────────────────────────────────────┘
```

### 8.4 Plan Resolution

| Action      | What happens                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------- |
| **Approve** | Banner disappears. Card shows "✅ Plan approved". Claude begins executing. Todo widget appears.             |
| **Edit**    | A text input field appears below the plan. User can type modifications. On submit, Claude revises the plan. |
| **Reject**  | Card shows "❌ Plan rejected". Claude asks what the user would prefer instead.                              |

---

## 9. Artifact & File Links

### 9.1 File Chip (Inline in Message)

When Claude creates a file, it appears as an inline clickable chip:

```
Here's your comparison report:

┌──────────────────────────────────┐
│ 📄 comparison-report.docx  24KB │
└──────────────────────────────────┘
```

**Behaviour:**

- Click → opens file in the right panel artifact viewer.
- Hover → shows tooltip with file name, size, and creation time.
- The chip has a subtle background colour (light grey) and rounded corners.
- File icon varies by type (📄 doc, 📊 xlsx, 📊 pptx, 🖼 image, 📋 pdf, 💻 code).

### 9.2 Multiple File Outputs

When Claude creates several files:

```
I've generated all three deliverables:

📄 comparison-report.docx     24KB
📊 risk-matrix.xlsx           12KB
📊 executive-summary.pptx     1.2MB
```

Each chip is on its own line, aligned left.

### 9.3 Right Panel Behaviour on Artifact Click

```
User clicks "📄 comparison-report.docx"
  → Right panel slides open (if not already) — 300ms slide from right
  → Tab switches to "Artifacts"
  → Loading spinner for ~200ms
  → File renders:
     - .docx → converted to PDF preview (server-side) → PDF.js viewer
     - .html → sandboxed iframe
     - .jsx → compiled + rendered in sandboxed iframe
     - .md → rendered HTML
     - .pdf → PDF.js viewer
     - .svg/.mermaid → rendered inline
     - .xlsx → converted to HTML table preview
     - .pptx → slide thumbnails
     - images → inline display

  → Toolbar appears at top of preview:
    📥 Download  |  ↗ Open in New Tab  |  📋 Copy Source
```

---

## 10. Global Progress Indicators

### 10.1 Session Tab Badge

When Claude is actively working, the browser tab title shows activity:

```
Normal:    "Cowork — Contract Analysis"
Working:   "⏳ Cowork — Contract Analysis"
Complete:  "✅ Cowork — Contract Analysis" (for 5 seconds, then reverts)
Error:     "❌ Cowork — Contract Analysis"
```

### 10.2 Top Progress Bar (Browser-Style)

A thin (2px) progress bar at the very top of the page, above everything:

```
┌══════════════════════════════════░░░░░░░░░░░░░░░┐  ← progress bar
│                                                  │
│  [rest of the interface]                         │
```

- Tied to the todo list: `completed / total` items.
- If no todo list: shows an indeterminate animation (sliding gradient) while Claude is streaming.
- Disappears when Claude finishes.
- Colour: accent blue/purple.

---

## 11. Status Line

### 11.1 Position

A thin bar between the message area and the input area:

```
│  ...message content...                               │
│──────────────────────────────────────────────────────│
│  🔄 Comparing indemnity terms · Turn 5 · 12s        │  ← status line
│──────────────────────────────────────────────────────│
│  📎 │ Message Claude...                          ▶  │
```

### 11.2 Content

| Claude State               | Status Line Content                    |
| -------------------------- | -------------------------------------- |
| **Idle**                   | Hidden (no bar shown)                  |
| **Streaming text**         | `✍️ Writing...`                        |
| **Calling a tool**         | `🔧 Running Read on contract-a.pdf...` |
| **Running bash**           | `⚡ Executing: python analyse.py · 5s` |
| **Spawning agents**        | `🔀 Starting 3 parallel tasks...`      |
| **Agents running**         | `🔀 2 of 3 tasks complete · Turn 4/10` |
| **Waiting for permission** | `⏸ Waiting for your permission above`  |
| **Waiting for question**   | `⏸ Waiting for your answer above`      |
| **Plan mode**              | `📐 Planning... (read-only)`           |
| **Stopped**                | Hidden                                 |

### 11.3 Behaviour

- Updates immediately when state changes.
- Shows the current `activeForm` text from the in-progress todo item when available.
- Elapsed time counter ticks every second when a tool or agent is running.
- Subtle pulse animation on the icon to indicate liveness.

---

## 12. Loading & Transition States

### 12.1 Initial Message Send

```
User hits Send
  → Input area disabled (slight opacity fade)
  → Send button transforms to Stop button (■) — 150ms morph animation
  → Small "thinking" indicator appears below the user's message:

    ┌─────────────┐
    │ 🤖 •••      │    ← three-dot pulsing animation
    └─────────────┘

  → After ~200-800ms, Claude's response starts streaming
  → Thinking indicator replaced by the first tokens of text
  → Status line appears showing current state
```

### 12.2 Between Tool Calls

When Claude finishes one tool and starts another, there's a brief gap:

```
▸ 🔧 Read  contract-a.pdf                       0.3s

[brief ~100ms gap — no visual indicator needed]

▸ 🔧 Read  contract-b.pdf                       ⏳
```

If the gap exceeds 500ms (Claude is "thinking" between tools), show the thinking indicator:

```
▸ 🔧 Read  contract-a.pdf                       0.3s

🤖 •••

▸ 🔧 Read  contract-b.pdf                       ⏳
```

### 12.3 Stop Button Behaviour

While Claude is streaming:

```
┌──────────────────────────────────────────┐
│  📎 │ Message Claude...              ■  │   ← Stop button (red square)
└──────────────────────────────────────────┘
```

- Click ■ → sends stop signal to server.
- Claude's response ends where it was (partial message preserved).
- Any running tool calls are cancelled.
- Status line: briefly shows "⏹ Stopped" then hides.
- Stop button morphs back to Send button (▶).
- Partial response stays in chat — user can continue the conversation.

### 12.4 WebSocket Reconnection

If the connection drops:

```
┌──────────────────────────────────────────────────────┐
│ ⚡ Reconnecting...                            3s     │
│ ━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░   │
└──────────────────────────────────────────────────────┘
```

- Banner appears at the top of the message area.
- Auto-reconnect with exponential backoff.
- Once reconnected: banner disappears, stream resumes from where it left off.
- If reconnection fails after 30s: banner changes to "❌ Connection lost. [Retry]".

---

## 13. Error States

### 13.1 Tool Execution Error

```
▾ ❌ Bash  python analyse.py                  Error
  ┌──────────────────────────────────────────────────┐
  │ COMMAND                                          │
  │ python analyse.py                                │
  │──────────────────────────────────────────────────│
  │ ERROR                                            │
  │ ModuleNotFoundError: No module named 'pandas'    │
  │──────────────────────────────────────────────────│
  └──────────────────────────────────────────────────┘
```

- Card expanded by default when there's an error (user needs to see what happened).
- Red left border.
- Error output highlighted in red-tinted background.
- Claude typically continues with a recovery attempt (installs the missing package, etc.).

### 13.2 Rate Limit

```
┌──────────────────────────────────────────────────────┐
│ ⏳ Rate limit reached — retrying in 15s...           │
│ ━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░░   │
└──────────────────────────────────────────────────────┘
```

- Countdown timer shown.
- Progress bar fills as wait completes.
- Automatically retries — no user action needed.
- Banner disappears once retry succeeds.

### 13.3 Context Length Overflow

```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Conversation is getting long.                     │
│ Claude will summarise older messages to continue.    │
│ This won't affect current work in progress.          │
│                                      [OK, continue]  │
└──────────────────────────────────────────────────────┘
```

### 13.4 Unrecoverable Error

```
┌──────────────────────────────────────────────────────┐
│ ❌ Something went wrong                              │
│──────────────────────────────────────────────────────│
│ Claude encountered an error it couldn't recover      │
│ from. Your work has been saved.                      │
│                                                      │
│ Error: Server returned 500 (internal error)          │
│                                                      │
│ [🔄 Retry]  [📋 Copy Error]  [💬 Start New Chat]    │
└──────────────────────────────────────────────────────┘
```

---

## 14. Timing & Animation Spec

### 14.1 Duration Constants

| Animation                    | Duration       | Easing                             |
| ---------------------------- | -------------- | ---------------------------------- |
| Tool card appear (fade in)   | 150ms          | ease-out                           |
| Tool card collapse           | 200ms          | ease-in-out                        |
| Tool card expand             | 200ms          | ease-in-out                        |
| Todo item status change      | 300ms          | ease                               |
| Todo progress bar            | 300ms          | ease                               |
| Todo new item appear         | 200ms          | ease-out                           |
| Sub-agent card appear        | 200ms          | ease-out                           |
| Permission card appear       | 200ms          | ease-out + slight scale (0.98→1.0) |
| Question card appear         | 200ms          | ease-out                           |
| Plan banner appear           | 250ms          | ease-out                           |
| Right panel slide open       | 300ms          | ease-in-out                        |
| File chip appear             | 150ms          | ease-out                           |
| Status line text change      | 150ms          | fade cross-dissolve                |
| Progress bar (top)           | 300ms          | ease                               |
| Thinking dots pulse          | 1200ms loop    | ease-in-out                        |
| Cursor blink                 | 530ms interval | step                               |
| Success flash (green border) | 200ms          | fade-out                           |
| Error flash (red border)     | 200ms          | fade-out                           |
| Button morph (Send↔Stop)     | 150ms          | ease                               |

### 14.2 Z-Index Hierarchy

| Element                   | Z-Index | Notes                      |
| ------------------------- | ------- | -------------------------- |
| Top progress bar          | 100     | Always above everything    |
| Plan mode banner          | 90      | Sticky at top of messages  |
| Reconnection banner       | 90      | Same layer as plan banner  |
| Permission/question cards | 80      | Highest card priority      |
| Status line               | 70      | Between messages and input |
| Tool cards                | 50      | Normal flow                |
| Message content           | 10      | Base layer                 |
| Right panel               | 60      | Overlays on mobile         |
| Modals                    | 200     | Above everything           |

### 14.3 Colour Tokens

| Token                 | Usage                       | Suggested Value (light) |
| --------------------- | --------------------------- | ----------------------- |
| `--progress-bar`      | Top bar, todo progress      | `#6366f1` (indigo)      |
| `--tool-running`      | Tool card running border    | `#6366f1` (indigo)      |
| `--tool-success`      | Tool card success flash     | `#22c55e` (green)       |
| `--tool-error`        | Error border and background | `#ef4444` (red)         |
| `--permission-bg`     | Permission card background  | `#fffbeb` (amber-50)    |
| `--permission-border` | Permission card left border | `#f59e0b` (amber)       |
| `--question-bg`       | Question card background    | `#eff6ff` (blue-50)     |
| `--plan-bg`           | Plan banner and card        | `#f5f3ff` (violet-50)   |
| `--plan-border`       | Plan card border            | `#8b5cf6` (violet)      |
| `--agent-bg`          | Sub-agent card background   | `#f0fdf4` (green-50)    |
| `--status-text`       | Status line text            | `#6b7280` (grey-500)    |
| `--muted-text`        | Completed items, timestamps | `#9ca3af` (grey-400)    |
| `--active-highlight`  | In-progress todo row        | `#eff6ff` (blue-50)     |

---

## 15. Tool Discovery & Capabilities UI

When users first encounter Cowork, or when they want to understand what the agent can do, they need a clear, accessible way to discover available capabilities. This section defines how users learn about tools — not through technical documentation, but through user-friendly descriptions that focus on what they can accomplish.

### 15.1 Discovery Patterns

Users can discover capabilities in three contexts:

**15.1.1 Empty State Widget**

When a user starts a new chat (no messages yet), a welcome widget appears in the center of the message area:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│                                                      │
│            ┌──────────────────────────────────┐      │
│            │  👋 Welcome to Cowork            │      │
│            │                                  │      │
│            │  I can help you with:            │      │
│            │                                  │      │
│            │  📁  Reading and editing files   │      │
│            │  🌐  Searching the web          │      │
│            │  💻  Running commands            │      │
│            │  📄  Creating documents          │      │
│            │  🤖  Parallel task coordination  │      │
│            │                                  │      │
│            │  Just ask me in natural          │      │
│            │  language — I'll figure out      │      │
│            │  what tools to use.             │      │
│            │                                  │      │
│            │  [💡 See all capabilities]       │      │
│            └──────────────────────────────────┘      │
│                                                      │
│                                                      │
│──────────────────────────────────────────────────────│
│  📎 │ Message Claude...                          ▶  │
│──────────────────────────────────────────────────────│
```

**Behaviour:**

- Widget appears centered in empty message area.
- Fades in with 200ms ease-out animation.
- Clicking "See all capabilities" opens the full capabilities panel (Section 15.2).
- Widget disappears when user sends first message (fade out 150ms).
- On mobile: widget is full-width with padding.

**15.1.2 Help Panel (Accessible Anytime)**

A help button in the chat header (top-right) opens the capabilities panel:

```
┌──────────────────────────────────────────────────────┐
│  Cowork — Contract Analysis        [💡 Help]  [⚙️]  │  ← header
│──────────────────────────────────────────────────────│
```

**Behaviour:**

- Help button (💡 icon) always visible in header.
- Click → capabilities panel slides in from right (300ms ease-in-out).
- Panel overlays chat area (z-index: 60, same as right panel).
- Click outside panel or press Escape → panel slides out (300ms).
- Panel persists across messages (doesn't close on send).

**15.1.3 Contextual Hints**

When user types in the input area, subtle hints appear below the input:

```
┌──────────────────────────────────────────────────────┐
│  📎 │ Read data.csv and...                      ▶  │
│──────────────────────────────────────────────────────│
│  💡 Try: "show me the first 10 rows" or            │
│     "analyze the data and create a summary"         │
└──────────────────────────────────────────────────────┘
```

**Behaviour:**

- Hints appear after 1 second of typing inactivity.
- Based on keywords in input (e.g., "read" → file operation hints).
- Fade in 150ms, fade out 150ms.
- Disappear when user continues typing or sends message.
- Maximum 2 hints shown at once.

---

### 15.2 Capabilities Panel Design

The main panel for browsing all available tools. Opens from help button or empty state.

**15.2.1 Panel Layout**

```
┌──────────────────────────────────────────────────────┐
│  💡 What I can do                            [✕]    │
│──────────────────────────────────────────────────────│
│                                                      │
│  [🔍 Search capabilities...]                        │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 📁 File Operations                    [▾]    │  │
│  │──────────────────────────────────────────────│  │
│  │ • Read and understand any file                │  │
│  │ • Create new documents and reports             │  │
│  │ • Edit existing files precisely               │  │
│  │ • Search across your files                     │  │
│  │ • Delete files                                 │  │
│  │ • List directories                             │  │
│  │                                                │  │
│  │ Example: "Read data.csv and show me the        │  │
│  │          first 10 rows"                        │  │
│  │          [Try this example →]                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 💻 Commands & Shell                    [▾]    │  │
│  │──────────────────────────────────────────────│  │
│  │ • Run terminal commands                        │  │
│  │ • Execute scripts and automation               │  │
│  │                                                │  │
│  │ 🟡 Requires your permission                   │  │
│  │                                                │  │
│  │ Example: "Run npm install to set up the        │  │
│  │          project dependencies"                 │  │
│  │          [Try this example →]                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🌐 Web & Research                     [▾]    │  │
│  │──────────────────────────────────────────────│  │
│  │ • Search the web for current information      │  │
│  │ • Fetch and read webpage content              │  │
│  │                                                │  │
│  │ Example: "Search for the latest React 19      │  │
│  │          features"                            │  │
│  │          [Try this example →]                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  [More categories below...]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**15.2.2 Panel States**

| State         | Visual                                   | Behaviour                                           |
| ------------- | ---------------------------------------- | --------------------------------------------------- |
| **Closed**    | Panel not visible                        | Default state                                       |
| **Opening**   | Slides in from right (300ms)             | Triggered by help button or empty state link        |
| **Open**      | Overlays chat area, 400px wide (desktop) | User can scroll, search, expand categories          |
| **Closing**   | Slides out to right (300ms)              | Triggered by ✕ button, Escape key, or click outside |
| **Searching** | Filtered categories shown                | Real-time filtering as user types                   |

**15.2.3 Responsive Behaviour**

| Screen Size         | Panel Width | Position                                 |
| ------------------- | ----------- | ---------------------------------------- |
| Desktop (>1024px)   | 400px       | Slides from right, overlays chat         |
| Tablet (768-1024px) | 350px       | Slides from right, overlays chat         |
| Mobile (<768px)     | Full width  | Slides from bottom, covers entire screen |

---

### 15.3 Category Organization

Tools are grouped into 7 categories, each with user-friendly descriptions.

**15.3.1 File Operations**

```
📁 File Operations (6 tools)
──────────────────────────────────────────────────────
• Read and understand any file
  Read files of any type — code, documents, data files,
  images (via OCR), and more. I can read specific lines
  or the entire file.

• Create new documents and reports
  Write new files with any content. Perfect for creating
  reports, documentation, configuration files, or scripts.

• Edit existing files precisely
  Make targeted changes to files using exact string
  matching. I'll show you what changed before saving.

• Search across your files
  Find files by pattern (Glob) or search for text
  within files (Grep). Filter by file type, directory,
  or content.

• Delete files
  Remove files you no longer need. I'll ask for
  confirmation before deleting multiple files.

• List directories
  Browse folder contents, see file sizes and types,
  filter by patterns.

🟢 All tools run automatically — no permission needed
```

**15.3.2 Commands & Shell**

```
💻 Commands & Shell (1 tool)
──────────────────────────────────────────────────────
• Run terminal commands
  Execute shell commands, run scripts, install packages,
  start servers, or run any terminal operation.

🟡 Requires your permission — I'll ask before running
   any command that could modify your system or data.
```

**15.3.3 Web & Research**

```
🌐 Web & Research (2 tools)
──────────────────────────────────────────────────────
• Search the web for current information
  Search the internet for up-to-date information,
  documentation, tutorials, or answers to questions.

• Fetch and read webpage content
  Download and analyze content from any URL. I can
  read articles, documentation, or any web page.

🟢 All tools run automatically — no permission needed
```

**15.3.4 Task Planning**

```
📋 Task Planning (1 tool)
──────────────────────────────────────────────────────
• Break complex work into trackable steps
  I automatically create a todo list for multi-step
  tasks, showing progress as I work. You'll see
  what's done, what's in progress, and what's next.

🟢 Runs automatically — appears as a progress widget
   in the chat (see Section 3)
```

**15.3.5 Questions & Clarification**

```
💬 Questions & Clarification (1 tool)
──────────────────────────────────────────────────────
• Ask you questions when I need input
  When I need clarification on scope, preferences, or
  choices, I'll ask with multiple-choice options or
  open-ended questions. The conversation pauses until
  you answer.

🟢 Runs automatically — appears as a question card
   (see Section 7)
```

**15.3.6 Parallel Work**

```
🤖 Parallel Work (1 tool)
──────────────────────────────────────────────────────
• Spawn multiple agents for faster results
  For complex tasks, I can launch parallel sub-agents
  to work on different parts simultaneously. You'll
  see progress for each agent and can cancel them
  individually.

🟢 Runs automatically — appears as a coordination card
   (see Section 5)
```

**15.3.7 Document Creation**

```
📄 Document Creation (2 tools)
──────────────────────────────────────────────────────
• Create Word documents (.docx)
  Generate formatted Word documents with sections,
  headings, and content. Perfect for reports, proposals,
  or any structured document.

• Create Excel spreadsheets (.xlsx)
  Generate Excel files with multiple sheets, tables,
  and data. Great for data exports, analysis reports,
  or structured data.

🟢 All tools run automatically — files appear as
   clickable artifacts in the chat (see Section 9)
```

---

### 15.4 Context-Aware Display

The capabilities panel adapts based on the current context.

**15.4.1 Plan Mode Filtering**

When in plan mode (read-only), tools that modify files are hidden:

```
┌──────────────────────────────────────────────┐
│ 📁 File Operations                  [▾]    │
│──────────────────────────────────────────────│
│ • Read and understand any file               │
│ • Search across your files                   │
│ • List directories                           │
│                                              │
│ 🔴 Write, Edit, and Delete tools are         │
│    hidden in plan mode (read-only)          │
└──────────────────────────────────────────────┘
```

**15.4.2 Permission Indicators**

Each tool category shows its permission level:

| Indicator | Meaning                                | Example                     |
| --------- | -------------------------------------- | --------------------------- |
| 🟢        | Auto — runs automatically              | File operations, web search |
| 🟡        | Ask first — requires permission        | Bash commands               |
| 🔴        | Not available — hidden in current mode | Write tools in plan mode    |

**15.4.3 Integration Status**

If integrations are available (future feature), show which tools require setup:

```
┌──────────────────────────────────────────────┐
│ 🔌 Integrations                      [▾]    │
│──────────────────────────────────────────────│
│ • Send Slack messages                        │
│   ⚙️ Requires Slack connection               │
│   [Connect Slack →]                          │
│                                              │
│ • Send emails                                │
│   ⚙️ Requires Gmail connection              │
│   [Connect Gmail →]                          │
└──────────────────────────────────────────────┘
```

---

### 15.5 Interaction Patterns

**15.5.1 Category Expand/Collapse**

- Click category header → expands/collapses (200ms slide animation).
- Default: first 3 categories expanded, rest collapsed.
- Expanded state persists across panel open/close (stored in session).

**15.5.2 Search Functionality**

```
User types "file" in search box:
  → Panel filters to show only matching categories/tools
  → Matching text highlighted
  → "No results" message if nothing matches
  → Clear search (✕) appears when text entered
```

**15.5.3 Example Prompts**

Each category includes 2-3 example prompts. Clicking "Try this example →" inserts the prompt into the input area:

```
User clicks "Try this example →" on:
  "Read data.csv and show me the first 10 rows"

  → Input area receives focus
  → Text inserted: "Read data.csv and show me the first 10 rows"
  → Panel closes (optional — can stay open)
  → User can edit or send immediately
```

**15.5.4 Tool Detail View**

Clicking a tool name (not the example) shows expanded details:

```
┌──────────────────────────────────────────────┐
│ ← Back to categories                         │
│──────────────────────────────────────────────│
│                                              │
│  📄 Read                                     │
│                                              │
│  Read and understand files of any type —    │
│  code, documents, data files, images (via    │
│  OCR), and more.                             │
│                                              │
│  I can:                                      │
│  • Read entire files                         │
│  • Read specific line ranges                 │
│  • Understand file contents and structure    │
│                                              │
│  Example prompts:                            │
│  • "Read config.json and show me the         │
│     database settings"                       │
│  • "Read lines 10-20 of script.py"          │
│  • "Read the README and summarize it"        │
│                                              │
│  [Try: "Read data.csv and show me the       │
│        first 10 rows" →]                     │
│                                              │
└──────────────────────────────────────────────┘
```

---

### 15.6 Visual Design

**15.6.1 Colour Tokens**

| Token                           | Usage                    | Value                                             |
| ------------------------------- | ------------------------ | ------------------------------------------------- |
| `--capabilities-panel-bg`       | Panel background         | `var(--color-surface)` (white)                    |
| `--capabilities-header-bg`      | Header background        | `var(--color-surface-secondary)` (light grey)     |
| `--capabilities-category-bg`    | Category card background | `var(--color-surface-tertiary)` (very light grey) |
| `--capabilities-text`           | Primary text             | `var(--color-text)` (dark)                        |
| `--capabilities-text-secondary` | Secondary text           | `var(--color-text-secondary)` (medium grey)       |
| `--capabilities-accent`         | Links, highlights        | `var(--color-accent)` (purple)                    |
| `--capabilities-border`         | Borders                  | `var(--color-border)` (light grey)                |

**15.6.2 Typography**

- Header: `font-size: 1.125rem`, `font-weight: 600`
- Category title: `font-size: 1rem`, `font-weight: 600`
- Tool description: `font-size: 0.9375rem`, `font-weight: 400`
- Example prompts: `font-size: 0.875rem`, `font-family: var(--font-mono)`, `color: var(--capabilities-text-secondary)`

**15.6.3 Icons**

- Category icons: 20px × 20px, coloured with accent colour
- Permission indicators: 12px × 12px circles (🟢🟡🔴)
- Expand/collapse chevrons: 14px × 14px, rotate 90° on expand

**15.6.4 Spacing**

- Panel padding: 24px
- Category spacing: 16px between categories
- Tool item spacing: 8px between tools in a category
- Example prompt spacing: 12px margin-top

---

### 15.7 Integration Points

**15.7.1 Chat Header**

Help button appears in top-right of chat header:

```
┌──────────────────────────────────────────────────────┐
│  [← Back]  Cowork — Contract Analysis  [💡] [⚙️]  │
│──────────────────────────────────────────────────────│
```

**15.7.2 Empty State**

Empty state widget includes link to capabilities panel (see Section 15.1.1).

**15.7.3 Tool Cards**

Completed tool cards can include a subtle link:

```
▸ 🔧 Read  contract-a.pdf                       0.3s
  💡 What else can I do? →
```

Clicking opens capabilities panel filtered to relevant category.

**15.7.4 Input Area Hints**

Contextual hints appear below input (see Section 15.1.3).

---

### 15.8 Content Strategy

**15.8.1 User-Facing Descriptions**

Transform technical tool names into benefits:

| Technical Name    | User-Facing Description                 |
| ----------------- | --------------------------------------- |
| Read              | Read and understand files of any type   |
| Write             | Create new files and documents          |
| StrReplace        | Make precise edits to existing files    |
| Delete            | Remove files you no longer need         |
| Glob              | Find files by pattern                   |
| Grep              | Search for text within files            |
| LS                | Browse folder contents                  |
| Bash              | Run terminal commands and scripts       |
| WebSearch         | Search the web for current information  |
| WebFetch          | Download and analyze webpage content    |
| TodoWrite         | Break complex work into trackable steps |
| AskQuestion       | Ask you questions when I need input     |
| Task              | Work on multiple tasks simultaneously   |
| SwitchMode        | Switch to read-only planning mode       |
| CreateDocument    | Generate Word documents with formatting |
| CreateSpreadsheet | Generate Excel files with data          |

**15.8.2 Example Prompts**

Each category includes 2-3 example prompts that:

- Are realistic and actionable
- Show natural language (not technical commands)
- Demonstrate different use cases
- Are copy-paste ready

**Example for File Operations:**

- "Read data.csv and show me the first 10 rows"
- "Create a new file called notes.md with today's meeting summary"
- "Search all .ts files for 'useState' and show me the matches"

**15.8.3 Tone**

- **Friendly but professional** — "I can help you with..." not "The system supports..."
- **Benefit-focused** — "Create documents" not "Execute CreateDocument tool"
- **Honest** — Clear about permissions and limitations
- **Encouraging** — "Just ask in natural language" not "Refer to documentation"

---

### 15.9 Permission Indicators

**15.9.1 Visual Indicators**

| Indicator | Colour          | Meaning                         | Usage                     |
| --------- | --------------- | ------------------------------- | ------------------------- |
| 🟢        | Green (#22c55e) | Auto — runs automatically       | Most tools                |
| 🟡        | Amber (#f59e0b) | Ask first — requires permission | Bash only                 |
| 🔴        | Red (#ef4444)   | Not available — hidden          | Tools hidden in plan mode |

**15.9.2 Placement**

- Permission indicator appears:
  - In category header (if all tools share same permission)
  - Next to individual tool (if mixed permissions in category)
  - In tool detail view (always shown)

**15.9.3 Explanatory Text**

When permission is required, include brief explanation:

```
🟡 Requires your permission

I'll ask before running any command that could modify
your system or data. This keeps you in control of
destructive operations.
```

---

### 15.10 Examples & Suggestions

**15.10.1 Category Examples**

Each category includes 2-3 example prompts:

**File Operations:**

- "Read data.csv and show me the first 10 rows"
- "Create a new file called notes.md with today's meeting summary"
- "Search all .ts files for 'useState' and show me the matches"

**Web & Research:**

- "Search for the latest React 19 features"
- "Fetch the documentation from https://example.com/docs"
- "Find recent articles about TypeScript 5.0"

**Document Creation:**

- "Create a project proposal document with 5 sections"
- "Generate an Excel spreadsheet with sales data for Q1"
- "Make a Word document summarizing the meeting notes"

**15.10.2 "Try This Example" Interaction**

- Clicking example → inserts text into input area
- Input receives focus
- User can edit before sending
- Panel optionally closes (user preference)

**15.10.3 Contextual Suggestions**

Based on user's current input, show relevant examples:

```
User types: "read"
  → Shows file operation examples
  → Highlights "Read" category

User types: "search"
  → Shows web search examples
  → Highlights "Web & Research" category
```

---

### 15.11 Animation & Timing

**15.11.1 Panel Animations**

| Animation               | Duration | Easing      |
| ----------------------- | -------- | ----------- |
| Panel slide in (open)   | 300ms    | ease-in-out |
| Panel slide out (close) | 300ms    | ease-in-out |
| Category expand         | 200ms    | ease-out    |
| Category collapse       | 200ms    | ease-in     |
| Search filter           | 150ms    | ease        |
| Example insert          | 100ms    | ease-out    |

**15.11.2 Empty State Widget**

| Animation       | Duration | Easing   |
| --------------- | -------- | -------- |
| Widget fade in  | 200ms    | ease-out |
| Widget fade out | 150ms    | ease-in  |
| Link hover      | 150ms    | ease     |

**15.11.3 Contextual Hints**

| Animation     | Duration | Easing   |
| ------------- | -------- | -------- |
| Hint fade in  | 150ms    | ease-out |
| Hint fade out | 150ms    | ease-in  |

---

### 15.12 Accessibility

**15.12.1 Keyboard Navigation**

- Tab through categories and tools
- Enter/Space to expand/collapse categories
- Escape to close panel
- Arrow keys to navigate tool list (when focused)

**15.12.2 Screen Reader Support**

- Panel has `role="dialog"` with `aria-label="Available capabilities"`
- Categories have `role="group"` with `aria-label`
- Tools have `role="button"` with descriptive `aria-label`
- Permission indicators have `aria-label` (e.g., "Requires permission")

**15.12.3 Focus Management**

- When panel opens: focus moves to search input (if present) or first category
- When panel closes: focus returns to help button
- Focus trap: Tab cycles within panel, doesn't escape to chat

---

### 15.13 Edge Cases

**15.13.1 No Tools Available**

If all tools are filtered out (e.g., extreme plan mode):

```
┌──────────────────────────────────────────────┐
│  💡 What I can do                            │
│──────────────────────────────────────────────│
│                                              │
│  No capabilities available in current mode.  │
│                                              │
│  You're in plan mode (read-only). Switch    │
│  to normal mode to access all tools.         │
│                                              │
└──────────────────────────────────────────────┘
```

**15.13.2 Search No Results**

```
┌──────────────────────────────────────────────┐
│  [🔍 Search: "xyz123"]              [✕]    │
│──────────────────────────────────────────────│
│                                              │
│  No capabilities match "xyz123".            │
│                                              │
│  Try searching for:                          │
│  • "file" — file operations                 │
│  • "web" — web search                       │
│  • "command" — terminal commands            │
│                                              │
└──────────────────────────────────────────────┘
```

**15.13.3 Very Long Tool Lists**

If a category has 10+ tools, make it scrollable:

```
┌──────────────────────────────────────────────┐
│ 📁 File Operations                   [▾]    │
│──────────────────────────────────────────────│
│ • Tool 1                                     │
│ • Tool 2                                     │
│ • Tool 3                                     │
│ • Tool 4                                     │
│ • Tool 5                                     │
│ • Tool 6                                     │
│ • Tool 7                                     │
│ • Tool 8                                     │
│ • Tool 9                                     │
│ • Tool 10                                    │
│ [Scroll for more...]                         │
└──────────────────────────────────────────────┘
```

Max height: 400px, then scrollable with subtle scroll indicator.

---

_End of specification. This document covers the exact user experience during Claude's work — from the first token streamed to the final file delivered. Build the components in the order they appear in the message stream: text renderer → tool cards → todo widget → sub-agent cards → permission/question cards → plan mode → artifact viewer → global indicators → tool discovery UI._
