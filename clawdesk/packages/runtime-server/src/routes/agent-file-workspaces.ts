import type { FastifyInstance } from "fastify";

import type {
  AgentFileWorkspaceFromSafeActionInput,
  AgentFileWorkspaceOrganizationPreview,
  AgentFileWorkspacePreviewInput,
  AgentFileWorkspaceRecord,
  AgentFileWorkspaceSearchQuery,
  AgentFileWorkspaceSearchResult,
  AgentFileWorkspacesBoardPayload,
  AgentFileWorkspaceStatusUpdateInput
} from "@clawdesk/shared-types";

import {
  AgentFileWorkspaceValidationError,
  createAgentFileWorkspaceFromSafeAction,
  getAgentFileWorkspacesBoard,
  previewAgentFileWorkspaceOrganization,
  searchAgentFileWorkspace,
  updateAgentFileWorkspaceStatus
} from "../services/agent-file-workspace.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentFileWorkspaceRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-file-workspaces", async () => {
    const payload: AgentFileWorkspacesBoardPayload = await getAgentFileWorkspacesBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-file-workspaces/from-safe-action", async (request, reply) => {
    try {
      const payload = await createAgentFileWorkspaceFromSafeAction(
        (request.body ?? {}) as AgentFileWorkspaceFromSafeActionInput
      );

      if (!payload) {
        reply.code(404);
        return failure("AGENT_SAFE_ACTION_NOT_FOUND", "Safe action not found.");
      }

      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentFileWorkspaceValidationError) {
        reply.code(400);
        return failure("AGENT_FILE_WORKSPACE_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/agent-file-workspaces/:workspaceId/search", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const payload: AgentFileWorkspaceSearchResult | null = await searchAgentFileWorkspace(
      workspaceId,
      (request.body ?? {}) as AgentFileWorkspaceSearchQuery
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_FILE_WORKSPACE_NOT_FOUND", `File workspace ${workspaceId} not found.`);
    }

    return success(payload);
  });

  server.post("/api/v1/agent-file-workspaces/:workspaceId/preview", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const payload: AgentFileWorkspaceOrganizationPreview | null = await previewAgentFileWorkspaceOrganization(
      workspaceId,
      (request.body ?? {}) as AgentFileWorkspacePreviewInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_FILE_WORKSPACE_NOT_FOUND", `File workspace ${workspaceId} not found.`);
    }

    return success(payload);
  });

  server.patch("/api/v1/agent-file-workspaces/:workspaceId/status", async (request, reply) => {
    const { workspaceId } = request.params as { workspaceId: string };
    const payload: AgentFileWorkspaceRecord | null = await updateAgentFileWorkspaceStatus(
      workspaceId,
      (request.body ?? {}) as AgentFileWorkspaceStatusUpdateInput
    );

    if (!payload) {
      reply.code(404);
      return failure("AGENT_FILE_WORKSPACE_NOT_FOUND", `File workspace ${workspaceId} not found.`);
    }

    return success(payload);
  });
}
