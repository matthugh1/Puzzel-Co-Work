/**
 * Claude (Anthropic) adapter for the LLM provider abstraction (Part 5).
 * Converts between canonical format and Claude Messages API format.
 * @see Plan/llm-provider-abstraction-spec.md Section 4
 */

import type { LLMProviderAdapter, StreamAdapter } from "./interface";
import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalToolDefinition,
  CanonicalToolChoice,
  CanonicalContentBlock,
  CanonicalStreamEvent,
  CanonicalError,
  CanonicalStopReason,
} from "../types";

const CLAUDE_MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-20250514",
  opus: "claude-opus-4-20251101",
  haiku: "claude-haiku-4-20251001",
};

function mapClaudeStopReason(reason: string): CanonicalStopReason {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

/** Stub stream adapter: processes chunks into canonical events (full impl when wiring stream). */
class ClaudeStreamAdapter implements StreamAdapter {
  private buffer: CanonicalContentBlock[] = [];
  private messageId = "";

  processChunk(_chunk: unknown): CanonicalStreamEvent[] {
    return [];
  }

  getFinalMessage(): CanonicalMessage {
    return {
      id: this.messageId || "claude-stream",
      role: "assistant",
      content: this.buffer,
    };
  }

  reset(): void {
    this.buffer = [];
    this.messageId = "";
  }
}

export const claudeAdapter: LLMProviderAdapter = {
  providerId: "anthropic",

  resolveModel(canonicalModel: string): string {
    const lower = canonicalModel.toLowerCase();
    return CLAUDE_MODEL_MAP[lower] ?? canonicalModel;
  },

  toProviderTools(tools: CanonicalToolDefinition[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
  },

  toProviderMessages(messages: CanonicalMessage[]): unknown[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content.map((block) => {
        switch (block.type) {
          case "text":
            return { type: "text", text: block.text };
          case "tool_use":
            return {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input,
            };
          case "tool_result":
            return {
              type: "tool_result",
              tool_use_id: block.toolUseId,
              content: block.content,
              is_error: block.isError,
            };
          case "image":
            return { type: "image", source: block.source };
          default:
            return block;
        }
      }),
    }));
  },

  toProviderSystemPrompt(prompt: string): unknown {
    return prompt;
  },

  toProviderToolChoice(choice: CanonicalToolChoice): unknown {
    switch (choice.type) {
      case "auto":
        return { type: "auto" };
      case "any":
        return { type: "any" };
      case "specific":
        return { type: "tool", name: choice.name };
      case "none":
        return undefined;
      default:
        return { type: "auto" };
    }
  },

  buildRequest(canonical: CanonicalRequest): unknown {
    return {
      model: this.resolveModel(canonical.model),
      system: this.toProviderSystemPrompt(canonical.systemPrompt),
      messages: this.toProviderMessages(canonical.messages),
      tools:
        canonical.tools.length > 0
          ? this.toProviderTools(canonical.tools)
          : undefined,
      tool_choice: canonical.toolChoice
        ? this.toProviderToolChoice(canonical.toolChoice)
        : undefined,
      max_tokens: canonical.maxTokens ?? 8192,
      temperature: canonical.temperature,
      stream: canonical.stream,
    };
  },

  fromProviderResponse(response: unknown): CanonicalMessage {
    const r = response as {
      id?: string;
      content?: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
      stop_reason?: string;
    };
    const content: CanonicalContentBlock[] = (r.content ?? []).map((block) => {
      if (block.type === "text")
        return { type: "text", text: block.text ?? "" };
      if (block.type === "tool_use")
        return {
          type: "tool_use",
          id: block.id ?? "",
          name: block.name ?? "",
          input: block.input ?? {},
        };
      return { type: "text", text: "" };
    });
    return {
      id: r.id ?? "claude-msg",
      role: "assistant",
      content,
      metadata: {
        model: r.model,
        provider: "anthropic",
        tokenUsage:
          r.usage != null
            ? { input: r.usage.input_tokens, output: r.usage.output_tokens }
            : undefined,
        stopReason: r.stop_reason
          ? mapClaudeStopReason(r.stop_reason)
          : undefined,
      },
    };
  },

  createStreamAdapter(): StreamAdapter {
    return new ClaudeStreamAdapter();
  },

  normaliseError(error: unknown): CanonicalError {
    const e = error as
      | { status?: number; code?: string; message?: string }
      | undefined;
    const message = e?.message ?? String(error);
    const code = e?.code ?? (e?.status === 429 ? "rate_limit" : "unknown");
    return {
      code: code === "rate_limit" ? "rate_limit" : "unknown",
      message,
      retryable: e?.status === 429,
      providerCode: e?.code,
      providerMessage: e?.message,
    };
  },
};
