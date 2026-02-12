/**
 * Canonical internal format for the LLM provider abstraction (Part 5).
 * Application code uses only these types; adapters convert to/from provider formats.
 * @see Plan/llm-provider-abstraction-spec.md
 */

/** Standard JSON Schema object for tool input (provider-agnostic). */
export interface CanonicalToolInputSchema {
  type: "object";
  properties?: Record<string, { type?: string; description?: string; [k: string]: unknown }>;
  required?: string[];
  additionalProperties?: boolean;
  [k: string]: unknown;
}

export interface CanonicalToolDefinition {
  name: string;
  description: string;
  inputSchema: CanonicalToolInputSchema;
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
    openWorld?: boolean;
  };
}

export type CanonicalStopReason = "end_turn" | "tool_use" | "max_tokens" | "error";

export interface CanonicalTextBlock {
  type: "text";
  text: string;
}

export interface CanonicalToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface CanonicalToolResultBlock {
  type: "tool_result";
  toolUseId: string;
  content: string;
  isError: boolean;
}

export interface CanonicalImageBlock {
  type: "image";
  source: {
    type: "base64";
    mediaType: string;
    data: string;
  };
}

export type CanonicalContentBlock =
  | CanonicalTextBlock
  | CanonicalToolUseBlock
  | CanonicalToolResultBlock
  | CanonicalImageBlock;

export interface CanonicalMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: CanonicalContentBlock[];
  metadata?: {
    model?: string;
    provider?: string;
    tokenUsage?: { input: number; output: number };
    stopReason?: CanonicalStopReason;
  };
}

export type CanonicalStreamEvent =
  | { type: "message_start"; messageId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input_delta"; id: string; partialJson: string }
  | { type: "tool_use_end"; id: string }
  | {
      type: "message_end";
      stopReason: CanonicalStopReason;
      usage?: { input: number; output: number };
    }
  | { type: "error"; code: string; message: string };

export type CanonicalToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "specific"; name: string }
  | { type: "none" };

export interface CanonicalRequest {
  model: string;
  systemPrompt: string;
  messages: CanonicalMessage[];
  tools: CanonicalToolDefinition[];
  toolChoice?: CanonicalToolChoice;
  maxTokens?: number;
  temperature?: number;
  stream: boolean;
}

export interface CanonicalError {
  code:
    | "rate_limit"
    | "auth"
    | "invalid_request"
    | "server_error"
    | "timeout"
    | "context_length"
    | "tool_error"
    | "unknown";
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
  providerCode?: string;
  providerMessage?: string;
}
