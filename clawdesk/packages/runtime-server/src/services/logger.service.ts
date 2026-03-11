import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  LogExportResult,
  LogFileInfo,
  LogQueryFilters,
  LogQueryResult,
  LogSummary,
  LogTailEntry,
  LogTailResult,
  MobileAlertItem,
  MobileAlertsSummaryPayload
} from "@clawdesk/shared-types";

const LOG_FILE_NAMES = ["desktop.log", "runtime.log", "error.log"] as const;

type SupportedLogFileName = (typeof LOG_FILE_NAMES)[number];

function getLogDir() {
  return process.env.CLAWDESK_LOG_DIR ?? path.resolve(process.cwd(), "logs");
}

async function ensureLogDir() {
  const logDir = getLogDir();
  await mkdir(logDir, { recursive: true });
  return logDir;
}

function serializeMessage(level: string, message: string, details?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    details: details ?? {}
  };

  return `${JSON.stringify(payload)}\n`;
}

export async function appendRuntimeLog(level: "info" | "error" | "warn", message: string, details?: Record<string, unknown>) {
  const logDir = await ensureLogDir();
  const fileName = level === "error" ? "error.log" : "runtime.log";
  const filePath = path.join(logDir, fileName);

  const line = serializeMessage(level, message, details);
  await writeFile(filePath, line, { encoding: "utf8", flag: "a" });
}

export async function initializeRuntimeLogger() {
  await ensureLogDir();

  process.on("uncaughtException", (error) => {
    void appendRuntimeLog("error", "uncaughtException", {
      message: error.message,
      stack: error.stack
    });
  });

  process.on("unhandledRejection", (reason) => {
    void appendRuntimeLog("error", "unhandledRejection", {
      reason: String(reason)
    });
  });

  await appendRuntimeLog("info", "runtime logger initialized");
}

async function buildLogFileInfo(fileName: string): Promise<LogFileInfo> {
  const logDir = getLogDir();
  const filePath = path.join(logDir, fileName);

  try {
    const [fileStat, content] = await Promise.all([
      stat(filePath),
      readFile(filePath, "utf8")
    ]);

    const tailLines = content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .slice(-20);

    return {
      name: fileName,
      path: filePath,
      exists: true,
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
      tailLines
    };
  } catch {
    return {
      name: fileName,
      path: filePath,
      exists: false,
      sizeBytes: 0,
      modifiedAt: null,
      tailLines: []
    };
  }
}

export async function getLogSummary(): Promise<LogSummary> {
  const logDir = await ensureLogDir();
  const files = await Promise.all(LOG_FILE_NAMES.map((fileName) => buildLogFileInfo(fileName)));

  return {
    logDir,
    files
  };
}

export function isSupportedLogFileName(fileName: string): fileName is SupportedLogFileName {
  return LOG_FILE_NAMES.includes(fileName as SupportedLogFileName);
}

function parseTailEntry(line: string): LogTailEntry {
  try {
    const payload = JSON.parse(line) as {
      timestamp?: string;
      level?: string;
      message?: string;
      details?: Record<string, unknown>;
    };

    return {
      raw: line,
      timestamp: payload.timestamp ?? null,
      level: payload.level ?? null,
      message: payload.message ?? null,
      details: payload.details ?? null
    };
  } catch {
    return {
      raw: line,
      timestamp: null,
      level: null,
      message: null,
      details: null
    };
  }
}

async function readLogEntries(fileName: SupportedLogFileName): Promise<{
  filePath: string;
  exists: boolean;
  entries: LogTailEntry[];
}> {
  const logDir = await ensureLogDir();
  const filePath = path.join(logDir, fileName);

  try {
    const content = await readFile(filePath, "utf8");
    const entries = content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => parseTailEntry(line));

    return {
      filePath,
      exists: true,
      entries
    };
  } catch {
    return {
      filePath,
      exists: false,
      entries: []
    };
  }
}

