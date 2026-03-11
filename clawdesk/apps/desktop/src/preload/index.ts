import { contextBridge } from "electron";

import type { DesktopBridge } from "@clawdesk/shared-types";

const bridge: DesktopBridge = {
  runtimeBaseUrl: process.env.CLAWDESK_RUNTIME_URL ?? "http://127.0.0.1:47890",
  appVersion: "0.1.0",
  platform: process.platform,
  userDataDir: process.env.CLAWDESK_USER_DATA_DIR ?? "",
  dataHome: process.env.OPENCLAW_HOME ?? "",
  dataHomeSource:
    process.env.CLAWDESK_DATA_HOME_SOURCE === "fresh" ||
    process.env.CLAWDESK_DATA_HOME_SOURCE === "legacy-import" ||
    process.env.CLAWDESK_DATA_HOME_SOURCE === "existing-managed"
      ? process.env.CLAWDESK_DATA_HOME_SOURCE
      : "unknown",
  legacyHome: process.env.CLAWDESK_LEGACY_IMPORTED_HOME ?? null,
  bundledExtensionAvailable: process.env.CLAWDESK_BUNDLED_EXTENSION_AVAILABLE === "1"
};

contextBridge.exposeInMainWorld("clawdesk", bridge);
