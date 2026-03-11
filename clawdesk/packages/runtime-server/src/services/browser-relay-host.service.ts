import {
  ensureOpenClawManagedBrowserGateway,
  stopOpenClawManagedBrowserGateway
} from "@clawdesk/openclaw-core";

import { appendRuntimeLog } from "./logger.service.js";

let started = false;

export async function startManagedBrowserRelayHost() {
  try {
    const result = await ensureOpenClawManagedBrowserGateway();
    started = true;

    await appendRuntimeLog("info", "managed browser relay ready", {
      relayPort: result.relayPort,
      gatewayCmdPath: result.gatewayCmdPath,
      alreadyRunning: result.alreadyRunning
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendRuntimeLog("warn", "managed browser relay failed to start", {
      message
    });
    return null;
  }
}

export async function stopManagedBrowserRelayHost() {
  if (!started) {
    return false;
  }

  try {
    const stopped = await stopOpenClawManagedBrowserGateway();
    await appendRuntimeLog("info", "managed browser relay stopped", {
      stopped
    });
    started = false;
    return stopped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendRuntimeLog("warn", "managed browser relay failed to stop cleanly", {
      message
    });
    started = false;
    return false;
  }
}
