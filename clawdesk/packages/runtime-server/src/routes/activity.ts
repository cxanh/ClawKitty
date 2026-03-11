import type { FastifyInstance } from "fastify";

import type { ActivityFeedItem, ActivityFeedPayload } from "@clawdesk/shared-types";

import { getActivityFeed, getActivityFeedItem } from "../services/activity.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerActivityRoutes(server: FastifyInstance) {
  server.get("/api/v1/activity", async (request) => {
    const { limit = "40" } = request.query as { limit?: string };
    const payload: ActivityFeedPayload = await getActivityFeed(Number.parseInt(limit, 10));
    return success(payload);
  });

  server.get("/api/v1/activity/:activityId", async (request, reply) => {
    const { activityId } = request.params as { activityId: string };
    const payload: ActivityFeedItem | null = await getActivityFeedItem(activityId);

    if (!payload) {
      reply.code(404);
      return failure("ACTIVITY_NOT_FOUND", `Activity ${activityId} not found.`);
    }

    return success(payload);
  });
}
