import type { FastifyInstance } from "fastify";

import { buildServer } from "./server.js";
import { startManagedBrowserRelayHost, stopManagedBrowserRelayHost } from "./services/browser-relay-host.service.js";
import { appendRuntimeLog, initializeRuntimeLogger } from "./services/logger.service.js";

export interface HostedRuntimeHandle {
  baseUrl: string;
  server: FastifyInstance;
  stop(): Promise<void>;
}

export interface HostedRuntimeOptions {
  host?: string;
  port?: number;
  logDir?: string;
  source?: string;
}

export async function startHostedRuntime(options: HostedRuntimeOptions = {}): Promise<HostedRuntimeHandle> {
  const host = options.host ?? process.env.CLAWDESK_RUNTIME_HOST ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.CLAWDESK_RUNTIME_PORT ?? 47890);

  if (options.logDir) {
    process.env.CLAWDESK_LOG_DIR = options.logDir;
  }

  await initializeRuntimeLogger();
  await startManagedBrowserRelayHost();
  const server = await buildServer();
  await server.listen({ host, port });
  await appendRuntimeLog("info", "runtime listening", {
    host,
    port,
    source: options.source ?? "hosted-runtime"
  });

  return {
    baseUrl: `http://${host}:${port}`,
    server,
    async stop() {
      await appendRuntimeLog("info", "runtime stopping", {
        host,
        port,
        source: options.source ?? "hosted-runtime"
      });
      await server.close();
      await stopManagedBrowserRelayHost();
    }
  };
}
