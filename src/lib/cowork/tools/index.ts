/**
 * Tool Registry
 * Central registry for all Cowork tools
 */

import type { ToolExecutor, ToolSchema, ToolContext, ToolResult } from "./types";

// Tool executors will be imported here as we build them
const toolExecutors: Map<string, ToolExecutor> = new Map();
let toolsRegistered = false;

/**
 * Register a tool executor
 */
export function registerTool(tool: ToolExecutor): void {
  toolExecutors.set(tool.name, tool);
}

/**
 * Ensure all tools are registered (lazy initialization to avoid circular deps)
 */
function ensureRegistered(): void {
  if (toolsRegistered) return;
  toolsRegistered = true;
  // Inline require to avoid circular import at module load time
  require("./register");
}

/**
 * Get a tool executor by name
 */
export function getTool(name: string): ToolExecutor | undefined {
  ensureRegistered();
  return toolExecutors.get(name);
}

/**
 * Get all registered tools
 */
export function getAllTools(): ToolExecutor[] {
  ensureRegistered();
  return Array.from(toolExecutors.values());
}

/**
 * Convert tool executors to Anthropic tools format
 */
export function getAnthropicTools(): ToolSchema[] {
  return getAllTools().map((tool) => {
    // Ensure parameters has type: "object" if not already present
    const schema = tool.parameters.type === "object" 
      ? tool.parameters 
      : { type: "object", ...tool.parameters };
    
    return {
      name: tool.name,
      description: tool.description,
      input_schema: schema as Record<string, unknown>,
    };
  });
}

/**
 * Convert tool executors to OpenAI functions format
 */
export function getOpenAITools(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return getAllTools().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  name: string,
  input: unknown,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return {
      content: `Tool "${name}" not found`,
      isError: true,
    };
  }

  // Check if tool is allowed in plan mode
  if (context.planMode) {
    const readOnlyTools = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];
    if (!readOnlyTools.includes(tool.name)) {
      return {
        content: `Tool "${name}" is not allowed in plan mode. Only read-only tools are permitted.`,
        isError: true,
      };
    }
  }

  try {
    return await tool.execute(input, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Tool ${name}] Execution error:`, error);
    return {
      content: `Error executing ${name}: ${message}`,
      isError: true,
      metadata: { error: message },
    };
  }
}

/**
 * Get permission level for a tool
 */
export function getToolPermissionLevel(name: string): "auto" | "ask" | "blocked" {
  const tool = getTool(name);
  return tool?.permissionLevel || "blocked";
}
