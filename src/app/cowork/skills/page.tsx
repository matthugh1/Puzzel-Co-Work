"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  IconZap,
  IconLoader,
  IconAlertTriangle,
  IconPlus,
  IconX,
  IconPencil,
} from "@/components/cowork/icons";

interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category?: string;
  triggers: string[];
  tags?: string[];
  source?: "built-in" | "custom";
}

const CATEGORIES = ["General", "Writing", "Analysis", "Code", "Research"];

function SkillCard({
  skill,
  isCustom,
  onEdit,
}: {
  skill: SkillMeta;
  isCustom?: boolean;
  onEdit?: (skill: SkillMeta) => void;
}) {
  return (
    <div
      className="card card-hover"
      style={{
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderLeft: isCustom ? "3px solid var(--color-accent)" : undefined,
        background: isCustom ? "var(--color-surface-alt, #faf9fc)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              margin: 0,
              color: "var(--color-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {skill.name}
          </h3>
          {isCustom && (
            <span
              style={{
                fontSize: "0.6875rem",
                padding: "2px 6px",
                borderRadius: 6,
                background: "var(--color-accent)",
                color: "#fff",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Custom
            </span>
          )}
          {skill.category && skill.category !== "General" && (
            <span
              style={{
                fontSize: "0.6875rem",
                padding: "2px 6px",
                borderRadius: 6,
                background: "var(--color-surface-secondary)",
                color: "var(--color-text-secondary)",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {skill.category}
            </span>
          )}
        </div>
        {isCustom && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(skill)}
            aria-label="Edit skill"
            title="Edit skill"
            style={{
              padding: 6,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            <IconPencil size={16} />
          </button>
        )}
      </div>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--color-text-secondary)",
          margin: 0,
          flex: 1,
          lineHeight: 1.5,
        }}
      >
        {skill.description || "No description."}
      </p>
      {(skill.tags?.length ?? 0) > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {skill.tags!.slice(0, 5).map((t) => (
            <span
              key={t}
              style={{
                fontSize: "0.6875rem",
                padding: "2px 8px",
                borderRadius: 99,
                background: "var(--color-primary-10)",
                color: "var(--color-primary-dark)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {skill.triggers && skill.triggers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {skill.triggers.slice(0, 5).map((t) => (
            <span
              key={t}
              style={{
                fontSize: "0.6875rem",
                padding: "2px 8px",
                borderRadius: 99,
                background: "var(--color-surface-secondary)",
                color: "var(--color-text-muted)",
              }}
            >
              {t}
            </span>
          ))}
          {skill.triggers.length > 5 && (
            <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
              +{skill.triggers.length - 5}
            </span>
          )}
        </div>
      )}
      {isCustom && (
        <div style={{ marginTop: "auto" }}>
          <Link
            href={`/cowork/skills/${skill.id}`}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            Use →
          </Link>
        </div>
      )}
    </div>
  );
}

function CoworkSkillsContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? undefined;

  const [filterCategory, setFilterCategory] = useState(searchParams.get("category") ?? "");
  const [filterSearch, setFilterSearch] = useState(searchParams.get("search") ?? "");
  const [filterTags, setFilterTags] = useState<string[]>(() => {
    const t = searchParams.get("tags");
    return t ? t.split(",").map((s) => s.trim()).filter(Boolean) : [];
  });

  const [builtInSkills, setBuiltInSkills] = useState<SkillMeta[]>([]);
  const [customSkills, setCustomSkills] = useState<SkillMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editSkillId, setEditSkillId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFormName, setEditFormName] = useState("");
  const [editFormDescription, setEditFormDescription] = useState("");
  const [editFormTriggers, setEditFormTriggers] = useState<string[]>([]);
  const [editFormTriggerInput, setEditFormTriggerInput] = useState("");
  const [editFormContent, setEditFormContent] = useState("");

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTriggers, setFormTriggers] = useState<string[]>([]);
  const [formTriggerInput, setFormTriggerInput] = useState("");
  const [formContent, setFormContent] = useState("");

  const query = new URLSearchParams();
  if (filterCategory) query.set("category", filterCategory);
  if (filterSearch) query.set("search", filterSearch);
  if (filterTags.length > 0) query.set("tags", filterTags.join(","));
  const queryString = query.toString();

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = queryString ? `/api/cowork/skills?${queryString}` : "/api/cowork/skills";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load skills");
      const data = await res.json();
      setBuiltInSkills(data.builtIn ?? []);
      setCustomSkills(data.custom ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load skills");
      setBuiltInSkills([]);
      setCustomSkills([]);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (filterCategory) params.set("category", filterCategory);
    else params.delete("category");
    if (filterSearch) params.set("search", filterSearch);
    else params.delete("search");
    if (filterTags.length > 0) params.set("tags", filterTags.join(","));
    else params.delete("tags");
    const next = params.toString();
    const current = window.location.search.slice(1);
    if (next !== current) {
      const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState(null, "", url);
    }
  }, [filterCategory, filterSearch, filterTags]);

  const addTrigger = () => {
    const t = formTriggerInput.trim();
    if (t && !formTriggers.includes(t) && formTriggers.length < 20) {
      setFormTriggers((prev) => [...prev, t]);
      setFormTriggerInput("");
    }
  };

  const removeTrigger = (index: number) => {
    setFormTriggers((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTriggers([]);
    setFormTriggerInput("");
    setFormContent("");
    setCreateError(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCloseCreate = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleOpenEdit = useCallback(
    async (skill: SkillMeta) => {
      setEditSkillId(skill.id);
      setEditError(null);
      setEditLoading(true);
      try {
        const res = await fetch(`/api/cowork/skills/${skill.id}`);
        if (!res.ok) throw new Error("Failed to load skill");
        const data = await res.json();
        const s = data.skill;
        setEditFormName(s.name ?? "");
        setEditFormDescription(s.description ?? "");
        setEditFormTriggers(Array.isArray(s.triggers) ? s.triggers : []);
        setEditFormContent(s.content ?? "");
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to load skill");
        setEditSkillId(null);
      } finally {
        setEditLoading(false);
      }
    },
    [],
  );

  const handleCloseEdit = useCallback(() => {
    setEditSkillId(null);
    setEditError(null);
    setEditFormName("");
    setEditFormDescription("");
    setEditFormTriggers([]);
    setEditFormContent("");
  }, []);

  const addEditTrigger = () => {
    const t = editFormTriggerInput.trim();
    if (t && !editFormTriggers.includes(t) && editFormTriggers.length < 20) {
      setEditFormTriggers((prev) => [...prev, t]);
      setEditFormTriggerInput("");
    }
  };

  const removeEditTrigger = (index: number) => {
    setEditFormTriggers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSkillId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();
      const res = await fetch(`/api/cowork/skills/${editSkillId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({
          name: editFormName.trim(),
          description: editFormDescription.trim(),
          triggers: editFormTriggers,
          content: editFormContent.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update skill");
      }
      await loadSkills();
      handleCloseEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update skill");
    } finally {
      setEditSaving(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      setCreateError("Open this page from a chat session to create a skill.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();
      const res = await fetch("/api/cowork/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim(),
          triggers: formTriggers,
          content: formContent.trim(),
          sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create skill");
      }
      await loadSkills();
      handleCloseCreate();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create skill");
    } finally {
      setCreating(false);
    }
  };

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
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--color-accent-subtle, rgba(124, 58, 237, 0.1))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-accent)",
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
                Skills
              </h1>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                Built-in and custom skills for Cowork
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/cowork"
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
              }}
            >
              Back to Cowork
            </Link>
            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "var(--color-accent)",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <IconPlus size={16} />
              Create skill
            </button>
          </div>
        </div>
      </header>

      <main className="page-content">
        {sessionId ? (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-muted)",
              marginBottom: 16,
            }}
          >
            Create a new skill for this chat. Viewing all built-in and custom skills.
          </p>
        ) : (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--color-text-muted)",
              marginBottom: 16,
            }}
          >
            Built-in skills (from the platform) and custom skills (created in chat).
          </p>
        )}

        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderRadius: 10,
              background: "var(--color-error-bg, #fef2f2)",
              border: "1px solid var(--color-error-border, #fecaca)",
              color: "var(--color-error, #dc2626)",
              marginBottom: 16,
            }}
          >
            <IconAlertTriangle size={18} />
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 24,
            padding: 16,
            background: "var(--color-surface-secondary)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
            <input
              type="search"
              placeholder="Search by name or description..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                fontSize: "0.875rem",
                background: "var(--color-background)",
              }}
              aria-label="Search skills"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: "0.875rem",
              background: "var(--color-background)",
              minWidth: 140,
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by tag (comma-separated)"
            value={filterTags.join(", ")}
            onChange={(e) => {
              const v = e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              setFilterTags(v);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--color-border)",
              fontSize: "0.875rem",
              background: "var(--color-background)",
              minWidth: 200,
            }}
            aria-label="Filter by tags"
          />
          {(filterCategory || filterSearch || filterTags.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setFilterCategory("");
                setFilterSearch("");
                setFilterTags([]);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 48,
              color: "var(--color-text-muted)",
            }}
          >
            <IconLoader size={24} />
            <span style={{ marginLeft: 8 }}>Loading skills...</span>
          </div>
        ) : (
          <>
            <section style={{ marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  margin: "0 0 12px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Built-in skills
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text-muted)",
                  margin: "0 0 16px 0",
                }}
              >
                System-provided skills from the platform
              </p>
              {builtInSkills.length === 0 ? (
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", margin: 0 }}>
                  No built-in skills loaded
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                  }}
                >
                  {builtInSkills.map((skill) => (
                    <SkillCard key={skill.id} skill={skill} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  margin: "0 0 12px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Custom skills
              </h2>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--color-text-muted)",
                  margin: "0 0 16px 0",
                }}
              >
                Skills created in chat sessions
              </p>
              {customSkills.length === 0 ? (
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", margin: 0 }}>
                  No custom skills yet. Create one from a chat session.
                </p>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                  }}
                >
                  {customSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      isCustom
                      onEdit={handleOpenEdit}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-skill-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={(e) => e.target === e.currentTarget && handleCloseCreate()}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                flexShrink: 0,
                padding: 16,
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                id="create-skill-title"
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--color-text)",
                }}
              >
                Create skill
              </h2>
              <button
                type="button"
                onClick={handleCloseCreate}
                aria-label="Close"
                style={{
                  padding: 4,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                }}
              >
                <IconX size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateSubmit}
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {!sessionId && (
                <p
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--color-text-muted)",
                    margin: 0,
                    padding: 10,
                    background: "var(--color-surface-secondary)",
                    borderRadius: 8,
                  }}
                >
                  Open this page from a chat session (e.g. &quot;Create skill&quot;
                  in the panel) to create a skill that will be available in that
                  chat.
                </p>
              )}

              {createError && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 10,
                    borderRadius: 8,
                    background: "var(--color-error-bg, #fef2f2)",
                    border: "1px solid var(--color-error-border, #fecaca)",
                    color: "var(--color-error, #dc2626)",
                    fontSize: "0.875rem",
                  }}
                >
                  <IconAlertTriangle size={16} />
                  {createError}
                </div>
              )}

              <div>
                <label
                  htmlFor="skill-name"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--color-text)",
                  }}
                >
                  Name
                </label>
                <input
                  id="skill-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Code review"
                  maxLength={120}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="skill-description"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--color-text)",
                  }}
                >
                  Description
                </label>
                <input
                  id="skill-description"
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="When to use this skill"
                  maxLength={500}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--color-text)",
                  }}
                >
                  Triggers (optional)
                </label>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={formTriggerInput}
                    onChange={(e) => setFormTriggerInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTrigger())}
                    placeholder="Add trigger phrase"
                    maxLength={80}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: "0.875rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={addTrigger}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    Add
                  </button>
                </div>
                {formTriggers.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {formTriggers.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: "0.8125rem",
                          padding: "4px 8px",
                          borderRadius: 6,
                          background: "var(--color-surface-secondary)",
                        }}
                      >
                        {t}
                        <button
                          type="button"
                          onClick={() => removeTrigger(i)}
                          aria-label={`Remove ${t}`}
                          style={{
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: "var(--color-text-muted)",
                          }}
                        >
                          <IconX size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="skill-content"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--color-text)",
                  }}
                >
                  Instructions (markdown)
                </label>
                <textarea
                  id="skill-content"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="# Skill name\n\nInstructions for the agent..."
                  rows={12}
                  maxLength={50000}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-mono)",
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  paddingTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !sessionId}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--color-accent)",
                    color: "#fff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: creating || !sessionId ? "not-allowed" : "pointer",
                    opacity: creating || !sessionId ? 0.6 : 1,
                  }}
                >
                  {creating ? "Creating..." : "Create skill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editSkillId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-skill-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 24,
          }}
          onClick={(e) => e.target === e.currentTarget && handleCloseEdit()}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                flexShrink: 0,
                padding: 16,
                borderBottom: "1px solid var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                id="edit-skill-title"
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--color-text)",
                }}
              >
                Edit skill
              </h2>
              <button
                type="button"
                onClick={handleCloseEdit}
                aria-label="Close"
                style={{
                  padding: 4,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--color-text-muted)",
                }}
              >
                <IconX size={20} />
              </button>
            </div>

            {editLoading ? (
              <div style={{ padding: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <IconLoader size={24} />
                <span>Loading...</span>
              </div>
            ) : (
              <form
                onSubmit={handleEditSubmit}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {editError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: 10,
                      borderRadius: 8,
                      background: "var(--color-error-bg, #fef2f2)",
                      border: "1px solid var(--color-error-border, #fecaca)",
                      color: "var(--color-error, #dc2626)",
                      fontSize: "0.875rem",
                    }}
                  >
                    <IconAlertTriangle size={16} />
                    {editError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="edit-skill-name"
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "var(--color-text)",
                    }}
                  >
                    Name
                  </label>
                  <input
                    id="edit-skill-name"
                    type="text"
                    value={editFormName}
                    onChange={(e) => setEditFormName(e.target.value)}
                    placeholder="e.g. Legal document analysis"
                    maxLength={120}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-skill-description"
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "var(--color-text)",
                    }}
                  >
                    Description
                  </label>
                  <input
                    id="edit-skill-description"
                    type="text"
                    value={editFormDescription}
                    onChange={(e) => setEditFormDescription(e.target.value)}
                    placeholder="When to use this skill"
                    maxLength={500}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: "0.875rem",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "var(--color-text)",
                    }}
                  >
                    Triggers (optional)
                  </label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      value={editFormTriggerInput}
                      onChange={(e) => setEditFormTriggerInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEditTrigger())}
                      placeholder="Add trigger phrase"
                      maxLength={80}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        fontSize: "0.875rem",
                      }}
                    />
                    <button
                      type="button"
                      onClick={addEditTrigger}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        fontSize: "0.875rem",
                        cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {editFormTriggers.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {editFormTriggers.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.8125rem",
                            padding: "4px 8px",
                            borderRadius: 6,
                            background: "var(--color-surface-secondary)",
                          }}
                        >
                          {t}
                          <button
                            type="button"
                            onClick={() => removeEditTrigger(i)}
                            aria-label={`Remove ${t}`}
                            style={{
                              padding: 0,
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            <IconX size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="edit-skill-content"
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      marginBottom: 4,
                      color: "var(--color-text)",
                    }}
                  >
                    Instructions (markdown)
                  </label>
                  <textarea
                    id="edit-skill-content"
                    value={editFormContent}
                    onChange={(e) => setEditFormContent(e.target.value)}
                    placeholder="# Instructions..."
                    rows={12}
                    maxLength={50000}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-mono)",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    paddingTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      fontSize: "0.875rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    style={{
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--color-accent)",
                      color: "#fff",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      cursor: editSaving ? "not-allowed" : "pointer",
                      opacity: editSaving ? 0.6 : 1,
                    }}
                  >
                    {editSaving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoworkSkillsPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <header className="page-header">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Skills</h1>
          </header>
          <main className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "var(--color-text-muted)" }}>Loading…</span>
          </main>
        </div>
      }
    >
      <CoworkSkillsContent />
    </Suspense>
  );
}
