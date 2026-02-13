"use client";

import { useState, useEffect, useCallback } from "react";
import { IconChevronDown, IconChevronRight } from "@/components/cowork/icons";

export interface SessionFeedbackItem {
  id: string;
  messageId: string;
  rating: string;
  comment: string | null;
  createdAt: string;
}

interface FeedbackSummarySectionProps {
  sessionId: string | null;
  messageIdsInOrder?: string[];
}

export function FeedbackSummarySection({
  sessionId,
  messageIdsInOrder = [],
}: FeedbackSummarySectionProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<SessionFeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!sessionId) {
      setFeedback([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/cowork/sessions/${sessionId}/feedback`);
      if (res.ok) {
        const data = await res.json();
        setFeedback(data.feedback || []);
      } else {
        setFeedback([]);
      }
    } catch {
      setFeedback([]);
    } finally {
      setLoading(false);
      setHasFetched(true);
    }
  }, [sessionId]);

  // Fetch once on mount (to know if there's feedback to show the section)
  useEffect(() => {
    if (sessionId && !hasFetched) {
      fetchFeedback();
    }
  }, [sessionId, hasFetched, fetchFeedback]);

  // Re-fetch when opened
  useEffect(() => {
    if (open && sessionId) {
      fetchFeedback();
    }
  }, [open, sessionId, fetchFeedback]);

  const negativeFeedback = feedback.filter((f) => f.rating === "negative");

  // If we've fetched and there's no feedback, hide the section entirely
  if (hasFetched && negativeFeedback.length === 0 && !open) {
    return null;
  }

  const getMessageLabel = (messageId: string): string => {
    const idx = messageIdsInOrder.indexOf(messageId);
    if (idx >= 0) return `Message #${idx + 1}`;
    return "Message";
  };

  return (
    <section className="cowork-right-panel__section">
      <button
        type="button"
        className="cowork-right-panel__section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {open ? (
          <IconChevronDown size={14} aria-hidden />
        ) : (
          <IconChevronRight size={14} aria-hidden />
        )}
        <span>Feedback</span>
        {negativeFeedback.length > 0 && !open && (
          <span className="cowork-right-panel__section-badge" aria-label={`${negativeFeedback.length} issues flagged`}>
            {negativeFeedback.length}
          </span>
        )}
      </button>
      {open && (
        <div className="cowork-right-panel__section-content cw-rpanel-animate-in">
          {loading ? (
            <div className="cowork-right-panel__empty">
              <span>Loading feedback...</span>
            </div>
          ) : negativeFeedback.length === 0 ? (
            <div className="cowork-right-panel__empty">
              <span>No issues flagged in this session</span>
            </div>
          ) : (
            <>
              <p className="cw-rpanel-feedback-count">
                {negativeFeedback.length} message{negativeFeedback.length !== 1 ? "s" : ""} flagged
              </p>
              <ul className="cw-rpanel-feedback-list">
                {negativeFeedback.map((f) => (
                  <li key={f.id} className="cw-rpanel-feedback-item">
                    <span className="cw-rpanel-feedback-item__label">
                      {getMessageLabel(f.messageId)}:
                    </span>{" "}
                    {f.comment?.trim() || "No comment"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
