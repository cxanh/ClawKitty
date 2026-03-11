import type { FastifyInstance } from "fastify";

import type {
  PairedDeviceMutationResult,
  PairingAuditEntry,
  PairingAuditExportResult,
  PairingAuditQueryResult,
  PairingApprovalResult,
  PairingCenterSessionPayload,
  PairingCenterStatusPayload,
  PairingPendingApproval,
  PairingSessionCleanupResult
} from "@clawdesk/shared-types";
import {
  cleanupExpiredOpenClawPairingSessions,
  exportOpenClawPairingAudit,
  OpenClawPairingError,
  approveOpenClawPendingApproval,
  createOpenClawPairingSession,
  getOpenClawBrowserRelayStatus,
  getOpenClawActivePairingSession,
  getOpenClawPairedDeviceDetail,
  listOpenClawPairingAuditEntries,
  listOpenClawPendingApprovals,
  listOpenClawPairedDevices,
  queryOpenClawPairingAudit,
  removeOpenClawPairedDevice,
  rejectOpenClawPendingApproval,
  updateOpenClawPairedDeviceApprovedScopes
} from "@clawdesk/openclaw-core";

import { failure, success } from "../services/response.service.js";
import { getRuntimeHealth } from "../services/runtime-health.service.js";

function getDeviceAgeState(lastUsedAt: string | null) {
  if (!lastUsedAt) {
    return "unknown";
  }

  const ageMs = Date.now() - Date.parse(lastUsedAt);
  if (Number.isNaN(ageMs)) {
    return "unknown";
  }

  return ageMs <= 1000 * 60 * 60 * 24 * 7 ? "recent" : "stale";
}

