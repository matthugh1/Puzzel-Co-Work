/**
 * Tool System Types
 * Common interfaces for all Cowork tools
 */

export type PermissionLevel = "auto" | "ask" | "blocked";

export interface ToolContext {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string; // Absolute path to session's storage directory
  planMode: boolean; // If true, only read-only tools allowed
  sendEvent?: (eventType: string, data: unknown) => void; // Optional SSE event sender for tools that need to emit events
}

export interface ToolResult {
  content: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutor {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  permissionLevel: PermissionLevel;
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>; // JSON Schema for Anthropic
  parameters?: Record<string, unknown>; // JSON Schema for OpenAI (legacy)
}
