"use client";

import { useState } from "react";
import {
  IconChevronRight,
  IconChevronDown,
  IconCheckCircle,
  IconAlertTriangle,
  IconLoader,
} from "@/components/cowork/icons";

/** One-line summary for the tool (e.g. "Read package.json", "Bash npm run build"). */
function toolSummary(
  name: string,
  input?: Record<string, unknown>,
): string | null {
  if (!input || typeof input !== "object") return null;
  const path = [input.path, input.filePath, input.file].find(
    (v) => typeof v === "string",
  ) as string | undefined;
  const command = typeof input.command === "string" ? input.command : undefined;
  const query = typeof input.query === "string" ? input.query : undefined;
  const pattern = typeof input.pattern === "string" ? input.pattern : undefined;
  const url = typeof input.url === "string" ? input.url : undefined;
  const str = path ?? command ?? query ?? pattern ?? url;
  if (!str) return null;
  return str.length > 60 ? str.slice(0, 57) + "…" : str;
}

/** Human-friendly tool labels */
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    Read: "Read file",
    Write: "Write file",
    Edit: "Edit file",
    Bash: "Run command",
    Glob: "Search files",
    Grep: "Search content",
    WebSearch: "Web search",
    WebFetch: "Fetch page",
    CreateDocument: "Create document",
    CreateSpreadsheet: "Create spreadsheet",
    Task: "Run sub-agent",
    Skill: "Load skill",
    TodoWrite: "Update progress",
    Delete: "Delete file",
  };
  return labels[name] || name;
}

interface ToolActivityBlockProps {
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  /** true while waiting for the tool result (still streaming) */
  isPending?: boolean;
}

export function ToolActivityBlock({
  name,
  input,
  result,
  isError,
  isPending,
}: ToolActivityBlockProps) {
  // Errors start expanded; everything else is collapsed
  const [open, setOpen] = useState(isError ?? false);
  const summary = toolSummary(name, input);
  const label = toolLabel(name);

  return (
    <div
      className={`cw-tool-activity ${isError ? "cw-tool-activity--error" : ""} ${isPending ? "cw-tool-activity--pending" : ""}`}
    >
      <button
        type="button"
        className="cw-tool-activity__header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {/* Status indicator */}
        <span className="cw-tool-activity__status">
          {isPending ? (
            <IconLoader
              size={14}
              className="cw-tool-activity__spinner cw-icon-spin"
            />
          ) : isError ? (
            <IconAlertTriangle size={14} />
          ) : (
            <IconCheckCircle size={14} />
          )}
        </span>

        {/* Tool name */}
        <span className="cw-tool-activity__label">{label}</span>

        {/* Summary */}
        {summary && (
          <span className="cw-tool-activity__summary" title={summary}>
            {summary}
          </span>
        )}

        {/* Expand chevron — pushed to far right */}
        <span className="cw-tool-activity__chevron">
          {open ? (
            <IconChevronDown size={12} />
          ) : (
            <IconChevronRight size={12} />
          )}
        </span>
      </button>

      {open && (
        <div className="cw-tool-activity__details">
          {/* Input section */}
          {input && Object.keys(input).length > 0 && (
            <div className="cw-tool-activity__section">
              <span className="cw-tool-activity__section-label">Input</span>
              <pre className="cw-tool-activity__pre">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {/* Result section */}
          {result && (
            <div className="cw-tool-activity__section">
              <span className="cw-tool-activity__section-label">
                {isError ? "Error" : "Output"}
              </span>
              <pre className="cw-tool-activity__pre">{result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
