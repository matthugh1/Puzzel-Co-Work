"use client";

/**
 * ArtifactRenderer
 * Renders different file types with appropriate viewers.
 *
 * Supported:
 *  - HTML       → sandboxed iframe (srcdoc with strict CSP)
 *  - Markdown   → client-side HTML conversion
 *  - SVG        → inline render (sanitised)
 *  - Images     → <img> tag
 *  - Code       → syntax-highlighted <pre>
 *  - PDF        → download link (full PDF.js deferred)
 *  - Other      → download link + file metadata
 */

import { useState, useEffect, useMemo } from "react";
import type { CoworkFileRecord } from "@/types/cowork";
import {
  IconDownload,
  IconCopy,
  IconExternalLink,
  IconX,
  IconFile,
} from "@/components/cowork/icons";

// ─── helpers ────────────────────────────────────────────────────────────────

type RenderMode = "html" | "markdown" | "svg" | "image" | "code" | "pdf" | "other";

function detectRenderMode(file: CoworkFileRecord): RenderMode {
  const mime = file.mimeType ?? "";
  const ext = file.fileName.split(".").pop()?.toLowerCase() ?? "";
  const artifactType = (file.metadata as Record<string, unknown> | undefined)?.artifactType as string | undefined;

  if (artifactType === "html" || mime === "text/html" || ext === "html" || ext === "htm") return "html";
  if (artifactType === "markdown" || mime === "text/markdown" || ext === "md" || ext === "markdown") return "markdown";
  if (artifactType === "svg" || mime === "image/svg+xml" || ext === "svg") return "svg";
  if (artifactType === "image" || mime.startsWith("image/")) return "image";
  if (artifactType === "pdf" || mime === "application/pdf" || ext === "pdf") return "pdf";
  if (
    artifactType === "code" ||
    artifactType === "jsx" ||
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    [
      "js", "ts", "jsx", "tsx", "json", "css", "py", "java",
      "cpp", "c", "go", "rs", "rb", "php", "sh", "bash",
      "yaml", "yml", "toml", "xml", "sql", "txt",
    ].includes(ext)
  ) {
    return "code";
  }

  return "other";
}

/** Very simple Markdown → HTML. Handles headings, bold, italic, code, links, lists. */
function markdownToHtml(md: string): string {
  let html = md
    // code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="cw-code-block" data-lang="${lang}"><code>${escapeHtml(code)}</code></pre>`,
    )
    // headings
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    // bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // inline code
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // unordered lists (- or *)
    .replace(/^[\-\*] (.+)$/gm, "<li>$1</li>")
    // ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // horizontal rules
    .replace(/^---$/gm, "<hr/>")
    // paragraphs (double newlines)
    .replace(/\n\n/g, "</p><p>")
    // single newlines → <br>
    .replace(/\n/g, "<br/>");

  // Wrap loose <li> in <ul>
  html = html.replace(/((?:<li>[\s\S]*?<\/li>\s*)+)/g, "<ul>$1</ul>");

  return `<p>${html}</p>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Basic CSS-based syntax highlighting keywords for code blocks */
const CODE_HIGHLIGHT_CSS = `
  .cw-code-viewer {
    font-family: "SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 16px;
    border-radius: 8px;
    overflow: auto;
    white-space: pre;
    tab-size: 2;
    margin: 0;
    max-height: 100%;
  }
  .cw-code-viewer .line-number {
    display: inline-block;
    width: 3em;
    text-align: right;
    margin-right: 1em;
    color: #585b70;
    user-select: none;
  }
`;

/** Build a sandboxed HTML document for the iframe */
function buildSandboxedHtml(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src data: blob: https:; font-src data:;" />
  <style>
    body { margin: 16px; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1a1a2e; }
    img { max-width: 100%; }
    a { color: #8b5cf6; }
  </style>
</head>
<body>${html}</body>
</html>`;
}

// ─── sub-renderers ──────────────────────────────────────────────────────────

function HtmlRenderer({ content }: { content: string }) {
  const srcDoc = useMemo(() => buildSandboxedHtml(content), [content]);
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      title="HTML artifact"
      className="cw-artifact-iframe"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 8,
        background: "#fff",
      }}
    />
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => markdownToHtml(content), [content]);
  const srcDoc = useMemo(
    () =>
      buildSandboxedHtml(`
        <style>
          h1,h2,h3,h4 { margin: .6em 0 .3em; }
          code { background: #f4f4f5; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
          pre { background: #1e1e2e; color: #cdd6f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
          pre code { background: none; padding: 0; color: inherit; }
          ul, ol { padding-left: 1.4em; }
          hr { border: none; border-top: 1px solid #e5e5e5; margin: 1em 0; }
          a { color: #8b5cf6; }
        </style>
        ${html}
      `),
    [html],
  );
  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      title="Markdown artifact"
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 8,
        background: "#fff",
      }}
    />
  );
}

function SvgRenderer({ content }: { content: string }) {
  // Strip any <script> tags from SVG for safety
  const safeSvg = content.replace(/<script[\s\S]*?<\/script>/gi, "");
  return (
    <div
      className="cw-svg-container"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        borderRadius: 8,
        overflow: "auto",
        padding: 16,
      }}
      dangerouslySetInnerHTML={{ __html: safeSvg }}
    />
  );
}

function ImageRenderer({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", padding: 16 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
    </div>
  );
}

