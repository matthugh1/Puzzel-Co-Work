# Cursor Implementation Plan: Puzzel Co-Work UX Polish

**Objective:** Close the UX gap between Puzzel Co-Work and Claude Cowork.
**Reference:** See `UX_GAP_AUDIT.md` for the full audit.

This plan is structured as **6 sequential tasks**. Complete each task fully before moving to the next. Each task lists the exact files to touch, what to change, and how to verify.

---

## Task 1: Install Dependencies

### What to do

Run in terminal:

```bash
npm install react-markdown remark-gfm rehype-raw rehype-sanitize react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
```

### Verify

- `npm run build` compiles without errors
- `package.json` lists all 5 new packages

---

## Task 2: Replace TextBlock Markdown Renderer

**This is the highest-impact change.** Every assistant message flows through this component.

### File: `src/components/cowork/message-blocks/TextBlock.tsx`

**Current state (57 lines):** Regex-based parser that only handles bold, italic, inline code, links, and fenced code blocks. Uses `dangerouslySetInnerHTML`. Cannot render headings, lists, tables, blockquotes, horizontal rules, nested formatting, or images.

**Replace the entire file with:**

```tsx
"use client";

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { IconCopy, IconCheckCircle } from "@/components/cowork/icons";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      className="cw-code-copy-btn"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy code"}
      aria-label={copied ? "Copied!" : "Copy code"}
    >
      {copied ? <IconCheckCircle size={14} /> : <IconCopy size={14} />}
    </button>
  );
}

export function TextBlock({ text }: { text: string }) {
  return (
    <div className="cowork-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Fenced code blocks with syntax highlighting + copy button
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match) {
              return (
                <div className="cw-code-block-wrapper">
                  <div className="cw-code-block-header">
                    <span className="cw-code-block-lang">{match[1]}</span>
                    <CopyButton text={codeString} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: "0 0 8px 8px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              );
            }

            // Inline code
            return (
              <code className="cw-inline-code" {...props}>
                {children}
              </code>
            );
          },

          // Code blocks without a language still get copy button
          pre({ children }) {
            // If the child is already a syntax-highlighted block, pass through
            const child = React.Children.only(children) as React.ReactElement;
            if (child?.props?.className?.includes("language-")) {
              return <>{children}</>;
            }
            // Plain code block
            const text =
              typeof child?.props?.children === "string"
                ? child.props.children
                : "";
            return (
              <div className="cw-code-block-wrapper">
                <div className="cw-code-block-header">
                  <span className="cw-code-block-lang">text</span>
                  {text && <CopyButton text={text} />}
                </div>
                <pre className="cw-code-block-plain">{children}</pre>
              </div>
            );
          },

          // Links open in new tab
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },

          // Tables get a wrapper for horizontal scrolling
          table({ children }) {
            return (
              <div className="cw-table-wrapper">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
```

### File: `src/app/globals.css`

Add these styles **at the end of the file** (after the last existing rule). These provide the styling for the new markdown components:

