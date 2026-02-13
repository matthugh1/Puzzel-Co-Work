"use client";

import { useCallback } from "react";
import { useCowork, useCoworkActions } from "@/lib/cowork/context";
import { IconFile } from "@/components/cowork/icons";

export function ArtifactBlock({
  artifactId,
  fileName,
  renderType,
}: {
  artifactId: string;
  fileName: string;
  renderType?: string;
}) {
  const { state } = useCowork();
  const actions = useCoworkActions();

  const handleClick = useCallback(() => {
    // Look up the file record from outputs
    const file = state.files.outputs.find(
      (f) => f.id === artifactId || f.fileName === fileName,
    );
    if (file) {
      actions.setActiveArtifact(file);
      actions.openRightPanel();
    }
  }, [artifactId, fileName, state.files.outputs, actions]);

  return (
    <button className="cowork-artifact-chip" onClick={handleClick}>
      <IconFile size={14} />
      <span>{fileName}</span>
      {renderType && (
        <span
          style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}
        >
          {renderType}
        </span>
      )}
    </button>
  );
}
