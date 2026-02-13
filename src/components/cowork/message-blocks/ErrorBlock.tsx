"use client";

import { IconAlertTriangle } from "@/components/cowork/icons";

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="cowork-interactive-card cowork-interactive-card--error">
      <div className="cowork-interactive-card__title" style={{ color: "var(--cw-danger)" }}>
        <IconAlertTriangle size={16} />
        Error
      </div>
      <div className="cowork-interactive-card__body">{message}</div>
    </div>
  );
}
