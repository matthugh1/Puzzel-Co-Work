"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  IconZap,
  IconLoader,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
} from "@/components/cowork/icons";

interface SkillData {
  id: string;
  name: string;
  description: string;
  category: string;
  triggers: string[];
  tags: string[];
  content: string;
  parameters: Array<{
    name: string;
    label: string;
    type: string;
    description: string;
    required: boolean;
    default?: string;
    options?: string[];
  }>;
  exampleInput?: string;
  exampleOutput?: string;
  version: number;
  status: string;
}

export default function SkillDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [skill, setSkill] = useState<SkillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contentExpanded, setContentExpanded] = useState(false);

  const loadSkill = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cowork/skills/${id}`);
      if (!res.ok) throw new Error("Failed to load skill");
      const data = await res.json();
      setSkill(data.skill);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skill");
      setSkill(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSkill();
  }, [loadSkill]);

  if (loading) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Skill</h1>
        </header>
        <main className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
          <IconLoader size={24} />
          <span style={{ marginLeft: 8, color: "var(--color-text-muted)" }}>Loading...</span>
        </main>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="page-container">
        <header className="page-header">
          <Link href="/cowork/skills" style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", textDecoration: "none" }}>
            ← Back to Skills
          </Link>
        </header>
        <main className="page-content" style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 16,
              borderRadius: 10,
              background: "var(--color-error-bg, #fef2f2)",
              border: "1px solid var(--color-error-border, #fecaca)",
              color: "var(--color-error, #dc2626)",
            }}
          >
            <IconAlertTriangle size={20} />
            {error ?? "Skill not found"}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href="/cowork/skills"
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              ← Skills
            </Link>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--color-primary-10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-primary)",
              }}
            >
              <IconZap size={20} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  color: "var(--color-text)",
                }}
              >
                {skill.name}
              </h1>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", margin: 0 }}>
                v{skill.version} · {skill.category}
              </p>
            </div>
          </div>
          <Link
            href="/cowork"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 10,
              background: "var(--color-primary)",
              color: "#fff",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Use in chat →
          </Link>
        </div>
      </header>

      <main className="page-content" style={{ padding: 24 }}>
        {skill.description && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px 0" }}>
              Description
            </h2>
            <p style={{ margin: 0, color: "var(--color-text)", lineHeight: 1.6 }}>
              {skill.description}
            </p>
          </section>
        )}

        {(skill.triggers?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px 0" }}>
              Triggers
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {skill.triggers.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.8125rem",
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--color-surface-secondary)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {(skill.tags?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 8px 0" }}>
              Tags
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {skill.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: "0.8125rem",
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--color-primary-10)",
                    color: "var(--color-primary-dark)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </section>
        )}

        {skill.content && (
          <section style={{ marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setContentExpanded((e) => !e)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 0",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {contentExpanded ? (
                <IconChevronDown size={18} />
              ) : (
                <IconChevronRight size={18} />
              )}
              System prompt
            </button>
            {contentExpanded && (
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  background: "var(--color-surface-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.8125rem",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "auto",
                  maxHeight: 400,
                }}
              >
                {skill.content}
              </pre>
            )}
          </section>
        )}

        {(skill.parameters?.length ?? 0) > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 12px 0" }}>
              Parameters
            </h2>
            <div
              style={{
                overflowX: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                <thead>
                  <tr style={{ background: "var(--color-surface-tertiary)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Name</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Required</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600 }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {skill.parameters.map((p) => (
                    <tr key={p.name} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td style={{ padding: "10px 12px" }}>{p.name}</td>
                      <td style={{ padding: "10px 12px" }}>{p.type}</td>
                      <td style={{ padding: "10px 12px" }}>{p.required ? "Yes" : "No"}</td>
                      <td style={{ padding: "10px 12px", color: "var(--color-text-secondary)" }}>
                        {p.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {(skill.exampleInput || skill.exampleOutput) && (
          <section>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--color-text-secondary)", margin: "0 0 12px 0" }}>
              Example
            </h2>
            <div
              style={{
                padding: 16,
                background: "var(--color-surface-secondary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
              }}
            >
              {skill.exampleInput && (
                <div style={{ marginBottom: skill.exampleOutput ? 12 : 0 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>
                    Input
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>{skill.exampleInput}</p>
                </div>
              )}
              {skill.exampleOutput && (
                <div>
                  <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 4 }}>
                    Output
                  </div>
                  <p style={{ margin: 0, fontSize: "0.875rem" }}>{skill.exampleOutput}</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
