/**
 * Plan Store
 * In-memory storage for pending plans (similar to permission system)
 */

export interface PendingPlan {
  planId: string;
  sessionId: string;
  plan: string;
  steps: Array<{
    id: string;
    description: string;
    status: "pending" | "in_progress" | "completed";
  }>;
  createdAt: number;
}

const pendingPlans = new Map<string, PendingPlan>();

/**
 * Store a pending plan
 */
export function storePlan(plan: PendingPlan): void {
  pendingPlans.set(plan.planId, plan);
}

/**
 * Get a pending plan
 */
export function getPlan(planId: string): PendingPlan | null {
  return pendingPlans.get(planId) || null;
}

/**
 * Remove a pending plan
 */
export function removePlan(planId: string): boolean {
  return pendingPlans.delete(planId);
}

/**
 * Clean up old plans (older than 1 hour)
 */
export function cleanupOldPlans(): void {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour

  for (const [planId, plan] of pendingPlans.entries()) {
    if (now - plan.createdAt > maxAge) {
      pendingPlans.delete(planId);
    }
  }
}

// Clean up old plans every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldPlans, 30 * 60 * 1000);
}
