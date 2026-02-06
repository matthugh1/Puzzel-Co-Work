"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  IconSend,
  IconStop,
  IconPaperclip,
  IconX,
  IconChevronDown,
} from "@/components/cowork/icons";

interface ProviderInfo {
  label: string;
  models: { id: string; label: string; contextWindow: string }[];
}

interface CoworkInputAreaProps {
  isStreaming: boolean;
  disabled?: boolean;
  onSend: (message: string, provider?: string, model?: string) => void;
  onStop: () => void;
  onFileSelect?: (files: FileList) => void;
  defaultProvider?: string;
  defaultModel?: string;
}

export function CoworkInputArea({
  isStreaming,
  disabled,
  onSend,
  onStop,
  onFileSelect,
  defaultProvider = "anthropic",
  defaultModel = "claude-sonnet-4-20250514",
}: CoworkInputAreaProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [provider, setProvider] = useState(defaultProvider);
  const [model, setModel] = useState(defaultModel);
  const [providers, setProviders] = useState<Record<string, ProviderInfo>>({});
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Load available providers
  useEffect(() => {
    fetch("/api/cowork/providers")
      .then((r) => r.json())
      .then((data) => {
        if (data.providers) setProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  // Sync defaults
  useEffect(() => {
    setProvider(defaultProvider);
    setModel(defaultModel);
  }, [defaultProvider, defaultModel]);

  // Close picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [input, autoResize]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming || disabled) return;
    onSend(text, provider, model);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input, isStreaming, disabled, onSend, provider, model]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
      if (onFileSelect) onFileSelect(e.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const currentProvider = providers[provider];
  const currentModelInfo = currentProvider?.models.find((m) => m.id === model);
  const canSend = input.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="cowork-input">
      <div className="cowork-input__wrapper">
        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="cowork-input__attachments">
            {attachments.map((file, i) => (
              <div key={`${file.name}-${i}`} className="cowork-input__attachment">
                <span>{file.name}</span>
                <button
                  className="cowork-input__attachment-remove"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${file.name}`}
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input field */}
        <div className="cowork-input__field">
          <button
            className="cowork-input__btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
          >
            <IconPaperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            className="cowork-input__textarea"
            placeholder="Describe your task..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
          />
          <div className="cowork-input__actions">
            {isStreaming ? (
              <button
                className="cowork-input__btn cowork-input__btn--stop"
                onClick={onStop}
                aria-label="Stop"
                title="Stop generation"
              >
                <IconStop size={16} />
              </button>
            ) : (
              <button
                className="cowork-input__btn cowork-input__btn--send"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
                title="Send message"
              >
                <IconSend size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Toolbar with model picker */}
        <div className="cowork-input__toolbar">
          <div style={{ position: "relative" }} ref={pickerRef}>
            <button
              className="cowork-input__model-btn"
              onClick={() => setShowModelPicker(!showModelPicker)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "3px 10px",
                border: "1px solid var(--color-border-muted)",
                borderRadius: 6,
                background: "#fff",
                fontSize: "0.75rem",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              <span>{currentModelInfo?.label || model}</span>
              <IconChevronDown size={12} />
            </button>

            {showModelPicker && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: 0,
                  width: 320,
                  background: "#fff",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                  zIndex: 100,
                  overflow: "hidden",
                }}
              >
                {/* Provider tabs */}
                <div style={{
                  display: "flex",
                  borderBottom: "1px solid var(--color-border-muted)",
                }}>
                  {Object.entries(providers).map(([key, prov]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setProvider(key);
                        const firstModel = prov.models[0];
                        if (firstModel) setModel(firstModel.id);
                      }}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: "none",
                        borderBottom: provider === key ? "2px solid var(--cw-accent)" : "2px solid transparent",
                        background: "transparent",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: provider === key ? "var(--cw-accent)" : "var(--color-text-muted)",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {prov.label}
                    </button>
                  ))}
                </div>

                {/* Models list */}
                <div style={{ padding: 4, maxHeight: 260, overflowY: "auto" }}>
                  {(providers[provider]?.models || []).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setShowModelPicker(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "10px 12px",
                        border: "none",
                        borderRadius: 8,
                        background: model === m.id ? "var(--cw-accent-soft)" : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--font-body)",
                        transition: "background 0.1s ease",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: model === m.id ? "var(--cw-accent)" : "var(--color-text)" }}>
                          {m.label}
                        </div>
                        <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                          {m.id}
                        </div>
                      </div>
                      <span style={{
                        fontSize: "0.625rem",
                        padding: "1px 6px",
                        borderRadius: 99,
                        background: "var(--color-surface-secondary)",
                        color: "var(--color-text-muted)",
                      }}>
                        {m.contextWindow}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className="cowork-input__hint">
            Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}
