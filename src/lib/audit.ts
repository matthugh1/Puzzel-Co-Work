/**
 * Audit logging service
 * Logs all significant actions in the system for compliance and tracking
 */

import { db } from "./db";
import type { Prisma } from "@prisma/client";

export type ResourceType =
  | "user"
  | "auth"
  | "organization"
  | "cowork_session"
  | "cowork_skill";

export interface AuditEntry {
  action: string;
  resourceType: ResourceType;
  resourceId: string;
  userId: string;
  organizationId?: string; // Nullable for system-level audits
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Core audit logging function
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        organizationId: entry.organizationId || null,
        details: (entry.details as Prisma.InputJsonValue) ?? undefined,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (error) {
    // Don't throw - audit logging failures shouldn't break the application
    console.error("Failed to log audit entry:", error);
  }
}

/**
 * Extract IP address from request headers
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0];
    if (firstIp) {
      return firstIp.trim();
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  return undefined;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get("user-agent") || undefined;
}

/**
 * Convenience functions for common audit actions
 */
export const audit = {
  // Authentication
  authLogin: (
    userId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "auth.login",
      resourceType: "auth",
      resourceId: userId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  authLogout: (
    userId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "auth.logout",
      resourceType: "auth",
      resourceId: userId,
      userId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  authFailed: (
    email: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "auth.failed",
      resourceType: "auth",
      resourceId: email,
      userId: "system", // Failed login doesn't have a user ID
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // User management
  userCreated: (
    userId: string,
    createdBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "user.created",
      resourceType: "user",
      resourceId: userId,
      userId: createdBy,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userUpdated: (
    userId: string,
    updatedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "user.updated",
      resourceType: "user",
      resourceId: userId,
      userId: updatedBy,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  userDeleted: (
    userId: string,
    deletedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "user.deleted",
      resourceType: "user",
      resourceId: userId,
      userId: deletedBy,
      organizationId: metadata?.organizationId as string | undefined,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Organization management
  organizationCreated: (
    organizationId: string,
    createdBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "organization.created",
      resourceType: "organization",
      resourceId: organizationId,
      userId: createdBy,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  organizationUpdated: (
    organizationId: string,
    updatedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "organization.updated",
      resourceType: "organization",
      resourceId: organizationId,
      userId: updatedBy,
      organizationId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  memberAdded: (
    organizationId: string,
    userId: string,
    addedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "organization.member.added",
      resourceType: "organization",
      resourceId: organizationId,
      userId: addedBy,
      organizationId,
      details: { memberUserId: userId, ...metadata },
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  memberRemoved: (
    organizationId: string,
    userId: string,
    removedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "organization.member.removed",
      resourceType: "organization",
      resourceId: organizationId,
      userId: removedBy,
      organizationId,
      details: { memberUserId: userId, ...metadata },
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  memberRoleUpdated: (
    organizationId: string,
    userId: string,
    updatedBy: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "organization.member.role.updated",
      resourceType: "organization",
      resourceId: organizationId,
      userId: updatedBy,
      organizationId,
      details: { memberUserId: userId, ...metadata },
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  // Cowork session management
  coworkSessionCreated: (
    sessionId: string,
    userId: string,
    organizationId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "cowork_session.created",
      resourceType: "cowork_session",
      resourceId: sessionId,
      userId,
      organizationId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  coworkSessionDeleted: (
    sessionId: string,
    userId: string,
    organizationId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "cowork_session.deleted",
      resourceType: "cowork_session",
      resourceId: sessionId,
      userId,
      organizationId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  coworkSessionUpdated: (
    sessionId: string,
    userId: string,
    organizationId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "cowork_session.updated",
      resourceType: "cowork_session",
      resourceId: sessionId,
      userId,
      organizationId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),

  coworkSkillUpdated: (
    skillId: string,
    userId: string,
    organizationId: string,
    metadata?: Record<string, unknown>,
    request?: Request,
  ) =>
    logAudit({
      action: "cowork_skill.updated",
      resourceType: "cowork_skill",
      resourceId: skillId,
      userId,
      organizationId,
      details: metadata,
      ipAddress: request ? getIpAddress(request) : undefined,
      userAgent: request ? getUserAgent(request) : undefined,
    }),
};
