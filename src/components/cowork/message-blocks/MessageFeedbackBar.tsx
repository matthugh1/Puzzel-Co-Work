"use client";

import { useState, useCallback } from "react";
import { useCowork } from "@/lib/cowork/context";
import {
  IconThumbsUp,
  IconThumbsDown,
  IconCheckCircle,
} from "@/components/cowork/icons";

export interface MessageFeedbackBarProps {
  messageId: string;
  sessionId: string;
  existingFeedback?: {
    rating: "positive" | "negative";
    comment?: string | null;
  } | null;
}

export function MessageFeedbackBar({
  messageId,
  sessionId,
  existingFeedback,
}: MessageFeedbackBarProps) {
  const { dispatch } = useCowork();
  const [rating, setRating] = useState<"positive" | "negative" | null>(
    existingFeedback?.rating ?? null,
  );
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState(existingFeedback?.comment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const submitFeedback = useCallback(
    async (value: "positive" | "negative", optionalComment?: string) => {
      setSubmitting(true);
      setNotFound(false);
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfData = await csrfRes.json();

        const res = await fetch(
          `/api/cowork/sessions/${sessionId}/messages/${messageId}/feedback`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfData.token,
            },
            body: JSON.stringify({
              rating: value,
              comment: optionalComment?.trim() || undefined,
            }),
          },
        );

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to submit feedback");
        }

        setRating(value);
        setSubmitted(true);
        setShowForm(false);
        dispatch({
          type: "SET_MESSAGE_FEEDBACK",
          payload: { messageId, rating: value },
        });
      } catch (err) {
        console.error("Feedback submit error:", err);
      } finally {
        setSubmitting(false);
      }
    },
    [messageId, sessionId, dispatch],
  );

  const handleThumbsUp = useCallback(() => {
    if (submitted || submitting) return;
    submitFeedback("positive");
  }, [submitted, submitting, submitFeedback]);

  const handleThumbsDown = useCallback(() => {
    if (submitted || submitting) return;
    setShowForm(true);
  }, [submitted, submitting]);

  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitted || submitting) return;
      submitFeedback("negative", comment);
    },
    [comment, submitted, submitting, submitFeedback],
  );

  if (submitted) {
    return (
      <div
        className="cowork-message-feedback"
        role="group"
        aria-label="Message feedback"
      >
        <span
          className="cowork-message-feedback__btn cowork-message-feedback__btn--submitted"
          aria-label="Feedback sent"
        >
          <IconCheckCircle size={14} />
          <span style={{ marginLeft: 4, fontSize: "0.75rem" }}>
            Feedback sent
          </span>
        </span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="cowork-message-feedback" role="group">
        <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
          Feedback unavailable for this message.
        </span>
      </div>
    );
  }

  return (
    <div
      className="cowork-message-feedback"
      role="group"
      aria-label="Rate this message"
    >
      <button
        type="button"
        className={`cowork-message-feedback__btn ${rating === "positive" ? "cowork-message-feedback__btn--active" : ""}`}
        onClick={handleThumbsUp}
        disabled={submitting}
        aria-label="Good response"
        title="Good response"
      >
        <IconThumbsUp size={14} />
      </button>
      <button
        type="button"
        className={`cowork-message-feedback__btn ${rating === "negative" ? "cowork-message-feedback__btn--active" : ""}`}
        onClick={handleThumbsDown}
        disabled={submitting}
        aria-label="Something went wrong"
        title="Something went wrong"
      >
        <IconThumbsDown size={14} />
      </button>

      {showForm && (
        <form
          className="cowork-message-feedback__form"
          onSubmit={handleFormSubmit}
          aria-label="What went wrong?"
        >
          <label htmlFor={`feedback-comment-${messageId}`} className="sr-only">
            What went wrong? (optional)
          </label>
          <textarea
            id={`feedback-comment-${messageId}`}
            className="cowork-message-feedback__input"
            placeholder="What went wrong? (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={submitting}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              className="cowork-message-feedback__submit"
              disabled={submitting}
            >
              {submitting ? "Sending…" : "Submit feedback"}
            </button>
            <button
              type="button"
              className="cowork-message-feedback__btn"
              onClick={() => setShowForm(false)}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
