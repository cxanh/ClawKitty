import type { FastifyInstance } from "fastify";

import { success } from "../services/response.service.js";
import { getSystemSummary } from "../services/system.service.js";

export async function registerSystemRoutes(server: FastifyInstance) {
  server.get("/api/v1/system/summary", async () => {
    const summary = await getSystemSummary();
    return success(summary);
  });
}
