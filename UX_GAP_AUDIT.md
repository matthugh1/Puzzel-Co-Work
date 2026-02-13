# UX Gap Audit: Puzzel Co-Work vs Claude Cowork

**Date:** 13 February 2026
**Audited by:** Claude
**Scope:** Full component audit of `src/components/cowork/`, `src/styles/`, `src/lib/cowork/`, and dependencies

---

## Executive Summary

Puzzel Co-Work has strong **functional foundations** — the agent loop, tool system, feedback mechanism, right panel, and skill architecture all work. But the front-end has significant **polish gaps** compared to Claude Cowork that make it feel rough. The issues fall into five categories:

1. **Markdown rendering is broken** — regex-based parser instead of a real library
2. **No syntax highlighting** — code blocks are unstyled monospace
3. **Inline styles plague** — ~90% of components use `style={{}}` instead of CSS classes
4. **Missing loading/transition states** — no skeletons, no smooth animations
5. **Missing micro-interactions** — no copy buttons on code, no hover states, no error boundaries

These are fixable. Below is the full audit with priority ordering.

---

## Priority 1: CRITICAL — Markdown Rendering

### Current State

`TextBlock.tsx` (57 lines) uses a hand-written regex parser:

```
line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
```

It handles **only**: bold, italic, inline code, links. It uses `dangerouslySetInnerHTML` on every line.

**What it cannot render:**

- Headings (`# H1`, `## H2`, etc.)
- Bullet lists / numbered lists
- Blockquotes
- Tables
- Horizontal rules
- Nested formatting (bold inside italic)
- Images
- Task lists (checkboxes)
- Line breaks within paragraphs

**Impact:** Every assistant message with any structured content looks wrong. This is the single biggest visual quality gap.

### What Claude Cowork Does

Uses `react-markdown` with `remark-gfm` (GitHub Flavored Markdown) and `rehype-raw` plugins. Full CommonMark + GFM compliance. Tables, task lists, footnotes — everything works.

### Fix

