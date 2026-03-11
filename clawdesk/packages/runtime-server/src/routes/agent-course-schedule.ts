import type { FastifyInstance } from "fastify";

import type {
  AgentCourseScheduleBoardPayload,
  AgentCourseScheduleEntry,
  AgentCourseScheduleEntryInput,
  AgentCourseScheduleImportInput,
  AgentCourseScheduleImportResult
} from "@clawdesk/shared-types";

import {
  AgentCourseScheduleValidationError,
  createAgentCourseScheduleEntry,
  deleteAgentCourseScheduleEntry,
  getAgentCourseScheduleBoard,
  importAgentCourseSchedule,
  updateAgentCourseScheduleEntry
} from "../services/agent-course-schedule.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerAgentCourseScheduleRoutes(server: FastifyInstance) {
  server.get("/api/v1/agent-course-schedule", async () => {
    const payload: AgentCourseScheduleBoardPayload = await getAgentCourseScheduleBoard();
    return success(payload);
  });

  server.post("/api/v1/agent-course-schedule", async (request, reply) => {
    try {
      const payload: AgentCourseScheduleEntry = await createAgentCourseScheduleEntry(
        (request.body ?? {}) as AgentCourseScheduleEntryInput
      );
      reply.code(201);
      return success(payload);
    } catch (error) {
      if (error instanceof AgentCourseScheduleValidationError) {
        reply.code(400);
        return failure("AGENT_COURSE_SCHEDULE_CREATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.post("/api/v1/agent-course-schedule/import", async (request, reply) => {
    try {
      const payload: AgentCourseScheduleImportResult = await importAgentCourseSchedule(
        (request.body ?? {}) as AgentCourseScheduleImportInput
      );
      return success(payload);
    } catch (error) {
      if (error instanceof AgentCourseScheduleValidationError) {
        reply.code(400);
        return failure("AGENT_COURSE_SCHEDULE_IMPORT_FAILED", error.message);
      }

      throw error;
    }
  });

  server.put("/api/v1/agent-course-schedule/:entryId", async (request, reply) => {
    try {
      const { entryId } = request.params as { entryId: string };
      const payload = await updateAgentCourseScheduleEntry(entryId, (request.body ?? {}) as AgentCourseScheduleEntryInput);
      if (!payload) {
        reply.code(404);
        return failure("AGENT_COURSE_SCHEDULE_NOT_FOUND", `Course entry ${entryId} not found.`);
      }

      return success(payload);
    } catch (error) {
      if (error instanceof AgentCourseScheduleValidationError) {
        reply.code(400);
        return failure("AGENT_COURSE_SCHEDULE_UPDATE_FAILED", error.message);
      }

      throw error;
    }
  });

  server.delete("/api/v1/agent-course-schedule/:entryId", async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const payload = await deleteAgentCourseScheduleEntry(entryId);
    if (!payload) {
      reply.code(404);
      return failure("AGENT_COURSE_SCHEDULE_NOT_FOUND", `Course entry ${entryId} not found.`);
    }

    return success(payload);
  });
}
