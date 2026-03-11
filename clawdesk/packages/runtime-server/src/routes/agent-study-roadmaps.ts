import type { FastifyInstance } from "fastify";

import type {
  AgentStudyRoadmapFromSafeActionInput,
  AgentStudyRoadmapRecord,
  AgentStudyRoadmapsBoardPayload,
  AgentStudyRoadmapStatusUpdateInput
} from "@clawdesk/shared-types";

import {
  AgentStudyRoadmapValidationError,
  createAgentStudyRoadmapFromSafeAction,
  getAgentStudyRoadmapsBoard,
  updateAgentStudyRoadmapStatus
} from "../services/agent-study-roadmap.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentStudyRoadmapRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-study-roadmaps", async () => {
    const payload: AgentStudyRoadmapsBoardPayload = await getAgentStudyRoadmapsBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-study-roadmaps/from-safe-action", async (request, reply) => {
    try {
      const payload = await createAgentStudyRoadmapFromSafeAction(
        (request.body ?? {}) as AgentStudyRoadmapFromSafeActionInput
      );

      if (!payload) {
        reply.code(404);
        return failure("AGENT_SAFE_ACTION_NOT_FOUND", "Safe action not found.");
      }

      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentStudyRoadmapValidationError) {
        reply.code(400);
        return failure("AGENT_STUDY_ROADMAP_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.patch("/api/v1/agent-study-roadmaps/:roadmapId/status", async (request, reply) => {
    const { roadmapId } = request.params as { roadmapId: string };
    const payload: AgentStudyRoadmapRecord | null = await updateAgentStudyRoadmapStatus(
      roadmapId,
      (request.body ?? {}) as AgentStudyRoadmapStatusUpdateInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_STUDY_ROADMAP_NOT_FOUND", `Study roadmap ${roadmapId} not found.`);
    }

    return success(payload);
  });
}