Install `react-markdown`, `remark-gfm`, `rehype-raw`, and `rehype-sanitize`. Replace the regex parser with:

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function TextBlock({ text }: { text: string }) {
  return (
    <div className="cowork-message__text">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
```

The same fix applies to `ArtifactRenderer.tsx`'s `markdownToHtml()` function (lines 63–97), which is a slightly better regex parser but still fundamentally broken.

**Estimated effort:** 1–2 hours
**Impact:** Transforms every assistant message from broken to professional

---

## Priority 2: HIGH — Code Syntax Highlighting

### Current State

Code blocks in `TextBlock.tsx` render as plain `<pre><code>{code}</code></pre>` — white text on dark background, no syntax colouring.

`ArtifactRenderer.tsx`'s `CodeRenderer` (lines 237–254) is better — it has line numbers and a Catppuccin-ish dark theme — but still no actual syntax highlighting.

**Missing:**

- Language-aware syntax colouring (keywords, strings, comments, types)
- Copy-to-clipboard button on code blocks in messages
- Language label on code blocks

### What Claude Cowork Does

Uses Shiki (WebAssembly-based syntax highlighter) with theme support. Every code block has a language label, copy button, and proper colouring.

### Fix

Install `shiki` (or the lighter `react-syntax-highlighter` with Prism). Add a custom `CodeBlock` component for `react-markdown`:

```tsx
<ReactMarkdown
  components={{
    code({ className, children }) {
      const language = className?.replace("language-", "") ?? "";
      return language ? (
        <SyntaxHighlighter language={language} style={theme}>
          {String(children)}
        </SyntaxHighlighter>
      ) : (
        <code className="inline-code">{children}</code>
      );
    },
  }}
/>
```

Add a copy button with visual feedback (checkmark for 2 seconds after click).

**Estimated effort:** 2–3 hours
**Impact:** Transforms code-heavy conversations from unreadable to professional

---

## Priority 3: HIGH — Inline Styles → CSS Classes

### Current State

Almost every component uses inline `style={{}}` objects instead of CSS classes. Examples:

- `ToolUseBlock.tsx` — summary span has 7 inline style properties
- `ToolResultBlock.tsx` — preview span has 6 inline style properties
- `CoworkInputArea.tsx` — model picker button has 10 inline style properties
- `PlanBlock.tsx` — textarea has 8 inline style properties
- `SubAgentStatusBlock.tsx` — status badges use inline colour values
- `AskUserBlock.tsx` — option buttons have 8+ inline styles each
- `SkillDraftCard.tsx` — every single element has inline styles

### Root Cause

Comment in `globals.css` line 1: `/* Tailwind disabled - PostCSS hangs. Re-enable when Tailwind v4 + Next.js 16 is fixed. */`

With Tailwind disabled, developers defaulted to inline styles instead of writing proper CSS classes.

### Impact

- **Theming is impossible** — can't change colours/spacing without editing every component
- **Dark mode impossible** — can't override inline styles with CSS custom properties
- **Maintenance nightmare** — same values hardcoded in dozens of places
- **Performance** — inline styles prevent browser CSS optimisation

### Fix

The project already has an excellent CSS custom properties system in `globals.css` (lines 4–80). And it already has well-structured BEM classes for the layout, sidebar, and message components. The pattern exists — it just wasn't followed for newer components.

Two options:

1. **Quick:** Write proper BEM CSS classes in `globals.css` for all interactive blocks (tool cards, plan block, ask-user block, etc.) and replace inline styles
2. **Better:** Fix the Tailwind v4 + PostCSS issue (likely a version conflict) and use utility classes

**Estimated effort:** 4–6 hours for option 1, 1–2 hours for option 2 if it's just a version bump
**Impact:** Enables theming, dark mode, and consistent styling

---

## Priority 4: MEDIUM — Loading States & Skeletons

### Current State

- **Message loading:** When waiting for first response, the chat area shows nothing — just the user's message and empty space
- **Artifact loading:** Shows plain text "Loading artifact..." (line 366 of `ArtifactRenderer.tsx`)
- **Sub-agent polling:** 3-second interval with no visual indicator between polls
- **Feedback loading:** Submit button shows "..." during submission
- **Tool execution:** No visual indicator that a tool is running (just the tool-use block appears when done)

### What Claude Cowork Does

- Pulsing dot animation while waiting for response
- Skeleton loaders for messages (grey boxes that pulse)
- "Thinking..." indicator with animated dots
- Smooth fade-in for new messages
- Progress bar for long-running tools

### Fix

1. Add a `StreamingIndicator` component — animated dots or pulsing bar shown between last message and input area while `isStreaming` is true
2. Add skeleton components for message blocks (grey pulsing rectangles)
3. Add fade-in animation for new messages using CSS `@keyframes` and `animation-delay`
4. Replace "Loading artifact..." with a proper skeleton

**Estimated effort:** 3–4 hours
**Impact:** Makes the interface feel alive and responsive

---

## Priority 5: MEDIUM — Missing Copy Buttons on Code Blocks

### Current State

`ArtifactRenderer.tsx` has a copy button in the toolbar (line 428–435), but `TextBlock.tsx` code blocks have no copy button at all. Users can't copy code snippets from assistant messages without manually selecting text.

### What Claude Cowork Does

Every code block has a floating copy button in the top-right corner. Clicking it shows a checkmark for 2 seconds, then reverts to the copy icon.

### Fix

Part of the `react-markdown` + custom code component fix in Priority 2. Add a `CopyButton` component:

```tsx
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="code-copy-btn">
      {copied ? <IconCheckCircle size={14} /> : <IconCopy size={14} />}
    </button>
  );
}
```

**Estimated effort:** 30 minutes (bundled with Priority 2)

---

## Priority 6: MEDIUM — Error Boundaries

### Current State

No React error boundary components anywhere in the codebase. If any component throws during render (e.g. malformed message content, unexpected API response shape, etc.), the entire chat UI crashes with a white screen.

### What Claude Cowork Does

Wraps major sections (chat, right panel, artifact renderer) in error boundaries. A failed artifact render shows "Failed to render" with a retry button — it doesn't crash the whole app.

### Fix

Create a simple `ErrorBoundary` component:

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          Something went wrong.{" "}
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

Wrap: `CoworkMessageItem`, `ArtifactRenderer`, `CoworkRightPanel`, `ContentBlock`.

**Estimated effort:** 1 hour
**Impact:** Prevents total UI crashes from edge cases

---

## Priority 7: MEDIUM — Message Animations

### Current State

Messages appear instantly with no transition. The only animation is a streaming pulse keyframe defined in CSS but barely used.

### What Claude Cowork Does

- New messages fade in with a subtle slide-up animation
- Tool blocks expand/collapse with smooth height transitions
- Status changes (running → completed) have colour transitions
- Right panel sections collapse with smooth animation

### Fix

Add CSS transitions to existing classes:

```css
.cowork-message {
  animation: messageAppear 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cowork-tool-card__content {
  overflow: hidden;
  transition:
    max-height 0.2s ease,
    opacity 0.2s ease;
}
```

**Estimated effort:** 2 hours
**Impact:** Makes the entire interface feel smoother and more professional

---

## Priority 8: LOW — Dark Mode

### Current State

CSS custom properties are defined but only for light mode. No theme toggle exists. The sidebar is dark (`--cw-sidebar-bg: #1a1a2e`) but the rest of the UI is white-only.

### What Claude Cowork Does

Full dark mode toggle that swaps all CSS custom properties.

### Fix

Define a `[data-theme="dark"]` block in `globals.css` that overrides all `--color-*` and `--cw-*` variables. Add a toggle button in the header. This is only possible after Priority 3 (inline styles removal) — inline styles can't be overridden by CSS custom properties.

**Estimated effort:** 3–4 hours (after Priority 3)
**Impact:** Standard user expectation for modern UIs

---

## Priority 9: LOW — PDF Preview

### Current State

`PdfRenderer` in `ArtifactRenderer.tsx` (lines 257–268) just shows a download link with "PDF preview is not available yet."

### What Claude Cowork Does

Embeds PDF.js for in-browser PDF rendering with page navigation.

### Fix

Install `pdfjs-dist` or use `react-pdf`. Replace `PdfRenderer` with an actual viewer.

**Estimated effort:** 3–4 hours
**Impact:** Better experience for document-heavy workflows

---

## Priority 10: LOW — Tool Block Visual Polish

### Current State

Tool use/result blocks work but look utilitarian:

- Raw JSON displayed in `<pre>` for tool inputs
- No icon differentiation between tool types (all use `IconTerminal`)
- Summary truncation is hardcoded at 50 characters
- Status colours are minimal

### What Claude Cowork Does

- Different icons for file operations, web, bash, etc.
- Smart input formatting (e.g. shows file path in a chip, not raw JSON)
- Collapsible with smooth animation
- Context-aware summaries

### Fix

Add a `toolIcon()` helper that maps tool names to specific icons. Format tool inputs as key-value pairs rather than raw JSON. Add smooth expand/collapse.

**Estimated effort:** 2–3 hours
**Impact:** Incremental polish improvement

---

## Component-by-Component Scorecard

| Component                    | Lines | Functional   | Polish | Priority Fix                       |
| ---------------------------- | ----- | ------------ | ------ | ---------------------------------- |
| `TextBlock.tsx`              | 57    | ⚠️ Broken    | 2/10   | P1 — react-markdown                |
| `ArtifactRenderer.tsx`       | 474   | ✅ Good      | 6/10   | P2 — syntax highlighting, P9 — PDF |
| `ToolUseBlock.tsx`           | 72    | ✅ Good      | 5/10   | P3 — CSS classes, P10 — icons      |
| `ToolResultBlock.tsx`        | 60    | ✅ Good      | 5/10   | P3 — CSS classes                   |
| `AskUserBlock.tsx`           | 133   | ✅ Good      | 5/10   | P3 — CSS classes                   |
| `PlanBlock.tsx`              | 183   | ✅ Good      | 5/10   | P3 — CSS classes                   |
| `SubAgentStatusBlock.tsx`    | 181   | ✅ Excellent | 6/10   | P3 — CSS classes, P7 — animations  |
| `PermissionRequestBlock.tsx` | 90    | ✅ Good      | 5/10   | P3 — CSS classes                   |
| `MessageFeedbackBar.tsx`     | 179   | ✅ Excellent | 7/10   | Minor — modal instead of inline    |
| `CoworkTodoWidget.tsx`       | 57    | ✅ Good      | 7/10   | Minor — animations                 |
| `CoworkCentrePanel.tsx`      | 672   | ✅ Good      | 6/10   | P4 — skeletons, P7 — animations    |
| `CoworkInputArea.tsx`        | 501   | ✅ Very Good | 6/10   | P3 — CSS classes                   |
| `CoworkRightPanel.tsx`       | 413   | ✅ Good      | 6/10   | P7 — animations                    |
| `CoworkMessageItem.tsx`      | 187   | ✅ Good      | 6/10   | P7 — fade-in animation             |
| `SkillDraftCard.tsx`         | 311   | ✅ Good      | 5/10   | P3 — CSS classes                   |
| `globals.css`                | 2000+ | ✅ Excellent | 8/10   | P3 — extend with new classes       |
| `FeedbackSummarySection.tsx` | New   | ✅ Good      | 7/10   | Minor polish                       |

---

## Dependency Gaps

These packages are **missing** from `package.json` but needed:

| Package                               | Purpose                                       | Priority |
| ------------------------------------- | --------------------------------------------- | -------- |
| `react-markdown`                      | Proper markdown rendering                     | P1       |
| `remark-gfm`                          | GitHub Flavored Markdown (tables, task lists) | P1       |
| `rehype-raw`                          | Allow raw HTML in markdown                    | P1       |
| `rehype-sanitize`                     | Sanitise HTML for security                    | P1       |
| `shiki` or `react-syntax-highlighter` | Code syntax highlighting                      | P2       |
| `pdfjs-dist` or `react-pdf`           | PDF preview in artifacts                      | P9       |

---

## Recommended Implementation Order

**Week 1 — Visual transformation (P1 + P2 + P5):**

1. Install `react-markdown` + plugins → replace `TextBlock.tsx` regex parser
2. Install `shiki` → add syntax highlighting + copy buttons to code blocks
3. Update `ArtifactRenderer.tsx`'s markdown and code renderers to match

**Week 2 — Structural cleanup (P3 + P6):** 4. Write BEM CSS classes for all interactive blocks in `globals.css` 5. Replace inline styles in all message-block components 6. Add `ErrorBoundary` wrapper components

**Week 3 — Polish (P4 + P7):** 7. Add loading skeletons for messages and artifacts 8. Add fade-in animation for messages 9. Add smooth expand/collapse for tool blocks and right panel sections

**Week 4+ — Nice to have (P8 + P9 + P10):** 10. Dark mode toggle 11. PDF.js integration 12. Tool-specific icons and smart input formatting

---

## Summary

The biggest single improvement is replacing the regex markdown parser with `react-markdown` (Priority 1). This one change will transform every assistant message from broken formatting to proper headings, lists, tables, and code blocks. Combined with syntax highlighting (Priority 2), these two changes alone will close roughly 60% of the visual quality gap with Claude Cowork.

The remaining 40% is about polish: moving inline styles to CSS classes, adding loading states, and smooth animations. These are important but less urgent — the app is functional without them, it's just not as slick.