```css
/* ============================================================================
   MARKDOWN CONTENT STYLING
   ============================================================================ */

.cowork-markdown {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--color-text);
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.cowork-markdown p {
  margin: 0 0 0.75em;
}

.cowork-markdown p:last-child {
  margin-bottom: 0;
}

.cowork-markdown h1,
.cowork-markdown h2,
.cowork-markdown h3,
.cowork-markdown h4 {
  font-family: var(--font-display);
  font-weight: 600;
  margin: 1.25em 0 0.5em;
  color: var(--color-text);
}

.cowork-markdown h1 {
  font-size: 1.5rem;
}
.cowork-markdown h2 {
  font-size: 1.25rem;
}
.cowork-markdown h3 {
  font-size: 1.1rem;
}
.cowork-markdown h4 {
  font-size: 1rem;
}

.cowork-markdown h1:first-child,
.cowork-markdown h2:first-child,
.cowork-markdown h3:first-child,
.cowork-markdown h4:first-child {
  margin-top: 0;
}

.cowork-markdown ul,
.cowork-markdown ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}

.cowork-markdown li {
  margin-bottom: 0.25em;
}

.cowork-markdown li > p {
  margin-bottom: 0.25em;
}

.cowork-markdown blockquote {
  margin: 0.75em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--cw-accent);
  background: var(--color-surface-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--color-text-secondary);
}

.cowork-markdown blockquote p:last-child {
  margin-bottom: 0;
}

.cowork-markdown hr {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: 1.25em 0;
}

.cowork-markdown a {
  color: var(--cw-accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cowork-markdown a:hover {
  color: var(--color-primary-dark);
}

.cowork-markdown strong {
  font-weight: 600;
  color: var(--color-text);
}

/* Inline code */
.cw-inline-code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  padding: 0.15em 0.4em;
  background: var(--color-surface-tertiary);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-primary-dark);
}

/* Code block wrapper */
.cw-code-block-wrapper {
  margin: 0.75em 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.cw-code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #2d2d3f;
  font-size: 0.75rem;
}

.cw-code-block-lang {
  color: #a0a0b8;
  font-family: var(--font-mono);
  text-transform: lowercase;
}

.cw-code-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: #a0a0b8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cw-code-copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
  color: #e0e0f0;
}

.cw-code-block-plain {
  margin: 0;
  padding: 16px;
  background: #1e1e2e;
  color: #cdd6f4;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre;
}

/* Tables */
.cw-table-wrapper {
  margin: 0.75em 0;
  overflow-x: auto;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.cowork-markdown table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.cowork-markdown th {
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  background: var(--color-surface-secondary);
  border-bottom: 2px solid var(--color-border);
  color: var(--color-text);
}

.cowork-markdown td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-muted);
  color: var(--color-text);
}

.cowork-markdown tr:last-child td {
  border-bottom: none;
}

/* Task lists (GFM checkboxes) */
.cowork-markdown input[type="checkbox"] {
  margin-right: 6px;
  accent-color: var(--cw-accent);
}

.cowork-markdown .task-list-item {
  list-style: none;
  margin-left: -1.5em;
}
```

### Verify

- Send a message that produces headings, bullet lists, code blocks, tables, and inline code
- Confirm headings render with correct sizing
- Confirm bullet/numbered lists are properly indented
- Confirm code blocks have syntax highlighting with language label and copy button
- Confirm copy button shows checkmark after click
- Confirm tables render with borders and header styling
- `npm run build` compiles without errors

---

## Task 3: Update ArtifactRenderer Markdown

The `ArtifactRenderer.tsx` has its own `markdownToHtml()` regex function (lines 63–97) used when rendering `.md` artifacts. Replace it with the same `react-markdown` approach.

### File: `src/components/cowork/ArtifactRenderer.tsx`

**Changes:**

1. Add imports at top (after existing imports):

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
```

2. **Delete** the `markdownToHtml()` function (lines 63–97) and the `escapeHtml()` function (lines 99–105). They are no longer needed.

3. **Replace** the `MarkdownRenderer` component (lines 172–204) with:

```tsx
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      className="cw-artifact-markdown-viewer"
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        padding: 24,
        background: "#fff",
        borderRadius: 8,
      }}
    >
      <div className="cowork-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children }) {
              const match = /language-(\w+)/.exec(className || "");
              const codeString = String(children).replace(/\n$/, "");
              if (match) {
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      borderRadius: 8,
                      fontSize: "13px",
                      lineHeight: "1.6",
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                );
              }
              return <code className="cw-inline-code">{children}</code>;
            },
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

This replaces the previous iframe-based markdown rendering with direct React rendering, so markdown artifacts also benefit from proper styling.

### Verify

- Create an artifact with `.md` extension
- Confirm it renders in the right panel with proper headings, lists, code blocks
- Confirm copy button is NOT needed here (the toolbar already has a global copy button)
- `npm run build` compiles without errors

---

## Task 4: Add Error Boundary

### Create new file: `src/components/cowork/ErrorBoundary.tsx`

```tsx
"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Optional label shown in error UI to help identify which section failed */
  section?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`,
      error,
      info,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="cw-error-boundary">
          <div className="cw-error-boundary__icon">⚠</div>
          <div className="cw-error-boundary__text">
            {this.props.section
              ? `Something went wrong in ${this.props.section}.`
              : "Something went wrong."}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-pill"
            onClick={this.handleRetry}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### File: `src/app/globals.css`

Add at end:

```css
/* Error boundary */
.cw-error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  min-height: 80px;
}

.cw-error-boundary__icon {
  font-size: 1.5rem;
}

.cw-error-boundary__text {
  text-align: center;
}
```

