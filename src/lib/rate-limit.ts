/**
 * Rate limiting utilities
 * Prevents abuse and brute force attacks
 */

import { NextResponse } from "next/server";

// In-memory rate limit store (for single-instance deployments)
// For production multi-instance, use Redis or similar
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier?: (request: Request) => string; // Custom identifier function
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  // General API endpoints
  API: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
} as const;

/**
 * Get identifier for rate limiting
 * Uses IP address or user ID if available
 */
function getIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP address
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0];
    if (firstIp) {
      return `ip:${firstIp.trim()}`;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return `ip:${realIp}`;
  }

  // Fallback to a default identifier (less secure)
  return "unknown";
}

/**
 * Check if request is within rate limit
 */
function checkRateLimit(
  identifier: string,
  windowMs: number,
  maxRequests: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetAt) {
    // Create new record
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  // Increment count
  record.count += 1;
  rateLimitStore.set(identifier, record);

  if (record.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Rate limit middleware
 * Returns error response if rate limited, null if allowed
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig,
  userId?: string,
): NextResponse | null {
  const identifier = config.identifier
    ? config.identifier(request)
    : getIdentifier(request, userId);

  const result = checkRateLimit(
    identifier,
    config.windowMs,
    config.maxRequests,
  );

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
          "X-RateLimit-Limit": config.maxRequests.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
        },
      },
    );
  }

  return null;
}

/**
 * Track failed login attempts (for account locking)
 */
const failedLoginAttempts = new Map<
  string,
  { count: number; resetAt: number }
>();

export function trackFailedLogin(email: string): {
  locked: boolean;
  attempts: number;
  resetAt: number;
} {
  const now = Date.now();
  const key = `failed_login:${email}`;
  const record = failedLoginAttempts.get(key);

  if (!record || now > record.resetAt) {
    // First failed attempt
    const resetAt = now + 15 * 60 * 1000; // 15 minutes
    failedLoginAttempts.set(key, { count: 1, resetAt });
    return { locked: false, attempts: 1, resetAt };
  }

  // Increment failed attempts
  record.count += 1;
  failedLoginAttempts.set(key, record);

  // Lock account after 5 failed attempts
  const locked = record.count >= 5;

  return {
    locked,
    attempts: record.count,
    resetAt: record.resetAt,
  };
}

/**
 * Clear failed login attempts (on successful login)
 */
export function clearFailedLoginAttempts(email: string): void {
  failedLoginAttempts.delete(`failed_login:${email}`);
}
