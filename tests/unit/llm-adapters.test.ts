/**
 * Part 18: Minimal unit tests for the LLM provider abstraction layer.
 */
import { describe, it, expect } from "vitest";
import { getAdapter, getSupportedProviders } from "@/lib/cowork/llm/index";

describe("LLM provider abstraction", () => {
  it("getSupportedProviders returns anthropic and openai", () => {
    const providers = getSupportedProviders();
    expect(providers).toContain("anthropic");
    expect(providers).toContain("openai");
    expect(providers).toHaveLength(2);
  });

  it("getAdapter('anthropic') resolves model names", () => {
    const adapter = getAdapter("anthropic");
    expect(adapter.providerId).toBe("anthropic");
    expect(adapter.resolveModel("sonnet")).toBe("claude-sonnet-4-20250514");
    expect(adapter.resolveModel("opus")).toBe("claude-opus-4-20251101");
    expect(adapter.resolveModel("claude-sonnet-4-20250514")).toBe("claude-sonnet-4-20250514");
  });

  it("getAdapter('openai') resolves model names", () => {
    const adapter = getAdapter("openai");
    expect(adapter.providerId).toBe("openai");
    expect(adapter.resolveModel("sonnet")).toBe("gpt-4o");
    expect(adapter.resolveModel("haiku")).toBe("gpt-4o-mini");
  });

  it("getAdapter throws for unknown provider", () => {
    expect(() => getAdapter("unknown" as "anthropic")).toThrow("Unknown LLM provider");
  });
});
