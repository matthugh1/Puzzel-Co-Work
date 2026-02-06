/**
 * Agentic Loop
 * Core loop that handles tool calling, execution, and re-prompting
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import path from "path";
import { getAnthropicTools, getOpenAITools, executeTool, getToolPermissionLevel } from "./tools";
import type { ToolContext, ToolResult } from "./tools/types";
import type { LLMProvider, LLMStreamConfig, TokenUsage } from "./llm";
import { requestPermission } from "./permissions";
import { loadSessionSkills, matchSkills, loadSkillContent } from "./skills";

const MAX_TOOL_ITERATIONS = 25;

/**
 * Assemble dynamic system prompt including session state and skills
 */
async function assembleSystemPrompt(
  basePrompt: string | undefined,
  sessionState?: AgentLoopConfig["sessionState"],
  sessionId?: string,
  activeSkills?: string[],
): Promise<string> {
  const defaultPrompt = `You are Cowork, an AI assistant built into the Puzzel Co-Work platform. You help users accomplish tasks by planning, executing, and delivering results.

Key behaviours:
- Be concise and helpful. Avoid unnecessary preamble.
- Use markdown formatting for readability (bold, lists, code blocks).
- When a task is complex, break it into steps and work through them.
- Ask clarifying questions when the request is ambiguous.
- Be honest about limitations.`;

  let prompt = basePrompt || defaultPrompt;

  // Add session state context
  if (sessionState) {
    const stateParts: string[] = [];

    if (sessionState.todos && sessionState.todos.length > 0) {
      const pendingTodos = sessionState.todos.filter((t) => t.status === "pending" || t.status === "in_progress");
      if (pendingTodos.length > 0) {
        stateParts.push(`\n\nCurrent tasks:\n${pendingTodos.map((t) => `- ${t.content} (${t.status})`).join("\n")}`);
      }
    }

    if (sessionState.files && sessionState.files.length > 0) {
      const outputs = sessionState.files.filter((f) => f.category === "output");
      if (outputs.length > 0) {
        stateParts.push(`\n\nGenerated files:\n${outputs.map((f) => `- ${f.fileName}`).join("\n")}`);
      }
    }

    if (sessionState.subAgents && sessionState.subAgents.length > 0) {
      const activeAgents = sessionState.subAgents.filter((a) => a.status === "running");
      if (activeAgents.length > 0) {
        stateParts.push(`\n\nActive sub-agents:\n${activeAgents.map((a) => `- ${a.description} (${a.status})`).join("\n")}`);
      }
    }

    if (stateParts.length > 0) {
      prompt += stateParts.join("");
    }
  }

  // Add skills metadata (always include)
  if (sessionId) {
    try {
      const registry = await loadSessionSkills(sessionId);
      if (registry && registry.length > 0) {
        prompt += `\n\nAvailable skills:\n${registry.map((s) => `- ${s.name}: ${s.description}`).join("\n")}`;
      }
    } catch (err) {
      // Silently fail - skills are optional
      console.error("[Agent Loop] Error loading skills:", err);
    }
  }

  // Inject active skill content (matched or explicitly invoked)
  if (activeSkills && activeSkills.length > 0 && sessionId) {
    const skillContents: string[] = [];
    for (const skillId of activeSkills) {
      try {
        const content = await loadSkillContent(skillId, sessionId);
        if (content) {
          skillContents.push(`\n\n--- Skill: ${content.metadata.name} ---\n${content.content}`);
        }
      } catch (err) {
        console.error(`[Agent Loop] Error loading skill ${skillId}:`, err);
      }
    }
    if (skillContents.length > 0) {
      prompt += skillContents.join("\n");
    }
  }

  return prompt;
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate conversation history to fit within token limits
 * Keeps last 20 full messages, summarises older ones
 */
function truncateHistory(
  messages: AgentMessage[],
  maxTokens: number,
): AgentMessage[] {
  if (messages.length === 0) return messages;

  // Keep last 20 messages fully
  const keepCount = 20;
  if (messages.length <= keepCount) {
    return messages;
  }

  const recentMessages = messages.slice(-keepCount);
  const oldMessages = messages.slice(0, -keepCount);

  // Summarise old messages
  const summaryText = `[Previous conversation summary: ${oldMessages.length} messages about various topics. User and assistant discussed tasks, used tools, and made progress.]`;

  // Drop tool call/result details from old messages, keep brief summaries
  const simplifiedOld: AgentMessage[] = oldMessages
    .filter((m): m is AgentMessage => m.role === "user" || m.role === "assistant")
    .map((m): AgentMessage => {
      if (typeof m.content === "string") {
        // Truncate long text messages
        const truncated = m.content.length > 500 ? m.content.substring(0, 500) + "..." : m.content;
        return { role: m.role as "user" | "assistant", content: truncated };
      }
      // For messages with tool_use/tool_result blocks, create a summary
      const contentArray = m.content as Array<{ type: string; name?: string; [key: string]: unknown }>;
      const toolUses = contentArray.filter((c) => c.type === "tool_use").map((c) => c.name || "tool");
      const summary = toolUses.length > 0
        ? `Used tools: ${toolUses.join(", ")}`
        : "Previous assistant message";
      return { role: m.role as "user" | "assistant", content: summary };
    });

  // Combine summary + recent messages
  const summaryMessage: AgentMessage = {
    role: "user",
    content: summaryText,
  };

  return [summaryMessage, ...simplifiedOld.slice(-5), ...recentMessages];
}

export interface AgentLoopConfig extends LLMStreamConfig {
  sessionId: string;
  userId: string;
  organizationId: string;
  sessionDir: string;
  planMode: boolean;
  isSubAgent?: boolean; // True if this is a sub-agent (prevents recursive tool usage)
  createArtifact?: ArtifactCreator; // Optional callback to create artifact DB records
  sessionState?: {
    todos?: Array<{ id: string; content: string; status: string }>;
    files?: Array<{ fileName: string; category: string }>;
    subAgents?: Array<{ id: string; description: string; status: string }>;
  };
  activeSkills?: string[]; // Skill IDs to inject into system prompt
}

export interface SSEEventSender {
  (eventType: string, data: unknown): void;
}

export interface ArtifactCreator {
  (filePath: string, fileName: string, content: string, sessionId: string): Promise<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: string;
    storagePath: string;
    downloadUrl: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}

type AgentMessage = 
  | { role: "user" | "assistant"; content: string | unknown[] }
  | { role: "tool"; content: string; tool_call_id: string; name: string }
  | { role: "assistant"; content: null; tool_calls: unknown[] };

/**
 * Run the agentic loop with tool calling support
 */
export async function runAgentLoop(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  sendEvent: SSEEventSender,
): Promise<{ fullText: string; usage?: TokenUsage }> {
  try {
    // Match skills from last user message (if available)
    let matchedSkills: string[] = [];
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user" && typeof lastMessage.content === "string") {
        try {
          const registry = await loadSessionSkills(config.sessionId);
          if (registry && registry.length > 0) {
            matchedSkills = matchSkills(lastMessage.content, registry);
          }
        } catch (err) {
          // Silently fail - skills matching is optional
          console.error("[Agent Loop] Error matching skills:", err);
        }
      }
    }

  // Merge matched skills with explicitly active skills
  // Use let so we can update it when Skill tool is called
  let activeSkills = [...new Set([...(config.activeSkills || []), ...matchedSkills])];
  const tools = getAnthropicTools();
  const openaiTools = getOpenAITools();

  const toolContext: ToolContext = {
    sessionId: config.sessionId,
    userId: config.userId,
    organizationId: config.organizationId,
    sessionDir: config.sessionDir,
    planMode: config.planMode,
    sendEvent, // Pass sendEvent to tools (e.g., Task tool for sub-agents)
  };

  let fullText = "";
  let iterationCount = 0;
  let totalUsage: TokenUsage | undefined;

  // Filter tools based on plan mode and whether this is a sub-agent
  // Sub-agents should NEVER have access to Task, AskUserQuestion, GetSubAgentResults, or Skill tools (prevent recursion)
  const subAgentBlocklist = ["Task", "AskUserQuestion", "GetSubAgentResults", "Skill"];
  
  let availableTools = config.planMode
    ? tools.filter((t) => ["Read", "Glob", "Grep", "WebSearch", "WebFetch"].includes(t.name))
    : tools;
  
  // Remove recursive tools for sub-agents
  if (config.isSubAgent) {
    availableTools = availableTools.filter((t) => !subAgentBlocklist.includes(t.name));
  }
  
  let availableOpenAITools = config.planMode
    ? openaiTools.filter((t) => ["Read", "Glob", "Grep", "WebSearch", "WebFetch"].includes(t.function.name))
    : openaiTools;
  
  // Remove recursive tools for sub-agents
  if (config.isSubAgent) {
    availableOpenAITools = availableOpenAITools.filter((t) => !subAgentBlocklist.includes(t.function.name));
  }

  // Track completed sub-agents to inject their results
  // Note: Sub-agent results are injected via sub_agent_update events handled by the frontend
  // The main agent will see results when the user sends the next message (sessionState refreshed)
  // For now, we rely on the sub-agent orchestrator to emit events that the frontend displays

  while (iterationCount < MAX_TOOL_ITERATIONS) {
    iterationCount++;

    if (config.provider === "anthropic") {
      const result = await runAnthropicIteration(
        messages,
        { ...config, activeSkills },
        availableTools,
        toolContext,
        sendEvent,
      );
      fullText += result.text;
      if (result.usage) totalUsage = result.usage;

      // If no tool calls, we're done
      if (result.toolCalls.length === 0) {
        break;
      }

      // Execute tools and add results to messages
      for (const toolCall of result.toolCalls) {
        const permissionLevel = getToolPermissionLevel(toolCall.name);
        
        if (permissionLevel === "blocked") {
          const errorResult: ToolResult = {
            content: `Tool "${toolCall.name}" is blocked and cannot be executed.`,
            isError: true,
          };
          messages.push({
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
              },
            ],
          });
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: errorResult.content,
                is_error: errorResult.isError,
              },
            ],
          });
          sendEvent("tool_result", {
            tool_use_id: toolCall.id,
            content: errorResult.content,
            is_error: errorResult.isError,
          });
          continue;
        }

        if (permissionLevel === "ask") {
          // Request permission from user
          const requestId = `perm_${toolCall.id}_${Date.now()}`;
          
          sendEvent("permission_request", {
            requestId,
            action: toolCall.name,
            details: {
              toolName: toolCall.name,
              toolInput: toolCall.input,
            },
          });

          // Wait for user to approve/deny
          let approved: boolean;
          try {
            approved = await requestPermission(requestId, toolCall.name, toolCall.input);
          } catch (error) {
            // Timeout or error - deny the request
            const errorResult: ToolResult = {
              content: `Permission request for "${toolCall.name}" was ${error instanceof Error && error.message.includes("timeout") ? "timed out" : "cancelled"}.`,
              isError: true,
            };
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: toolCall.input,
                },
              ],
            });
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: errorResult.content,
                  is_error: errorResult.isError,
                },
              ],
            });
            sendEvent("tool_result", {
              tool_use_id: toolCall.id,
              content: errorResult.content,
              is_error: errorResult.isError,
            });
            continue;
          }

          if (!approved) {
            // User denied - return error
            const errorResult: ToolResult = {
              content: `Permission denied for "${toolCall.name}". The tool execution was cancelled.`,
              isError: true,
            };
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: toolCall.input,
                },
              ],
            });
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: errorResult.content,
                  is_error: errorResult.isError,
                },
              ],
            });
            sendEvent("tool_result", {
              tool_use_id: toolCall.id,
              content: errorResult.content,
              is_error: errorResult.isError,
            });
            continue;
          }

          // Permission granted - continue with execution
        }

        // Execute tool
        sendEvent("tool_use_start", {
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
        });

        // Handle AskUserQuestion specially - emit question event before execution
        let toolInput = toolCall.input;
        if (toolCall.name === "AskUserQuestion") {
          const questionInput = toolCall.input as {
            prompt: string;
            options: Array<{ id: string; label: string }>;
            allowMultiple?: boolean;
          };
          const questionId = `question_${toolCall.id}_${Date.now()}`;
          
          // Add questionId to input so tool can use it
          toolInput = {
            ...questionInput,
            questionId,
          };
          
          sendEvent("ask_question", {
            id: questionId,
            prompt: questionInput.prompt,
            options: questionInput.options.map((opt) => ({
              id: opt.id,
              label: opt.label,
            })),
            allowMultiple: questionInput.allowMultiple || false,
          });
        }

        const toolResult = await executeTool(toolCall.name, toolInput, toolContext);

        // Stream tool result
        sendEvent("tool_result", {
          tool_use_id: toolCall.id,
          content: toolResult.content,
          is_error: toolResult.isError,
        });

        // Handle side effects (e.g., todo updates, artifact creation, plan mode)
        if (toolCall.name === "TodoWrite" && toolResult.metadata?.todos) {
          sendEvent("todo_update", { todos: toolResult.metadata.todos });
        }
        
        // Handle plan mode changes
        if (toolCall.name === "EnterPlanMode" && toolResult.metadata?.planMode) {
          toolContext.planMode = true;
          // Update available tools for next iteration
        }
        
        if (toolCall.name === "ExitPlanMode" && toolResult.metadata?.planId) {
          // Send plan_proposed event - plan mode stays ON until user approves
          sendEvent("plan_proposed", {
            planId: toolResult.metadata.planId,
            steps: toolResult.metadata.steps || [],
          });
          // Break the loop - wait for user to approve/reject the plan
          break;
        }
        
        // Handle artifact creation (Write tool creating files in outputs/)
        if (toolCall.name === "Write" && toolResult.metadata?.isArtifact && config.createArtifact) {
          try {
            const artifactPath = toolResult.metadata.artifactPath as string;
            const artifactFileName = toolResult.metadata.artifactFileName as string;
            const fileContent = (toolCall.input as { content: string }).content;
            
            const artifact = await config.createArtifact(
              artifactPath,
              artifactFileName,
              fileContent,
              config.sessionId,
            );
            
            sendEvent("artifact_created", artifact);
          } catch (error) {
            console.error("[Agent Loop] Error creating artifact:", error);
            // Don't fail the tool execution, just log the error
          }
        }

        // Handle sub-agent spawning (Task tool)
        if (toolCall.name === "Task" && toolResult.metadata?.agentId) {
          // The Task tool already emits sub_agent_update, but we can also add a status block
          // The frontend will handle the sub_agent_update event to update state
        }

        // Handle skill invocation (Skill tool)
        if (toolCall.name === "Skill" && toolResult.metadata?.skillId) {
          // Add skill to activeSkills for next iteration
          if (!activeSkills) {
            activeSkills = [];
          }
          if (!activeSkills.includes(toolResult.metadata.skillId as string)) {
            activeSkills.push(toolResult.metadata.skillId as string);
          }
        }

        // Add to conversation for next iteration (Anthropic format)
        if (config.provider === "anthropic") {
          messages.push({
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.input,
              },
            ],
          });
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolCall.id,
                content: toolResult.content,
                is_error: toolResult.isError,
              },
            ],
          });
        }
      }
    } else if (config.provider === "openai") {
      iterationCount++;
      const result = await runOpenAIIteration(
        messages,
        { ...config, activeSkills },
        availableOpenAITools,
        toolContext,
        sendEvent,
      );
      fullText += result.text;
      if (result.usage) totalUsage = result.usage;

      // If no tool calls, we're done
      if (result.toolCalls.length === 0) {
        break;
      }

      // Execute tools and add results to messages
      for (const toolCall of result.toolCalls) {
        const permissionLevel = getToolPermissionLevel(toolCall.name);
        
        if (permissionLevel === "blocked") {
          const errorResult: ToolResult = {
            content: `Tool "${toolCall.name}" is blocked and cannot be executed.`,
            isError: true,
          };
          // OpenAI format
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.input),
                },
              },
            ],
          } as AgentMessage);
          messages.push({
            role: "tool",
            content: errorResult.content,
            tool_call_id: toolCall.id,
            name: toolCall.name,
          } as AgentMessage);
          sendEvent("tool_result", {
            tool_use_id: toolCall.id,
            content: errorResult.content,
            is_error: errorResult.isError,
          });
          continue;
        }

        if (permissionLevel === "ask") {
          // Request permission from user
          const requestId = `perm_${toolCall.id}_${Date.now()}`;
          
          sendEvent("permission_request", {
            requestId,
            action: toolCall.name,
            details: {
              toolName: toolCall.name,
              toolInput: toolCall.input,
            },
          });

          // Wait for user to approve/deny
          let approved: boolean;
          try {
            approved = await requestPermission(requestId, toolCall.name, toolCall.input);
          } catch (error) {
            // Timeout or error - deny the request
            const errorResult: ToolResult = {
              content: `Permission request for "${toolCall.name}" was ${error instanceof Error && error.message.includes("timeout") ? "timed out" : "cancelled"}.`,
              isError: true,
            };
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: toolCall.input,
                },
              ],
            });
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: errorResult.content,
                  is_error: errorResult.isError,
                },
              ],
            });
            sendEvent("tool_result", {
              tool_use_id: toolCall.id,
              content: errorResult.content,
              is_error: errorResult.isError,
            });
            continue;
          }

          if (!approved) {
            // User denied - return error
            const errorResult: ToolResult = {
              content: `Permission denied for "${toolCall.name}". The tool execution was cancelled.`,
              isError: true,
            };
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "tool_use",
                  id: toolCall.id,
                  name: toolCall.name,
                  input: toolCall.input,
                },
              ],
            });
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: errorResult.content,
                  is_error: errorResult.isError,
                },
              ],
            });
            sendEvent("tool_result", {
              tool_use_id: toolCall.id,
              content: errorResult.content,
              is_error: errorResult.isError,
            });
            continue;
          }

          // Permission granted - continue with execution
        }

        // Execute tool
        sendEvent("tool_use_start", {
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
        });

        // Handle AskUserQuestion specially - emit question event before execution
        let toolInput = toolCall.input;
        if (toolCall.name === "AskUserQuestion") {
          const questionInput = toolCall.input as {
            prompt: string;
            options: Array<{ id: string; label: string }>;
            allowMultiple?: boolean;
          };
          const questionId = `question_${toolCall.id}_${Date.now()}`;
          
          // Add questionId to input so tool can use it
          toolInput = {
            ...questionInput,
            questionId,
          };
          
          sendEvent("ask_question", {
            id: questionId,
            prompt: questionInput.prompt,
            options: questionInput.options.map((opt) => ({
              id: opt.id,
              label: opt.label,
            })),
            allowMultiple: questionInput.allowMultiple || false,
          });
        }

        const toolResult = await executeTool(toolCall.name, toolInput, toolContext);

        // Stream tool result
        sendEvent("tool_result", {
          tool_use_id: toolCall.id,
          content: toolResult.content,
          is_error: toolResult.isError,
        });

        // Handle side effects (e.g., todo updates, artifact creation, plan mode)
        if (toolCall.name === "TodoWrite" && toolResult.metadata?.todos) {
          sendEvent("todo_update", { todos: toolResult.metadata.todos });
        }
        
        // Handle plan mode changes
        if (toolCall.name === "EnterPlanMode" && toolResult.metadata?.planMode) {
          toolContext.planMode = true;
          // Update available tools for next iteration
        }
        
        if (toolCall.name === "ExitPlanMode" && toolResult.metadata?.planId) {
          // Send plan_proposed event - plan mode stays ON until user approves
          sendEvent("plan_proposed", {
            planId: toolResult.metadata.planId,
            steps: toolResult.metadata.steps || [],
          });
          // Break the loop - wait for user to approve/reject the plan
          break;
        }
        
        // Handle artifact creation (Write tool creating files in outputs/)
        if (toolCall.name === "Write" && toolResult.metadata?.isArtifact && config.createArtifact) {
          try {
            const artifactPath = toolResult.metadata.artifactPath as string;
            const artifactFileName = toolResult.metadata.artifactFileName as string;
            const fileContent = (toolCall.input as { content: string }).content;
            
            const artifact = await config.createArtifact(
              artifactPath,
              artifactFileName,
              fileContent,
              config.sessionId,
            );
            
            sendEvent("artifact_created", artifact);
          } catch (error) {
            console.error("[Agent Loop] Error creating artifact:", error);
            // Don't fail the tool execution, just log the error
          }
        }

        // Handle sub-agent spawning (Task tool)
        if (toolCall.name === "Task" && toolResult.metadata?.agentId) {
          // The Task tool already emits sub_agent_update, but we can also add a status block
          // The frontend will handle the sub_agent_update event to update state
        }

        // Handle skill invocation (Skill tool)
        if (toolCall.name === "Skill" && toolResult.metadata?.skillId) {
          // Add skill to activeSkills for next iteration
          if (!activeSkills) {
            activeSkills = [];
          }
          if (!activeSkills.includes(toolResult.metadata.skillId as string)) {
            activeSkills.push(toolResult.metadata.skillId as string);
          }
        }

        // Add to conversation for next iteration (OpenAI format)
        if (config.provider === "openai") {
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: toolCall.id,
                type: "function",
                function: {
                  name: toolCall.name,
                  arguments: JSON.stringify(toolCall.input),
                },
              },
            ],
          } as AgentMessage);
          messages.push({
            role: "tool",
            content: toolResult.content,
            tool_call_id: toolCall.id,
            name: toolCall.name,
          } as AgentMessage);
        }
      }
    }
  }

    if (iterationCount >= MAX_TOOL_ITERATIONS) {
      sendEvent("error", {
        code: "max_iterations",
        message: `Reached maximum tool call iterations (${MAX_TOOL_ITERATIONS})`,
      });
    }

    return { fullText, usage: totalUsage };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Run Agent Loop] Fatal error:", error);
    console.error("[Run Agent Loop] Stack:", stack);
    sendEvent("error", {
      code: "fatal_error",
      message: `Agent loop failed: ${message}`,
    });
    throw error;
  }
}

