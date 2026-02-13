"use client";

import { useState } from "react";
import {
  parseSkillFromMarkdown,
  hasSkillDraftFormat,
} from "@/lib/cowork/skill-parser";
import type { SkillDraft } from "@/types/skill";
import { IconChevronDown, IconChevronRight } from "@/components/cowork/icons";

interface SkillDraftCardProps {
  content: string;
}

export function SkillDraftCard({ content }: SkillDraftCardProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  if (!hasSkillDraftFormat(content)) return null;

  const draft = parseSkillFromMarkdown(content);
  if (!draft || (!draft.name && !draft.content)) return null;

  const skill = draft as Partial<SkillDraft>;
  const category = skill.category ?? "General";
  const parameters = skill.parameters ?? [];
  const hasParams = parameters.length > 0;

  return (
    <div
      className="skill-draft-card"
      style={{
        marginTop: 12,
        padding: 16,
        background: "var(--color-surface-secondary)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        fontSize: "0.875rem",
      }}
      role="region"
      aria-label="Skill draft preview"
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontWeight: 600,
            color: "var(--color-text)",
            fontSize: "1rem",
          }}
        >
          {skill.name || "Untitled Skill"}
        </h4>
        <span
          style={{
            padding: "2px 8px",
            background: "var(--color-primary-10)",
            color: "var(--color-primary-dark)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.75rem",
            fontWeight: 500,
          }}
        >
          {category}
        </span>
      </div>

      {skill.description && (
        <p
          style={{
            margin: "0 0 12px",
            color: "var(--color-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {skill.description}
        </p>
      )}

      {skill.content && (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setPromptExpanded((e) => !e)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 0",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8125rem",
              color: "var(--color-primary-dark)",
              fontWeight: 500,
            }}
            aria-expanded={promptExpanded}
          >
            {promptExpanded ? (
              <IconChevronDown size={14} aria-hidden />
            ) : (
              <IconChevronRight size={14} aria-hidden />
            )}
            System prompt
          </button>
          {promptExpanded && (
            <pre
              style={{
                margin: 0,
                padding: 12,
                background: "var(--color-background)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8125rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              {skill.content}
            </pre>
          )}
        </div>
      )}

      {hasParams && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              marginBottom: 6,
            }}
          >
            Parameters
          </div>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8125rem",
              }}
            >
              <thead>
                <tr style={{ background: "var(--color-surface-tertiary)" }}>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    Required
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--color-text)",
                    }}
                  >
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((p, i) => (
                  <tr
                    key={p.name + i}
                    style={{
                      borderTop: "1px solid var(--color-border)",
                    }}
                  >
                    <td style={{ padding: "8px 10px", color: "var(--color-text)" }}>
                      {p.name}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>
                      {p.type}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>
                      {p.required ? "Yes" : "No"}
                    </td>
                    <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>
                      {p.description || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(skill.exampleInput || skill.exampleOutput) && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: "var(--color-background)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.8125rem",
          }}
        >
          {skill.exampleInput && (
            <div style={{ marginBottom: skill.exampleOutput ? 8 : 0 }}>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  marginRight: 6,
                }}
              >
                Example input:
              </span>
              <span style={{ color: "var(--color-text)" }}>{skill.exampleInput}</span>
            </div>
          )}
          {skill.exampleOutput && (
            <div>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  marginRight: 6,
                }}
              >
                Example output:
              </span>
              <span style={{ color: "var(--color-text)" }}>{skill.exampleOutput}</span>
            </div>
          )}
        </div>
      )}

      {(skill.tags?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              marginRight: 8,
            }}
          >
            Tags:
          </span>
          <span style={{ color: "var(--color-text)" }}>
            {skill.tags!.join(", ")}
          </span>
        </div>
      )}

      {(skill.triggers?.length ?? 0) > 0 && (
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              marginRight: 8,
            }}
          >
            Triggers:
          </span>
          <span style={{ color: "var(--color-text)" }}>
            {skill.triggers!.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
