import { app } from "electron";

import { initializeClawDeskDataHome } from "./data-home.js";
import { startHostedRuntime } from "../../../../packages/runtime-server/src/runtime-host.js";

function isRuntimeChildProcess() {
  return process.argv.includes("--clawdesk-runtime");
}

export async function maybeRunRuntimeChildProcess() {
  if (!isRuntimeChildProcess()) {
    return false;
  }

  try {
    const userDataDir = process.env.CLAWDESK_USER_DATA_DIR ?? app.getPath("userData");
    if (!process.env.OPENCLAW_HOME) {
      const dataHomeInfo = await initializeClawDeskDataHome(userDataDir);
      process.env.OPENCLAW_HOME = dataHomeInfo.dataHome;
      process.env.CLAWDESK_DATA_HOME_SOURCE = dataHomeInfo.source;
      process.env.CLAWDESK_LEGACY_IMPORTED_HOME = dataHomeInfo.legacyHome ?? "";
      process.env.CLAWDESK_BUNDLED_EXTENSION_AVAILABLE = dataHomeInfo.seededExtensionAvailable ? "1" : "0";
    }

    const runtimeHandle = await startHostedRuntime({
      logDir: process.env.CLAWDESK_LOG_DIR,
      source: "electron-runtime-child"
    });

    const shutdown = async () => {
      await runtimeHandle.stop();
      app.exit(0);
    };

    process.on("SIGINT", () => {
      void shutdown();
    });

    process.on("SIGTERM", () => {
      void shutdown();
    });
  } catch (error) {
    console.error("Failed to start ClawDesk runtime child.", error);
    app.exit(1);
  }

  return true;
}