### File: `src/components/cowork/CoworkMessageItem.tsx`

Wrap each content block render in an error boundary. Add import at top:

```tsx
import { ErrorBoundary } from "@/components/cowork/ErrorBoundary";
```

Then find the section where content blocks are mapped (around the `renderBlock` function or the JSX that maps over `sortedBlocks`). Wrap each block's render output:

```tsx
<ErrorBoundary key={blockKey} section="message block">
  {/* existing block render code */}
</ErrorBoundary>
```

### File: `src/components/cowork/ArtifactRenderer.tsx`

Add import:

```tsx
import { ErrorBoundary } from "@/components/cowork/ErrorBoundary";
```

Wrap `{renderContent()}` in the JSX (around line 469):

```tsx
<div className="cw-artifact-renderer__body">
  <ErrorBoundary section="artifact">{renderContent()}</ErrorBoundary>
</div>
```

### Verify

- Intentionally cause a render error (e.g. pass malformed data) — confirm it shows "Something went wrong in artifact" instead of crashing the whole UI
- Confirm "Try again" button recovers
- `npm run build` compiles without errors

---

## Task 5: Add Message Animations and Loading States

### File: `src/app/globals.css`

Add at end:

```css
/* ============================================================================
   MESSAGE ANIMATIONS
   ============================================================================ */

/* Fade-in for new messages */
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cowork-message {
  animation: messageAppear 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
}

/* Smooth expand/collapse for tool blocks */
.cowork-tool-card__content {
  animation: expandIn 0.2s ease both;
}

@keyframes expandIn {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 2000px;
  }
}

/* Thinking indicator (three dots) */
.cw-thinking-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.cw-thinking-dots {
  display: flex;
  gap: 4px;
}

.cw-thinking-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cw-accent);
  animation: thinkingBounce 1.4s infinite ease-in-out both;
}

.cw-thinking-dots span:nth-child(1) {
  animation-delay: -0.32s;
}
.cw-thinking-dots span:nth-child(2) {
  animation-delay: -0.16s;
}
.cw-thinking-dots span:nth-child(3) {
  animation-delay: 0s;
}

@keyframes thinkingBounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Loading skeleton */
.cw-skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-secondary) 25%,
    var(--color-surface-tertiary) 50%,
    var(--color-surface-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.cw-skeleton-line {
  height: 14px;
  margin-bottom: 8px;
}

.cw-skeleton-line:last-child {
  width: 60%;
}
```

### File: `src/components/cowork/CoworkCentrePanel.tsx`

Find the section where messages are rendered (the JSX that maps over `messages`) and after the last message, before the `messagesEndRef` div, add a thinking indicator that shows when `isStreaming` is true and the last message is from the user (i.e. no assistant response has started yet):

```tsx
{
  isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user" && (
      <div className="cw-thinking-indicator">
        <div className="cw-thinking-dots">
          <span />
          <span />
          <span />
        </div>
        Thinking...
      </div>
    );
}
```

### Verify

- Send a message — confirm the thinking dots appear while waiting for response
- Confirm messages fade in smoothly when they appear
- Confirm tool blocks expand with a smooth animation
- `npm run build` compiles without errors

---

## Task 6: Migrate Worst Inline Styles to CSS Classes

This task focuses on the **most inline-style-heavy components**. The goal is not to fix every single `style={{}}` (there are 202), but to hit the worst offenders and establish the pattern.

### Approach

For each component below, identify the inline styles and replace them with CSS classes in `globals.css`. Use the existing BEM naming convention: `.cowork-{component}__{element}--{modifier}`.

### 6a. File: `src/components/cowork/message-blocks/ToolUseBlock.tsx`

The summary `<span>` at lines 43–59 has 7 inline style properties. Replace with a CSS class.

**Add to `globals.css`:**

```css
.cowork-tool-card__summary {
  margin-left: 6px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  opacity: 0.9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
```

**In the component**, replace the inline `style={{...}}` on the summary span with just `className="cowork-tool-card__summary"` (keep the existing className too if it has one).

### 6b. File: `src/components/cowork/message-blocks/ToolResultBlock.tsx`

The preview `<span>` at lines 37–45 has 6 inline style properties. Replace similarly.

**Add to `globals.css`:**