export async function getLogTail(fileName: SupportedLogFileName, lineCount = 80): Promise<LogTailResult> {
  const safeLineCount = Math.max(10, Math.min(200, Number.isFinite(lineCount) ? Math.trunc(lineCount) : 80));
  const { filePath, exists, entries } = await readLogEntries(fileName);

  return {
    file: fileName,
    path: filePath,
    exists,
    lineCount: Math.min(entries.length, safeLineCount),
    entries: entries.slice(-safeLineCount)
  };
}

function filterLogEntries(entries: LogTailEntry[], filters: LogQueryFilters) {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.level !== "all" && entry.level !== filters.level) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    const haystacks = [
      entry.raw,
      entry.timestamp ?? "",
      entry.level ?? "",
      entry.message ?? "",
      entry.details ? JSON.stringify(entry.details) : ""
    ];

    return haystacks.some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

export async function queryLogs(
  fileName: SupportedLogFileName,
  filters?: Partial<LogQueryFilters>
): Promise<LogQueryResult> {
  const normalizedFilters: LogQueryFilters = {
    level:
      filters?.level === "info" || filters?.level === "warn" || filters?.level === "error"
        ? filters.level
        : "all",
    search: filters?.search?.trim() ?? "",
    lines: Math.max(10, Math.min(500, Number.isFinite(filters?.lines ?? NaN) ? Math.trunc(filters?.lines ?? 80) : 80))
  };

  const { filePath, exists, entries } = await readLogEntries(fileName);
  const matchedEntries = filterLogEntries(entries, normalizedFilters);
  const selectedEntries = matchedEntries.slice(-normalizedFilters.lines).reverse();

  return {
    file: fileName,
    path: filePath,
    exists,
    totalEntries: entries.length,
    matchedEntries: matchedEntries.length,
    returnedEntries: selectedEntries.length,
    filters: normalizedFilters,
    entries: selectedEntries
  };
}

export async function exportLogBundle(): Promise<LogExportResult> {
  const summary = await getLogSummary();
  const exportsDir = path.join(summary.logDir, "exports");
  await mkdir(exportsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const fileName = `clawdesk-log-export-${generatedAt.replace(/[:.]/g, "-")}.txt`;
  const outputPath = path.join(exportsDir, fileName);

  const sections = await Promise.all(
    summary.files.map(async (file) => {
      if (!file.exists) {
        return [`===== ${file.name} =====`, "(missing)"].join("\n");
      }

      const content = await readFile(file.path, "utf8");
      return [`===== ${file.name} =====`, content.trim() || "(empty)"].join("\n");
    })
  );

  const output = [
    `Generated at: ${generatedAt}`,
    `Log directory: ${summary.logDir}`,
    "",
    ...sections
  ].join("\n\n");

  await writeFile(outputPath, output, "utf8");

  return {
    outputPath,
    generatedAt,
    fileCount: summary.files.length
  };
}

export async function getMobileAlertsSummary(limit = 10): Promise<MobileAlertsSummaryPayload> {
  const safeLimit = Math.max(1, Math.min(20, Number.isFinite(limit) ? Math.trunc(limit) : 10));
  const results = await Promise.all(LOG_FILE_NAMES.map((fileName) => readLogEntries(fileName)));

  const allAlerts: MobileAlertItem[] = results.flatMap((result, index) => {
    const sourceFile = LOG_FILE_NAMES[index];
    return result.entries
      .filter((entry): entry is LogTailEntry & { level: "warn" | "error" } => entry.level === "warn" || entry.level === "error")
      .map((entry) => ({
        sourceFile,
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
        details: entry.details
      }));
  });

  const sortedAlerts = allAlerts.sort((left, right) => {
    const leftTime = left.timestamp ? Date.parse(left.timestamp) : 0;
    const rightTime = right.timestamp ? Date.parse(right.timestamp) : 0;
    return rightTime - leftTime;
  });

  return {
    generatedAt: new Date().toISOString(),
    total: sortedAlerts.length,
    errorCount: sortedAlerts.filter((entry) => entry.level === "error").length,
    warnCount: sortedAlerts.filter((entry) => entry.level === "warn").length,
    latest: sortedAlerts.slice(0, safeLimit)
  };
}
