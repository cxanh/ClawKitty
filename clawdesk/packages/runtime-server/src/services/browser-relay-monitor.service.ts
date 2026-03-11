import crypto from "node:crypto";

import { getOpenClawBrowserRelayStatus } from "@clawdesk/openclaw-core";
import type { BrowserRelayEvent, BrowserRelayMonitorState, BrowserRelayStatus } from "@clawdesk/shared-types";

import { appendRuntimeLog } from "./logger.service.js";

const DEFAULT_POLL_INTERVAL_MS = Number(process.env.CLAWDESK_BROWSER_RELAY_POLL_MS ?? 15_000);
const MAX_EVENTS = 80;

let timer: NodeJS.Timeout | null = null;
let startedAt: string | null = null;
let lastCheckedAt: string | null = null;
let currentStatus: BrowserRelayStatus | null = null;
let events: BrowserRelayEvent[] = [];
let lastErrorMessage: string | null = null;

function pushEvent(event: Omit<BrowserRelayEvent, "id" | "timestamp">) {
  const nextEvent: BrowserRelayEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event
  };

  events = [nextEvent, ...events].slice(0, MAX_EVENTS);
  const logLevel = nextEvent.severity === "error" ? "error" : nextEvent.severity === "warn" ? "warn" : "info";
  void appendRuntimeLog(logLevel, `browser relay event: ${nextEvent.kind}`, {
    summary: nextEvent.summary,
    details: nextEvent.details
  });
}

function compareStatus(previous: BrowserRelayStatus | null, next: BrowserRelayStatus) {
  if (!previous) {
    pushEvent({
      kind: "snapshot",
      severity: next.relayStatus === "online" ? "info" : "warn",
      summary: `Initial relay snapshot: relay ${next.relayStatus}, auth ${next.relayAuthStatus}, gateway ${next.gatewayStatus}.`,
      details: {
        relayStatus: next.relayStatus,
        relayAuthStatus: next.relayAuthStatus,
        gatewayStatus: next.gatewayStatus,
        targetCount: next.targetCount
      }
    });
    return;
  }

  if (previous.relayStatus !== next.relayStatus) {
    pushEvent({
      kind: "relay-status",
      severity: next.relayStatus === "online" ? "info" : "warn",
      summary: `Relay status changed from ${previous.relayStatus} to ${next.relayStatus}.`,
      details: {
        previous: previous.relayStatus,
        next: next.relayStatus,
        relayPort: next.relayPort
      }
    });
  }

  if (previous.relayAuthStatus !== next.relayAuthStatus) {
    pushEvent({
      kind: "relay-auth",
      severity: next.relayAuthStatus === "configured" ? "info" : next.relayAuthStatus === "rejected" ? "error" : "warn",
      summary: `Relay auth changed from ${previous.relayAuthStatus} to ${next.relayAuthStatus}.`,
      details: {
        previous: previous.relayAuthStatus,
        next: next.relayAuthStatus,
        statusCode: next.relayVersionProbe.statusCode
      }
    });
  }

  if (previous.gatewayStatus !== next.gatewayStatus) {
    pushEvent({
      kind: "gateway-status",
      severity: next.gatewayStatus === "online" ? "info" : "warn",
      summary: `Gateway status changed from ${previous.gatewayStatus} to ${next.gatewayStatus}.`,
      details: {
        previous: previous.gatewayStatus,
        next: next.gatewayStatus,
        gatewayPort: next.gatewayPort
      }
    });
  }

  if (previous.targetCount !== next.targetCount) {
    pushEvent({
      kind: "target-count",
      severity: "info",
      summary: `Relay target count changed from ${previous.targetCount} to ${next.targetCount}.`,
      details: {
        previous: previous.targetCount,
        next: next.targetCount,
        targets: next.targets.map((target) => ({
          id: target.id,
          title: target.title,
          type: target.type
        }))
      }
    });
  }

  const previousNotes = previous.notes.join(" | ");
  const nextNotes = next.notes.join(" | ");
  if (previousNotes !== nextNotes && next.notes.length > 0) {
    pushEvent({
      kind: "notes",
      severity: "warn",
      summary: "Relay notes changed.",
      details: {
        previous: previous.notes,
        next: next.notes
      }
    });
  }
}

export async function refreshBrowserRelayMonitorNow() {
  try {
    const nextStatus = await getOpenClawBrowserRelayStatus();
    lastCheckedAt = new Date().toISOString();
    compareStatus(currentStatus, nextStatus);
    currentStatus = nextStatus;
    lastErrorMessage = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    lastCheckedAt = new Date().toISOString();

    if (message !== lastErrorMessage) {
      pushEvent({
        kind: "error",
        severity: "error",
        summary: `Relay monitor refresh failed: ${message}`,
        details: {
          message
        }
      });
      lastErrorMessage = message;
    }
  }
}

export function startBrowserRelayMonitor() {
  if (timer) {
    return;
  }

  startedAt = startedAt ?? new Date().toISOString();
  void refreshBrowserRelayMonitorNow();

  timer = setInterval(() => {
    void refreshBrowserRelayMonitorNow();
  }, DEFAULT_POLL_INTERVAL_MS);

  timer.unref?.();
}

export function stopBrowserRelayMonitor() {
  if (!timer) {
    return;
  }

  clearInterval(timer);
  timer = null;
}

export function getBrowserRelayMonitorState(limit = 20): BrowserRelayMonitorState {
  const safeLimit = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 20));

  return {
    startedAt: startedAt ?? new Date().toISOString(),
    lastCheckedAt,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    current: currentStatus,
    eventCount: events.length,
    events: events.slice(0, safeLimit)
  };
}
