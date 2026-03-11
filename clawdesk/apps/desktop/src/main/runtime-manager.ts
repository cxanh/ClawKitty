import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

type RuntimeMode = "external" | "managed-node" | "managed-electron";
type RuntimeState = "idle" | "starting" | "online" | "stopped" | "error";

interface RuntimeManagerOptions {
  desktopMainDir: string;
  logDir: string;
  dataHome: string;
  userDataDir: string;
  packaged: boolean;
}

export interface RuntimeManager {
  readonly baseUrl: string;
  readonly mode: RuntimeMode;
  readonly state: RuntimeState;
  start(): Promise<void>;
  stop(): void;
}

const DEFAULT_PORT = Number(process.env.CLAWDESK_RUNTIME_PORT ?? 47890);
const DEFAULT_BASE_URL = process.env.CLAWDESK_RUNTIME_URL ?? `http://127.0.0.1:${DEFAULT_PORT}`;

function shouldManageRuntime() {
  if (process.env.CLAWDESK_MANAGED_RUNTIME === "1") {
    return true;
  }

  if (process.env.CLAWDESK_RUNTIME_URL) {
    return false;
  }

  return !process.env.ELECTRON_RENDERER_URL;
}

function resolveRuntimeMode(options: RuntimeManagerOptions): RuntimeMode {
  if (!shouldManageRuntime()) {
    return "external";
  }

  if (process.env.CLAWDESK_RUNTIME_CHILD_MODE === "electron") {
    return "managed-electron";
  }

  if (process.env.CLAWDESK_RUNTIME_CHILD_MODE === "node") {
    return "managed-node";
  }

  return options.packaged ? "managed-electron" : "managed-node";
}

function resolveRuntimeEntry(desktopMainDir: string) {
  const candidates = [
    process.env.CLAWDESK_RUNTIME_ENTRY,
    resolve(process.cwd(), "packages/runtime-server/dist/index.js"),
    resolve(process.cwd(), "../../packages/runtime-server/dist/index.js"),
    resolve(desktopMainDir, "../../../packages/runtime-server/dist/index.js")
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function waitForRuntime(baseUrl: string) {
  const deadline = Date.now() + 12_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/runtime/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Ignore startup connection errors while the runtime is still booting.
    }

    await new Promise((resolvePromise) => {
      setTimeout(resolvePromise, 400);
    });
  }

  throw new Error(`Runtime did not respond at ${baseUrl} within the startup window.`);
}

export function createRuntimeManager(options: RuntimeManagerOptions): RuntimeManager {
  const mode = resolveRuntimeMode(options);
  const baseUrl = DEFAULT_BASE_URL;
  let child: ChildProcess | null = null;
  let state: RuntimeState = mode === "external" ? "online" : "idle";

  return {
    get baseUrl() {
      return baseUrl;
    },
    get mode() {
      return mode;
    },
    get state() {
      return state;
    },
    async start() {
      if (mode === "external" || child) {
        return;
      }

      state = "starting";
      if (mode === "managed-electron") {
        child = spawn(process.execPath, ["--clawdesk-runtime"], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            CLAWDESK_RUNTIME_PORT: String(DEFAULT_PORT),
            CLAWDESK_LOG_DIR: options.logDir,
            CLAWDESK_USER_DATA_DIR: options.userDataDir,
            CLAWDESK_SEED_HOME: process.env.CLAWDESK_SEED_HOME,
            OPENCLAW_HOME: options.dataHome
          },
          stdio: "ignore",
          windowsHide: true
        });
      } else {
        const runtimeEntry = resolveRuntimeEntry(options.desktopMainDir);
        if (!runtimeEntry) {
          state = "error";
          throw new Error("Runtime entry was not found. Build @clawdesk/runtime-server first or provide CLAWDESK_RUNTIME_ENTRY.");
        }

        child = spawn(process.env.CLAWDESK_NODE_PATH ?? "node", [runtimeEntry], {
          cwd: dirname(runtimeEntry),
          env: {
            ...process.env,
            CLAWDESK_RUNTIME_PORT: String(DEFAULT_PORT),
            CLAWDESK_LOG_DIR: options.logDir,
            CLAWDESK_USER_DATA_DIR: options.userDataDir,
            CLAWDESK_SEED_HOME: process.env.CLAWDESK_SEED_HOME,
            OPENCLAW_HOME: options.dataHome
          },
          stdio: "ignore",
          windowsHide: true
        });
      }

      child.on("exit", () => {
        child = null;
        state = "stopped";
      });

      try {
        await waitForRuntime(baseUrl);
        state = "online";
      } catch (error) {
        state = "error";
        child.kill();
        child = null;
        throw error;
      }
    },
    stop() {
      if (!child) {
        state = "stopped";
        return;
      }

      child.kill();
      child = null;
      state = "stopped";
    }
  };
}