export async function registerDeviceRoutes(server: FastifyInstance) {
  server.get("/api/v1/devices", async () => {
    const devices = await listOpenClawPairedDevices();
    return success(devices);
  });

  server.get("/api/v1/devices/pairing-center", async () => {
    const [devices, runtime, relay, activeSession, audit] = await Promise.all([
      listOpenClawPairedDevices(),
      getRuntimeHealth(),
      getOpenClawBrowserRelayStatus(),
      getOpenClawActivePairingSession(),
      listOpenClawPairingAuditEntries(5)
    ]);

    const payload: PairingCenterStatusPayload = {
      generatedAt: new Date().toISOString(),
      approvalMode: "desktop-approval-required",
      transport: "qr+token",
      supportedClients: ["android", "mini-program"],
      runtimeReady: runtime.status === "online" || runtime.status === "degraded",
      relayReady: relay.relayStatus === "online",
      pairedDevices: {
        total: devices.length,
        approved: devices.filter((device) => device.approvedScopes.length > 0).length,
        pending: devices.filter((device) => device.approvedScopes.length === 0).length,
        recent: devices.filter((device) => getDeviceAgeState(device.lastUsedAt) === "recent").length
      },
      defaultScopes: ["device.read", "task.read", "logs.read", "relay.read", "alerts.read"],
      plannedWriteScopes: ["task.write", "relay.control"],
      restrictedActions: [
        "process.kill",
        "desktop.settings.write",
        "provider.credentials.read",
        "browser.detach-only"
      ],
      nextSteps: [
        "Add a desktop pairing center page that can generate a short-lived QR token.",
        "Approve pairing and requested scopes on desktop before mobile starts polling.",
        "Keep phase one mobile clients read-only until audit and revoke flows are ready."
      ],
      notes: [
        "Desktop remains the approval authority for the first mobile release.",
        `Current active pairing session: ${activeSession ? activeSession.sessionId : "none"}.`,
        `Recent pairing audit events: ${audit.length}.`
      ]
    };

    return success(payload);
  });

  server.get("/api/v1/devices/pairing-audit", async (request) => {
    const { limit = "20" } = request.query as { limit?: string };
    const payload: PairingAuditEntry[] = await listOpenClawPairingAuditEntries(Number.parseInt(limit, 10));
    return success(payload);
  });

  server.get("/api/v1/devices/pairing-audit/query", async (request) => {
    const query = request.query as {
      kind?: PairingAuditQueryResult["filters"]["kind"];
      actor?: PairingAuditQueryResult["filters"]["actor"];
      search?: string;
      limit?: string;
      offset?: string;
    };

    const payload: PairingAuditQueryResult = await queryOpenClawPairingAudit({
      kind: query.kind,
      actor: query.actor,
      search: query.search,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined,
      offset: query.offset ? Number.parseInt(query.offset, 10) : undefined
    });
    return success(payload);
  });

  server.post("/api/v1/devices/pairing-audit/export", async (request) => {
    const body = (request.body ?? {}) as {
      kind?: PairingAuditQueryResult["filters"]["kind"];
      actor?: PairingAuditQueryResult["filters"]["actor"];
      search?: string;
      limit?: number;
      offset?: number;
    };

    const payload: PairingAuditExportResult = await exportOpenClawPairingAudit(body);
    return success(payload);
  });

  server.post("/api/v1/devices/pairing-center/cleanup", async () => {
    const payload: PairingSessionCleanupResult = await cleanupExpiredOpenClawPairingSessions();
    return success(payload);
  });

  server.post("/api/v1/devices/pairing-center/session", async (request, reply) => {
    try {
      const payload: PairingCenterSessionPayload = await createOpenClawPairingSession();
      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof OpenClawPairingError) {
        reply.code(400);
        return failure("PAIRING_SESSION_CREATE_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.get("/api/v1/devices/pending-approvals", async () => {
    const payload: PairingPendingApproval[] = await listOpenClawPendingApprovals();
    return success(payload);
  });

  server.post("/api/v1/devices/pending-approvals/:requestId/approve", async (request, reply) => {
    const requestId = (request.params as { requestId: string }).requestId;
    const body = (request.body ?? {}) as { approvedScopes?: string[] };

    try {
      const payload: PairingApprovalResult | null = await approveOpenClawPendingApproval(
        requestId,
        body.approvedScopes
      );

      if (!payload) {
        reply.code(404);
        return failure("PAIRING_REQUEST_NOT_FOUND", `Pairing request ${requestId} not found`);
      }

      return success(payload);
    } catch (error) {
      if (error instanceof OpenClawPairingError) {
        reply.code(400);
        return failure("PAIRING_APPROVAL_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/devices/pending-approvals/:requestId/reject", async (request, reply) => {
    const requestId = (request.params as { requestId: string }).requestId;
    const body = (request.body ?? {}) as { reason?: string };

    try {
      const payload: PairingApprovalResult | null = await rejectOpenClawPendingApproval(requestId, body.reason);

      if (!payload) {
        reply.code(404);
        return failure("PAIRING_REQUEST_NOT_FOUND", `Pairing request ${requestId} not found`);
      }

      return success(payload);
    } catch (error) {
      if (error instanceof OpenClawPairingError) {
        reply.code(400);
        return failure("PAIRING_REJECTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.put("/api/v1/devices/:deviceId/scopes", async (request, reply) => {
    const deviceId = (request.params as { deviceId: string }).deviceId;
    const body = (request.body ?? {}) as { approvedScopes?: string[] };
    const payload: PairedDeviceMutationResult | null = await updateOpenClawPairedDeviceApprovedScopes(
      deviceId,
      Array.isArray(body.approvedScopes) ? body.approvedScopes.filter((scope): scope is string => typeof scope === "string") : []
    );

    if (!payload) {
      reply.code(404);
      return failure("DEVICE_NOT_FOUND", `Device ${deviceId} not found`);
    }

    return success(payload);
  });

  server.delete("/api/v1/devices/:deviceId", async (request, reply) => {
    const deviceId = (request.params as { deviceId: string }).deviceId;
    const payload: PairedDeviceMutationResult | null = await removeOpenClawPairedDevice(deviceId);

    if (!payload) {
      reply.code(404);
      return failure("DEVICE_NOT_FOUND", `Device ${deviceId} not found`);
    }

    return success(payload);
  });

  server.get("/api/v1/devices/:deviceId", async (request, reply) => {
    const deviceId = (request.params as { deviceId: string }).deviceId;
    const detail = await getOpenClawPairedDeviceDetail(deviceId);

    if (!detail) {
      reply.code(404);
      return failure("DEVICE_NOT_FOUND", `Device ${deviceId} not found`);
    }

    return success(detail);
  });
}
