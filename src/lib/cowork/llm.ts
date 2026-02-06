/**
 * Cowork LLM Service
 * Unified streaming interface for Anthropic (Claude) and OpenAI.
 * Server-only — never import this in client code.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LLMProvider = "anthropic" | "openai";

export interface LLMStreamConfig {
  provider: LLMProvider;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onDone: (fullText: string, usage?: TokenUsage) => void;
  onError: (error: string) => void;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ---------------------------------------------------------------------------
// Available models registry
// ---------------------------------------------------------------------------

export const PROVIDERS: Record<
  LLMProvider,
  { label: string; models: { id: string; label: string; contextWindow: string }[] }
> = {
  anthropic: {
    label: "Anthropic (Claude)",
    models: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", contextWindow: "200K" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4", contextWindow: "200K" },
      { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet", contextWindow: "200K" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", contextWindow: "200K" },
    ],
  },
  openai: {
    label: "OpenAI",
    models: [
      { id: "gpt-4o", label: "GPT-4o", contextWindow: "128K" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", contextWindow: "128K" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", contextWindow: "128K" },
      { id: "o3-mini", label: "o3 Mini", contextWindow: "200K" },
    ],
  },
};

export function getDefaultProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "anthropic"; // fallback
}

export function getDefaultModel(provider: LLMProvider): string {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
    case "openai":
      return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }
}

// ---------------------------------------------------------------------------
// Client singletons
// ---------------------------------------------------------------------------

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ---------------------------------------------------------------------------
// Streaming — Anthropic
// ---------------------------------------------------------------------------

const COWORK_SYSTEM_PROMPT = `You are Cowork, an AI assistant built into the Puzzel Co-Work platform. You help users accomplish tasks by planning, executing, and delivering results.

Key behaviours:
- Be concise and helpful. Avoid unnecessary preamble.
- Use markdown formatting for readability (bold, lists, code blocks).
- When a task is complex, break it into steps and work through them.
- Ask clarifying questions when the request is ambiguous.
- Be honest about limitations.`;

async function streamAnthropic(
  messages: ChatMessage[],
  config: LLMStreamConfig,
  callbacks: StreamCallbacks,
): Promise<void> {
  const client = getAnthropicClient();
  const systemPrompt = config.systemPrompt || COWORK_SYSTEM_PROMPT;

  try {
    const stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    let fullText = "";

    stream.on("text", (text) => {
      fullText += text;
      callbacks.onToken(text);
    });

    const finalMessage = await stream.finalMessage();

    const usage: TokenUsage = {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    };

    callbacks.onDone(fullText, usage);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Cowork LLM] Anthropic streaming error:", msg);
    callbacks.onError(msg);
  }
}

// ---------------------------------------------------------------------------
// Streaming — OpenAI
// ---------------------------------------------------------------------------

async function streamOpenAI(
  messages: ChatMessage[],
  config: LLMStreamConfig,
  callbacks: StreamCallbacks,
): Promise<void> {
  const client = getOpenAIClient();
  const systemPrompt = config.systemPrompt || COWORK_SYSTEM_PROMPT;

  try {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    const stream = await client.chat.completions.create({
      model: config.model,
      messages: openaiMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = "";
    let usage: TokenUsage | undefined;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        callbacks.onToken(delta);
      }

      // Usage comes in the final chunk
      if (chunk.usage) {
        usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        };
      }
    }

    callbacks.onDone(fullText, usage);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Cowork LLM] OpenAI streaming error:", msg);
    callbacks.onError(msg);
  }
}

// ---------------------------------------------------------------------------
// Unified streaming entry point
// ---------------------------------------------------------------------------

/**
 * Stream a chat completion from any supported LLM provider.
 * Returns a ReadableStream suitable for an SSE response.
 */
export function streamChat(
  messages: ChatMessage[],
  config: LLMStreamConfig,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        const payload = JSON.stringify({ type: eventType, ...( typeof data === 'object' && data !== null ? data : { data }) });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const assistantMessageId = `msg_${Date.now()}`;
      send("message_start", { messageId: assistantMessageId, role: "assistant" });

      const callbacks: StreamCallbacks = {
        onToken(text) {
          send("content_delta", { text });
        },
        onDone(fullText, usage) {
          send("message_end", {
            messageId: assistantMessageId,
            tokenUsage: usage
              ? { input: usage.inputTokens, output: usage.outputTokens }
              : undefined,
          });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
        onError(error) {
          send("error", { code: "llm_error", message: error });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      };

      switch (config.provider) {
        case "anthropic":
          await streamAnthropic(messages, config, callbacks);
          break;
        case "openai":
          await streamOpenAI(messages, config, callbacks);
          break;
        default:
          callbacks.onError(`Unsupported provider: ${config.provider}`);
      }
    },
  });
}

/**
 * Check which providers are configured (have API keys set).
 */
export function getConfiguredProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];
  if (process.env.ANTHROPIC_API_KEY) providers.push("anthropic");
  if (process.env.OPENAI_API_KEY) providers.push("openai");
  return providers;
}
