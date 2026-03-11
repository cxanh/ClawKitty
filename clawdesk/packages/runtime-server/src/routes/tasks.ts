import type { FastifyInstance } from "fastify";

import {
  OpenClawTaskEditorError,
  createOpenClawTask,
  deleteOpenClawTasks,
  deleteOpenClawTask,
  getOpenClawTaskDetail,
  listOpenClawTaskRuns,
  listOpenClawTasks,
  setOpenClawTasksEnabled,
  updateOpenClawTask
} from "@clawdesk/openclaw-core";

import { failure, success } from "../services/response.service.js";

export async function registerTaskRoutes(server: FastifyInstance) {
  server.get("/api/v1/tasks", async () => {
    const tasks = await listOpenClawTasks();
    return success(tasks);
  });

  server.post("/api/v1/tasks", async (request, reply) => {
    try {
      const detail = await createOpenClawTask(request.body);
      reply.code(201);
      return success(detail);
    } catch (error) {
      if (error instanceof OpenClawTaskEditorError) {
        reply.code(400);
        return failure("TASK_VALIDATION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.put("/api/v1/tasks/:taskId", async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId;

    try {
      const detail = await updateOpenClawTask(taskId, request.body);

      if (!detail) {
        reply.code(404);
        return failure("TASK_NOT_FOUND", `Task ${taskId} not found`);
      }

      return success(detail);
    } catch (error) {
      if (error instanceof OpenClawTaskEditorError) {
        reply.code(400);
        return failure("TASK_VALIDATION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.delete("/api/v1/tasks/:taskId", async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId;
    const result = await deleteOpenClawTask(taskId);

    if (!result) {
      reply.code(404);
      return failure("TASK_NOT_FOUND", `Task ${taskId} not found`);
    }

    return success(result);
  });

  server.post("/api/v1/tasks/bulk", async (request, reply) => {
    const body = (request.body ?? {}) as { action?: string; taskIds?: string[] };

    try {
      if (body.action === "enable") {
        const result = await setOpenClawTasksEnabled(body.taskIds ?? [], true);
        return success(result);
      }

      if (body.action === "disable") {
        const result = await setOpenClawTasksEnabled(body.taskIds ?? [], false);
        return success(result);
      }

      if (body.action === "delete") {
        const result = await deleteOpenClawTasks(body.taskIds ?? []);
        return success(result);
      }

      reply.code(400);
      return failure("TASK_BULK_ACTION_INVALID", "Bulk action must be one of enable, disable, delete.");
    } catch (error) {
      if (error instanceof OpenClawTaskEditorError) {
        reply.code(400);
        return failure("TASK_VALIDATION_FAILED", error.message, error.details);
      }

      throw error;
    }
  });

  server.get("/api/v1/tasks/:taskId/runs", async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId;
    const detail = await getOpenClawTaskDetail(taskId);

    if (!detail) {
      reply.code(404);
      return failure("TASK_NOT_FOUND", `Task ${taskId} not found`);
    }

    const { limit = "20" } = request.query as { limit?: string };
    const runs = await listOpenClawTaskRuns(taskId, Number.parseInt(limit, 10));
    return success(runs);
  });

  server.get("/api/v1/tasks/:taskId", async (request, reply) => {
    const taskId = (request.params as { taskId: string }).taskId;
    const detail = await getOpenClawTaskDetail(taskId);

    if (!detail) {
      reply.code(404);
      return failure("TASK_NOT_FOUND", `Task ${taskId} not found`);
    }

    return success(detail);
  });
}
