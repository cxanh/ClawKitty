import crypto from "node:crypto";

import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerActivityRoutes } from "./routes/activity.js";
import { registerApprovalRoutes } from "./routes/approvals.js";
import { registerAgentSafeActionRoutes } from "./routes/agent-safe-actions.js";
import { registerAgentFileWorkspaceRoutes } from "./routes/agent-file-workspaces.js";
import { registerAgentReminderPlanRoutes } from "./routes/agent-reminder-plans.js";
import { registerAgentReminderDeliveryRoutes } from "./routes/agent-reminder-deliveries.js";
import { registerAgentStudyRoadmapRoutes } from "./routes/agent-study-roadmaps.js";
import { registerAgentCourseScheduleRoutes } from "./routes/agent-course-schedule.js";
import { registerAgentTaskRoutes } from "./routes/agent-tasks.js";
import { registerAgentRoutes } from "./routes/agents.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerBrowserRoutes } from "./routes/browser.js";
import { registerCapabilitiesRoutes } from "./routes/capabilities.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerDeviceRoutes } from "./routes/devices.js";
import { registerLogRoutes } from "./routes/logs.js";
import { registerMobileRoutes } from "./routes/mobile.js";
import { registerModelsRoutes } from "./routes/models.js";
import { registerOpenClawRoutes } from "./routes/openclaw.js";
import { registerPermissionsRoutes } from "./routes/permissions.js";
import { registerProcessRoutes } from "./routes/processes.js";
import { registerRuntimeRoutes } from "./routes/runtime.js";
import { registerSystemRoutes } from "./routes/system.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { startBrowserRelayMonitor } from "./services/browser-relay-monitor.service.js";
import { appendRuntimeLog } from "./services/logger.service.js";

export async function buildServer() {
  const server = Fastify({
    logger: true
  });

  await server.register(cors, {
    origin: true
  });

  await registerRuntimeRoutes(server);
  await registerSystemRoutes(server);
  await registerChatRoutes(server);
  await registerAgentTaskRoutes(server);
  await registerAgentSafeActionRoutes(server);
  await registerAgentFileWorkspaceRoutes(server);
  await registerAgentReminderPlanRoutes(server);
  await registerAgentReminderDeliveryRoutes(server);
  await registerAgentCourseScheduleRoutes(server);
  await registerAgentStudyRoadmapRoutes(server);
  await registerActivityRoutes(server);
  await registerApprovalRoutes(server);
  await registerCapabilitiesRoutes(server);
  await registerPermissionsRoutes(server);
  await registerModelsRoutes(server);
  await registerAuthRoutes(server);
  await registerAgentRoutes(server);
  await registerTaskRoutes(server);
  await registerDeviceRoutes(server);
  await registerMobileRoutes(server);
  await registerProcessRoutes(server);
  await registerOpenClawRoutes(server);
  await registerBrowserRoutes(server);
  await registerLogRoutes(server);
  startBrowserRelayMonitor();

  server.setErrorHandler((error, request, reply) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    void appendRuntimeLog("error", "request failed", {
      method: request.method,
      url: request.url,
      message,
      stack
    });

    reply.code(500).send({
      success: false,
      error: {
        code: "RUNTIME_SERVER_ERROR",
        message
      },
      meta: {
        requestId: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }
    });
  });

  return server;
}
