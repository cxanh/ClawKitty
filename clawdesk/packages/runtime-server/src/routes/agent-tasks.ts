import type { FastifyInstance } from "fastify";

import type {
  AgentTaskBoardPayload,
  AgentTaskCard,
  AgentTaskFromChatInput,
  AgentTaskStatusUpdateInput
} from "@clawdesk/shared-types";

import {
  AgentTaskValidationError,
  createAgentTaskFromChat,
  getAgentTaskBoard,
  updateAgentTaskStatus
} from "../services/agent-task.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentTaskRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-tasks", async () => {
    const payload: AgentTaskBoardPayload = await getAgentTaskBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-tasks/from-chat", async (request, reply) => {
    try {
      const payload = await createAgentTaskFromChat((request.body ?? {}) as AgentTaskFromChatInput);

      if (!payload) {
        reply.code(404);
        return failure("CHAT_CONVERSATION_NOT_FOUND", "Conversation not found.");
      }

      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentTaskValidationError) {
        reply.code(400);
        return failure("AGENT_TASK_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.patch("/api/v1/agent-tasks/:taskId/status", async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const payload: AgentTaskCard | null = await updateAgentTaskStatus(
      taskId,
      (request.body ?? {}) as AgentTaskStatusUpdateInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_TASK_NOT_FOUND", `Agent task ${taskId} not found.`);
    }

    return success(payload);
  });
}
