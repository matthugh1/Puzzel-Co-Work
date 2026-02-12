/**
 * OpenAI adapter for the LLM provider abstraction (Part 5).
 * Converts between canonical format and OpenAI Chat Completions format.
 * Enforces strict schema for tool parameters (required for OpenAI).
 * @see Plan/llm-provider-abstraction-spec.md Section 5
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
  CanonicalToolInputSchema,
} from "../types";

const OPENAI_MODEL_MAP: Record<string, string> = {
  sonnet: "gpt-4o",
  opus: "gpt-4o",
  haiku: "gpt-4o-mini",
};

/** Make schema strict for OpenAI: additionalProperties: false, all properties required, optional → nullable. */
function enforceStrictSchema(schema: CanonicalToolInputSchema): Record<string, unknown> {
  if (schema.type !== "object") return schema as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const allPropertyNames = Object.keys(properties);
  const strictProperties: Record<string, unknown> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const p = prop as Record<string, unknown>;
    strictProperties[key] = !required.includes(key) && p.type !== undefined
      ? { ...p, type: Array.isArray(p.type) ? [...(p.type as string[]), "null"] : [p.type, "null"] }
      : p;
  }
  return {
    type: "object",
    properties: strictProperties,
    required: allPropertyNames,
    additionalProperties: false,
  };
}

function mapOpenAIStopReason(
  finishReason: string | undefined,
): CanonicalStopReason {
  switch (finishReason) {
    case "stop":
      return "end_turn";
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}

/** Stub stream adapter for OpenAI (full impl when wiring stream). */
class OpenAIStreamAdapter implements StreamAdapter {
  private buffer: CanonicalContentBlock[] = [];
  private messageId = "";

  processChunk(_chunk: unknown): CanonicalStreamEvent[] {
    return [];
  }

  getFinalMessage(): CanonicalMessage {
    return {
      id: this.messageId || "openai-stream",
      role: "assistant",
      content: this.buffer,
    };
  }

  reset(): void {
    this.buffer = [];
    this.messageId = "";
  }
}

export const openaiAdapter: LLMProviderAdapter = {
  providerId: "openai",

  resolveModel(canonicalModel: string): string {
    const lower = canonicalModel.toLowerCase();
    return OPENAI_MODEL_MAP[lower] ?? canonicalModel;
  },

  toProviderTools(tools: CanonicalToolDefinition[]): unknown[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: enforceStrictSchema(tool.inputSchema),
        strict: true,
      },
    }));
  },

  toProviderMessages(messages: CanonicalMessage[]): unknown[] {
    const result: unknown[] = [];
    for (const msg of messages) {
      if (msg.role === "system") {
        result.push({
          role: "system",
          content: (msg.content[0] as { type: "text"; text: string } | undefined)?.text ?? "",
        });
        continue;
      }
      const toolResults = msg.content.filter((b) => b.type === "tool_result");
      const otherContent = msg.content.filter((b) => b.type !== "tool_result");
      for (const block of toolResults) {
        if (block.type !== "tool_result") continue;
        result.push({
          role: "tool",
          tool_call_id: block.toolUseId,
          content: block.isError ? `Error: ${block.content}` : block.content,
        });
      }
      if (otherContent.length > 0) {
        const content = otherContent.map((block) => {
          if (block.type === "text") return { type: "text", text: block.text };
          if (block.type === "tool_use")
            return {
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: JSON.stringify(block.input),
            };
          return { type: "text", text: "" };
        });
        result.push({ role: msg.role as "user" | "assistant", content });
      }
    }
    return result;
  },

  toProviderSystemPrompt(prompt: string): unknown {
    return prompt;
  },

  toProviderToolChoice(choice: CanonicalToolChoice): unknown {
    switch (choice.type) {
      case "auto":
        return "auto";
      case "any":
        return "required";
      case "specific":
        return { type: "function", function: { name: choice.name } };
      case "none":
        return "none";
      default:
        return "auto";
    }
  },

  buildRequest(canonical: CanonicalRequest): unknown {
    const messages: unknown[] = [
      { role: "system", content: canonical.systemPrompt },
      ...this.toProviderMessages(canonical.messages),
    ];
    return {
      model: this.resolveModel(canonical.model),
      messages,
      tools:
        canonical.tools.length > 0 ? this.toProviderTools(canonical.tools) : undefined,
      tool_choice: canonical.toolChoice
        ? this.toProviderToolChoice(canonical.toolChoice)
        : undefined,
      max_tokens: canonical.maxTokens ?? 8192,
      temperature: canonical.temperature,
      stream: canonical.stream,
    };
  },

  fromProviderResponse(response: unknown): CanonicalMessage {
    type OpenAIChoice = {
      message?: {
        content?: string;
        tool_calls?: Array<{
          id: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    };
    const r = response as { id?: string; choices?: OpenAIChoice[] };
    const msg = r.choices?.[0]?.message;
    const content: CanonicalContentBlock[] = [];
    if (msg?.content) content.push({ type: "text", text: msg.content });
    for (const tc of msg?.tool_calls ?? []) {
      const name = tc.function?.name ?? "";
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function?.arguments ?? "{}");
      } catch {
        // ignore
      }
      content.push({ type: "tool_use", id: tc.id, name, input });
    }
    return {
      id: r.id ?? "openai-msg",
      role: "assistant",
      content,
      metadata: { provider: "openai" },
    };
  },

  createStreamAdapter(): StreamAdapter {
    return new OpenAIStreamAdapter();
  },

  normaliseError(error: unknown): CanonicalError {
    const e = error as { status?: number; code?: string; message?: string } | undefined;
    const message = e?.message ?? String(error);
    const code = e?.status === 429 ? "rate_limit" : e?.code === "invalid_api_key" ? "auth" : "unknown";
    return {
      code: code === "rate_limit" ? "rate_limit" : code === "auth" ? "auth" : "unknown",
      message,
      retryable: e?.status === 429,
      providerCode: e?.code,
      providerMessage: e?.message,
    };
  },
};
