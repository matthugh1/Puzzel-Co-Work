"use client";

import { useState } from "react";
import {
  IconTerminal,
  IconChevronRight,
  IconChevronDown,
} from "@/components/cowork/icons";

/** One-line summary for tool block header (e.g. "Read package.json", "Bash npm run build"). */
function toolSummary(name: string, input?: Record<string, unknown>): string | null {
  if (!input || typeof input !== "object") return null;
  const path = [input.path, input.filePath, input.file].find((v) => typeof v === "string") as string | undefined;
  const command = typeof input.command === "string" ? input.command : undefined;
  const query = typeof input.query === "string" ? input.query : undefined;
  const pattern = typeof input.pattern === "string" ? input.pattern : undefined;
  const url = typeof input.url === "string" ? input.url : undefined;
  if (path) return path.length > 50 ? path.slice(0, 47) + "…" : path;
  if (command) return command.length > 45 ? command.slice(0, 42) + "…" : command;
  if (query) return query.length > 45 ? query.slice(0, 42) + "…" : query;
  if (pattern) return pattern.length > 45 ? pattern.slice(0, 42) + "…" : pattern;
  if (url) return url.length > 45 ? url.slice(0, 42) + "…" : url;
  return null;
}

export function ToolUseBlock({ name, input }: { name: string; input?: Record<string, unknown> }) {
  // Important tools start expanded
  const importantTools = ["AskUserQuestion", "Task", "EnterPlanMode", "GetSubAgentResults"];
  const [open, setOpen] = useState(importantTools.includes(name));
  const summary = toolSummary(name, input);

  return (
    <div className="cowork-message__tool-block cowork-message__tool-block--use">
      <div className="cowork-message__tool-block-badge" aria-hidden>
        Tool call
      </div>
      <div className="cowork-tool-card cowork-tool-card--compact">
        <button className="cowork-tool-card__header" onClick={() => setOpen(!open)}>
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <IconTerminal size={14} />
          <span className="cowork-tool-card__name">{name}</span>
        {summary != null && (
          <span
            className="cowork-tool-card__summary"
            title={summary}
          >
            • {summary}
          </span>
        )}
      </button>
      {open && (
        <div className="cowork-tool-card__content">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {JSON.stringify(input, null, 2)}
          </pre>
        </div>
      )}
      </div>
    </div>
  );
}
