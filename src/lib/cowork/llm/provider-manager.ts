/**
 * Provider registry and selection for the LLM abstraction layer (Part 5).
 * Application code uses getAdapter(providerId) to obtain the correct adapter.
 */

import type { LLMProviderAdapter } from "./adapters/interface";
import { claudeAdapter } from "./adapters/claude";
import { openaiAdapter } from "./adapters/openai";

export type ProviderId = "anthropic" | "openai";

const adapters: Record<ProviderId, LLMProviderAdapter> = {
  anthropic: claudeAdapter,
  openai: openaiAdapter,
};

export function getAdapter(providerId: ProviderId): LLMProviderAdapter {
  const adapter = adapters[providerId];
  if (!adapter) throw new Error(`Unknown LLM provider: ${providerId}`);
  return adapter;
}

export function getSupportedProviders(): ProviderId[] {
  return Object.keys(adapters) as ProviderId[];
}
