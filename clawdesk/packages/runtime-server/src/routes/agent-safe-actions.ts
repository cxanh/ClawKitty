import type { FastifyInstance } from "fastify";

import type {
  AgentSafeActionsBoardPayload,
  AgentSafeActionFromChatInput,
  AgentSafeActionFromTaskInput,
  AgentSafeActionRecord,
  AgentSafeActionStatusUpdateInput
} from "@clawdesk/shared-types";

import {
  AgentSafeActionValidationError,
  createAgentSafeActionFromChat,
  createAgentSafeActionFromTask,
  getAgentSafeActionsBoard,
  updateAgentSafeActionStatus
} from "../services/agent-safe-action.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentSafeActionRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-safe-actions", async () => {
    const payload: AgentSafeActionsBoardPayload = await getAgentSafeActionsBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-safe-actions/from-chat", async (request, reply) => {
    try {
      const payload = await createAgentSafeActionFromChat((request.body ?? {}) as AgentSafeActionFromChatInput);
      if (!payload) {
        reply.code(404);
        return failure("CHAT_CONVERSATION_NOT_FOUND", "Conversation not found.");
      }

      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentSafeActionValidationError) {
        reply.code(400);
        return failure("AGENT_SAFE_ACTION_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/agent-safe-actions/from-task", async (request, reply) => {
    const payload = await createAgentSafeActionFromTask((request.body ?? {}) as AgentSafeActionFromTaskInput);
    if (!payload) {
      reply.code(404);
      return failure("AGENT_TASK_NOT_FOUND", "Agent task not found.");
    }

    reply.code(201);
    return success(payload);
  });

  server.patch("/api/v1/agent-safe-actions/:actionId/status", async (request, reply) => {
    const { actionId } = request.params as { actionId: string };
    const payload: AgentSafeActionRecord | null = await updateAgentSafeActionStatus(
      actionId,
      (request.body ?? {}) as AgentSafeActionStatusUpdateInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_SAFE_ACTION_NOT_FOUND", `Safe action ${actionId} not found.`);
    }

    return success(payload);
  });
}
