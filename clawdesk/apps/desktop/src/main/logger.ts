import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

let logDir = "";

export async function initializeDesktopLogger(nextLogDir: string) {
  logDir = nextLogDir;
  await mkdir(logDir, { recursive: true });

  process.on("uncaughtException", (error) => {
    void appendDesktopLog("error", "uncaughtException", {
      message: error.message,
      stack: error.stack
    });
  });

  process.on("unhandledRejection", (reason) => {
    void appendDesktopLog("error", "unhandledRejection", {
      reason: String(reason)
    });
  });

  await appendDesktopLog("info", "desktop logger initialized");
}

export async function appendDesktopLog(level: "info" | "warn" | "error", message: string, details?: Record<string, unknown>) {
  if (!logDir) {
    return;
  }

  const fileName = level === "error" ? "error.log" : "desktop.log";
  const filePath = path.join(logDir, fileName);
  const line = `${JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ?? {}
  })}\n`;

  await writeFile(filePath, line, { encoding: "utf8", flag: "a" });
}