function CodeRenderer({ content, fileName }: { content: string; fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const lines = content.split("\n");
  return (
    <>
      <style>{CODE_HIGHLIGHT_CSS}</style>
      <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
        <pre className="cw-code-viewer">
          {lines.map((line, i) => (
            <div key={i}>
              <span className="line-number">{i + 1}</span>
              {line || " "}
            </div>
          ))}
        </pre>
      </div>
    </>
  );
}

function PdfRenderer({ downloadUrl, fileName }: { downloadUrl: string; fileName: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--color-text-muted)" }}>
      <IconFile size={48} />
      <span style={{ fontWeight: 500, fontSize: "1rem" }}>{fileName}</span>
      <span style={{ fontSize: "0.8125rem" }}>PDF preview is not available yet.</span>
      <a href={downloadUrl} download style={{ fontSize: "0.875rem", color: "var(--cw-accent)", textDecoration: "underline", display: "flex", alignItems: "center", gap: 4 }}>
        <IconDownload size={14} /> Download PDF
      </a>
    </div>
  );
}

function OtherRenderer({ downloadUrl, fileName, mimeType, sizeBytes }: { downloadUrl: string; fileName: string; mimeType: string; sizeBytes: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--color-text-muted)" }}>
      <IconFile size={48} />
      <span style={{ fontWeight: 500, fontSize: "1rem" }}>{fileName}</span>
      <span style={{ fontSize: "0.8125rem" }}>
        {mimeType} &middot; {formatBytes(sizeBytes)}
      </span>
      <a href={downloadUrl} download style={{ fontSize: "0.875rem", color: "var(--cw-accent)", textDecoration: "underline", display: "flex", alignItems: "center", gap: 4 }}>
        <IconDownload size={14} /> Download file
      </a>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── main component ─────────────────────────────────────────────────────────

interface ArtifactRendererProps {
  artifact: CoworkFileRecord;
  /** Raw file content — if already available (e.g. just-written by agent) */
  rawContent?: string;
  onClose?: () => void;
}

export function ArtifactRenderer({ artifact, rawContent, onClose }: ArtifactRendererProps) {
  const [content, setContent] = useState<string | null>(rawContent ?? null);
  const [loading, setLoading] = useState(!rawContent);
  const [error, setError] = useState<string | null>(null);
  const mode = detectRenderMode(artifact);

  // Fetch content for text-based artifacts if not provided
  useEffect(() => {
    if (rawContent != null) {
      setContent(rawContent);
      setLoading(false);
      return;
    }

    // Only fetch for text-based renderers
    if (["html", "markdown", "svg", "code"].includes(mode) && artifact.downloadUrl) {
      setLoading(true);
      setError(null);
      fetch(artifact.downloadUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [artifact.downloadUrl, mode, rawContent]);

  // ── toolbar ──

  const handleCopy = async () => {
    if (content) {
      await navigator.clipboard.writeText(content);
    }
  };

  const handleOpenNew = () => {
    if (artifact.downloadUrl) {
      window.open(artifact.downloadUrl, "_blank");
    }
  };

  // ── render ──

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--color-text-muted)" }}>
          Loading artifact...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8, color: "var(--cw-danger)" }}>
          <IconFile size={32} />
          <span>Failed to load: {error}</span>
        </div>
      );
    }

    switch (mode) {
      case "html":
        return content ? <HtmlRenderer content={content} /> : null;
      case "markdown":
        return content ? <MarkdownRenderer content={content} /> : null;
      case "svg":
        return content ? <SvgRenderer content={content} /> : null;
      case "image":
        return artifact.downloadUrl ? <ImageRenderer src={artifact.downloadUrl} alt={artifact.fileName} /> : null;
      case "code":
        return content ? <CodeRenderer content={content} fileName={artifact.fileName} /> : null;
      case "pdf":
        return artifact.downloadUrl ? <PdfRenderer downloadUrl={artifact.downloadUrl} fileName={artifact.fileName} /> : null;
      case "other":
      default:
        return <OtherRenderer downloadUrl={artifact.downloadUrl} fileName={artifact.fileName} mimeType={artifact.mimeType} sizeBytes={artifact.sizeBytes} />;
    }
  };

  return (
    <div className="cw-artifact-renderer">
      {/* Toolbar */}
      <div className="cw-artifact-renderer__toolbar">
        <span className="cw-artifact-renderer__filename" title={artifact.fileName}>
          <IconFile size={14} />
          {artifact.fileName}
          <span className="cw-artifact-renderer__badge">{mode.toUpperCase()}</span>
        </span>
        <div className="cw-artifact-renderer__actions">
          {["html", "markdown", "svg", "code"].includes(mode) && content && (
            <button
              className="cowork-input__btn"
              onClick={handleCopy}
              title="Copy source"
            >
              <IconCopy size={14} />
            </button>
          )}
          {artifact.downloadUrl && (
            <button
              className="cowork-input__btn"
              onClick={handleOpenNew}
              title="Open in new tab"
            >
              <IconExternalLink size={14} />
            </button>
          )}
          {artifact.downloadUrl && (
            <a
              href={artifact.downloadUrl}
              download
              className="cowork-input__btn"
              title="Download"
            >
              <IconDownload size={14} />
            </a>
          )}
          {onClose && (
            <button
              className="cowork-input__btn"
              onClick={onClose}
              title="Close"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Render area */}
      <div className="cw-artifact-renderer__body">
        {renderContent()}
      </div>
    </div>
  );
}
