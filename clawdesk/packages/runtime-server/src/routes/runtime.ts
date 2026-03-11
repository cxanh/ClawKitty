import type { FastifyInstance } from "fastify";

import { getDesktopOnboardingStatus } from "../services/desktop-onboarding.service.js";
import { success } from "../services/response.service.js";
import { getRuntimeHealth } from "../services/runtime-health.service.js";

export async function registerRuntimeRoutes(server: FastifyInstance) {
  server.get("/api/v1/runtime/health", async () => {
    const payload = await getRuntimeHealth();
    return success(payload);
  });

  server.get("/api/v1/runtime/onboarding", async () => {
    const payload = await getDesktopOnboardingStatus();
    return success(payload);
  });
}
