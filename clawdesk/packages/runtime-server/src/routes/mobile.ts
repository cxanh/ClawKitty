import type { FastifyInstance } from "fastify";

import type {
  MobileAlertsSummaryPayload,
  MobileAuthBoundary,
  MobileBootstrapPayload,
  MobileOverviewPayload,
  MobilePairingFlowPayload,
  MobilePairingStatusPayload,
  PairingPendingApproval
} from "@clawdesk/shared-types";
import {
  getOpenClawActivePairingSession,
  getOpenClawBrowserRelayStatus,
  getOpenClawOverview,
  listOpenClawPairingAuditEntries,
  listOpenClawPendingApprovals,
  listOpenClawPairedDevices,
  listOpenClawTasks,
  OpenClawPairingError,
  submitOpenClawPairingRequest
} from "@clawdesk/openclaw-core";

import { failure, success } from "../services/response.service.js";
import { getMobileAlertsSummary } from "../services/logger.service.js";
import { getRuntimeHealth } from "../services/runtime-health.service.js";
import { getSystemSummary } from "../services/system.service.js";

function buildMobileAuthBoundary(): MobileAuthBoundary {
  return {
    pairingRequired: true,
    supportedClients: ["android", "mini-program"],
    recommendedPollIntervalSec: 5,
    supportedScopes: ["device.read", "task.read", "logs.read", "relay.read"],
    plannedWriteScopes: ["task.write", "relay.control"],
    restrictedActions: [
      "process.kill",
      "browser.detach-only",
      "provider.credentials.read",
      "desktop.settings.write"
    ],
    notes: [
      "Phase one mobile clients should stay read-mostly.",
      "Pairing approval remains desktop-side until the mobile auth flow is finalized.",
      "High-risk runtime controls stay blocked until we add explicit approval and audit logging."
    ]
  };
}

function buildMobilePairingFlow(): MobilePairingFlowPayload {
  return {
    generatedAt: new Date().toISOString(),
    supportedClients: ["android", "mini-program"],
    approvalMode: "desktop-approval-required",
    pairingTransport: "qr+token",
    requiredDesktopActions: [
      "Generate pairing token on desktop",
      "Approve pairing request on desktop",
      "Approve requested scopes on desktop"
    ],
    requiredMobileActions: [
      "Scan QR code or paste pairing token",
      "Choose client type and device name",
      "Wait for desktop approval"
    ],
    defaultScopes: ["device.read", "task.read", "logs.read", "relay.read"],
    optionalScopes: ["alerts.read"],
    writeScopesPlanned: ["task.write", "relay.control"],
    restrictedActions: [
      "process.kill",
      "browser.detach-only",
      "desktop.settings.write",
      "provider.credentials.read"
    ],
    steps: [
      {
        id: "desktop-prepare",
        title: "Desktop prepares pairing session",
        owner: "desktop",
        status: "planned",
        summary: "Desktop generates a short-lived pairing token and QR code."
      },
      {
        id: "show-qr",
        title: "Desktop shows QR code",
        owner: "desktop",
        status: "planned",
        summary: "Desktop displays a QR code that encodes the pairing token and runtime endpoint hint."
      },
      {
        id: "mobile-scan",
        title: "Mobile scans and submits pairing request",
        owner: "mobile",
        status: "planned",
        summary: "Mobile client scans the QR code, identifies itself, and requests initial read scopes."
      },
      {
        id: "desktop-approve",
        title: "Desktop approves device",
        owner: "desktop",
        status: "planned",
        summary: "Desktop user reviews the device, confirms pairing, and approves the request."
      },
      {
        id: "scope-confirm",
        title: "Scopes become active",
        owner: "shared",
        status: "planned",
        summary: "Approved scopes are persisted in the OpenClaw device registry for later reuse."
      },
      {
        id: "poll-runtime",
        title: "Mobile begins runtime polling",
        owner: "mobile",
        status: "ready",
        summary: "Once approved, mobile starts polling overview, alerts, and bootstrap endpoints."
      }
    ],
    notes: [
      "Phase one pairing should remain desktop-initiated and desktop-approved.",
      "Phase one mobile clients should default to read-only scopes.",
      "Write scopes stay planned until audit and revocation flows are added."
    ]
  };
}

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

