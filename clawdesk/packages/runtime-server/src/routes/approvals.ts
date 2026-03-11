import type { FastifyInstance } from "fastify";

import type {
  ApprovalRequestCreateResult,
  ApprovalRequestDecisionResult,
  ApprovalRequestItem
} from "@clawdesk/shared-types";

import { failure, success } from "../services/response.service.js";
import {
  approveApprovalRequest,
  ApprovalValidationError,
  createAgentTaskToolApprovalRequest,
  createChatToolApprovalRequest,
  createDeviceRemoveApprovalRequest,
  createProcessKillApprovalRequest,
  listApprovalRequests,
  rejectApprovalRequest
} from "../services/approval.service.js";

export async function registerApprovalRoutes(server: FastifyInstance) {
  server.get("/api/v1/approvals", async (request) => {
    const { limit = "20" } = request.query as { limit?: string };
    const payload: ApprovalRequestItem[] = await listApprovalRequests(Number.parseInt(limit, 10));
    return success(payload);
  });

  server.post("/api/v1/approvals/process-kill", async (request, reply) => {
    const { pid } = (request.body ?? {}) as { pid?: number };

    try {
      const payload: ApprovalRequestCreateResult = await createProcessKillApprovalRequest(Number(pid));
      if (payload.created) {
        reply.code(201);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/approvals/device-remove", async (request, reply) => {
    const { deviceId } = (request.body ?? {}) as { deviceId?: string };

    try {
      const payload: ApprovalRequestCreateResult = await createDeviceRemoveApprovalRequest(String(deviceId ?? ""));
      if (payload.created) {
        reply.code(201);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/approvals/chat-hint", async (request, reply) => {
    const { conversationId, toolId } = (request.body ?? {}) as { conversationId?: string; toolId?: string };

    try {
      const payload: ApprovalRequestCreateResult = await createChatToolApprovalRequest(
        String(conversationId ?? ""),
        String(toolId ?? "")
      );
      if (payload.created) {
        reply.code(201);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/approvals/agent-task-hint", async (request, reply) => {
    const { taskId, toolId } = (request.body ?? {}) as { taskId?: string; toolId?: string };

    try {
      const payload: ApprovalRequestCreateResult = await createAgentTaskToolApprovalRequest(
        String(taskId ?? ""),
        String(toolId ?? "")
      );
      if (payload.created) {
        reply.code(201);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/approvals/:requestId/approve", async (request, reply) => {
    const { requestId } = request.params as { requestId: string };

    try {
      const payload: ApprovalRequestDecisionResult | null = await approveApprovalRequest(requestId);
      if (!payload) {
        reply.code(404);
        return failure("APPROVAL_REQUEST_NOT_FOUND", `Approval request ${requestId} not found.`);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/approvals/:requestId/reject", async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    const { reason } = (request.body ?? {}) as { reason?: string };

    try {
      const payload: ApprovalRequestDecisionResult | null = await rejectApprovalRequest(requestId, reason);
      if (!payload) {
        reply.code(404);
        return failure("APPROVAL_REQUEST_NOT_FOUND", `Approval request ${requestId} not found.`);
      }
      return success(payload);
    } catch (error) {
      if (error instanceof ApprovalValidationError) {
        reply.code(400);
        return failure("APPROVAL_REQUEST_INVALID", error.message);
      }

      throw error;
    }
  });
}
