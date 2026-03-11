import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_ID, APP_NAME, APP_TITLE } from "./branding.js";
import { initializeClawDeskDataHome } from "./data-home.js";
import { createDesktopReminderPoller, type DesktopReminderPoller } from "./desktop-reminder-poller.js";
import { appendDesktopLog, initializeDesktopLogger } from "./logger.js";
import { maybeRunRuntimeChildProcess } from "./runtime-child.js";
import { createRuntimeManager, type RuntimeManager } from "./runtime-manager.js";
import { createAppTray } from "./tray.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let appTray: ReturnType<typeof createAppTray> | null = null;
let isQuitting = false;
let runtimeManager: RuntimeManager | null = null;
let reminderPoller: DesktopReminderPoller | null = null;

const runtimeChildStarted = await maybeRunRuntimeChildProcess();

function resolveSeedHome(packaged: boolean) {
  if (packaged) {
    return join(process.resourcesPath, "seed", "openclaw-home");
  }

  return resolve(__dirname, "../../resources/openclaw-home");
}

function createWindow() {
  if (!runtimeManager) {
    throw new Error("Runtime manager is not initialized.");
  }

  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: "#091018",
    title: APP_TITLE,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  process.env.CLAWDESK_RUNTIME_URL = runtimeManager.baseUrl;

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    void appendDesktopLog("info", "window hidden to tray");
    window.hide();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
    return window;
  }

  void window.loadFile(join(__dirname, "../renderer/index.html"));
  return window;
}

function showMainWindow() {
  if (!mainWindow) {
    mainWindow = createWindow();
    void appendDesktopLog("info", "main window created from tray restore");
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  void appendDesktopLog("info", "main window shown");
}

function quitApplication() {
  isQuitting = true;
  void appendDesktopLog("info", "quit requested from tray");
  reminderPoller?.stop();
  runtimeManager?.stop();
  app.quit();
}

if (!runtimeChildStarted) {
  app.whenReady().then(async () => {
    app.setName(APP_NAME);
    app.setAppUserModelId(APP_ID);
    const userDataDir = app.getPath("userData");
    const logDir = join(app.getPath("userData"), "logs");
    process.env.CLAWDESK_SEED_HOME = resolveSeedHome(app.isPackaged);
    const dataHomeInfo = await initializeClawDeskDataHome(userDataDir);
    process.env.CLAWDESK_LOG_DIR = logDir;
    process.env.CLAWDESK_USER_DATA_DIR = userDataDir;
    process.env.OPENCLAW_HOME = dataHomeInfo.dataHome;
    process.env.CLAWDESK_DATA_HOME_SOURCE = dataHomeInfo.source;
    process.env.CLAWDESK_LEGACY_IMPORTED_HOME = dataHomeInfo.legacyHome ?? "";
    process.env.CLAWDESK_BUNDLED_EXTENSION_AVAILABLE = dataHomeInfo.seededExtensionAvailable ? "1" : "0";
    await initializeDesktopLogger(logDir);
    await appendDesktopLog("info", "application ready", {
      logDir,
      dataHome: dataHomeInfo.dataHome,
      dataHomeSource: dataHomeInfo.source,
      legacyHome: dataHomeInfo.legacyHome,
      bundledExtensionAvailable: dataHomeInfo.seededExtensionAvailable
    });

    runtimeManager = createRuntimeManager({
      desktopMainDir: __dirname,
      logDir,
      dataHome: dataHomeInfo.dataHome,
      userDataDir,
      packaged: app.isPackaged
    });
    process.env.CLAWDESK_RUNTIME_URL = runtimeManager.baseUrl;

    try {
      await runtimeManager.start();
      reminderPoller = createDesktopReminderPoller({
        baseUrl: runtimeManager.baseUrl
      });
      reminderPoller.start();
      await appendDesktopLog("info", "managed runtime started", {
        baseUrl: runtimeManager.baseUrl,
        mode: runtimeManager.mode
      });
    } catch (error) {
      await appendDesktopLog("error", "managed runtime failed to start", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      console.error("Failed to start managed runtime.", error);
    }

    mainWindow = createWindow();
    appTray = createAppTray(mainWindow, quitApplication);
    await appendDesktopLog("info", "tray initialized");

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        void appendDesktopLog("info", "main window re-created on activate");
        return;
      }

      showMainWindow();
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    void appendDesktopLog("info", "application before-quit");
    reminderPoller?.stop();
    runtimeManager?.stop();
  });

  app.on("window-all-closed", () => {
    // Keep the app alive in the tray until the user explicitly quits.
  });
}
