"use client";

import { useState } from "react";
import type { CoworkFileRecord } from "@/types/cowork";
import { ArtifactRenderer } from "@/components/cowork/ArtifactRenderer";
import {
  IconChevronRight,
  IconChevronDown,
  IconFile,
  IconFolder,
  IconDownload,
  IconCopy,
  IconX,
  IconPanelRight,
} from "@/components/cowork/icons";

interface CoworkRightPanelProps {
  isOpen: boolean;
  activeTab: "artifacts" | "files";
  activeArtifact: CoworkFileRecord | null;
  uploads: CoworkFileRecord[];
  outputs: CoworkFileRecord[];
  onToggle: () => void;
  onTabChange: (tab: "artifacts" | "files") => void;
  onSelectFile: (file: CoworkFileRecord | null) => void;
}

export function CoworkRightPanel({
  isOpen,
  activeTab,
  activeArtifact,
  uploads,
  outputs,
  onToggle,
  onTabChange,
  onSelectFile,
}: CoworkRightPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="cowork-right-panel" style={{ position: "relative" }}>
      <button className="cowork-right-panel__toggle" onClick={onToggle} aria-label="Close panel">
        <IconChevronRight size={14} />
      </button>

      {/* Tabs */}
      <div className="cowork-right-panel__tabs">
        <button
          className={`cowork-right-panel__tab ${activeTab === "artifacts" ? "cowork-right-panel__tab--active" : ""}`}
          onClick={() => onTabChange("artifacts")}
        >
          Artifacts
        </button>
        <button
          className={`cowork-right-panel__tab ${activeTab === "files" ? "cowork-right-panel__tab--active" : ""}`}
          onClick={() => onTabChange("files")}
        >
          Files
        </button>
      </div>

      {/* Content */}
      <div className="cowork-right-panel__content">
        {activeTab === "artifacts" ? (
          activeArtifact ? (
            <ArtifactRenderer
              artifact={activeArtifact}
              onClose={() => onSelectFile(null)}
            />
          ) : (
            <div className="cowork-file-explorer__empty">
              <div style={{ marginBottom: 8 }}>
                <IconFile size={32} />
              </div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>No artifact selected</div>
              <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
                Click on a file reference in the chat to view it here
              </div>
            </div>
          )
        ) : (
          <FileExplorer
            uploads={uploads}
            outputs={outputs}
            onSelectFile={onSelectFile}
          />
        )}
      </div>
    </div>
  );
}

function FileExplorer({
  uploads,
  outputs,
  onSelectFile,
}: {
  uploads: CoworkFileRecord[];
  outputs: CoworkFileRecord[];
  onSelectFile: (file: CoworkFileRecord) => void;
}) {
  const [uploadsOpen, setUploadsOpen] = useState(true);
  const [outputsOpen, setOutputsOpen] = useState(true);

  const allEmpty = uploads.length === 0 && outputs.length === 0;

  if (allEmpty) {
    return (
      <div className="cowork-file-explorer__empty">
        <div style={{ marginBottom: 8 }}>
          <IconFolder size={32} />
        </div>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>No files yet</div>
        <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>
          Uploaded and generated files will appear here
        </div>
      </div>
    );
  }

  return (
    <div className="cowork-file-explorer">
      {/* Uploads */}
      <div className="cowork-file-explorer__group">
        <button
          className="cowork-file-explorer__group-title"
          onClick={() => setUploadsOpen(!uploadsOpen)}
        >
          {uploadsOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <IconFolder size={14} />
          <span>Uploads ({uploads.length})</span>
        </button>
        {uploadsOpen &&
          uploads.map((file) => (
            <button
              key={file.id}
              className="cowork-file-explorer__item"
              onClick={() => onSelectFile(file)}
            >
              <IconFile size={14} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.fileName}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", flexShrink: 0 }}>
                {formatBytes(file.sizeBytes)}
              </span>
            </button>
          ))}
      </div>

      {/* Outputs */}
      <div className="cowork-file-explorer__group">
        <button
          className="cowork-file-explorer__group-title"
          onClick={() => setOutputsOpen(!outputsOpen)}
        >
          {outputsOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <IconFolder size={14} />
          <span>Outputs ({outputs.length})</span>
        </button>
        {outputsOpen &&
          outputs.map((file) => (
            <button
              key={file.id}
              className="cowork-file-explorer__item"
              onClick={() => onSelectFile(file)}
            >
              <IconFile size={14} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.fileName}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", flexShrink: 0 }}>
                {formatBytes(file.sizeBytes)}
              </span>
            </button>
          ))}
      </div>
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
