import type { FastifyInstance } from "fastify";

import type {
  CapabilitiesOverviewPayload,
  CapabilityModelInfo,
  CapabilitySkillInfo,
  CapabilityToolInfo
} from "@clawdesk/shared-types";

import {
  getCapabilitiesOverview,
  listCapabilityModels,
  listCapabilitySkills,
  listCapabilityTools
} from "../services/capabilities.service.js";
import { success } from "../services/response.service.js";

export async function registerCapabilitiesRoutes(server: FastifyInstance) {
  server.get("/api/v1/capabilities", async () => {
    const payload: CapabilitiesOverviewPayload = await getCapabilitiesOverview();
    return success(payload);
  });

  server.get("/api/v1/capabilities/models", async () => {
    const payload: CapabilityModelInfo[] = await listCapabilityModels();
    return success(payload);
  });

  server.get("/api/v1/capabilities/skills", async () => {
    const payload: CapabilitySkillInfo[] = await listCapabilitySkills();
    return success(payload);
  });

  server.get("/api/v1/capabilities/tools", async () => {
    const payload: CapabilityToolInfo[] = await listCapabilityTools();
    return success(payload);
  });
}
