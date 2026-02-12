/**
 * Provider adapter interface for the LLM abstraction layer (Part 5).
 * Each provider (Claude, OpenAI) implements this interface.
 * @see Plan/llm-provider-abstraction-spec.md
 */

import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalToolDefinition,
  CanonicalToolChoice,
  CanonicalStreamEvent,
  CanonicalError,
} from "../types";

export interface StreamAdapter {
  /** Process a raw provider SSE chunk and emit canonical events. */
  processChunk(chunk: unknown): CanonicalStreamEvent[];

  /** Get the final assembled message after stream completes. */
  getFinalMessage(): CanonicalMessage;

  /** Reset state for new stream. */
  reset(): void;
}

export interface LLMProviderAdapter {
  readonly providerId: string;

  /** Map canonical model name to provider-specific model string. */
  resolveModel(canonicalModel: string): string;

  /** Convert canonical tool definitions to provider format. */
  toProviderTools(tools: CanonicalToolDefinition[]): unknown[];

  /** Convert canonical messages to provider message format. */
  toProviderMessages(messages: CanonicalMessage[]): unknown[];

  /** Convert canonical system prompt to provider format. */
  toProviderSystemPrompt(prompt: string): unknown;

  /** Convert canonical tool choice to provider format. */
  toProviderToolChoice(choice: CanonicalToolChoice): unknown;

  /** Build the full provider-specific API request body. */
  buildRequest(canonical: CanonicalRequest): unknown;

  /** Parse a non-streaming provider response into canonical messages. */
  fromProviderResponse(response: unknown): CanonicalMessage;

  /** Create a streaming event transformer. */
  createStreamAdapter(): StreamAdapter;

  /** Normalise provider errors into canonical error format. */
  normaliseError(error: unknown): CanonicalError;
}
