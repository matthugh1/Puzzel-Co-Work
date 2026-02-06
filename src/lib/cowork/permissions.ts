/**
 * Permission System
 * Handles permission requests and resolutions for tool execution
 */

export interface PermissionRequest {
  requestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  createdAt: number;
}

export interface PermissionResolver {
  requestPermission(request: PermissionRequest): Promise<boolean>;
}

// In-memory storage for pending permission requests
// In production, this would use Redis pub/sub or similar
const pendingRequests = new Map<string, {
  resolve: (approved: boolean) => void;
  reject: (error: Error) => void;
  request: PermissionRequest;
}>();

/**
 * Request permission for a tool execution
 * Returns a promise that resolves when the user approves/denies
 */
export async function requestPermission(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request: PermissionRequest = {
      requestId,
      toolName,
      toolInput,
      createdAt: Date.now(),
    };

    // Store the resolver
    pendingRequests.set(requestId, {
      resolve,
      reject,
      request,
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Permission request timed out"));
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Resolve a pending permission request
 */
export function resolvePermission(requestId: string, approved: boolean): boolean {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return false; // Request not found or already resolved
  }

  pendingRequests.delete(requestId);
  pending.resolve(approved);
  return true;
}

/**
 * Get pending request details
 */
export function getPendingRequest(requestId: string): PermissionRequest | null {
  const pending = pendingRequests.get(requestId);
  return pending ? pending.request : null;
}

/**
 * Clean up old requests (older than 10 minutes)
 */
export function cleanupOldRequests(): void {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes

  for (const [requestId, { request }] of pendingRequests.entries()) {
    if (now - request.createdAt > maxAge) {
      const pending = pendingRequests.get(requestId);
      if (pending) {
        pendingRequests.delete(requestId);
        pending.reject(new Error("Permission request expired"));
      }
    }
  }
}

// Clean up old requests every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldRequests, 5 * 60 * 1000);
}
