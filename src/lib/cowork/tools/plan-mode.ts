/**
 * Plan Mode Tools
 * EnterPlanMode and ExitPlanMode
 */

import { db } from "@/lib/db";
import { storePlan } from "../plan-store";
import type { ToolExecutor } from "./types";

export const enterPlanModeTool: ToolExecutor = {
  name: "EnterPlanMode",
  description: "Enter plan mode. In plan mode, only read-only tools (Read, Glob, Grep, WebSearch, WebFetch) are available. Use this when you need to gather information before proposing a plan.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    try {
      await db.coworkSession.update({
        where: { id: context.sessionId },
        data: { planMode: true },
      });

      return {
        content: "Entered plan mode. Only read-only tools are now available. Use ExitPlanMode when ready to propose a plan.",
        isError: false,
        metadata: { planMode: true },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error entering plan mode: ${message}`,
        isError: true,
      };
    }
  },
};

export const exitPlanModeTool: ToolExecutor = {
  name: "ExitPlanMode",
  description: "Exit plan mode and propose a plan. The plan will be sent to the user for approval before execution continues.",
  parameters: {
    type: "object",
    properties: {
      plan: {
        type: "string",
        description: "The proposed plan as a clear, step-by-step description",
      },
    },
    required: ["plan"],
  },
  permissionLevel: "auto",
  async execute(input, context) {
    const { plan } = input as { plan: string };

    if (!plan || typeof plan !== "string") {
      return {
        content: "Error: plan must be a non-empty string",
        isError: true,
      };
    }

    try {
      // Parse plan into steps (simple heuristic: lines starting with numbers or bullets)
      const lines = plan.split("\n").filter((l) => l.trim().length > 0);
      const steps = lines.map((line, index) => ({
        id: `step_${index}`,
        description: line.replace(/^[\d\-\*\+]\s+/, "").trim(), // Remove leading numbers/bullets
        status: "pending" as const,
      }));

      const planId = `plan_${context.sessionId}_${Date.now()}`;

      // Store the plan for approval
      storePlan({
        planId,
        sessionId: context.sessionId,
        plan,
        steps,
        createdAt: Date.now(),
      });

      // Keep plan mode ON until user approves
      // Don't update session.planMode here - wait for approval

      return {
        content: `Plan proposed with ${steps.length} step(s). Waiting for user approval...`,
        isError: false,
        metadata: {
          planId,
          plan,
          steps,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: `Error exiting plan mode: ${message}`,
        isError: true,
      };
    }
  },
};
