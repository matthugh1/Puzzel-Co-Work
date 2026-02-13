"use client";

import { useState } from "react";
import {
  IconChevronRight,
  IconChevronDown,
  IconCheckCircle,
  IconAlertTriangle,
} from "@/components/cowork/icons";

export function ToolResultBlock({
  output,
  isError,
}: {
  output?: string;
  isError?: boolean;
}) {
  // Errors and important results start expanded
  const [open, setOpen] = useState(isError || false);

  // Show preview for collapsed results (first 100 chars)
  const preview =
    output && !open && output.length > 100
      ? output.slice(0, 100) + "..."
      : null;

  return (
    <div
      className={`cowork-message__tool-block cowork-message__tool-block--result ${isError ? "cowork-message__tool-block--error" : ""}`}
    >
      <div className="cowork-message__tool-block-badge" aria-hidden>
        {isError ? "Tool error" : "Tool result"}
      </div>
      <div className="cowork-tool-card cowork-tool-card--compact">
        <button
          className="cowork-tool-card__header"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <IconChevronDown size={14} />
          ) : (
            <IconChevronRight size={14} />
          )}
          {isError ? (
            <IconAlertTriangle size={14} />
          ) : (
            <IconCheckCircle size={14} />
          )}
          <span
            style={{
              color: isError ? "var(--cw-danger)" : "var(--cw-success)",
            }}
          >
            {isError ? "Error" : "Result"}
          </span>
          {preview && (
            <span className="cowork-tool-card__preview">{preview}</span>
          )}
        </button>
        {open && (
          <div className="cowork-tool-card__content">
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {output || "(empty)"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
