"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconSettings,
  IconCheckCircle,
  IconLoader,
  IconAlertTriangle,
} from "@/components/cowork/icons";

interface ProviderInfo {
  label: string;
  models: { id: string; label: string; contextWindow: string }[];
}

interface Settings {
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string | null;
}

export default function CoworkSettingsPage() {
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [configured, setConfigured] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>({
    defaultProvider: "anthropic",
    defaultModel: "claude-sonnet-4-20250514",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load providers and settings
  useEffect(() => {
    Promise.all([
      fetch("/api/cowork/providers").then((r) => r.json()),
      fetch("/api/cowork/settings").then((r) => r.json()),
    ])
      .then(([provData, settData]) => {
        setProviders(provData.providers || {});
        setConfigured(provData.configured || []);
        if (settData.settings) {
          setSettings(settData.settings);
        }
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();

      const res = await fetch("/api/cowork/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({
          defaultProvider: settings.defaultProvider,
          defaultModel: settings.defaultModel,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          systemPrompt: settings.systemPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // When provider changes, auto-select first model
  const handleProviderChange = (provider: string) => {
    const providerModels = providers[provider]?.models || [];
    setSettings((prev) => ({
      ...prev,
      defaultProvider: provider,
      defaultModel: providerModels[0]?.id || prev.defaultModel,
    }));
  };

  const currentModels = providers[settings.defaultProvider]?.models || [];

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--color-text-muted)",
        }}
      >
        <IconLoader size={24} />
        <span style={{ marginLeft: 8 }}>Loading settings...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "linear-gradient(135deg, #c084fc, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <IconSettings size={20} />
        </div>
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: 0,
              fontFamily: "var(--font-display)",
            }}
          >
            LLM Settings
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            Configure the default AI provider and model for Cowork
          </p>
        </div>
      </div>

      {/* Status bar */}
      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            marginBottom: 20,
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#dc2626",
            fontSize: "0.875rem",
          }}
        >
          <IconAlertTriangle size={16} />
          {error}
        </div>
      )}

      {configured.length === 0 && (
        <div
          style={{
            padding: "16px",
            borderRadius: 10,
            marginBottom: 20,
            background: "#fffbeb",
            border: "1px solid #f59e0b",
            fontSize: "0.875rem",
            lineHeight: 1.6,
          }}
        >
          <strong>No API keys configured.</strong> Add{" "}
          <code>ANTHROPIC_API_KEY</code> or <code>OPENAI_API_KEY</code> to your{" "}
          <code>.env.local</code> file to enable LLM features.
        </div>
      )}

      {/* Provider Selection */}
      <section style={{ marginBottom: 28 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Default Provider
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(providers).map(([key, prov]) => (
            <button
              key={key}
              onClick={() => handleProviderChange(key)}
              style={{
                flex: 1,
                padding: "14px 16px",
                borderRadius: 12,
                border:
                  settings.defaultProvider === key
                    ? "2px solid var(--cw-accent)"
                    : "1.5px solid var(--color-border)",
                background:
                  settings.defaultProvider === key
                    ? "var(--cw-accent-soft)"
                    : "#fff",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                fontFamily: "var(--font-body)",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  marginBottom: 2,
                }}
              >
                {prov.label}
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-muted)",
                }}
              >
                {prov.models.length} models available
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Model Selection */}
      <section style={{ marginBottom: 28 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Default Model
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {currentModels.map((m) => (
            <button
              key={m.id}
              onClick={() =>
                setSettings((prev) => ({ ...prev, defaultModel: m.id }))
              }
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                border:
                  settings.defaultModel === m.id
                    ? "2px solid var(--cw-accent)"
                    : "1.5px solid var(--color-border)",
                background:
                  settings.defaultModel === m.id
                    ? "var(--cw-accent-soft)"
                    : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "all 0.15s ease",
                fontFamily: "var(--font-body)",
                textAlign: "left",
              }}
            >
              <div>
                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--color-text-muted)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {m.id}
                </div>
              </div>
              <span
                style={{
                  fontSize: "0.6875rem",
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "var(--color-surface-secondary)",
                  color: "var(--color-text-muted)",
                }}
              >
                {m.contextWindow}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Temperature */}
      <section style={{ marginBottom: 28 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Temperature: {settings.temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              temperature: parseFloat(e.target.value),
            }))
          }
          style={{ width: "100%", accentColor: "var(--cw-accent)" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.6875rem",
            color: "var(--color-text-muted)",
            marginTop: 4,
          }}
        >
          <span>Precise (0)</span>
          <span>Balanced (0.7)</span>
          <span>Creative (2)</span>
        </div>
      </section>

      {/* Max Tokens */}
      <section style={{ marginBottom: 28 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Max Output Tokens
        </label>
        <select
          value={settings.maxTokens}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              maxTokens: parseInt(e.target.value),
            }))
          }
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--color-border)",
            fontSize: "0.875rem",
            fontFamily: "var(--font-body)",
            background: "#fff",
          }}
        >
          <option value={1024}>1,024 (short)</option>
          <option value={2048}>2,048</option>
          <option value={4096}>4,096 (default)</option>
          <option value={8192}>8,192</option>
          <option value={16384}>16,384</option>
          <option value={32768}>32,768 (long)</option>
        </select>
      </section>

      {/* System Prompt */}
      <section style={{ marginBottom: 28 }}>
        <label
          style={{
            display: "block",
            fontSize: "0.875rem",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Custom System Prompt{" "}
          <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>
            (optional)
          </span>
        </label>
        <textarea
          value={settings.systemPrompt || ""}
          onChange={(e) =>
            setSettings((prev) => ({
              ...prev,
              systemPrompt: e.target.value || null,
            }))
          }
          placeholder="Override the default system prompt. Leave empty to use the built-in Cowork prompt."
          rows={5}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 10,
            border: "1.5px solid var(--color-border)",
            fontSize: "0.875rem",
            fontFamily: "var(--font-body)",
            resize: "vertical",
            lineHeight: 1.6,
          }}
        />
      </section>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving || configured.length === 0}
          style={{
            padding: "10px 28px",
            borderRadius: 10,
            border: "none",
            background: "var(--cw-accent)",
            color: "#fff",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor:
              saving || configured.length === 0 ? "not-allowed" : "pointer",
            opacity: saving || configured.length === 0 ? 0.5 : 1,
            transition: "all 0.15s ease",
            fontFamily: "var(--font-body)",
          }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: "var(--cw-success)",
              fontSize: "0.875rem",
            }}
          >
            <IconCheckCircle size={16} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
