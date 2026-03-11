import type { FastifyInstance } from "fastify";

import type { AgentReminderDeliveriesPollPayload } from "@clawdesk/shared-types";

import { pollDueReminderDeliveries } from "../services/agent-reminder-delivery.service.js";
import { success } from "../services/response.service.js";

export async function registerAgentReminderDeliveryRoutes(server: FastifyInstance) {
  server.post("/api/v1/agent-reminder-deliveries/poll", async () => {
    const payload: AgentReminderDeliveriesPollPayload = await pollDueReminderDeliveries();
    return success(payload);
  });
}
