/**
 * Question Store
 * Handles pending user questions and answer resolutions
 */

import type { AskQuestion } from "@/types/cowork";

export interface PendingQuestion {
  questionId: string;
  question: AskQuestion;
  resolve: (answers: Record<string, string>) => void;
  reject: (error: Error) => void;
  createdAt: number;
}

// In-memory storage for pending questions
// In production, this would use Redis pub/sub or similar
const pendingQuestions = new Map<string, PendingQuestion>();

/**
 * Store a pending question and return a promise that resolves when answered
 */
export async function storePendingQuestion(
  questionId: string,
  question: AskQuestion,
): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const pending: PendingQuestion = {
      questionId,
      question,
      resolve,
      reject,
      createdAt: Date.now(),
    };

    // Store the resolver
    pendingQuestions.set(questionId, pending);

    // Timeout after 5 minutes
    setTimeout(
      () => {
        if (pendingQuestions.has(questionId)) {
          pendingQuestions.delete(questionId);
          reject(new Error("Question request timed out"));
        }
      },
      5 * 60 * 1000,
    );
  });
}

/**
 * Resolve a pending question with user answers
 */
export function resolveQuestion(
  questionId: string,
  answers: Record<string, string>,
): boolean {
  const pending = pendingQuestions.get(questionId);
  if (!pending) {
    return false; // Question not found or already resolved
  }

  pendingQuestions.delete(questionId);
  pending.resolve(answers);
  return true;
}

/**
 * Get pending question details
 */
export function getPendingQuestion(questionId: string): AskQuestion | null {
  const pending = pendingQuestions.get(questionId);
  return pending ? pending.question : null;
}

/**
 * Clean up old questions (older than 10 minutes)
 */
export function cleanupOldQuestions(): void {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [questionId, pending] of pendingQuestions.entries()) {
    if (now - pending.createdAt > maxAge) {
      pendingQuestions.delete(questionId);
      pending.reject(new Error("Question request expired"));
    }
  }
}

// Clean up old questions every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldQuestions, 5 * 60 * 1000);
}
