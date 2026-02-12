"use client";

import { useState } from "react";

interface CapabilitiesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  {
    icon: "📁",
    title: "File Operations",
    tools: ["Read", "Write", "Edit", "Delete", "Glob", "Grep"],
    examples: ["Read a file", "Create or overwrite a file", "Search in files"],
  },
  {
    icon: "💻",
    title: "Commands & Shell",
    tools: ["Bash"],
    examples: ["Run shell commands", "Install packages", "Run scripts"],
    permission: "May require your permission",
  },
  {
    icon: "🌐",
    title: "Web",
    tools: ["WebSearch", "WebFetch"],
    examples: ["Search the web", "Fetch a webpage"],
  },
  {
    icon: "📄",
    title: "Documents",
    tools: ["CreateDocument", "CreateSpreadsheet"],
    examples: ["Generate a Word document", "Create an Excel spreadsheet"],
  },
  {
    icon: "🤖",
    title: "Task & Coordination",
    tools: ["TodoWrite", "Task", "Skill"],
    examples: ["Track multi-step tasks", "Spawn sub-agents", "Use a skill"],
  },
];

/**
 * Part 15: Tool Discovery UI — "What I can do" panel with categories and search.
 */
export function CapabilitiesPanel({ isOpen, onClose }: CapabilitiesPanelProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const filtered = query.trim()
    ? CATEGORIES.map((cat) => ({
        ...cat,
        tools: cat.tools.filter((t) => t.toLowerCase().includes(query.toLowerCase())),
        examples: cat.examples.filter((e) => e.toLowerCase().includes(query.toLowerCase())),
      })).filter((cat) => cat.tools.length > 0 || cat.examples.length > 0)
    : CATEGORIES;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Capabilities panel"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-overlay)",
      }}
      onClick={onClose}
    >
      <div
        className="capabilities-panel"
        style={{
          background: "var(--color-background)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          maxWidth: 560,
          width: "90%",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>What I can do</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cowork-input__btn"
            style={{ padding: "6px 10px" }}
          >
            ✕
          </button>
        </header>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-border)" }}>
          <input
            type="search"
            placeholder="Search capabilities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: "0.875rem",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-background)",
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {filtered.map((cat) => (
            <div
              key={cat.title}
              style={{
                marginBottom: 20,
                padding: 16,
                background: "var(--color-surface-secondary)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 8 }}>
                <span style={{ marginRight: 8 }}>{cat.icon}</span>
                {cat.title}
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: 8 }}>
                {cat.tools.join(", ")}
              </div>
              {cat.permission && (
                <div style={{ fontSize: "0.75rem", color: "var(--color-warning-text)", marginBottom: 4 }}>
                  {cat.permission}
                </div>
              )}
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>
                {cat.examples.slice(0, 3).map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
