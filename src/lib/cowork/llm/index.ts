/**
 * LLM provider abstraction layer (Part 5 rebuild guide).
 * Public API: use canonical types and getAdapter() for provider-specific conversion.
 * @see Plan/llm-provider-abstraction-spec.md
 */

export * from "./types";
export { getAdapter, getSupportedProviders } from "./provider-manager";
export type { ProviderId } from "./provider-manager";
export type { LLMProviderAdapter, StreamAdapter } from "./adapters/interface";
export { claudeAdapter } from "./adapters/claude";
export { openaiAdapter } from "./adapters/openai";
