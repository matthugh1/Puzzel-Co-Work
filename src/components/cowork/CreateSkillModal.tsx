"use client";

import { useState } from "react";
import { IconX, IconAlertTriangle } from "@/components/cowork/icons";

interface CreateSkillModalProps {
  sessionId: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateSkillModal({
  sessionId,
  onClose,
  onSuccess,
}: CreateSkillModalProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [triggerInput, setTriggerInput] = useState("");
  const [content, setContent] = useState("");

  const addTrigger = () => {
    const t = triggerInput.trim();
    if (t && !triggers.includes(t) && triggers.length < 20) {
      setTriggers((prev) => [...prev, t]);
      setTriggerInput("");
    }
  };

  const removeTrigger = (index: number) => {
    setTriggers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      setError("No active session. Start a chat first.");
      return;
    }
    setCreating(true);
    setError(null);
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
          name: name.trim(),
          description: description.trim(),
          triggers,
          content: content.trim(),
          sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create skill");
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create skill");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-skill-modal-title"
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
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
          background: "var(--color-surface)",
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
            id="create-skill-modal-title"
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
            onClick={onClose}
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
          onSubmit={handleSubmit}
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
              Start a chat session to create a skill that will be available in
              that chat.
            </p>
          )}

          {error && (
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
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="create-skill-name"
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
              id="create-skill-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              htmlFor="create-skill-description"
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
              id="create-skill-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTrigger())
                }
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
            {triggers.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {triggers.map((t, i) => (
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
              htmlFor="create-skill-content"
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
              id="create-skill-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Skill name\n\nInstructions for the agent..."
              rows={10}
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
              onClick={onClose}
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
  );
}
