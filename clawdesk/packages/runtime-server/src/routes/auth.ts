import type { FastifyInstance } from "fastify";

import { listOpenClawAuthProfiles } from "@clawdesk/openclaw-core";

import { success } from "../services/response.service.js";

export async function registerAuthRoutes(server: FastifyInstance) {
  server.get("/api/v1/auth/profiles", async () => {
    const profiles = await listOpenClawAuthProfiles();
    return success(profiles);
  });
}
