/**
 * GetSubAgentResults Tool
 * Fetches results from completed sub-agents
 */

import { getSessionSubAgents } from "../sub-agent";
import type { ToolExecutor } from "./types";

export const getSubAgentResultsTool: ToolExecutor = {
  name: "GetSubAgentResults",
  description:
    "Retrieve results from spawned sub-agents. IMPORTANT: Only call this tool ONCE after spawning sub-agents. Sub-agents run in parallel and take time to complete (30-60 seconds). The tool will automatically wait for completion and return all results when ready. Do not call repeatedly - trust that it will wait and return when done.",
  parameters: {
    type: "object",
    properties: {
      check_only: {
        type: "boolean",
        description:
          "If true, just check status without waiting. If false (default), waits for all to complete before returning.",
        default: false,
      },
    },
    required: [],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { check_only = false } = input as {
      check_only?: boolean;
    };

    try {
      const agents = await getSessionSubAgents(context.sessionId);

      if (agents.length === 0) {
        return {
          content: "No sub-agents found for this session.",
          isError: false,
        };
      }

      // If check_only, return current status immediately
      if (check_only) {
        const stillRunning = agents.filter((a) => a.status === "running");
        const completed = agents.filter((a) => a.status === "completed");

        return {
          content: `Sub-agent status: ${completed.length}/${agents.length} completed. ${stillRunning.length > 0 ? `Still running: ${stillRunning.map((a) => `"${a.description}"`).join(", ")}. Check back later.` : "All complete!"}`,
          isError: false,
          metadata: {
            total: agents.length,
            running: stillRunning.length,
            completed: completed.length,
          },
        };
      }

      // Wait for completion (poll every 5 seconds, max 2 minutes)
      const maxWaitSeconds = 120;
      const pollIntervalSeconds = 5;
      const maxAttempts = Math.floor(maxWaitSeconds / pollIntervalSeconds);

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const currentAgents = await getSessionSubAgents(context.sessionId);
        const stillRunning = currentAgents.filter(
          (a) => a.status === "running",
        );

        if (stillRunning.length === 0) {
          // All done! Return results
          const results = currentAgents.map((agent) => ({
            description: agent.description,
            status: agent.status,
            result: agent.result || "(no result)",
            turns: agent.turns,
          }));

          const formattedResults = results
            .map((r) => {
              const statusEmoji =
                r.status === "completed"
                  ? "✓"
                  : r.status === "failed"
                    ? "✗"
                    : "○";
              return `${statusEmoji} **${r.description}**\nStatus: ${r.status}\nTurns: ${r.turns}\n\nResult:\n${r.result}\n`;
            })
            .join("\n---\n\n");

          return {
            content: `All ${currentAgents.length} sub-agents completed! Here are the results:\n\n${formattedResults}\n\nPlease compile these findings into your final response.`,
            isError: false,
            metadata: {
              agents: results,
              waitedSeconds: attempt * pollIntervalSeconds,
            },
          };
        }

        // Wait before next check
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, pollIntervalSeconds * 1000),
          );
        }
      }

      // Timeout - return partial results
      const currentAgents = await getSessionSubAgents(context.sessionId);
      const completed = currentAgents.filter((a) => a.status === "completed");
      const stillRunning = currentAgents.filter((a) => a.status === "running");

      return {
        content: `Timeout after ${maxWaitSeconds} seconds. ${completed.length}/${currentAgents.length} completed. Still running: ${stillRunning.map((a) => `"${a.description}"`).join(", ")}. You can try calling this tool again or work with partial results.`,
        isError: false,
        metadata: {
          total: currentAgents.length,
          completed: completed.length,
          running: stillRunning.length,
          timedOut: true,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error fetching sub-agent results: ${message}`,
        isError: true,
      };
    }
  },
};
