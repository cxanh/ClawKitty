import type { FastifyInstance } from "fastify";

import { getOpenClawOverview } from "@clawdesk/openclaw-core";

import { success } from "../services/response.service.js";

export async function registerOpenClawRoutes(server: FastifyInstance) {
  server.get("/api/v1/openclaw/overview", async () => {
    const overview = await getOpenClawOverview();
    return success(overview);
  });
}
