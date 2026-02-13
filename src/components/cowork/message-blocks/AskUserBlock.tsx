"use client";

import { useState, useCallback } from "react";
import { useCowork } from "@/lib/cowork/context";
import { IconAlertTriangle } from "@/components/cowork/icons";

export function AskUserBlock({
  questionId,
  sessionId,
  question,
}: {
  questionId: string;
  sessionId: string;
  question:
    | {
        id: string;
        prompt: string;
        options: Array<{ id: string; label: string }>;
        allowMultiple?: boolean;
      }
    | undefined;
}) {
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string>
  >({});
  const [resolved, setResolved] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const { dispatch } = useCowork();

  if (!question) {
    return null;
  }

  const handleOptionToggle = (optionId: string, label: string) => {
    if (question.allowMultiple) {
      // Multi-select: toggle
      setSelectedAnswers((prev) => {
        const next = { ...prev };
        if (next[optionId]) {
          delete next[optionId];
        } else {
          next[optionId] = label;
        }
        return next;
      });
    } else {
      // Single-select: replace
      setSelectedAnswers({ [optionId]: label });
    }
  };

  const handleSubmit = useCallback(async () => {
    if (Object.keys(selectedAnswers).length === 0) {
      return; // No selection made
    }

    setLoading(true);
    try {
      const csrfRes = await fetch("/api/csrf-token");
      const csrfData = await csrfRes.json();

      await fetch(`/api/cowork/sessions/${sessionId}/questions/${questionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.token,
        },
        body: JSON.stringify({ answers: selectedAnswers }),
      });

      setResolved(true);
      dispatch({ type: "SET_PENDING_QUESTION", payload: null });
    } catch (err) {
      console.error("Answer question error:", err);
    } finally {
      setLoading(false);
    }
  }, [questionId, sessionId, selectedAnswers, dispatch]);

  return (
    <div className="cowork-interactive-card cowork-interactive-card--question">
      <div className="cowork-interactive-card__title">
        <IconAlertTriangle size={16} />
        Question
      </div>
      <div className="cowork-interactive-card__body">{question.prompt}</div>
      {resolved ? (
        <div className="cowork-interactive-card__actions">
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--cw-success)",
            }}
          >
            Answered: {Object.values(selectedAnswers).join(", ")}
          </span>
        </div>
      ) : (
        <>
          <div className="cw-ask-options-list" style={{ padding: "0 14px" }}>
            {question.options.map((opt) => {
              const isSelected = !!selectedAnswers[opt.id];
              return (
                <label
                  key={opt.id}
                  className={`cw-ask-option${isSelected ? " cw-ask-option--selected" : ""}`}
                >
                  <input
                    type={question.allowMultiple ? "checkbox" : "radio"}
                    name={`question_${questionId}`}
                    checked={isSelected}
                    onChange={() => handleOptionToggle(opt.id, opt.label)}
                    style={{ cursor: "pointer" }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          <div className="cowork-interactive-card__actions">
            <button
              className="cowork-interactive-card__btn cowork-interactive-card__btn--primary"
              onClick={handleSubmit}
              disabled={loading || Object.keys(selectedAnswers).length === 0}
            >
              {loading ? "..." : "Submit"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
