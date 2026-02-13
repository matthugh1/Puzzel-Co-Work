/**
 * Task Tool
 * Spawns a sub-agent to handle a parallel task
 */

import { spawnSubAgent, type SubAgentType } from "../sub-agent";
import type { ToolExecutor } from "./types";

export const taskTool: ToolExecutor = {
  name: "Task",
  description:
    "Spawn a sub-agent to handle a parallel task. Use this when you need to break work into independent workstreams that can run concurrently. Each sub-agent has its own conversation context and can use tools independently.",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description:
          "Brief description of what this sub-agent will do (e.g., 'Research competitor A')",
      },
      prompt: {
        type: "string",
        description: "The task prompt/instructions for the sub-agent",
      },
      subagent_type: {
        type: "string",
        enum: ["bash", "general-purpose", "explore", "plan"],
        description:
          "Type of sub-agent: 'bash' (Bash only), 'general-purpose' (all tools), 'explore' (read-only), 'plan' (read-only, planning)",
        default: "general-purpose",
      },
      model: {
        type: "string",
        description:
          "Optional model override for this sub-agent (defaults to parent session model)",
      },
      maxTurns: {
        type: "number",
        description: "Maximum number of turns for this sub-agent (default: 10)",
        default: 10,
      },
    },
    required: ["description", "prompt"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { description, prompt, subagent_type, model, maxTurns } = input as {
      description: string;
      prompt: string;
      subagent_type?: SubAgentType;
      model?: string;
      maxTurns?: number;
    };

    if (!description || typeof description !== "string") {
      return {
        content: "Error: description must be a non-empty string",
        isError: true,
      };
    }

    if (!prompt || typeof prompt !== "string") {
      return {
        content: "Error: prompt must be a non-empty string",
        isError: true,
      };
    }

    const agentType: SubAgentType = subagent_type || "general-purpose";

    try {
      // Spawn sub-agent with parent sendEvent callback if available
      const agentId = await spawnSubAgent({
        sessionId: context.sessionId,
        userId: context.userId,
        organizationId: context.organizationId,
        description,
        prompt,
        type: agentType,
        model,
        maxTurns: maxTurns || 10,
        sessionDir: context.sessionDir,
        parentSendEvent: context.sendEvent, // Pass parent's sendEvent so sub-agent can emit updates
      });

      // Emit sub_agent_update event immediately to show agent was spawned
      if (context.sendEvent) {
        context.sendEvent("sub_agent_update", {
          id: agentId,
          description,
          type: agentType,
          status: "running",
          turns: 0,
          maxTurns: maxTurns || 10,
        });
      }

      return {
        content: `Sub-agent "${description}" spawned successfully. It will run in parallel and report results when complete.`,
        isError: false,
        metadata: {
          agentId,
          description,
          type: agentType,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error spawning sub-agent: ${message}`,
        isError: true,
      };
    }
  },
};
