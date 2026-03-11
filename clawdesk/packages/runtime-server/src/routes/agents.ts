import type { FastifyInstance } from "fastify";

import { getOpenClawSessionDetail, listOpenClawSessions } from "@clawdesk/openclaw-core";

import { failure, success } from "../services/response.service.js";

export async function registerAgentRoutes(server: FastifyInstance) {
  server.get("/api/v1/agents/sessions", async () => {
    const sessions = await listOpenClawSessions();
    return success(sessions);
  });

  server.get("/api/v1/agents/sessions/:sessionId", async (request, reply) => {
    const sessionId = (request.params as { sessionId: string }).sessionId;
    const detail = await getOpenClawSessionDetail(sessionId);

    if (!detail) {
      reply.code(404);
      return failure("SESSION_NOT_FOUND", `Session ${sessionId} not found`);
    }

    return success(detail);
  });
}
