import type { FastifyInstance } from "fastify";

import type {
  AgentReminderPlanFromSafeActionInput,
  AgentReminderPlansBoardPayload,
  AgentReminderPlanRecord,
  AgentReminderPlanStatusUpdateInput
} from "@clawdesk/shared-types";

import {
  AgentReminderPlanValidationError,
  createAgentReminderPlanFromSafeAction,
  getAgentReminderPlansBoard,
  updateAgentReminderPlanStatus
} from "../services/agent-reminder-plan.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentReminderPlanRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-reminder-plans", async () => {
    const payload: AgentReminderPlansBoardPayload = await getAgentReminderPlansBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-reminder-plans/from-safe-action", async (request, reply) => {
    try {
      const payload = await createAgentReminderPlanFromSafeAction(
        (request.body ?? {}) as AgentReminderPlanFromSafeActionInput
      );

      if (!payload) {
        reply.code(404);
        return failure("AGENT_SAFE_ACTION_NOT_FOUND", "Safe action not found.");
      }

      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentReminderPlanValidationError) {
        reply.code(400);
        return failure("AGENT_REMINDER_PLAN_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.patch("/api/v1/agent-reminder-plans/:planId/status", async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const payload: AgentReminderPlanRecord | null = await updateAgentReminderPlanStatus(
      planId,
      (request.body ?? {}) as AgentReminderPlanStatusUpdateInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_REMINDER_PLAN_NOT_FOUND", `Reminder plan ${planId} not found.`);
    }

    return success(payload);
  });
}
