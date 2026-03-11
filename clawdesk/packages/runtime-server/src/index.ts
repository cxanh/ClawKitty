import { appendRuntimeLog } from "./services/logger.service.js";
import { startHostedRuntime } from "./runtime-host.js";

const port = Number(process.env.CLAWDESK_RUNTIME_PORT ?? 47890);
const host = process.env.CLAWDESK_RUNTIME_HOST ?? "127.0.0.1";

try {
  await startHostedRuntime({
    host,
    port,
    source: "standalone-index"
  });
  console.log(`ClawDesk runtime listening on http://${host}:${port}`);
} catch (error) {
  await appendRuntimeLog("error", "runtime failed to start", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  console.error("Failed to start ClawDesk runtime.", error);
  process.exit(1);
}