```css
.cowork-tool-card__preview {
  margin-left: 8px;
  font-size: 0.75rem;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
```

Also, the `<pre>` at line 52 has `style={{ margin: 0, ... }}`. This is already covered by the existing `.cowork-tool-card__content pre` selector — verify and remove if so.

### 6c. File: `src/components/cowork/message-blocks/PlanBlock.tsx`

Multiple inline styles throughout. Key ones to extract:

**Add to `globals.css`:**

```css
.cw-plan-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.cw-plan-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.cw-plan-step-number {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--color-surface-tertiary);
  color: var(--color-text-secondary);
}

.cw-plan-step-number--completed {
  background: var(--color-success-bg);
  color: var(--cw-success);
}

.cw-plan-step-number--active {
  background: var(--color-accent-bg);
  color: var(--cw-accent);
}

.cw-plan-edit-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1.6;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  resize: vertical;
}

.cw-plan-edit-textarea:focus {
  outline: none;
  border-color: var(--cw-accent);
  box-shadow: 0 0 0 3px var(--color-focus-ring);
}

.cw-plan-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
```

Then replace the inline styles in `PlanBlock.tsx` with these class names.

### 6d. File: `src/components/cowork/message-blocks/AskUserBlock.tsx`

Extract option button styles:

**Add to `globals.css`:**

```css
.cw-ask-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 0.9rem;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s ease;
}

.cw-ask-option:hover {
  background: var(--color-surface-secondary);
  border-color: var(--color-border-strong);
}

.cw-ask-option--selected {
  background: var(--cw-accent-soft);
  border-color: var(--cw-accent);
}

.cw-ask-option--disabled {
  opacity: 0.6;
  cursor: default;
}

.cw-ask-options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.cw-ask-submit-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
```

Then replace inline styles in `AskUserBlock.tsx`.

### 6e. File: `src/components/cowork/message-blocks/SubAgentStatusBlock.tsx`

Extract status badge styles:

**Add to `globals.css`:**

```css
.cw-agent-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cw-agent-status-badge--running {
  background: var(--cw-accent-soft);
  color: var(--cw-accent);
}

.cw-agent-status-badge--completed {
  background: rgba(34, 197, 94, 0.1);
  color: var(--cw-success);
}

.cw-agent-status-badge--failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--cw-danger);
}

.cw-agent-status-badge--cancelled {
  background: var(--color-surface-tertiary);
  color: var(--color-text-muted);
}

.cw-agent-turn-counter {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-left: 4px;
}
```

Then replace inline styles in `SubAgentStatusBlock.tsx`.

### Verify

- All 5 components render identically to before (visual regression check)
- No inline styles remain in the migrated sections
- `npm run build` compiles without errors

---

## Post-Implementation Checklist

After all 6 tasks are complete, verify end-to-end:

- [ ] `npm run build` — clean compilation, no TypeScript errors
- [ ] Send a message that produces markdown with headings, lists, bold, italic, code
- [ ] Verify code blocks have syntax highlighting and copy button
- [ ] Verify tables render with proper borders and header
- [ ] Verify `.md` artifacts render properly in the right panel
- [ ] Verify the thinking dots animation appears while waiting for response
- [ ] Verify messages fade in smoothly
- [ ] Verify tool blocks expand/collapse smoothly
- [ ] Verify error boundary catches a broken artifact without crashing the UI
- [ ] Check inline styles in ToolUseBlock, ToolResultBlock, PlanBlock, AskUserBlock, SubAgentStatusBlock are replaced with CSS classes
- [ ] Run the app on mobile viewport (< 900px) — confirm nothing breaks

---

## What This Does NOT Cover (Future Work)

These are documented in `UX_GAP_AUDIT.md` as lower priorities:

- **Dark mode** — requires all inline styles migrated first (ongoing)
- **PDF.js preview** — install `pdfjs-dist`, replace `PdfRenderer`
- **Tool-specific icons** — map tool names to different icons
- **Skeleton loaders** — for artifacts and initial message load
- **Re-enabling Tailwind** — the `postcss.config.mjs.bak` exists, investigate the PostCSS hang
- **Remaining 150+ inline styles** — SkillDraftCard (33), CreateSkillModal (24), CapabilitiesPanel (14), EmptyStateWidget (10), etc.
