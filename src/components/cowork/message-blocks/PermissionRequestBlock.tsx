"use client";

import { useState, useCallback } from "react";
import { useCowork } from "@/lib/cowork/context";
import { IconAlertTriangle } from "@/components/cowork/icons";

export function PermissionRequestBlock({
  requestId,
  sessionId,
  title,
  description,
}: {
  requestId: string;
  sessionId: string;
  title: string;
  description: string;
}) {
  const [resolved, setResolved] = useState<"approved" | "denied" | null>(null);
  const [loading, setLoading] = useState(false);
  const { dispatch } = useCowork();

  const handleResolve = useCallback(
    async (approved: boolean) => {
      setLoading(true);
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        await fetch(`/api/cowork/sessions/${sessionId}/permissions/${requestId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.token,
          },
          body: JSON.stringify({ approved }),
        });

        setResolved(approved ? "approved" : "denied");
        dispatch({ type: "SET_PENDING_PERMISSION", payload: null });
      } catch (err) {
        console.error("Permission resolve error:", err);
      } finally {
        setLoading(false);
      }
    },
    [requestId, sessionId, dispatch],
  );

  return (
    <div className="cowork-interactive-card cowork-interactive-card--permission">
      <div className="cowork-interactive-card__title">
        <IconAlertTriangle size={16} />
        {title}
      </div>
      <div className="cowork-interactive-card__body">
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: "0.8125rem" }}>
          {description}
        </pre>
      </div>
      <div className="cowork-interactive-card__actions">
        {resolved ? (
          <span style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: resolved === "approved" ? "var(--cw-success)" : "var(--cw-danger)",
          }}>
            {resolved === "approved" ? "Allowed" : "Denied"}
          </span>
        ) : (
          <>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={() => handleResolve(true)}
              disabled={loading}
            >
              {loading ? "..." : "Allow"}
            </button>
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--danger"
              onClick={() => handleResolve(false)}
              disabled={loading}
            >
              {loading ? "..." : "Deny"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