interface AnthropicIterationResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  usage?: TokenUsage;
}

async function runAnthropicIteration(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>,
  toolContext: ToolContext,
  sendEvent: SSEEventSender,
): Promise<AnthropicIterationResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  // Assemble dynamic system prompt with session state and skills
  const systemPrompt = await assembleSystemPrompt(
    config.systemPrompt,
    config.sessionState,
    config.sessionId,
    config.activeSkills,
  );

  // Truncate history if needed (keep last 20 messages, summarise older ones)
  const truncatedMessages = truncateHistory(messages, config.maxTokens || 4096);

  // Convert messages to Anthropic format
  // Filter out tool role messages (Anthropic uses user role with tool_result blocks)
  const anthropicMessages: Anthropic.MessageParam[] = truncatedMessages
    .filter((m) => m.role !== "tool") // Remove tool role messages
    .map((m) => {
      if (typeof m.content === "string") {
        return { role: m.role as "user" | "assistant", content: m.content };
      }
      // Handle tool_use/tool_result blocks - content is already an array
      return { 
        role: m.role as "user" | "assistant", 
        content: m.content as Anthropic.TextBlockParam[] | Anthropic.ToolUseBlockParam[] | Anthropic.ToolResultBlockParam[] 
      };
    });

  let stream;
  try {
    stream = client.messages.stream({
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.7,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: tools.length > 0 ? (tools as Anthropic.Tool[]) : undefined,
    });
  } catch (error: unknown) {
    // Handle rate limit errors
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('503') || error.message.includes('rate limit') || error.message.includes('overflow'))) {
      throw new Error('Rate limit reached. Please wait a moment and try again.');
    }
    throw error;
  }

  let text = "";
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

  // Stream text deltas
  stream.on("text", (delta) => {
    text += delta;
    sendEvent("content_delta", { text: delta });
  });

  let finalMessage;
  try {
    finalMessage = await stream.finalMessage();
  } catch (error: unknown) {
    // Handle rate limit errors during streaming
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('503') || error.message.includes('rate limit') || error.message.includes('overflow'))) {
      throw new Error('Rate limit reached. Please wait a moment and try again.');
    }
    throw error;
  }

  // Extract tool_use blocks from final message content
  if (finalMessage.content) {
    for (const block of finalMessage.content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }
  }

  const usage: TokenUsage = {
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };

  return { text, toolCalls, usage };
}