export async function registerMobileRoutes(server: FastifyInstance) {
  server.get("/api/v1/mobile/bootstrap", async () => {
    const [runtime, system, openclaw, pairedDevices, relay, tasks] = await Promise.all([
      getRuntimeHealth(),
      getSystemSummary(),
      getOpenClawOverview(),
      listOpenClawPairedDevices(),
      getOpenClawBrowserRelayStatus(),
      listOpenClawTasks()
    ]);

    const pendingDevices = pairedDevices.filter((device) => device.approvedScopes.length === 0).length;
    const recentDevices = pairedDevices.filter((device) => getDeviceAgeState(device.lastUsedAt) === "recent");
    const staleDevices = pairedDevices.filter((device) => getDeviceAgeState(device.lastUsedAt) === "stale").length;

    const payload: MobileBootstrapPayload = {
      generatedAt: new Date().toISOString(),
      runtime,
      system,
      openclaw,
      pairedDevices: {
        total: pairedDevices.length,
        approved: pairedDevices.filter((device) => device.approvedScopes.length > 0).length,
        pending: pendingDevices,
        recentCount: recentDevices.length,
        staleCount: staleDevices,
        recent: recentDevices.slice(0, 5)
      },
      tasks: {
        total: tasks.length,
        enabled: tasks.filter((task) => task.enabled).length,
        error: tasks.filter((task) => task.lastRunStatus === "error").length,
        running: tasks.filter((task) => Boolean(task.runningAt)).length,
        recent: tasks
          .slice()
          .sort((left, right) => {
            const leftTime = left.lastRunAt ? Date.parse(left.lastRunAt) : 0;
            const rightTime = right.lastRunAt ? Date.parse(right.lastRunAt) : 0;
            return rightTime - leftTime;
          })
          .slice(0, 5)
      },
      browserRelay: {
        relayStatus: relay.relayStatus,
        relayAuthStatus: relay.relayAuthStatus,
        extensionConnected: relay.extensionConnected,
        targetCount: relay.targetCount,
        checkedAt: relay.checkedAt
      },
      authBoundary: buildMobileAuthBoundary()
    };

    return success(payload);
  });

  server.get("/api/v1/mobile/overview", async () => {
    const [runtime, system, pairedDevices, relay, tasks, alerts] = await Promise.all([
      getRuntimeHealth(),
      getSystemSummary(),
      listOpenClawPairedDevices(),
      getOpenClawBrowserRelayStatus(),
      listOpenClawTasks(),
      getMobileAlertsSummary(5)
    ]);

    const payload: MobileOverviewPayload = {
      generatedAt: new Date().toISOString(),
      runtime: {
        status: runtime.status,
        collectorStatus: runtime.collectorStatus,
        openclawCoreStatus: runtime.openclawCoreStatus,
        browserRelayStatus: runtime.browserRelayStatus,
        uptimeSec: runtime.uptimeSec
      },
      host: {
        hostname: system.hostname,
        deviceId: system.deviceId,
        platform: system.platform,
        lastHeartbeatAt: system.lastHeartbeatAt
      },
      pairedDevices: {
        total: pairedDevices.length,
        approved: pairedDevices.filter((device) => device.approvedScopes.length > 0).length,
        pending: pairedDevices.filter((device) => device.approvedScopes.length === 0).length,
        recent: pairedDevices.filter((device) => getDeviceAgeState(device.lastUsedAt) === "recent").length,
        stale: pairedDevices.filter((device) => getDeviceAgeState(device.lastUsedAt) === "stale").length
      },
      tasks: {
        total: tasks.length,
        enabled: tasks.filter((task) => task.enabled).length,
        error: tasks.filter((task) => task.lastRunStatus === "error").length,
        running: tasks.filter((task) => Boolean(task.runningAt)).length
      },
      browserRelay: {
        relayStatus: relay.relayStatus,
        relayAuthStatus: relay.relayAuthStatus,
        extensionConnected: relay.extensionConnected,
        targetCount: relay.targetCount
      },
      alerts: {
        total: alerts.total,
        error: alerts.errorCount,
        warn: alerts.warnCount,
        latestMessage: alerts.latest[0]?.message ?? null,
        latestTimestamp: alerts.latest[0]?.timestamp ?? null
      }
    };

    return success(payload);
  });

  server.get("/api/v1/mobile/auth-boundary", async () => {
    return success(buildMobileAuthBoundary());
  });

  server.get("/api/v1/mobile/pairing-flow", async () => {
    return success(buildMobilePairingFlow());
  });

  server.get("/api/v1/mobile/pairing-status", async () => {
    const [runtime, relay, activeSession, pendingApprovals, audit] = await Promise.all([
      getRuntimeHealth(),
      getOpenClawBrowserRelayStatus(),
      getOpenClawActivePairingSession(),
      listOpenClawPendingApprovals(),
      listOpenClawPairingAuditEntries(5)
    ]);

    const payload: MobilePairingStatusPayload = {
      generatedAt: new Date().toISOString(),
      approvalMode: "desktop-approval-required",
      pairingTransport: "qr+token",
      runtimeReady: runtime.status === "online" || runtime.status === "degraded",
      relayReady: relay.relayStatus === "online",
      desktopReady: (runtime.status === "online" || runtime.status === "degraded") && relay.relayStatus === "online",
      hasActivePairingSession: Boolean(activeSession),
      activePairingSession: activeSession,
      pendingApprovalCount: pendingApprovals.length,
      recentAudit: audit,
      supportedClients: ["android", "mini-program"],
      supportedScopes: ["device.read", "task.read", "logs.read", "relay.read", "alerts.read"],
      plannedWriteScopes: ["task.write", "relay.control"],
      notes: [
        "Mobile clients should wait for desktop approval before polling overview endpoints.",
        "The pairing token remains short-lived and desktop-generated.",
        "Write scopes remain planned until approval audit and revoke flows are complete."
      ]
    };

    return success(payload);
  });

  server.get("/api/v1/mobile/alerts-summary", async (request) => {
    const { limit = "10" } = request.query as { limit?: string };
    const payload: MobileAlertsSummaryPayload = await getMobileAlertsSummary(Number.parseInt(limit, 10));
    return success(payload);
  });

  server.post("/api/v1/mobile/pairing-request", async (request, reply) => {
    try {
      const payload: PairingPendingApproval = await submitOpenClawPairingRequest(request.body);
      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof OpenClawPairingError) {
        reply.code(400);
        return failure("PAIRING_REQUEST_INVALID", error.message, error.details);
      }

      throw error;
    }
  });
}
