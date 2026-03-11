import type { FastifyInstance } from "fastify";

import { getProcessByPid, killProcessByPid, listProcesses } from "../services/process.service.js";
import { appendRuntimeLog } from "../services/logger.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerProcessRoutes(server: FastifyInstance) {
  server.get("/api/v1/processes", async (request) => {
    const query = request.query as {
      search?: string;
      sortBy?: "cpu" | "memory" | "name" | "pid";
      order?: "asc" | "desc";
      limit?: string;
    };

    const processes = await listProcesses({
      search: query.search,
      sortBy: query.sortBy,
      order: query.order,
      limit: query.limit ? Number(query.limit) : undefined
    });

    return success(processes);
  });

  server.get("/api/v1/processes/:pid", async (request, reply) => {
    const pid = Number((request.params as { pid: string }).pid);
    const processInfo = await getProcessByPid(pid);

    if (!processInfo) {
      reply.code(404);
      return failure("PROCESS_NOT_FOUND", `Process ${pid} not found`);
    }

    return success(processInfo);
  });

  server.post("/api/v1/processes/:pid/kill", async (request, reply) => {
    const pid = Number((request.params as { pid: string }).pid);

    try {
      const result = await killProcessByPid(pid);

      if (!result) {
        reply.code(404);
        return failure("PROCESS_NOT_FOUND", `Process ${pid} not found`);
      }

      await appendRuntimeLog("warn", "process termination requested", {
        pid: result.pid,
        name: result.name,
        method: result.method
      });

      return success(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reply.code(400);
      return failure("PROCESS_KILL_DENIED", message);
    }
  });
}