interface OpenAIIterationResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  usage?: TokenUsage;
}

async function runOpenAIIteration(
  messages: AgentMessage[],
  config: AgentLoopConfig,
  tools: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>,
  toolContext: ToolContext,
  sendEvent: SSEEventSender,
): Promise<OpenAIIterationResult> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Assemble dynamic system prompt with session state and skills
  const systemPrompt = await assembleSystemPrompt(
    config.systemPrompt,
    config.sessionState,
    config.sessionId,
    config.activeSkills,
  );

  // Truncate history if needed (keep last 20 messages, summarise older ones)
  const truncatedMessages = truncateHistory(messages, config.maxTokens || 4096);

  // Convert messages to OpenAI format
  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...truncatedMessages.map((m) => {
      // If already in OpenAI format (tool role), pass through
      if (m.role === "tool") {
        return m as OpenAI.Chat.ChatCompletionMessageParam;
      }
      
      // Handle tool role messages (from previous tool results in Anthropic format)
      if (m.role === "user" && Array.isArray(m.content)) {
        // Check if this is a tool_result block
        const toolResult = m.content.find((c: unknown) => 
          typeof c === "object" && c !== null && "type" in c && c.type === "tool_result"
        );
        if (toolResult && typeof toolResult === "object" && "tool_use_id" in toolResult) {
          const result = toolResult as { content?: string; tool_use_id: string };
          return {
            role: "tool" as const,
            content: result.content || "",
            tool_call_id: result.tool_use_id,
          };
        }
      }
      
      // Handle assistant messages with tool_use blocks (Anthropic format)
      if (m.role === "assistant" && Array.isArray(m.content)) {
        const toolUse = m.content.find((c: unknown) =>
          typeof c === "object" && c !== null && "type" in c && c.type === "tool_use"
        );
        if (toolUse && typeof toolUse === "object" && "id" in toolUse && "name" in toolUse) {
          const use = toolUse as { id: string; name: string; input?: Record<string, unknown> };
          return {
            role: "assistant" as const,
            content: null,
            tool_calls: [
              {
                id: use.id,
                type: "function" as const,
                function: {
                  name: use.name,
                  arguments: JSON.stringify(use.input || {}),
                },
              },
            ],
          };
        }
      }
      
      // If already in OpenAI format with tool_calls, pass through
      if (m.role === "assistant" && "tool_calls" in m) {
        return m as OpenAI.Chat.ChatCompletionMessageParam;
      }

      if (typeof m.content === "string") {
        return {
          role: m.role as "user" | "assistant",
          content: m.content,
        };
      }

      // Fallback: stringify content
      return {
        role: m.role as "user" | "assistant",
        content: JSON.stringify(m.content),
      };
    }),
  ];

  let stream;
  // Check if model supports temperature and max_completion_tokens
  // o1 models don't support temperature, top_p, or tool usage
  const isO1Model = config.model.includes('o1');
  const isO3Model = config.model.includes('o3');
  const isReasoningModel = isO1Model || isO3Model;
  const supportsTemperature = !isReasoningModel;
  const supportsTools = !isReasoningModel;
  
  // Warn if using reasoning model with tools
  if (isReasoningModel && tools.length > 0) {
    console.warn(`[Agent Loop] Model ${config.model} does not support tool calling. Tools will be disabled for this session.`);
  }
  
  try {
    const baseParams = {
      model: config.model,
      messages: openaiMessages,
      stream: true as const,
      stream_options: { include_usage: true },
    };
    
    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      ...baseParams,
      ...(supportsTemperature ? { temperature: config.temperature ?? 0.7 } : {}),
      ...((!isReasoningModel) ? { max_completion_tokens: config.maxTokens ?? 4096 } : {}),
      ...(supportsTools && tools.length > 0 ? { tools } : {}),
    };
    
    stream = await client.chat.completions.create(requestParams);
  } catch (error: unknown) {
    // Handle rate limit errors
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('503') || error.message.includes('rate limit') || error.message.includes('overflow'))) {
      throw new Error('Rate limit reached. Please wait a moment and try again.');
    }
    throw error;
  }

  let text = "";
  const toolCallMap = new Map<string, { id: string; name: string; arguments: string }>();
  let usage: TokenUsage | undefined;

  try {
    for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    
    if (delta?.content) {
      text += delta.content;
      sendEvent("content_delta", { text: delta.content });
    }

    if (delta?.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        const callId = toolCallDelta.id;
        if (!callId) continue;

        const existing = toolCallMap.get(callId);
        if (existing) {
          // Append to arguments
          existing.arguments += toolCallDelta.function?.arguments || "";
          if (toolCallDelta.function?.name) {
            existing.name = toolCallDelta.function.name;
          }
        } else {
          toolCallMap.set(callId, {
            id: callId,
            name: toolCallDelta.function?.name || "",
            arguments: toolCallDelta.function?.arguments || "",
          });
        }
      }
    }

    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      };
    }
  }
  } catch (error: unknown) {
    // Handle rate limit errors during streaming
    if (error instanceof Error && (error.message.includes('429') || error.message.includes('503') || error.message.includes('rate limit') || error.message.includes('overflow'))) {
      throw new Error('Rate limit reached. Please wait a moment and try again.');
    }
    throw error;
  }

  // Convert accumulated tool calls to our format
  const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
  for (const [id, call] of toolCallMap) {
    try {
      toolCalls.push({
        id,
        name: call.name,
        input: JSON.parse(call.arguments || "{}"),
      });
    } catch (error) {
      console.error(`[Agent Loop] Failed to parse tool call arguments for ${call.name}:`, error);
    }
  }

  return { text, toolCalls, usage };
}

/**
 * Create an SSE stream from the agent loop
 * This is the main entry point for the message API route
 */
export function streamAgentLoop(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  config: AgentLoopConfig,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (eventType: string, data: unknown) => {
        const payload = JSON.stringify({ type: eventType, ...(typeof data === 'object' && data !== null ? data : { data }) });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const assistantMessageId = `msg_${Date.now()}`;
      send("message_start", { messageId: assistantMessageId, role: "assistant" });

      try {
        // Convert simple messages to agent format
        const agentMessages: AgentMessage[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        console.log("[Stream Agent Loop] Starting agent loop with", agentMessages.length, "messages");
        const result = await runAgentLoop(agentMessages, config, send);

        send("message_end", {
          messageId: assistantMessageId,
          tokenUsage: result.usage
            ? { input: result.usage.inputTokens, output: result.usage.outputTokens }
            : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        console.error("[Stream Agent Loop] Error:", error);
        console.error("[Stream Agent Loop] Stack:", stack);
        send("error", { code: "agent_error", message });
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
