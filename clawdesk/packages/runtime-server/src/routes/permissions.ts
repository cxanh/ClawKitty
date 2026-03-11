import type { FastifyInstance } from "fastify";

import type {
  PermissionRiskDefaultsUpdateInput,
  PermissionsOverviewPayload,
  PermissionToolPolicy,
  PermissionToolPolicyUpdateInput
} from "@clawdesk/shared-types";

import { failure, success } from "../services/response.service.js";
import {
  getPermissionsOverview,
  PermissionsValidationError,
  updatePermissionRiskDefaults,
  updatePermissionToolPolicy
} from "../services/permissions.service.js";

export async function registerPermissionsRoutes(server: FastifyInstance) {
  server.get("/api/v1/permissions", async () => {
    const payload: PermissionsOverviewPayload = await getPermissionsOverview();
    return success(payload);
  });

  server.put("/api/v1/permissions/risk-defaults", async (request, reply) => {
    try {
      const payload: PermissionsOverviewPayload = await updatePermissionRiskDefaults(
        (request.body ?? {}) as PermissionRiskDefaultsUpdateInput
      );
      return success(payload);
    } catch (error) {
      if (error instanceof PermissionsValidationError) {
        reply.code(400);
        return failure("PERMISSIONS_INVALID", error.message);
      }

      throw error;
    }
  });

  server.put("/api/v1/permissions/tools/:toolId", async (request, reply) => {
    const { toolId } = request.params as { toolId: string };

    try {
      const payload: PermissionToolPolicy | null = await updatePermissionToolPolicy(
        toolId,
        (request.body ?? {}) as PermissionToolPolicyUpdateInput
      );

      if (!payload) {
        reply.code(404);
        return failure("PERMISSION_TOOL_NOT_FOUND", `Tool ${toolId} not found.`);
      }

      return success(payload);
    } catch (error) {
      if (error instanceof PermissionsValidationError) {
        reply.code(400);
        return failure("PERMISSIONS_INVALID", error.message);
      }

      throw error;
    }
  });
}
