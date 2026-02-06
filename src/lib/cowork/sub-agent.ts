/**
 * Sub-Agent Orchestrator
 * Spawns, monitors, and aggregates results from parallel sub-agent tasks
 */

import { db } from "@/lib/db";
import { runAgentLoop, type AgentLoopConfig } from "./agent-loop";
import type { ToolContext } from "./tools/types";
import { getAnthropicTools, getOpenAITools } from "./tools";
import type { SSEEventSender } from "./agent-loop";

export type SubAgentType = "bash" | "general-purpose" | "explore" | "plan";
export type SubAgentStatus = "running" | "completed" | "failed" | "cancelled";

export interface SubAgentConfig {
  sessionId: string;
  userId: string;
  organizationId: string;
  description: string;
  prompt: string;
  type: SubAgentType;
  model?: string;
  maxTurns?: number;
  sessionDir: string;
  parentSendEvent?: SSEEventSender; // Callback to emit SSE events to parent stream
}

interface RunningAgent {
  controller: AbortController;
  promise: Promise<void>;
  agentId: string;
}

// In-memory tracking of running agents
const runningAgents = new Map<string, RunningAgent>();

/**
 * Spawn a sub-agent
 * Creates DB record and starts independent agent loop
 */
export async function spawnSubAgent(config: SubAgentConfig): Promise<string> {
  // Create DB record
  const subAgent = await db.coworkSubAgent.create({
    data: {
      sessionId: config.sessionId,
      description: config.description,
      type: config.type.toUpperCase().replace("-", "_") as "BASH" | "GENERAL_PURPOSE" | "EXPLORE" | "PLAN",
      status: "RUNNING",
      prompt: config.prompt,
      model: config.model,
      maxTurns: config.maxTurns || 10,
      turns: 0,
    },
  });

  const agentId = subAgent.id;
  const controller = new AbortController();

  // Tool filtering is handled in the agent loop based on planMode
  // For sub-agents, we set planMode=true for explore/plan types to restrict tools

  // Create tool context for sub-agent
  const toolContext: ToolContext = {
    sessionId: config.sessionId,
    userId: config.userId,
    organizationId: config.organizationId,
    sessionDir: config.sessionDir,
    planMode: config.type === "plan" || config.type === "explore", // Read-only mode
  };

  // Track if parent stream is still open
  let parentStreamOpen = !!config.parentSendEvent;

  // SSE event sender for sub-agent (emits to parent stream)
  const sendEvent: SSEEventSender = (eventType: string, data: unknown) => {
    // Update DB record periodically (on turn completion)
    if (eventType === "message_end") {
      db.coworkSubAgent
        .update({
          where: { id: agentId },
          data: { turns: { increment: 1 } },
        })
        .catch((err) => console.error("[Sub-Agent] Error updating turns:", err));
    }

    // Only emit to parent stream if still open and on important events
    if (parentStreamOpen && config.parentSendEvent && eventType === "message_end") {
      try {
        config.parentSendEvent("sub_agent_update", {
          id: agentId,
          status: "running",
          turns: 0, // Will be read from DB by polling
          ...(typeof data === "object" && data !== null ? data : { data }),
        });
      } catch (error) {
        // Parent stream closed - mark it and stop trying
        parentStreamOpen = false;
        console.log(`[Sub-Agent ${agentId}] Parent stream closed, continuing in background`);
      }
    }
  };

  // Start agent loop in detached async context
  const agentPromise = (async () => {
    try {
      // Initial message from prompt
      const initialMessages = [
        {
          role: "user" as const,
          content: config.prompt,
        },
      ];

      // Agent loop config
      const agentConfig: AgentLoopConfig = {
        provider: "anthropic", // Sub-agents always use Anthropic for now
        model: config.model || "claude-sonnet-4-20250514",
        temperature: 0.7,
        maxTokens: 4096,
        sessionId: config.sessionId,
        userId: config.userId,
        organizationId: config.organizationId,
        sessionDir: config.sessionDir,
        planMode: config.type === "plan" || config.type === "explore",
        isSubAgent: true, // CRITICAL: Prevents recursive Task tool usage
        sessionState: undefined, // Sub-agents don't inherit parent state
      };

      // Run agent loop (it handles iterations internally)
      let fullText = "";
      let turnCount = 0;

      const result = await runAgentLoop(initialMessages, agentConfig, (eventType, data) => {
        // Track turns from message_end events
        if (eventType === "message_end") {
          turnCount++;
          
          // Update DB with turn count
          db.coworkSubAgent
            .update({
              where: { id: agentId },
              data: { turns: turnCount },
            })
            .catch((err) => console.error("[Sub-Agent] Error updating turns:", err));
        }

        // Forward to parent sendEvent
        sendEvent(eventType, data);

        // Accumulate text from content_delta events
        if (eventType === "content_delta" && typeof data === "object" && data !== null && "text" in data) {
          fullText += String(data.text);
        }
      });

      // Add final text from result
      fullText += result.fullText;
      turnCount = Math.max(turnCount, 1); // At least 1 turn

      // Update DB with result
      await db.coworkSubAgent.update({
        where: { id: agentId },
        data: {
          status: "COMPLETED",
          result: fullText,
          completedAt: new Date(),
          turns: turnCount,
        },
      });

      // Emit completion event
      if (config.parentSendEvent) {
        try {
          config.parentSendEvent("sub_agent_update", {
            id: agentId,
            status: "completed",
            result: fullText,
            turns: turnCount,
          });
        } catch (error) {
          console.log(`[Sub-Agent ${agentId}] Parent stream closed on completion`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Update DB with error
      await db.coworkSubAgent.update({
        where: { id: agentId },
        data: {
          status: controller.signal.aborted ? "CANCELLED" : "FAILED",
          result: errorMessage,
          completedAt: new Date(),
        },
      });

      // Emit error event
      if (config.parentSendEvent) {
        try {
          config.parentSendEvent("sub_agent_update", {
            id: agentId,
            status: controller.signal.aborted ? "cancelled" : "failed",
            error: errorMessage,
          });
        } catch (error) {
          console.log(`[Sub-Agent ${agentId}] Parent stream closed on error`);
        }
      }
    } finally {
      // Clean up
      runningAgents.delete(agentId);
    }
  })();

  // Store running agent
  runningAgents.set(agentId, {
    controller,
    promise: agentPromise,
    agentId,
  });

  // Don't await - let it run in background
  agentPromise.catch((err) => {
    console.error(`[Sub-Agent ${agentId}] Unhandled error:`, err);
  });

  return agentId;
}

/**
 * Get sub-agent status from DB
 */
export async function getSubAgentStatus(agentId: string) {
  const agent = await db.coworkSubAgent.findUnique({
    where: { id: agentId },
  });

  if (!agent) {
    return null;
  }

  return {
    id: agent.id,
    sessionId: agent.sessionId,
    description: agent.description,
    type: agent.type.toLowerCase().replace("_", "-") as SubAgentType,
    status: agent.status.toLowerCase() as SubAgentStatus,
    prompt: agent.prompt,
    result: agent.result,
    model: agent.model,
    turns: agent.turns,
    maxTurns: agent.maxTurns,
    createdAt: agent.createdAt.toISOString(),
    completedAt: agent.completedAt?.toISOString(),
  };
}

/**
 * Cancel a running sub-agent
 */
export async function cancelSubAgent(agentId: string): Promise<boolean> {
  const running = runningAgents.get(agentId);
  if (running) {
    running.controller.abort();
    runningAgents.delete(agentId);
  }

  // Update DB
  const updated = await db.coworkSubAgent.updateMany({
    where: {
      id: agentId,
      status: "RUNNING",
    },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
    },
  });

  return updated.count > 0;
}

/**
 * Get all active sub-agents for a session
 */
export async function getSessionSubAgents(sessionId: string) {
  const agents = await db.coworkSubAgent.findMany({
    where: {
      sessionId,
      status: { in: ["RUNNING", "COMPLETED", "FAILED"] },
    },
    orderBy: { createdAt: "desc" },
  });

  return agents.map((agent) => ({
    id: agent.id,
    sessionId: agent.sessionId,
    description: agent.description,
    type: agent.type.toLowerCase().replace("_", "-") as SubAgentType,
    status: agent.status.toLowerCase() as SubAgentStatus,
    prompt: agent.prompt,
    result: agent.result,
    model: agent.model,
    turns: agent.turns,
    maxTurns: agent.maxTurns,
    createdAt: agent.createdAt.toISOString(),
    completedAt: agent.completedAt?.toISOString(),
  }));
}
