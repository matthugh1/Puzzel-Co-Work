"use client";

interface EmptyStateWidgetProps {
  onOpenCapabilities: () => void;
}

/**
 * Part 15: Empty state when chat has no messages. Lists capabilities and offers "See all capabilities".
 */
export function EmptyStateWidget({
  onOpenCapabilities,
}: EmptyStateWidgetProps) {
  return (
    <div
      className="cowork-empty-state-widget"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: 24,
        maxWidth: 480,
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          marginBottom: 8,
          color: "var(--color-text)",
        }}
      >
        Welcome to Cowork
      </h3>
      <p
        style={{
          fontSize: "0.9375rem",
          color: "var(--color-text-muted)",
          marginBottom: 16,
        }}
      >
        I can help you with:
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "0 0 20px",
          fontSize: "0.875rem",
          color: "var(--color-text-secondary)",
          textAlign: "left",
        }}
      >
        <li style={{ marginBottom: 6 }}>Reading and editing files</li>
        <li style={{ marginBottom: 6 }}>Searching the web</li>
        <li style={{ marginBottom: 6 }}>Running commands</li>
        <li style={{ marginBottom: 6 }}>Creating documents and spreadsheets</li>
        <li style={{ marginBottom: 6 }}>Parallel task coordination</li>
      </ul>
      <button
        type="button"
        onClick={onOpenCapabilities}
        className="cowork-input__btn cowork-input__btn--primary"
        style={{ padding: "10px 20px", fontSize: "0.875rem" }}
      >
        See all capabilities
      </button>
    </div>
  );
}
