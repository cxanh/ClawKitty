import type { FastifyInstance } from "fastify";

import { failure } from "../services/response.service.js";
import { success } from "../services/response.service.js";
import { exportLogBundle, getLogSummary, getLogTail, isSupportedLogFileName, queryLogs } from "../services/logger.service.js";

export async function registerLogRoutes(server: FastifyInstance) {
  server.get("/api/v1/logs/summary", async () => {
    const summary = await getLogSummary();
    return success(summary);
  });

  server.get("/api/v1/logs/tail", async (request, reply) => {
    const { file = "runtime.log", lines = "80" } = request.query as {
      file?: string;
      lines?: string;
    };

    if (!isSupportedLogFileName(file)) {
      reply.code(400);
      return failure("INVALID_LOG_FILE", `Unsupported log file: ${file}`);
    }

    const tail = await getLogTail(file, Number.parseInt(lines, 10));
    return success(tail);
  });

  server.get("/api/v1/logs/query", async (request, reply) => {
    const {
      file = "runtime.log",
      lines = "80",
      level = "all",
      search = ""
    } = request.query as {
      file?: string;
      lines?: string;
      level?: string;
      search?: string;
    };

    if (!isSupportedLogFileName(file)) {
      reply.code(400);
      return failure("INVALID_LOG_FILE", `Unsupported log file: ${file}`);
    }

    const result = await queryLogs(file, {
      level: level === "info" || level === "warn" || level === "error" ? level : "all",
      search,
      lines: Number.parseInt(lines, 10)
    });

    return success(result);
  });

  server.post("/api/v1/logs/export", async () => {
    const result = await exportLogBundle();
    return success(result);
  });
}
