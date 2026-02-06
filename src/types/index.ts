/**
 * Shared TypeScript types
 */

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}
