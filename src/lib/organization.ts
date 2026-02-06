/**
 * Organization context utilities
 * Handles organization membership, admin checks, and context extraction
 */

import { db } from "./db";
import { getUserFromRequest } from "./auth";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

/**
 * Get organization from JWT token (stored in user.organizationId)
 */
export async function getOrganizationFromRequest(
  request: Request,
): Promise<Organization | null> {
  const user = await getUserFromRequest(request);
  if (!user || !user.organizationId) {
    return null;
  }

  const org = await db.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!org || !org.isActive) {
    return null;
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    isActive: org.isActive,
  };
}

/**
 * Require organization context - throws error if not found
 */
export async function requireOrganization(
  request: Request,
): Promise<Organization> {
  const org = await getOrganizationFromRequest(request);
  if (!org) {
    throw new Error("Organization context required");
  }
  return org;
}

/**
 * Check if user is member of organization
 */
export async function isOrganizationMember(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await db.organizationUser.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });
  return !!membership;
}

/**
 * Check if user is organization admin
 */
export async function isOrganizationAdmin(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const membership = await db.organizationUser.findFirst({
    where: {
      userId,
      organizationId,
      role: {
        name: "admin",
      },
    },
  });
  return !!membership;
}

/**
 * Get user's organizations
 */
export async function getUserOrganizations(
  userId: string,
): Promise<Organization[]> {
  const memberships = await db.organizationUser.findMany({
    where: { userId },
    include: { organization: true },
  });
  return memberships
    .filter((m) => m.organization.isActive)
    .map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      isActive: m.organization.isActive,
    }));
}
