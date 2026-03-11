import type { FastifyInstance } from "fastify";

import { listOpenClawProviders } from "@clawdesk/openclaw-core";

import { success } from "../services/response.service.js";

export async function registerModelsRoutes(server: FastifyInstance) {
  server.get("/api/v1/models/providers", async () => {
    const providers = await listOpenClawProviders();
    return success(providers);
  });
}
