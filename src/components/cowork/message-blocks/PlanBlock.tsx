"use client";

import { useState, useCallback } from "react";
import { useCowork } from "@/lib/cowork/context";
import { IconList } from "@/components/cowork/icons";

export function PlanBlock({
  planId,
  sessionId,
  title,
  steps,
  status,
}: {
  planId: string;
  sessionId: string;
  title: string;
  steps: Array<{ id?: string; description: string; status?: string }>;
  status?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(
    status === "approved"
      ? "approved"
      : status === "rejected"
        ? "rejected"
        : null,
  );
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(
    steps.map((s) => s.description).join("\n"),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const { dispatch } = useCowork();

  const handlePlanAction = useCallback(
    async (action: "approve" | "reject") => {
      setActionError(null);
      setLoading(true);
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        const res = await fetch(
          `/api/cowork/sessions/${sessionId}/plan/${action}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfData.token,
            },
            body: JSON.stringify({ planId }),
          },
        );

        if (res.ok) {
          setResolved(action === "approve" ? "approved" : "rejected");
          dispatch({ type: "SET_PENDING_PLAN", payload: null });
          if (action === "approve") {
            dispatch({
              type: "UPDATE_SESSION",
              payload: { id: sessionId, planMode: false },
            });
          }
        } else {
          const data = await res.json().catch(() => ({}));
          if (res.status === 404 && data.code === "PLAN_NOT_FOUND") {
            setActionError(
              data.error ||
                "Plan expired or already resolved. Ask the assistant to propose a new plan.",
            );
          } else {
            setActionError(data.error || `Request failed (${res.status})`);
          }
        }
      } catch (err) {
        console.error("Plan action error:", err);
        setActionError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [planId, sessionId, dispatch],
  );

  const handleEditSubmit = useCallback(async () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setActionError(null);
    setLoading(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();
      const res = await fetch(`/api/cowork/sessions/${sessionId}/plan/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({ planId, editedPlan: trimmed }),
      });
      if (res.ok) {
        setResolved("approved");
        setEditing(false);
        dispatch({ type: "SET_PENDING_PLAN", payload: null });
        dispatch({
          type: "UPDATE_SESSION",
          payload: { id: sessionId, planMode: false },
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setActionError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      console.error("Plan edit error:", err);
      setActionError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [planId, sessionId, editText, dispatch]);

  return (
    <div className="cowork-interactive-card cowork-interactive-card--plan">
      <div className="cowork-interactive-card__title">
        <IconList size={16} />
        {title || "Plan"}
      </div>
      {editing ? (
        <>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={6}
            className="cw-plan-edit-textarea"
            aria-label="Edit plan steps (one per line)"
          />
          <div className="cowork-interactive-card__actions cw-plan-actions">
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={handleEditSubmit}
              disabled={loading || !editText.trim()}
            >
              {loading ? "..." : "Save and approve"}
            </button>
            <button
              className="cowork-interactive-card__btn"
              onClick={() => {
                setEditing(false);
                setEditText(steps.map((s) => s.description).join("\n"));
              }}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <ol
            className="cw-plan-list"
            style={{
              margin: "8px 0",
              paddingLeft: 20,
              fontSize: "0.875rem",
              lineHeight: 1.7,
            }}
          >
            {steps.map((step, i) => (
              <li
                key={step.id || i}
                style={{
                  color:
                    step.status === "completed"
                      ? "var(--cw-success)"
                      : step.status === "in_progress"
                        ? "var(--cw-accent)"
                        : undefined,
                }}
              >
                {step.description}
              </li>
            ))}
          </ol>
          <div className="cowork-interactive-card__actions">
            {actionError && (
              <p
                className="cw-plan-action-error"
                style={{
                  margin: "0 0 8px",
                  fontSize: "0.8125rem",
                  color: "var(--color-text-secondary)",
                }}
              >
                {actionError}
              </p>
            )}
            {resolved ? (
              <span
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  color:
                    resolved === "approved"
                      ? "var(--cw-success)"
                      : "var(--cw-danger)",
                }}
              >
                {resolved === "approved" ? "Plan approved" : "Plan rejected"}
              </span>
            ) : (
              <>
                <button
                  className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
                  onClick={() => handlePlanAction("approve")}
                  disabled={loading}
                >
                  {loading ? "..." : "Approve"}
                </button>
                <button
                  className="cowork-interactive-card__btn"
                  onClick={() => {
                    setActionError(null);
                    setEditing(true);
                    setEditText(steps.map((s) => s.description).join("\n"));
                  }}
                  disabled={loading}
                >
                  Edit
                </button>
                <button
                  className="cowork-interactive-card__btn cowork-interactive-card__btn--danger"
                  onClick={() => handlePlanAction("reject")}
                  disabled={loading}
                >
                  {loading ? "..." : "Reject"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
