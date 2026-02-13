# LLM Provider Abstraction Layer — Full Specification

> **Purpose:** This document specifies the abstraction layer needed to make the Cowork web app work with multiple LLM providers (Claude, OpenAI, and future providers) without changing any application logic. Hand this to Cursor alongside the main Cowork spec and build it as a foundational layer before wiring up any LLM calls.

> **Problem:** The Cowork web app was built against Claude's tool calling API. When switching to OpenAI, tool calling fails because the two providers use fundamentally different JSON formats for tool definitions, tool call messages, tool results, streaming events, and error handling. This spec defines a canonical internal format and bidirectional adapters for each provider.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Canonical Internal Format](#2-canonical-internal-format)
3. [Provider Adapter Interface](#3-provider-adapter-interface)
4. [Claude Adapter](#4-claude-adapter)
5. [OpenAI Adapter](#5-openai-adapter)
6. [Streaming Adapter](#6-streaming-adapter)
7. [Behaviour Differences & Compensations](#7-behaviour-differences--compensations)
8. [Provider Configuration](#8-provider-configuration)
9. [Error Normalisation](#9-error-normalisation)
10. [Testing Strategy](#10-testing-strategy)
11. [Adding a New Provider](#11-adding-a-new-provider)

---

## 1. Architecture Overview

### The Problem in Detail

The app currently sends tool definitions and processes responses in Claude's format. OpenAI uses a different format at every level:

| Layer                   | Claude Format                                                            | OpenAI Format                                                                                    | Breaks? |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ------- |
| Tool definition         | `{ name, description, input_schema }`                                    | `{ type: "function", function: { name, description, parameters } }`                              | **Yes** |
| Tool call (response)    | Content block: `{ type: "tool_use", id, name, input: {} }`               | Message field: `tool_calls: [{ id, type: "function", function: { name, arguments: "string" } }]` | **Yes** |
| Tool result (send back) | Content block: `{ type: "tool_result", tool_use_id, content, is_error }` | Separate message: `{ role: "tool", tool_call_id, content }`                                      | **Yes** |
| Arguments format        | JSON object                                                              | JSON string (must `JSON.parse()`)                                                                | **Yes** |
| Strict mode             | Optional, lenient requirements                                           | Requires `additionalProperties: false` + all fields `required`                                   | **Yes** |
| Streaming               | `content_block_start/delta/stop`                                         | `response.function_call_arguments.delta/done`                                                    | **Yes** |
| Error signalling        | `is_error: true` field on tool_result                                    | No explicit field; inferred from content                                                         | **Yes** |
| Parallel tool control   | Native, no parameter                                                     | `parallel_tool_calls: true/false` parameter                                                      | **Yes** |

### Solution: Adapter Pattern

```
┌──────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                         │
│                                                              │
│  Chat Engine, Tool Executor, Sub-Agent Orchestrator, etc.    │
│                                                              │
│  All code works with CANONICAL FORMAT only.                  │
│  Never touches provider-specific JSON.                       │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                    Canonical Format
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                   PROVIDER ADAPTER LAYER                      │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Claude Adapter   │  │ OpenAI Adapter   │  │ Future...    │ │
│  │                 │  │                 │  │              │ │
│  │ toProviderTool  │  │ toProviderTool  │  │              │ │
│  │ toProviderMsg   │  │ toProviderMsg   │  │              │ │
│  │ fromProviderMsg │  │ fromProviderMsg │  │              │ │
│  │ streamAdapter   │  │ streamAdapter   │  │              │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                  Provider-Specific Format
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                     LLM PROVIDER APIs                         │
│                                                              │
│  Claude Messages API    OpenAI Chat Completions / Responses  │
└──────────────────────────────────────────────────────────────┘
```

### Key Principle

**The application layer never sees provider-specific JSON.** All tool definitions, messages, tool calls, tool results, and streaming events use the canonical format. The adapter is the only place where provider-specific logic lives.

---

## 2. Canonical Internal Format

This is the single format used throughout the application. It is inspired by Claude's format (since the app was originally built for it) but is provider-agnostic.

### 2.1 Canonical Tool Definition

```typescript
interface CanonicalToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema; // Standard JSON Schema object
  annotations?: {
    readOnly?: boolean;
    destructive?: boolean;
    idempotent?: boolean;
    openWorld?: boolean;
  };
}

// Example
const readTool: CanonicalToolDefinition = {
  name: "Read",
  description: "Read file contents from the filesystem",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the file",
      },
      offset: {
        type: "number",
        description: "Line number to start reading from",
      },
      limit: {
        type: "number",
        description: "Number of lines to read",
      },
    },
    required: ["file_path"],
    // Note: NO additionalProperties here — adapters add it if needed
  },
};
```

### 2.2 Canonical Message Format

```typescript
interface CanonicalMessage {
  id: string; // Internal message ID
  role: "user" | "assistant" | "system";
  content: CanonicalContentBlock[];
  metadata?: {
    model?: string;
    provider?: string;
    tokenUsage?: { input: number; output: number };
    stopReason?: CanonicalStopReason;
  };
}

type CanonicalStopReason = "end_turn" | "tool_use" | "max_tokens" | "error";

type CanonicalContentBlock =
  | CanonicalTextBlock
  | CanonicalToolUseBlock
  | CanonicalToolResultBlock
  | CanonicalImageBlock;

interface CanonicalTextBlock {
  type: "text";
  text: string;
}

interface CanonicalToolUseBlock {
  type: "tool_use";
  id: string; // Unique tool call ID
  name: string; // Tool name
  input: Record<string, any>; // Parsed JSON object (NEVER a string)
}

interface CanonicalToolResultBlock {
  type: "tool_result";
  toolUseId: string; // References the tool_use ID
  content: string; // Result content (always string)
  isError: boolean; // Explicit error flag
}

interface CanonicalImageBlock {
  type: "image";
  source: {
    type: "base64";
    mediaType: string;
    data: string;
  };
}
```

### 2.3 Canonical Streaming Events

```typescript
type CanonicalStreamEvent =
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
```

### 2.4 Canonical Request

```typescript
interface CanonicalRequest {
  model: string; // Canonical model name (mapped by adapter)
  systemPrompt: string;
  messages: CanonicalMessage[];
  tools: CanonicalToolDefinition[];
  toolChoice?: CanonicalToolChoice;
  maxTokens?: number;
  temperature?: number;
  stream: boolean;
}

type CanonicalToolChoice =
  | { type: "auto" } // Model decides
  | { type: "any" } // Must call a tool (any tool)
  | { type: "specific"; name: string } // Must call this specific tool
  | { type: "none" }; // No tool calling
```

---

## 3. Provider Adapter Interface

Every provider must implement this interface:

```typescript
interface LLMProviderAdapter {
  /** Provider identifier */
  readonly providerId: string; // 'claude' | 'openai' | etc.

  /** Map canonical model name to provider-specific model string */
  resolveModel(canonicalModel: string): string;

  /** Convert canonical tool definitions to provider format */
  toProviderTools(tools: CanonicalToolDefinition[]): any[];

  /** Convert canonical messages to provider message format */
  toProviderMessages(messages: CanonicalMessage[]): any[];

  /** Convert canonical system prompt to provider format */
  toProviderSystemPrompt(prompt: string): any;

  /** Convert canonical tool choice to provider format */
  toProviderToolChoice(choice: CanonicalToolChoice): any;

  /** Build the full provider-specific API request body */
  buildRequest(canonical: CanonicalRequest): any;

  /** Parse a non-streaming provider response into canonical messages */
  fromProviderResponse(response: any): CanonicalMessage;

  /** Create a streaming event transformer */
  createStreamAdapter(): StreamAdapter;

  /** Normalise provider errors into canonical error format */
  normaliseError(error: any): CanonicalError;
}

interface StreamAdapter {
  /** Process a raw provider SSE chunk and emit canonical events */
  processChunk(chunk: any): CanonicalStreamEvent[];

  /** Get the final assembled message after stream completes */
  getFinalMessage(): CanonicalMessage;

  /** Reset state for new stream */
  reset(): void;
}

interface CanonicalError {
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
  providerCode?: string; // Original provider error code
  providerMessage?: string; // Original provider message
}
```

---

## 4. Claude Adapter

### 4.1 Model Mapping

```typescript
const CLAUDE_MODEL_MAP: Record<string, string> = {
  sonnet: "claude-sonnet-4-5-20250929",
  opus: "claude-opus-4-5-20251101",
  haiku: "claude-haiku-4-5-20251001",
  // Allow pass-through of full model strings
};
```

### 4.2 Tool Definition Conversion

```typescript
// Canonical → Claude (minimal transformation)
function toProviderTools(tools: CanonicalToolDefinition[]): ClaudeTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
    // Claude doesn't require additionalProperties: false
  }));
}
```

### 4.3 Message Conversion

```typescript
// Canonical → Claude
function toProviderMessages(messages: CanonicalMessage[]): ClaudeMessage[] {
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
            input: block.input, // Already an object — no conversion needed
          };

        case "tool_result":
          return {
            type: "tool_result",
            tool_use_id: block.toolUseId,
            content: block.content,
            is_error: block.isError,
          };

        case "image":
          return {
            type: "image",
            source: block.source,
          };
      }
    }),
  }));
}
```

### 4.4 Claude System Prompt

```typescript
// Claude uses a top-level 'system' field
function toProviderSystemPrompt(prompt: string): string {
  return prompt; // Used as: { system: prompt } in request body
}
```

### 4.5 Tool Choice Conversion

```typescript
function toProviderToolChoice(choice: CanonicalToolChoice): any {
  switch (choice.type) {
    case "auto":
      return { type: "auto" };
    case "any":
      return { type: "any" };
    case "specific":
      return { type: "tool", name: choice.name };
    case "none":
      return undefined; // Omit tools entirely
  }
}
```

### 4.6 Full Request Builder

```typescript
function buildRequest(canonical: CanonicalRequest): any {
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
}
```

### 4.7 Response Parsing

```typescript
function fromProviderResponse(response: any): CanonicalMessage {
  return {
    id: response.id,
    role: "assistant",
    content: response.content.map((block: any) => {
      switch (block.type) {
        case "text":
          return { type: "text", text: block.text };
        case "tool_use":
          return {
            type: "tool_use",
            id: block.id,
            name: block.name,
            input: block.input, // Already an object
          };
      }
    }),
    metadata: {
      model: response.model,
      provider: "claude",
      tokenUsage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      stopReason: mapClaudeStopReason(response.stop_reason),
    },
  };
}

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
```

---

## 5. OpenAI Adapter

This is where most of the transformation work happens.

### 5.1 Model Mapping

```typescript
const OPENAI_MODEL_MAP: Record<string, string> = {
  sonnet: "gpt-4o", // Comparable tier
  opus: "gpt-4o", // Or 'o3' / 'gpt-5' if available
  haiku: "gpt-4o-mini", // Comparable tier
  // Allow pass-through of full model strings
};
```

### 5.2 Tool Definition Conversion (CRITICAL)

This is where most failures happen. OpenAI wraps tools in a `function` object and has strict schema requirements.

```typescript
function toProviderTools(tools: CanonicalToolDefinition[]): OpenAITool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: enforceStrictSchema(tool.inputSchema),
      strict: true, // Enable structured outputs
    },
  }));
}

/**
 * CRITICAL: OpenAI strict mode requires:
 * 1. Every object must have additionalProperties: false
 * 2. Every property must be in the 'required' array
 * 3. Optional properties must use nullable types instead
 *
 * This function transforms a canonical schema into a strict-compatible one.
 */
function enforceStrictSchema(schema: JSONSchema): JSONSchema {
  if (schema.type !== "object") return schema;

  const properties = schema.properties ?? {};
  const required = schema.required ?? [];
  const allPropertyNames = Object.keys(properties);

  // Transform each property
  const strictProperties: Record<string, any> = {};
  for (const [key, prop] of Object.entries(properties)) {
    strictProperties[key] = enforceStrictSchemaRecursive(prop as JSONSchema);

    // If property was optional, make it nullable instead
    if (!required.includes(key)) {
      strictProperties[key] = makeNullable(strictProperties[key]);
    }
  }

  return {
    type: "object",
    properties: strictProperties,
    required: allPropertyNames, // ALL properties required
    additionalProperties: false, // MUST be false
  };
}

function enforceStrictSchemaRecursive(schema: JSONSchema): JSONSchema {
  if (schema.type === "object" && schema.properties) {
    return enforceStrictSchema(schema); // Recurse into nested objects
  }
  if (schema.type === "array" && schema.items) {
    return {
      ...schema,
      items: enforceStrictSchemaRecursive(schema.items as JSONSchema),
    };
  }
  return schema;
}

function makeNullable(schema: JSONSchema): JSONSchema {
  // Convert { type: "string" } to { type: ["string", "null"] }
  if (typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }
  // Already an array of types — add 'null' if not present
  if (Array.isArray(schema.type) && !schema.type.includes("null")) {
    return { ...schema, type: [...schema.type, "null"] };
  }
  return schema;
}
```

**Why this matters:** Without this transformation, OpenAI will reject the API call with a `400 Invalid schema for strict mode` error. Every optional parameter in the canonical format (like `offset` on the Read tool, `model` on sub-agents, `schedule` on shortcuts) needs to become a nullable required field.

### 5.3 Message Conversion (CRITICAL)

Claude and OpenAI structure messages completely differently. This is the most complex adapter.

```typescript
function toProviderMessages(messages: CanonicalMessage[]): OpenAIMessage[] {
  const result: OpenAIMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      // System messages handled separately in OpenAI
      result.push({ role: "system", content: msg.content[0]?.text ?? "" });
      continue;
    }

    if (msg.role === "user") {
      // Check if this message contains tool results
      const toolResults = msg.content.filter((b) => b.type === "tool_result");
      const otherContent = msg.content.filter((b) => b.type !== "tool_result");

      // Tool results become separate 'tool' role messages in OpenAI
      for (const result_ of toolResults) {
        const tr = result_ as CanonicalToolResultBlock;
        result.push({
          role: "tool",
          tool_call_id: tr.toolUseId,
          content: tr.isError
            ? `Error: ${tr.content}` // OpenAI has no is_error flag
            : tr.content,
        });
      }

      // Non-tool content stays as a user message
      if (otherContent.length > 0) {
        result.push({
          role: "user",
          content: otherContent
            .map((block) => {
              if (block.type === "text")
                return { type: "text", text: block.text };
              if (block.type === "image")
                return {
                  type: "image_url",
                  image_url: {
                    url: `data:${block.source.mediaType};base64,${block.source.data}`,
                  },
                };
            })
            .filter(Boolean),
        });
      }
      continue;
    }

    if (msg.role === "assistant") {
      const textBlocks = msg.content.filter((b) => b.type === "text");
      const toolUses = msg.content.filter(
        (b) => b.type === "tool_use",
      ) as CanonicalToolUseBlock[];

      const assistantMsg: any = {
        role: "assistant",
        content:
          textBlocks.length > 0
            ? textBlocks.map((b) => (b as CanonicalTextBlock).text).join("")
            : null,
      };

      // Tool uses become tool_calls array (not content blocks)
      if (toolUses.length > 0) {
        assistantMsg.tool_calls = toolUses.map((tu) => ({
          id: tu.id,
          type: "function",
          function: {
            name: tu.name,
            arguments: JSON.stringify(tu.input), // MUST stringify for OpenAI
          },
        }));
      }

      result.push(assistantMsg);
      continue;
    }
  }

  return result;
}
```

**Key transformations:**

| Canonical                                     | OpenAI                                        | What Changes                               |
| --------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `tool_use` content block in assistant message | `tool_calls` array field on assistant message | Moves from content to top-level field      |
| `input: { key: "value" }` (object)            | `arguments: '{"key":"value"}'` (string)       | Must `JSON.stringify()`                    |
| `tool_result` content block in user message   | Separate message with `role: "tool"`          | Becomes its own message                    |
| `toolUseId`                                   | `tool_call_id`                                | Field name changes                         |
| `isError: true`                               | No field; prefix content with "Error:"        | Must encode error status in content string |
| Image as `source.data` base64                 | Image as `image_url` with data URI            | Different image format                     |

### 5.4 OpenAI System Prompt

```typescript
// OpenAI uses a system message in the messages array
function toProviderSystemPrompt(prompt: string): any {
  // Returns as first message in the array
  return { role: "system", content: prompt };
}
```

### 5.5 Tool Choice Conversion

```typescript
function toProviderToolChoice(choice: CanonicalToolChoice): any {
  switch (choice.type) {
    case "auto":
      return "auto";
    case "any":
      return "required";
    case "specific":
      return { type: "function", function: { name: choice.name } };
    case "none":
      return "none";
  }
}
```

### 5.6 Full Request Builder

```typescript
function buildRequest(canonical: CanonicalRequest): any {
  const messages = this.toProviderMessages(canonical.messages);

  // Prepend system prompt as first message
  if (canonical.systemPrompt) {
    messages.unshift({ role: "system", content: canonical.systemPrompt });
  }

  return {
    model: this.resolveModel(canonical.model),
    messages,
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
    parallel_tool_calls: true, // Enable parallel calling
  };
}
```

### 5.7 Response Parsing

```typescript
function fromProviderResponse(response: any): CanonicalMessage {
  const choice = response.choices[0];
  const assistantMsg = choice.message;
  const content: CanonicalContentBlock[] = [];

  // Text content
  if (assistantMsg.content) {
    content.push({ type: "text", text: assistantMsg.content });
  }

  // Tool calls → canonical tool_use blocks
  if (assistantMsg.tool_calls) {
    for (const tc of assistantMsg.tool_calls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments), // MUST parse from string
      });
    }
  }

  return {
    id: response.id,
    role: "assistant",
    content,
    metadata: {
      model: response.model,
      provider: "openai",
      tokenUsage: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
      stopReason: mapOpenAIStopReason(choice.finish_reason),
    },
  };
}

function mapOpenAIStopReason(reason: string): CanonicalStopReason {
  switch (reason) {
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
```

---

## 6. Streaming Adapter

### 6.1 Claude Stream Adapter

```typescript
class ClaudeStreamAdapter implements StreamAdapter {
  private currentMessage: Partial<CanonicalMessage> = {};
  private contentBlocks: CanonicalContentBlock[] = [];
  private currentToolUse: Partial<CanonicalToolUseBlock> | null = null;
  private toolInputBuffer: string = "";

  processChunk(event: any): CanonicalStreamEvent[] {
    const events: CanonicalStreamEvent[] = [];

    switch (event.type) {
      case "message_start":
        this.currentMessage = {
          id: event.message.id,
          role: "assistant",
          content: [],
        };
        events.push({ type: "message_start", messageId: event.message.id });
        break;

      case "content_block_start":
        if (event.content_block.type === "text") {
          // Text block starting — no event needed yet
        } else if (event.content_block.type === "tool_use") {
          this.currentToolUse = {
            type: "tool_use",
            id: event.content_block.id,
            name: event.content_block.name,
            input: {},
          };
          this.toolInputBuffer = "";
          events.push({
            type: "tool_use_start",
            id: event.content_block.id,
            name: event.content_block.name,
          });
        }
        break;

      case "content_block_delta":
        if (event.delta.type === "text_delta") {
          events.push({ type: "text_delta", text: event.delta.text });
        } else if (event.delta.type === "input_json_delta") {
          this.toolInputBuffer += event.delta.partial_json;
          events.push({
            type: "tool_use_input_delta",
            id: this.currentToolUse!.id!,
            partialJson: event.delta.partial_json,
          });
        }
        break;

      case "content_block_stop":
        if (this.currentToolUse) {
          try {
            this.currentToolUse.input = JSON.parse(this.toolInputBuffer);
          } catch {
            this.currentToolUse.input = {};
          }
          this.contentBlocks.push(this.currentToolUse as CanonicalToolUseBlock);
          events.push({ type: "tool_use_end", id: this.currentToolUse.id! });
          this.currentToolUse = null;
        }
        break;

      case "message_stop":
        events.push({
          type: "message_end",
          stopReason: mapClaudeStopReason(
            event.message?.stop_reason ?? "end_turn",
          ),
          usage: event.message?.usage
            ? {
                input: event.message.usage.input_tokens,
                output: event.message.usage.output_tokens,
              }
            : undefined,
        });
        break;

      case "message_delta":
        // Usage and stop_reason updates
        if (event.delta?.stop_reason) {
          events.push({
            type: "message_end",
            stopReason: mapClaudeStopReason(event.delta.stop_reason),
            usage: event.usage
              ? {
                  input: event.usage.input_tokens,
                  output: event.usage.output_tokens,
                }
              : undefined,
          });
        }
        break;

      case "error":
        events.push({
          type: "error",
          code: event.error?.type ?? "unknown",
          message: event.error?.message ?? "Unknown streaming error",
        });
        break;
    }

    return events;
  }

  getFinalMessage(): CanonicalMessage {
    /* assemble from buffers */
  }
  reset(): void {
    /* clear all buffers */
  }
}
```

### 6.2 OpenAI Stream Adapter

```typescript
class OpenAIStreamAdapter implements StreamAdapter {
  private currentMessage: Partial<CanonicalMessage> = {};
  private textBuffer: string = "";
  private toolCalls: Map<
    number,
    {
      id: string;
      name: string;
      argumentsBuffer: string;
    }
  > = new Map();

  processChunk(data: any): CanonicalStreamEvent[] {
    const events: CanonicalStreamEvent[] = [];
    const choice = data.choices?.[0];
    if (!choice) return events;

    const delta = choice.delta;

    // Text content delta
    if (delta?.content) {
      this.textBuffer += delta.content;
      events.push({ type: "text_delta", text: delta.content });
    }

    // Tool call deltas
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const index = tc.index;

        if (tc.id) {
          // New tool call starting
          this.toolCalls.set(index, {
            id: tc.id,
            name: tc.function?.name ?? "",
            argumentsBuffer: tc.function?.arguments ?? "",
          });
          events.push({
            type: "tool_use_start",
            id: tc.id,
            name: tc.function?.name ?? "",
          });
        } else if (tc.function?.arguments) {
          // Argument delta for existing tool call
          const existing = this.toolCalls.get(index);
          if (existing) {
            existing.argumentsBuffer += tc.function.arguments;
            if (tc.function.name) existing.name = tc.function.name;
            events.push({
              type: "tool_use_input_delta",
              id: existing.id,
              partialJson: tc.function.arguments,
            });
          }
        }
      }
    }

    // Stream finished
    if (choice.finish_reason) {
      // Emit tool_use_end for all open tool calls
      for (const [_, tc] of this.toolCalls) {
        events.push({ type: "tool_use_end", id: tc.id });
      }

      events.push({
        type: "message_end",
        stopReason: mapOpenAIStopReason(choice.finish_reason),
        usage: data.usage
          ? {
              input: data.usage.prompt_tokens,
              output: data.usage.completion_tokens,
            }
          : undefined,
      });
    }

    return events;
  }

  getFinalMessage(): CanonicalMessage {
    const content: CanonicalContentBlock[] = [];

    if (this.textBuffer) {
      content.push({ type: "text", text: this.textBuffer });
    }

    for (const [_, tc] of this.toolCalls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: safeJsonParse(tc.argumentsBuffer),
      });
    }

    return {
      id: this.currentMessage.id ?? generateId(),
      role: "assistant",
      content,
      metadata: { provider: "openai" },
    };
  }

  reset(): void {
    this.textBuffer = "";
    this.toolCalls.clear();
    this.currentMessage = {};
  }
}

function safeJsonParse(str: string): Record<string, any> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
```

---

## 7. Behaviour Differences & Compensations

This section covers the non-format differences — places where the models behave differently even when the API format is correct.

### 7.1 Tool Calling Proactivity

| Behaviour                           | Claude                                                 | OpenAI                                        | Compensation                                                                        |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Auto-creates todo list**          | Yes — proactively calls TodoWrite for multi-step tasks | Often skips — describes steps in text instead | Add explicit system prompt instruction for OpenAI (see below)                       |
| **Calls tools without being asked** | Frequently — if context suggests a tool is relevant    | Waits for more explicit signals               | Use `tool_choice: "required"` on first turn when you know a tool call should happen |
| **Parallel tool calls**             | Aggressive — frequently calls 3-5 tools in parallel    | Conservative — usually 1-2 at a time          | Accept this; don't force parallel calls                                             |
| **Reads files before editing**      | Reliably follows the pattern                           | Sometimes skips the read step                 | Add "ALWAYS read before editing" to system prompt for OpenAI                        |

### 7.2 System Prompt Overrides by Provider

Create provider-specific addenda to the system prompt:

```typescript
const PROVIDER_PROMPT_ADDENDA: Record<string, string> = {
  openai: `
## CRITICAL TOOL USAGE RULES (MUST FOLLOW)

You have access to tools and MUST use them actively. Do not describe what you would do — actually do it by calling the appropriate tool.

Specific rules:
1. ALWAYS call TodoWrite at the start of any multi-step task (3+ steps). Do not skip this.
2. ALWAYS call Read before calling Edit on any file. Never edit a file you haven't read.
3. When you need to create a file, call Write — do not put file content in your text response.
4. When multiple independent pieces of information are needed, call multiple tools. Do not serialize unnecessarily.
5. When a task is complete, save the output file and provide the download link. Do not just show the content in chat.
6. When you encounter an error from a tool, try to fix it and retry. Do not give up after one failure.

IMPORTANT: Your responses should be ACTION-oriented. If the user asks you to do something, DO IT by calling tools. Do not just explain how you would do it.
`,

  claude: "", // Claude follows these patterns natively; no addendum needed
};
```

### 7.3 Tool Count Management

```typescript
/**
 * OpenAI accuracy degrades with many tools.
 * If tool count exceeds threshold, use dynamic tool filtering.
 */
const TOOL_COUNT_THRESHOLDS: Record<string, number> = {
  claude: 60, // Claude handles large tool sets well
  openai: 20, // OpenAI accuracy drops significantly above ~20
};

function filterToolsForProvider(
  allTools: CanonicalToolDefinition[],
  provider: string,
  context: { lastUserMessage: string; activeSkills: string[] },
): CanonicalToolDefinition[] {
  const threshold = TOOL_COUNT_THRESHOLDS[provider] ?? 20;

  if (allTools.length <= threshold) return allTools;

  // Priority tiers:
  // 1. Core tools (always included): Read, Write, Edit, Bash, Glob, Grep,
  //    TodoWrite, AskUserQuestion, Task, WebSearch, WebFetch
  // 2. Active skill tools (included if skill is triggered)
  // 3. Connector tools (included if connector is active and relevant)
  // 4. Everything else (included only if under threshold)

  const coreTool = new Set([
    "Read",
    "Write",
    "Edit",
    "Bash",
    "Glob",
    "Grep",
    "TodoWrite",
    "AskUserQuestion",
    "Task",
    "WebSearch",
    "WebFetch",
    "Skill",
    "EnterPlanMode",
    "ExitPlanMode",
  ]);

  const core = allTools.filter((t) => coreTool.has(t.name));
  const skillTools = allTools.filter(
    (t) =>
      !coreTool.has(t.name) &&
      context.activeSkills.some((s) => t.name.startsWith(s)),
  );
  const remaining = allTools.filter(
    (t) => !coreTool.has(t.name) && !skillTools.includes(t),
  );

  const selected = [...core, ...skillTools];
  const budget = threshold - selected.length;

  if (budget > 0) {
    // Use relevance scoring to pick the most useful remaining tools
    selected.push(...remaining.slice(0, budget));
  }

  return selected;
}
```

### 7.4 Retry & Recovery Differences

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

const PROVIDER_RETRY_CONFIG: Record<string, RetryConfig> = {
  claude: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ["rate_limit", "server_error", "timeout"],
  },
  openai: {
    maxRetries: 5, // More retries — OpenAI has more transient failures
    baseDelayMs: 2000, // Longer base delay
    maxDelayMs: 60000,
    retryableErrors: [
      "rate_limit",
      "server_error",
      "timeout",
      "tool_error", // Retry tool_error for the known call_id bug
    ],
  },
};
```

### 7.5 Tool Result Handling

OpenAI is stricter about message ordering after tool calls:

```typescript
/**
 * CRITICAL: OpenAI requires that every tool_call in an assistant message
 * is immediately followed by a matching tool result message.
 * Missing or mismatched results cause a 400 error.
 *
 * Claude is more forgiving — it can handle partial results.
 */
function validateToolResultCompleteness(
  assistantMsg: CanonicalMessage,
  resultMsg: CanonicalMessage,
  provider: string,
): void {
  if (provider !== "openai") return; // Only strict for OpenAI

  const toolUseIds = new Set(
    assistantMsg.content
      .filter((b) => b.type === "tool_use")
      .map((b) => (b as CanonicalToolUseBlock).id),
  );

  const resultIds = new Set(
    resultMsg.content
      .filter((b) => b.type === "tool_result")
      .map((b) => (b as CanonicalToolResultBlock).toolUseId),
  );

  // Every tool_use MUST have a corresponding tool_result
  for (const id of toolUseIds) {
    if (!resultIds.has(id)) {
      throw new Error(
        `Missing tool result for tool_call ${id}. ` +
          `OpenAI requires all tool calls to have matching results.`,
      );
    }
  }
}
```

---

## 8. Provider Configuration

### 8.1 Configuration Schema

```typescript
interface ProviderConfig {
  providerId: string;
  apiKey: string; // From environment / secrets
  apiBaseUrl?: string; // For proxies or custom endpoints
  defaultModel: string; // Canonical model name
  modelMap: Record<string, string>; // Canonical → provider model
  maxTokens: number;
  temperature: number;
  streaming: boolean;
  toolBehaviour: {
    strictMode: boolean; // Enforce strict JSON schemas
    maxTools: number; // Max tools per request
    parallelCalls: boolean; // Enable parallel tool calling
    forceToolUseOnFirstTurn: boolean; // Force tool call on first message
  };
  retry: RetryConfig;
  promptAddendum: string; // Provider-specific system prompt additions
}
```

### 8.2 Default Configurations

```typescript
const DEFAULT_CONFIGS: Record<string, Partial<ProviderConfig>> = {
  claude: {
    providerId: "claude",
    apiBaseUrl: "https://api.anthropic.com/v1",
    defaultModel: "sonnet",
    maxTokens: 8192,
    temperature: 0.7,
    streaming: true,
    toolBehaviour: {
      strictMode: false,
      maxTools: 60,
      parallelCalls: true,
      forceToolUseOnFirstTurn: false,
    },
    retry: PROVIDER_RETRY_CONFIG.claude,
    promptAddendum: "",
  },

  openai: {
    providerId: "openai",
    apiBaseUrl: "https://api.openai.com/v1",
    defaultModel: "sonnet", // Maps to gpt-4o via model map
    maxTokens: 8192,
    temperature: 0.7,
    streaming: true,
    toolBehaviour: {
      strictMode: true, // Required for reliable tool calling
      maxTools: 20,
      parallelCalls: true,
      forceToolUseOnFirstTurn: true, // Compensate for passive behaviour
    },
    retry: PROVIDER_RETRY_CONFIG.openai,
    promptAddendum: PROVIDER_PROMPT_ADDENDA.openai,
  },
};
```

### 8.3 Runtime Provider Selection

```typescript
class ProviderManager {
  private adapters: Map<string, LLMProviderAdapter> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();

  constructor() {
    this.register("claude", new ClaudeAdapter(), DEFAULT_CONFIGS.claude);
    this.register("openai", new OpenAIAdapter(), DEFAULT_CONFIGS.openai);
  }

  register(
    id: string,
    adapter: LLMProviderAdapter,
    config: Partial<ProviderConfig>,
  ): void {
    this.adapters.set(id, adapter);
    this.configs.set(id, {
      ...DEFAULT_CONFIGS[id],
      ...config,
    } as ProviderConfig);
  }

  getAdapter(providerId: string): LLMProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new Error(`Unknown provider: ${providerId}`);
    return adapter;
  }

  getConfig(providerId: string): ProviderConfig {
    const config = this.configs.get(providerId);
    if (!config) throw new Error(`No config for provider: ${providerId}`);
    return config;
  }

  /**
   * Assemble a provider-ready request from canonical format.
   * This is the main entry point for the application layer.
   */
  async prepareRequest(
    providerId: string,
    canonical: CanonicalRequest,
  ): Promise<any> {
    const adapter = this.getAdapter(providerId);
    const config = this.getConfig(providerId);

    // Inject provider-specific prompt addendum
    const augmentedRequest = {
      ...canonical,
      systemPrompt: canonical.systemPrompt + "\n" + config.promptAddendum,
      tools: filterToolsForProvider(canonical.tools, providerId, {
        lastUserMessage: "",
        activeSkills: [],
      }),
    };

    return adapter.buildRequest(augmentedRequest);
  }
}
```

---

## 9. Error Normalisation

### 9.1 Claude Error Mapping

```typescript
function normaliseClaudeError(error: any): CanonicalError {
  const status = error.status ?? error.response?.status;
  const type = error.error?.type ?? error.type ?? "";
  const message = error.error?.message ?? error.message ?? "Unknown error";

  switch (type) {
    case "rate_limit_error":
      return {
        code: "rate_limit",
        message: "Rate limit reached",
        retryable: true,
        retryAfterMs: parseRetryAfter(error),
        providerCode: type,
        providerMessage: message,
      };

    case "authentication_error":
      return {
        code: "auth",
        message: "Invalid API key",
        retryable: false,
        providerCode: type,
        providerMessage: message,
      };

    case "invalid_request_error":
      if (
        message.includes("context length") ||
        message.includes("too many tokens")
      ) {
        return {
          code: "context_length",
          message: "Conversation too long — need to truncate history",
          retryable: true, // Retryable after truncation
          providerCode: type,
          providerMessage: message,
        };
      }
      return {
        code: "invalid_request",
        message,
        retryable: false,
        providerCode: type,
        providerMessage: message,
      };

    case "overloaded_error":
    case "api_error":
      return {
        code: "server_error",
        message: "Claude API is temporarily overloaded",
        retryable: true,
        retryAfterMs: 5000,
        providerCode: type,
        providerMessage: message,
      };

    default:
      return {
        code: status >= 500 ? "server_error" : "unknown",
        message,
        retryable: status >= 500,
        providerCode: type,
        providerMessage: message,
      };
  }
}
```

### 9.2 OpenAI Error Mapping

```typescript
function normaliseOpenAIError(error: any): CanonicalError {
  const status = error.status ?? error.response?.status;
  const code = error.code ?? error.error?.code ?? "";
  const message = error.error?.message ?? error.message ?? "Unknown error";

  // Known OpenAI call_id bug
  if (
    message.includes("No tool call found") ||
    message.includes("No tool output found")
  ) {
    return {
      code: "tool_error",
      message: "OpenAI tool call state mismatch (known issue). Retrying...",
      retryable: true,
      retryAfterMs: 1000,
      providerCode: code,
      providerMessage: message,
    };
  }

  // Strict schema rejection
  if (message.includes("Invalid schema") || message.includes("strict mode")) {
    return {
      code: "invalid_request",
      message:
        "Tool schema rejected by OpenAI strict mode. Check additionalProperties and required fields.",
      retryable: false,
      providerCode: code,
      providerMessage: message,
    };
  }

  switch (status) {
    case 429:
      return {
        code: "rate_limit",
        message: "OpenAI rate limit reached",
        retryable: true,
        retryAfterMs: parseRetryAfter(error) ?? 10000,
        providerCode: code,
        providerMessage: message,
      };

    case 401:
      return {
        code: "auth",
        message: "Invalid OpenAI API key",
        retryable: false,
        providerCode: code,
        providerMessage: message,
      };

    case 400:
      if (
        message.includes("context_length") ||
        message.includes("maximum context length")
      ) {
        return {
          code: "context_length",
          message: "Conversation too long",
          retryable: true,
          providerCode: code,
          providerMessage: message,
        };
      }
      return {
        code: "invalid_request",
        message,
        retryable: false,
        providerCode: code,
        providerMessage: message,
      };

    default:
      return {
        code: status >= 500 ? "server_error" : "unknown",
        message,
        retryable: status >= 500,
        retryAfterMs: status >= 500 ? 5000 : undefined,
        providerCode: code,
        providerMessage: message,
      };
  }
}
```

---

## 10. Testing Strategy

### 10.1 Adapter Unit Tests

Every adapter method needs round-trip tests:

```typescript
// Test: Tool definition round-trip
describe("OpenAI Tool Adapter", () => {
  test("converts canonical tool with optional params to strict schema", () => {
    const canonical: CanonicalToolDefinition = {
      name: "Read",
      description: "Read a file",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path" },
          offset: { type: "number", description: "Start line" }, // OPTIONAL
          limit: { type: "number", description: "Lines to read" }, // OPTIONAL
        },
        required: ["file_path"],
      },
    };

    const result = adapter.toProviderTools([canonical])[0];

    // Verify wrapping
    expect(result.type).toBe("function");
    expect(result.function.name).toBe("Read");

    // Verify strict schema transformation
    const params = result.function.parameters;
    expect(params.additionalProperties).toBe(false);
    expect(params.required).toEqual(["file_path", "offset", "limit"]); // ALL required
    expect(params.properties.offset.type).toEqual(["number", "null"]); // Made nullable
    expect(params.properties.limit.type).toEqual(["number", "null"]); // Made nullable
    expect(params.properties.file_path.type).toBe("string"); // Stays as-is
  });

  test("converts tool_use content blocks to tool_calls array", () => {
    const canonical: CanonicalMessage = {
      id: "msg_1",
      role: "assistant",
      content: [
        { type: "text", text: "Let me read that file." },
        {
          type: "tool_use",
          id: "tu_1",
          name: "Read",
          input: { file_path: "/test.txt" },
        },
      ],
    };

    const result = adapter.toProviderMessages([canonical])[0];

    expect(result.role).toBe("assistant");
    expect(result.content).toBe("Let me read that file.");
    expect(result.tool_calls).toHaveLength(1);
    expect(result.tool_calls[0].id).toBe("tu_1");
    expect(result.tool_calls[0].function.arguments).toBe(
      '{"file_path":"/test.txt"}',
    );
  });

  test("converts tool_result to separate tool message", () => {
    const canonical: CanonicalMessage = {
      id: "msg_2",
      role: "user",
      content: [
        {
          type: "tool_result",
          toolUseId: "tu_1",
          content: "File contents here",
          isError: false,
        },
      ],
    };

    const result = adapter.toProviderMessages([canonical]);

    expect(result).toHaveLength(1);
    expect(result[0].role).toBe("tool");
    expect(result[0].tool_call_id).toBe("tu_1");
    expect(result[0].content).toBe("File contents here");
  });

  test("converts tool_result with error to prefixed content", () => {
    const canonical: CanonicalMessage = {
      id: "msg_3",
      role: "user",
      content: [
        {
          type: "tool_result",
          toolUseId: "tu_2",
          content: "File not found",
          isError: true,
        },
      ],
    };

    const result = adapter.toProviderMessages([canonical]);

    expect(result[0].content).toBe("Error: File not found");
  });
});
```

### 10.2 Integration Test Matrix

Run the same task against every provider and verify equivalent outcomes:

| Test Case                      | What to Verify                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| **Simple chat (no tools)**     | Text response received, streaming works                         |
| **Single tool call**           | Tool called correctly, result sent back, conversation continues |
| **Parallel tool calls**        | Multiple tools called in one turn, all results returned         |
| **Tool error handling**        | Error result sent, model recovers and retries or informs user   |
| **TodoWrite**                  | Todo list created and updated during multi-step task            |
| **File creation**              | File created via Write tool, returned as artifact               |
| **Nested tool calls**          | Tool call → result → another tool call → result → final text    |
| **Large tool set (25+ tools)** | Correct tool selected, no schema errors                         |
| **Streaming interruption**     | Stop button works, partial message preserved                    |
| **Context length overflow**    | Truncation applied, retried successfully                        |
| **Strict schema edge cases**   | Optional params, nested objects, arrays with objects            |

### 10.3 Provider Behaviour Smoke Tests

These verify that the behavioural compensations are working:

```typescript
describe("OpenAI Behaviour Compensations", () => {
  test("creates todo list for multi-step task", async () => {
    const response = await sendMessage(
      "openai",
      "Analyse this PDF and create a summary report with 5 sections",
    );
    const todoWriteCalls = response.toolCalls.filter(
      (t) => t.name === "TodoWrite",
    );
    expect(todoWriteCalls.length).toBeGreaterThan(0);
  });

  test("reads file before editing", async () => {
    const response = await sendMessage(
      "openai",
      "Fix the typo on line 3 of /test/file.txt",
    );
    const toolOrder = response.toolCalls.map((t) => t.name);
    const readIndex = toolOrder.indexOf("Read");
    const editIndex = toolOrder.indexOf("Edit");
    expect(readIndex).toBeLessThan(editIndex);
  });

  test("handles strict schema with optional params", async () => {
    // Send a request using a tool with optional parameters
    const response = await sendMessage("openai", "Read /test.txt");
    // Should not get schema rejection error
    expect(response.error).toBeUndefined();
  });
});
```

---

## 11. Adding a New Provider

To add support for a new LLM provider (e.g., Google Gemini, Mistral, Cohere):

### Step 1: Create the Adapter

```typescript
// adapters/gemini.ts
export class GeminiAdapter implements LLMProviderAdapter {
  readonly providerId = "gemini";

  resolveModel(canonical: string): string {
    /* ... */
  }
  toProviderTools(tools: CanonicalToolDefinition[]): any[] {
    /* ... */
  }
  toProviderMessages(messages: CanonicalMessage[]): any[] {
    /* ... */
  }
  toProviderSystemPrompt(prompt: string): any {
    /* ... */
  }
  toProviderToolChoice(choice: CanonicalToolChoice): any {
    /* ... */
  }
  buildRequest(canonical: CanonicalRequest): any {
    /* ... */
  }
  fromProviderResponse(response: any): CanonicalMessage {
    /* ... */
  }
  createStreamAdapter(): StreamAdapter {
    /* ... */
  }
  normaliseError(error: any): CanonicalError {
    /* ... */
  }
}
```

### Step 2: Add Configuration

```typescript
DEFAULT_CONFIGS.gemini = {
  providerId: "gemini",
  apiBaseUrl: "https://generativelanguage.googleapis.com/v1",
  defaultModel: "sonnet",
  modelMap: {
    sonnet: "gemini-2.0-flash",
    opus: "gemini-2.0-pro",
    haiku: "gemini-2.0-flash-lite",
  },
  maxTokens: 8192,
  streaming: true,
  toolBehaviour: {
    strictMode: false,
    maxTools: 30,
    parallelCalls: true,
    forceToolUseOnFirstTurn: false,
  },
  retry: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    retryableErrors: ["rate_limit", "server_error"],
  },
  promptAddendum: PROVIDER_PROMPT_ADDENDA.gemini ?? "",
};
```

### Step 3: Register

```typescript
providerManager.register("gemini", new GeminiAdapter(), DEFAULT_CONFIGS.gemini);
```

### Step 4: Run Integration Tests

Run the full test matrix (Section 10.2) against the new provider.

### Checklist for New Provider

- [ ] Model mapping defined
- [ ] Tool definition format implemented and tested
- [ ] Message conversion (both directions) implemented and tested
- [ ] System prompt format handled
- [ ] Tool choice mapping implemented
- [ ] Streaming adapter implemented and tested
- [ ] Error normalisation implemented
- [ ] Strict schema transformation (if applicable)
- [ ] Behaviour compensations identified and implemented
- [ ] Provider-specific prompt addendum written
- [ ] Tool count threshold determined
- [ ] Retry configuration tuned
- [ ] Full integration test suite passing

---

## Appendix: Quick Reference — Format Mapping Cheatsheet

### Tool Definition

| Field       | Canonical     | Claude                  | OpenAI                                                        |
| ----------- | ------------- | ----------------------- | ------------------------------------------------------------- |
| Name        | `name`        | `name`                  | `function.name`                                               |
| Description | `description` | `description`           | `function.description`                                        |
| Schema      | `inputSchema` | `input_schema`          | `function.parameters`                                         |
| Wrapper     | none          | none                    | `{ type: "function", function: { ... } }`                     |
| Strict      | n/a           | optional `strict: true` | `strict: true` + `additionalProperties: false` + all required |

### Tool Call (in assistant response)

| Field     | Canonical          | Claude             | OpenAI                          |
| --------- | ------------------ | ------------------ | ------------------------------- |
| Location  | `content[]` block  | `content[]` block  | `tool_calls[]` field on message |
| Type tag  | `type: "tool_use"` | `type: "tool_use"` | `type: "function"`              |
| ID        | `id`               | `id`               | `id`                            |
| Name      | `name`             | `name`             | `function.name`                 |
| Arguments | `input` (object)   | `input` (object)   | `function.arguments` (string!)  |

### Tool Result (sent back to model)

| Field      | Canonical                     | Claude                        | OpenAI                           |
| ---------- | ----------------------------- | ----------------------------- | -------------------------------- |
| Location   | `content[]` block in user msg | `content[]` block in user msg | Separate message, `role: "tool"` |
| Reference  | `toolUseId`                   | `tool_use_id`                 | `tool_call_id`                   |
| Content    | `content`                     | `content`                     | `content`                        |
| Error flag | `isError` (boolean)           | `is_error` (boolean)          | none (encode in content)         |

### Stop Reasons

| Canonical    | Claude       | OpenAI       |
| ------------ | ------------ | ------------ |
| `end_turn`   | `end_turn`   | `stop`       |
| `tool_use`   | `tool_use`   | `tool_calls` |
| `max_tokens` | `max_tokens` | `length`     |

### Token Usage

| Canonical | Claude                | OpenAI                    |
| --------- | --------------------- | ------------------------- |
| `input`   | `usage.input_tokens`  | `usage.prompt_tokens`     |
| `output`  | `usage.output_tokens` | `usage.completion_tokens` |

---

_End of specification. Build the adapter layer first, then run the integration test matrix before connecting it to the main Cowork application._
