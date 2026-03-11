import type { FastifyInstance } from "fastify";

import {
  activateOpenClawBrowserRelayTarget,
  closeOpenClawBrowserRelayTarget,
  getOpenClawBrowserRelayStartupGuide,
  getOpenClawBrowserRelayStatus,
  OpenClawBrowserRelayActionError,
  openOpenClawBrowserExtensionFolder,
  openOpenClawBrowserExtensionOptions,
  openOpenClawBrowserRelayTarget,
  startOpenClawBrowserGateway
} from "@clawdesk/openclaw-core";

import { getBrowserRelayMonitorState } from "../services/browser-relay-monitor.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerBrowserRoutes(server: FastifyInstance) {
  server.get("/api/v1/browser/relay", async () => {
    const relay = await getOpenClawBrowserRelayStatus();
    return success(relay);
  });

  server.get("/api/v1/browser/relay/guide", async () => {
    const guide = await getOpenClawBrowserRelayStartupGuide();
    return success(guide);
  });

  server.get("/api/v1/browser/relay/events", async (request) => {
    const { limit = "20" } = request.query as { limit?: string };
    const state = getBrowserRelayMonitorState(Number.parseInt(limit, 10));
    return success(state);
  });

  server.post("/api/v1/browser/relay/open-target", async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { url?: string };
      const result = await openOpenClawBrowserRelayTarget(body.url ?? "");
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/browser/relay/start-gateway", async (_request, reply) => {
    try {
      const result = await startOpenClawBrowserGateway();
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/browser/relay/open-extension-folder", async (_request, reply) => {
    try {
      const result = await openOpenClawBrowserExtensionFolder();
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/browser/relay/open-extension-options", async (_request, reply) => {
    try {
      const result = await openOpenClawBrowserExtensionOptions();
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/browser/relay/activate-target", async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { targetId?: string };
      const result = await activateOpenClawBrowserRelayTarget(body.targetId ?? "");
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.post("/api/v1/browser/relay/close-target", async (request, reply) => {
    try {
      const body = (request.body ?? {}) as { targetId?: string };
      const result = await closeOpenClawBrowserRelayTarget(body.targetId ?? "");
      return success(result);
    } catch (error) {
      if (error instanceof OpenClawBrowserRelayActionError) {
        reply.code(400);
        return failure("BROWSER_RELAY_ACTION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });
}
