/**
 * Permission System
 * DB-backed permission requests for tool execution (survives restarts, multi-instance).
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: number;
}

const POLL_INTERVAL_MS = 500;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function getTimeoutMs(): number {
  const env = process.env.COWORK_PERMISSION_TIMEOUT_MS;
  if (env != null) {
    const n = parseInt(env, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_TIMEOUT_MS;
}

/**
 * Request permission for a tool execution.
 * Creates a DB record and polls until the user approves/denies via the API or timeout.
 */
export async function requestPermission(
  sessionId: string,
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<boolean> {
  const timeoutMs = getTimeoutMs();

  await db.coworkPermissionRequest.create({
    data: {
      sessionId,
      requestId,
      toolName,
      toolInput: toolInput as Prisma.InputJsonValue,
      status: "pending",
    },
  });

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const row = await db.coworkPermissionRequest.findFirst({
      where: { sessionId, requestId },
      select: { status: true },
    });

    if (!row) {
      throw new Error("Permission request record not found");
    }

    if (row.status === "approved") return true;
    if (row.status === "denied" || row.status === "timeout") return false;

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  await db.coworkPermissionRequest.updateMany({
    where: { sessionId, requestId, status: "pending" },
    data: { status: "timeout", resolvedAt: new Date() },
  });

  throw new Error("Permission request timed out");
}

/**
 * Resolve a pending permission request (called from API route).
 * Updates the DB record so the polling requestPermission() sees it.
 */
export async function resolvePermission(
  sessionId: string,
  requestId: string,
  approved: boolean,
): Promise<boolean> {
  const updated = await db.coworkPermissionRequest.updateMany({
    where: { sessionId, requestId, status: "pending" },
    data: {
      status: approved ? "approved" : "denied",
      resolvedAt: new Date(),
    },
  });
  return updated.count > 0;
}

/**
 * Get pending request details by requestId (optional; for backwards compatibility).
 * Looks up any session with this requestId.
 */
export async function getPendingRequest(
  requestId: string,
): Promise<PermissionRequest | null> {
  const row = await db.coworkPermissionRequest.findFirst({
    where: { requestId, status: "pending" },
    select: { toolName: true, toolInput: true, createdAt: true },
  });
  if (!row) return null;
  return {
    requestId,
    toolName: row.toolName,
    toolInput: (row.toolInput as Record<string, unknown>) ?? {},
    createdAt: row.createdAt.getTime(),
  };
}
