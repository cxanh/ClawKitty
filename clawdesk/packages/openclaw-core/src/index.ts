import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID, webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  BrowserRelayActionResult,
  BrowserRelayEndpointProbe,
  BrowserRelayStartupGuide,
  BrowserRelayStartupStep,
  BrowserRelayPortProbe,
  BrowserRelayStatus,
  BrowserRelayTargetInfo,
  OpenClawAuthProfileInfo,
  OpenClawPairedDeviceDetail,
  OpenClawPairedDeviceInfo,
  OpenClawOverview,
  OpenClawProviderInfo,
  OpenClawSessionDetail,
  OpenClawSessionInfo,
  OpenClawTaskDetail,
  OpenClawTaskBulkActionResult,
  OpenClawTaskDeleteResult,
  OpenClawTaskEditorInput,
  OpenClawTaskInfo,
  OpenClawTaskPayloadInput,
  OpenClawTaskRunRecord,
  OpenClawTaskScheduleInput,
  OpenClawTaskRunUsage,
  OpenClawTaskStateSummary,
  PairedDeviceMutationResult,
  PairingAuditEntry,
  PairingAuditExportResult,
  PairingAuditFilters,
  PairingAuditQueryResult,
  PairingApprovalResult,
  PairingCenterSessionPayload,
  PairingPendingApproval,
  PairingSessionCleanupResult,
  PairingRequestInput
} from "@clawdesk/shared-types";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const require = createRequire(import.meta.url);

interface OpenClawRootConfig {
  auth?: {
    profiles?: Record<string, { provider?: string; mode?: string }>;
  };
  models?: {
    providers?: Record<string, { baseUrl?: string; api?: string; models?: Array<{ id?: string; name?: string }> }>;
  };
}

interface OpenClawDetailedAuthConfig {
  profiles?: Record<
    string,
    {
      provider?: string;
      type?: string;
      mode?: string;
      access?: string;
      refresh?: string;
      token?: string;
      expires?: number;
    }
  >;
  usageStats?: Record<
    string,
    {
      lastUsed?: number;
      errorCount?: number;
    }
  >;
}

interface OpenClawCronConfig {
  jobs?: Array<Record<string, JsonValue>>;
  [key: string]: JsonValue | Array<Record<string, JsonValue>> | undefined;
}

interface OpenClawSessionsIndex {
  [sessionKey: string]: {
    sessionId?: string;
    updatedAt?: number;
    sessionFile?: string;
    modelProvider?: string;
    model?: string;
    abortedLastRun?: boolean;
    origin?: {
      label?: string;
    };
  };
}

interface OpenClawPairedDevicesConfig {
  [deviceId: string]: {
    deviceId?: string;
    platform?: string;
    clientId?: string;
    clientMode?: string;
    role?: string;
    scopes?: string[];
    approvedScopes?: string[];
    tokens?: Record<
      string,
      {
        lastUsedAtMs?: number;
      }
    >;
    createdAtMs?: number;
    approvedAtMs?: number;
  };
}

interface OpenClawPairingSessionsConfig {
  [sessionId: string]: {
    sessionId?: string;
    token?: string;
    createdAtMs?: number;
    expiresAtMs?: number;
    defaultScopes?: string[];
    supportedClients?: Array<"android" | "mini-program">;
    approvalMode?: "desktop-approval-required";
    transport?: "qr+token";
    status?: "ready" | "claimed" | "approved" | "rejected" | "expired";
    claimedRequestId?: string;
  };
}

interface OpenClawPendingApprovalsConfig {
  [requestId: string]: {
    requestId?: string;
    sessionId?: string;
    token?: string;
    clientType?: "android" | "mini-program";
    deviceName?: string;
    requestedScopes?: string[];
    status?: "pending" | "approved" | "rejected";
    submittedAtMs?: number;
    expiresAtMs?: number;
    decidedAtMs?: number;
    approvedScopes?: string[];
    reason?: string;
    suggestedDeviceId?: string;
  };
}

type OpenClawPairingAuditConfig = PairingAuditEntry[];

interface OpenClawExtensionManifest {
  name?: string;
  version?: string;
  permissions?: string[];
}

let lastPairingMaintenanceAt = 0;
const PAIRING_MAINTENANCE_INTERVAL_MS = 60_000;
const DEFAULT_BROWSER_RELAY_PORT = 18_792;
const CLAWDESK_MANAGED_GATEWAY_MARKER = "ClawDesk";
const CLAWDESK_MANAGED_GATEWAY_SERVICE_VERSION = `clawdesk-managed-${process.env.npm_package_version ?? "0.1.0"}`;

type ChromeExtensionRelayServer = {
  stop(): Promise<void>;
};

type EnsureChromeExtensionRelayServer = (options: {
  cdpUrl: string;
}) => Promise<ChromeExtensionRelayServer>;

type StopChromeExtensionRelayServer = (options: {
  cdpUrl: string;
}) => Promise<boolean>;

let relaySdkPromise: Promise<{
  ensureChromeExtensionRelayServer: EnsureChromeExtensionRelayServer;
  stopChromeExtensionRelayServer: StopChromeExtensionRelayServer;
}> | null = null;

export class OpenClawTaskEditorError extends Error {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OpenClawTaskEditorError";
    this.details = details;
  }
}

export class OpenClawBrowserRelayActionError extends Error {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OpenClawBrowserRelayActionError";
    this.details = details;
  }
}

export class OpenClawPairingError extends Error {
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "OpenClawPairingError";
    this.details = details;
  }
}

function getOpenClawHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(targetPath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(targetPath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function timestampToIso(value: number | undefined): string | null {
  if (!value || Number.isNaN(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

function stringTimestampToIso(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizeTaskName(rawTask: Record<string, JsonValue>, index: number) {
  const name = rawTask.name;
  if (typeof name === "string" && name.trim().length > 0) {
    return name;
  }

  return `task-${index + 1}`;
}

function normalizeTaskId(rawTask: Record<string, JsonValue>, index: number) {
  const id = rawTask.id;
  if (typeof id === "string" && id.trim().length > 0) {
    return id;
  }

  return `task-${index + 1}`;
}

function toRecord(value: unknown): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new OpenClawTaskEditorError(`${field} is required`, { field });
  }

  return value.trim();
}

function getOptionalText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getRequiredBoolean(value: unknown, field: string) {
  if (typeof value !== "boolean") {
    throw new OpenClawTaskEditorError(`${field} must be a boolean`, { field });
  }

  return value;
}

function getRequiredRecord(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OpenClawTaskEditorError(`${field} must be an object`, { field });
  }

  return value as Record<string, unknown>;
}

function getRequiredEnum<T extends string>(value: unknown, field: string, allowedValues: T[]): T {
  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new OpenClawTaskEditorError(`${field} must be one of ${allowedValues.join(", ")}`, {
      field,
      allowedValues
    });
  }

  return value as T;
}

function getRequiredFiniteNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new OpenClawTaskEditorError(`${field} must be a finite number`, { field });
  }

  return value;
}

function getTaskRunLogPath(taskId: string) {
  return path.join(getOpenClawHome(), "cron", "runs", `${taskId}.jsonl`);
}

function getCronConfigPath() {
  return path.join(getOpenClawHome(), "cron", "jobs.json");
}

function getCronBackupPath() {
  return `${getCronConfigPath()}.bak`;
}

function getDevicesDirPath() {
  return path.join(getOpenClawHome(), "devices");
}

function getBrowserDirPath() {
  return path.join(getOpenClawHome(), "browser");
}

function getBrowserExtensionDirPath() {
  return path.join(getBrowserDirPath(), "chrome-extension");
}

function getExportsDirPath() {
  return path.join(getOpenClawHome(), "exports");
}

function getGatewayCmdPath() {
  return path.join(getOpenClawHome(), "gateway.cmd");
}

function getPairedDevicesConfigPath() {
  return path.join(getDevicesDirPath(), "paired.json");
}

function getPairingSessionsConfigPath() {
  return path.join(getDevicesDirPath(), "pairing-sessions.json");
}

function getPendingApprovalsConfigPath() {
  return path.join(getDevicesDirPath(), "pending-approvals.json");
}

function getPairingAuditConfigPath() {
  return path.join(getDevicesDirPath(), "pairing-audit.json");
}

function buildPairingUri(token: string) {
  const encodedToken = encodeURIComponent(token);
  return `openclaw://pair?token=${encodedToken}`;
}

function generatePairingToken() {
  const bytes = new Uint8Array(18);
  webcrypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function generateGatewayToken() {
  const bytes = new Uint8Array(24);
  webcrypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function normalizeScopeList(scopes: unknown, field: string) {
  if (!Array.isArray(scopes)) {
    throw new OpenClawPairingError(`${field} must be an array of strings`, { field });
  }

  const normalized = scopes
    .map((scope) => (typeof scope === "string" ? scope.trim() : ""))
    .filter((scope) => scope.length > 0);

  if (normalized.length === 0) {
    throw new OpenClawPairingError(`${field} must contain at least one scope`, { field });
  }

  return [...new Set(normalized)];
}

async function writeJsonFile(targetPath: string, data: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function normalizeTaskScheduleInput(value: unknown): OpenClawTaskScheduleInput {
  const schedule = getRequiredRecord(value, "schedule");
  const kind = getRequiredEnum(schedule.kind, "schedule.kind", ["every", "cron", "at"]);

  if (kind === "every") {
    const everyMs = Math.trunc(getRequiredFiniteNumber(schedule.everyMs, "schedule.everyMs"));
    if (everyMs < 1000) {
      throw new OpenClawTaskEditorError("schedule.everyMs must be at least 1000", {
        field: "schedule.everyMs",
        minimum: 1000
      });
    }

    return {
      kind,
      everyMs
    };
  }

  if (kind === "cron") {
    return {
      kind,
      expr: getRequiredText(schedule.expr, "schedule.expr"),
      tz: getOptionalText(schedule.tz)
    };
  }

  const at = getRequiredText(schedule.at, "schedule.at");
  const timestamp = Date.parse(at);
  if (Number.isNaN(timestamp)) {
    throw new OpenClawTaskEditorError("schedule.at must be a valid datetime", {
      field: "schedule.at"
    });
  }

  return {
    kind,
    at: new Date(timestamp).toISOString()
  };
}

function normalizeTaskPayloadInput(value: unknown): OpenClawTaskPayloadInput {
  const payload = getRequiredRecord(value, "payload");
  const kind = getRequiredEnum(payload.kind, "payload.kind", ["systemEvent", "openUrl", "notify"]);

  if (kind === "systemEvent") {
    return {
      kind,
      text: getRequiredText(payload.text, "payload.text")
    };
  }

  if (kind === "openUrl") {
    const url = getRequiredText(payload.url, "payload.url");
    if (!/^https?:\/\//i.test(url)) {
      throw new OpenClawTaskEditorError("payload.url must start with http:// or https://", {
        field: "payload.url"
      });
    }

    return {
      kind,
      url,
      openMode: getRequiredEnum(payload.openMode, "payload.openMode", ["external", "relay"]),
      label: getOptionalText(payload.label)
    };
  }

  return {
    kind,
    title: getRequiredText(payload.title, "payload.title"),
    body: getRequiredText(payload.body, "payload.body"),
    level: getRequiredEnum(payload.level, "payload.level", ["info", "warn", "error"])
  };
}

function normalizeTaskEditorInput(value: unknown): OpenClawTaskEditorInput {
  const input = getRequiredRecord(value, "request body");

  return {
    name: getRequiredText(input.name, "name"),
    description: getOptionalText(input.description),
    enabled: getRequiredBoolean(input.enabled, "enabled"),
    deleteAfterRun: getRequiredBoolean(input.deleteAfterRun, "deleteAfterRun"),
    agentId: getOptionalText(input.agentId),
    sessionKey: getOptionalText(input.sessionKey),
    sessionTarget: getRequiredEnum(input.sessionTarget, "sessionTarget", ["main", "isolated"]),
    wakeMode: getRequiredEnum(input.wakeMode, "wakeMode", ["next-heartbeat", "now"]),
    schedule: normalizeTaskScheduleInput(input.schedule),
    payload: normalizeTaskPayloadInput(input.payload)
  };
}

function toTaskScheduleRecord(schedule: OpenClawTaskScheduleInput): Record<string, JsonValue> {
  if (schedule.kind === "every") {
    return {
      kind: schedule.kind,
      everyMs: schedule.everyMs
    };
  }

  if (schedule.kind === "cron") {
    return {
      kind: schedule.kind,
      expr: schedule.expr,
      tz: schedule.tz
    };
  }

  return {
    kind: schedule.kind,
    at: schedule.at
  };
}

function toTaskPayloadRecord(payload: OpenClawTaskPayloadInput): Record<string, JsonValue> {
  if (payload.kind === "openUrl") {
    return {
      kind: payload.kind,
      url: payload.url,
      openMode: payload.openMode,
      label: payload.label
    };
  }

  if (payload.kind === "notify") {
    return {
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      level: payload.level
    };
  }

  return {
    kind: payload.kind,
    text: payload.text
  };
}

function buildTaskRecord(
  input: OpenClawTaskEditorInput,
  existing: Record<string, JsonValue> | null,
  fallbackId?: string
): Record<string, JsonValue> {
  const now = new Date();
  const createdAtMs = getNumber(existing?.createdAtMs) ?? now.getTime();
  const createdAt = getString(existing?.createdAt) ?? new Date(createdAtMs).toISOString();
  const schedule = toTaskScheduleRecord(input.schedule);
  const nextRunAt = input.schedule.kind === "at" ? input.schedule.at : null;
  const nextRunAtMs = input.schedule.kind === "at" ? Date.parse(input.schedule.at) : null;

  return {
    ...(existing ?? {}),
    id: getString(existing?.id) ?? fallbackId ?? randomUUID(),
    name: input.name,
    type: input.payload.kind,
    description: input.description,
    enabled: input.enabled,
    deleteAfterRun: input.deleteAfterRun,
    agentId: input.agentId,
    sessionKey: input.sessionKey,
    sessionTarget: input.sessionTarget,
    wakeMode: input.wakeMode,
    schedule,
    payload: toTaskPayloadRecord(input.payload),
    nextRunAt,
    nextRunAtMs,
    createdAt,
    createdAtMs,
    updatedAt: now.toISOString(),
    updatedAtMs: now.getTime(),
    source: getString(existing?.source) ?? "clawdesk",
    state: toRecord(existing?.state) ?? {}
  };
}

async function persistCronConfig(config: OpenClawCronConfig) {
  const configPath = getCronConfigPath();
  const backupPath = getCronBackupPath();
  const nextContent = `${JSON.stringify(config, null, 2)}\n`;

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, nextContent, "utf8");
  await writeFile(backupPath, nextContent, "utf8");
}

function normalizeTaskType(rawTask: Record<string, JsonValue>) {
  const directType = getString(rawTask.type);
  if (directType) {
    return directType;
  }

  const payload = toRecord(rawTask.payload);
  const payloadKind = getString(payload?.kind);
  if (payloadKind) {
    return payloadKind;
  }

  const schedule = toRecord(rawTask.schedule);
  return getString(schedule?.kind) ?? "unknown";
}

function normalizeTaskState(rawTask: Record<string, JsonValue>): OpenClawTaskStateSummary {
  const state = toRecord(rawTask.state) ?? {};
  const lastRunStatus = getString(state.lastRunStatus);
  const lastStatus = getString(state.lastStatus);
  const lastDeliveryStatus = getString(state.lastDeliveryStatus);

  return {
    nextRunAt:
      getString(rawTask.nextRunAt) ??
      timestampToIso(getNumber(rawTask.nextRunAtMs) ?? getNumber(state.nextRunAtMs) ?? undefined),
    runningAt: timestampToIso(getNumber(state.runningAtMs) ?? undefined),
    lastRunAt: timestampToIso(getNumber(state.lastRunAtMs) ?? undefined),
    lastRunStatus:
      lastRunStatus === "ok" || lastRunStatus === "error" || lastRunStatus === "skipped"
        ? lastRunStatus
        : null,
    lastStatus:
      lastStatus === "ok" || lastStatus === "error" || lastStatus === "skipped"
        ? lastStatus
        : null,
    lastError: getString(state.lastError),
    lastDurationMs: getNumber(state.lastDurationMs),
    consecutiveErrors: getNumber(state.consecutiveErrors) ?? 0,
    lastDelivered: getBoolean(state.lastDelivered),
    lastDeliveryStatus:
      lastDeliveryStatus === "delivered" ||
      lastDeliveryStatus === "not-delivered" ||
      lastDeliveryStatus === "unknown" ||
      lastDeliveryStatus === "not-requested"
        ? lastDeliveryStatus
        : null,
    lastDeliveryError: getString(state.lastDeliveryError),
    lastFailureAlertAt: timestampToIso(getNumber(state.lastFailureAlertAtMs) ?? undefined)
  };
}

function normalizeTaskInfo(rawTask: Record<string, JsonValue>, index: number): OpenClawTaskInfo {
  const state = normalizeTaskState(rawTask);
  const schedule = toRecord(rawTask.schedule);

  return {
    id: normalizeTaskId(rawTask, index),
    name: normalizeTaskName(rawTask, index),
    type: normalizeTaskType(rawTask),
    description: getString(rawTask.description),
    enabled: typeof rawTask.enabled === "boolean" ? rawTask.enabled : true,
    deleteAfterRun: Boolean(rawTask.deleteAfterRun),
    agentId: getString(rawTask.agentId),
    sessionKey: getString(rawTask.sessionKey),
    scheduleKind: getString(schedule?.kind),
    nextRunAt: state.nextRunAt,
    runningAt: state.runningAt,
    lastRunAt: state.lastRunAt,
    lastRunStatus: state.lastRunStatus,
    lastError: state.lastError,
    lastDurationMs: state.lastDurationMs,
    consecutiveErrors: state.consecutiveErrors,
    source: "openclaw-cron"
  };
}

function normalizeTaskRunUsage(value: unknown): OpenClawTaskRunUsage | null {
  const usage = toRecord(value);
  if (!usage) {
    return null;
  }

  return {
    inputTokens: getNumber(usage.input_tokens),
    outputTokens: getNumber(usage.output_tokens),
    totalTokens: getNumber(usage.total_tokens),
    cacheReadTokens: getNumber(usage.cache_read_tokens),
    cacheWriteTokens: getNumber(usage.cache_write_tokens)
  };
}

function normalizeTaskRunRecord(value: unknown): OpenClawTaskRunRecord | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const status = getString(record.status);
  const deliveryStatus = getString(record.deliveryStatus);

  return {
    ts: timestampToIso(getNumber(record.ts) ?? undefined),
    action: getString(record.action) ?? "unknown",
    status: status === "ok" || status === "error" || status === "skipped" ? status : null,
    error: getString(record.error),
    summary: getString(record.summary),
    delivered: getBoolean(record.delivered),
    deliveryStatus:
      deliveryStatus === "delivered" ||
      deliveryStatus === "not-delivered" ||
      deliveryStatus === "unknown" ||
      deliveryStatus === "not-requested"
        ? deliveryStatus
        : null,
    deliveryError: getString(record.deliveryError),
    sessionId: getString(record.sessionId),
    sessionKey: getString(record.sessionKey),
    runAt: timestampToIso(getNumber(record.runAtMs) ?? undefined),
    durationMs: getNumber(record.durationMs),
    nextRunAt: timestampToIso(getNumber(record.nextRunAtMs) ?? undefined),
    model: getString(record.model),
    provider: getString(record.provider),
    jobName: getString(record.jobName),
    usage: normalizeTaskRunUsage(record.usage),
    raw: record as Record<string, unknown>
  };
}

async function readRootConfig() {
  return readJsonFile<OpenClawRootConfig>(path.join(getOpenClawHome(), "openclaw.json"), {});
}

async function readDetailedAuthConfig() {
  return readJsonFile<OpenClawDetailedAuthConfig>(path.join(getOpenClawHome(), "agents", "main", "agent", "auth-profiles.json"), {});
}

async function readSessionsIndex() {
  return readJsonFile<OpenClawSessionsIndex>(path.join(getOpenClawHome(), "agents", "main", "sessions", "sessions.json"), {});
}

async function readCronConfig() {
  return readJsonFile<OpenClawCronConfig>(path.join(getOpenClawHome(), "cron", "jobs.json"), { jobs: [] });
}

async function readPairedDevicesConfig() {
  return readJsonFile<OpenClawPairedDevicesConfig>(getPairedDevicesConfigPath(), {});
}

async function writePairedDevicesConfig(config: OpenClawPairedDevicesConfig) {
  await writeJsonFile(getPairedDevicesConfigPath(), config);
}

async function readPairingSessionsConfig() {
  return readJsonFile<OpenClawPairingSessionsConfig>(getPairingSessionsConfigPath(), {});
}

async function writePairingSessionsConfig(config: OpenClawPairingSessionsConfig) {
  await writeJsonFile(getPairingSessionsConfigPath(), config);
}

async function readPendingApprovalsConfig() {
  return readJsonFile<OpenClawPendingApprovalsConfig>(getPendingApprovalsConfigPath(), {});
}

async function writePendingApprovalsConfig(config: OpenClawPendingApprovalsConfig) {
  await writeJsonFile(getPendingApprovalsConfigPath(), config);
}

async function readPairingAuditConfig() {
  return readJsonFile<OpenClawPairingAuditConfig>(getPairingAuditConfigPath(), []);
}

async function writePairingAuditConfig(config: OpenClawPairingAuditConfig) {
  await writeJsonFile(getPairingAuditConfigPath(), config);
}

async function appendPairingAuditEntry(
  entry: Omit<PairingAuditEntry, "id" | "timestamp">
): Promise<PairingAuditEntry> {
  const config = await readPairingAuditConfig();
  const nextEntry: PairingAuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  };

  config.push(nextEntry);
  const trimmed = config.slice(-200);
  await writePairingAuditConfig(trimmed);
  return nextEntry;
}

async function runOpenClawPairingMaintenanceIfDue(force = false) {
  const now = Date.now();
  if (!force && now - lastPairingMaintenanceAt < PAIRING_MAINTENANCE_INTERVAL_MS) {
    return null;
  }

  lastPairingMaintenanceAt = now;
  return cleanupExpiredOpenClawPairingSessions();
}

export async function getOpenClawOverview(): Promise<OpenClawOverview> {
  const homePath = getOpenClawHome();
  const available = await pathExists(homePath);

  if (!available) {
    return {
      homePath,
      available: false,
      providerCount: 0,
      authProfileCount: 0,
      sessionCount: 0,
      taskCount: 0,
      latestSessionUpdatedAt: null
    };
  }

  const [providers, authProfiles, sessions, tasks] = await Promise.all([
    listOpenClawProviders(),
    listOpenClawAuthProfiles(),
    listOpenClawSessions(),
    listOpenClawTasks()
  ]);

  return {
    homePath,
    available,
    providerCount: providers.length,
    authProfileCount: authProfiles.length,
    sessionCount: sessions.length,
    taskCount: tasks.length,
    latestSessionUpdatedAt: sessions[0]?.updatedAt ?? null
  };
}

export async function listOpenClawProviders(): Promise<OpenClawProviderInfo[]> {
  const rootConfig = await readRootConfig();
  const providers = rootConfig.models?.providers ?? {};

  return Object.entries(providers).map(([providerId, providerConfig]) => ({
    id: providerId,
    displayName: providerId,
    baseUrl: providerConfig.baseUrl ?? null,
    apiKind: providerConfig.api ?? null,
    modelCount: providerConfig.models?.length ?? 0
  }));
}

export async function listOpenClawAuthProfiles(): Promise<OpenClawAuthProfileInfo[]> {
  const [rootConfig, detailedAuthConfig] = await Promise.all([readRootConfig(), readDetailedAuthConfig()]);

  const rootProfiles = rootConfig.auth?.profiles ?? {};
  const detailedProfiles = detailedAuthConfig.profiles ?? {};
  const usageStats = detailedAuthConfig.usageStats ?? {};

  return Object.entries(rootProfiles).map(([profileId, profileConfig]) => {
    const detailedProfile = detailedProfiles[profileId];
    const usage = usageStats[profileId];

    return {
      id: profileId,
      providerId: profileConfig.provider ?? detailedProfile?.provider ?? "unknown",
      mode: profileConfig.mode ?? detailedProfile?.mode ?? detailedProfile?.type ?? "unknown",
      hasStoredCredentials: Boolean(
        detailedProfile?.access ||
          detailedProfile?.refresh ||
          detailedProfile?.token
      ),
      expiresAt: timestampToIso(detailedProfile?.expires),
      lastUsedAt: timestampToIso(usage?.lastUsed),
      errorCount: usage?.errorCount ?? 0
    };
  });
}

export async function listOpenClawSessions(): Promise<OpenClawSessionInfo[]> {
  const sessionsIndex = await readSessionsIndex();

  return Object.entries(sessionsIndex)
    .map(([sessionKey, session]) => ({
      sessionId: session.sessionId ?? sessionKey,
      sessionKey,
      agentId: sessionKey.split(":")[1] ?? "main",
      updatedAt: timestampToIso(session.updatedAt),
      modelProvider: session.modelProvider ?? null,
      model: session.model ?? null,
      originLabel: session.origin?.label ?? null,
      abortedLastRun: Boolean(session.abortedLastRun),
      sessionFile: session.sessionFile ?? null
    }))
    .sort((left, right) => {
      const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
      const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
      return rightTime - leftTime;
    });
}

export async function listOpenClawTasks(): Promise<OpenClawTaskInfo[]> {
  const cronConfig = await readCronConfig();
  const jobs = cronConfig.jobs ?? [];

  return jobs.map((job, index) => normalizeTaskInfo(job, index));
}

function extractTextPreview(content: unknown): string {
  if (!Array.isArray(content)) {
    return "";
  }

  const textParts = content
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      const record = item as Record<string, unknown>;
      if (typeof record.text === "string") {
        return record.text;
      }

      if (typeof record.thinking === "string") {
        return `[thinking] ${record.thinking}`;
      }

      if (typeof record.type === "string") {
        return `[${record.type}]`;
      }

      return "";
    })
    .filter((value) => value.length > 0);

  return textParts.join(" ").slice(0, 240);
}

function findSessionEntry(sessionId: string, sessionsIndex: OpenClawSessionsIndex) {
  return Object.entries(sessionsIndex).find(([sessionKey, session]) => {
    return sessionKey === sessionId || session.sessionId === sessionId;
  });
}

export async function getOpenClawSessionDetail(sessionId: string): Promise<OpenClawSessionDetail | null> {
  const sessionsIndex = await readSessionsIndex();
  const entry = findSessionEntry(sessionId, sessionsIndex);

  if (!entry) {
    return null;
  }

  const [sessionKey, session] = entry;
  const baseSessionInfo: OpenClawSessionInfo = {
    sessionId: session.sessionId ?? sessionKey,
    sessionKey,
    agentId: sessionKey.split(":")[1] ?? "main",
    updatedAt: timestampToIso(session.updatedAt),
    modelProvider: session.modelProvider ?? null,
    model: session.model ?? null,
    originLabel: session.origin?.label ?? null,
    abortedLastRun: Boolean(session.abortedLastRun),
    sessionFile: session.sessionFile ?? null
  };

  if (!session.sessionFile) {
    return {
      session: baseSessionInfo,
      cwd: null,
      startedAt: null,
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      toolMessageCount: 0,
      errorCount: 0,
      lastError: null,
      recentMessages: []
    };
  }

  const content = await readFile(session.sessionFile, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const events = lines
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((item): item is Record<string, unknown> => Boolean(item));

  const sessionRecord = events.find((event) => event.type === "session");
  const messageEvents = events.filter((event) => event.type === "message");

  const recentMessages = messageEvents.slice(-8).map((event) => {
    const message = (event.message ?? {}) as Record<string, unknown>;
    return {
      id: String(event.id ?? ""),
      role: typeof message.role === "string" ? message.role : "unknown",
      timestamp:
        stringTimestampToIso(typeof event.timestamp === "string" ? event.timestamp : undefined) ??
        timestampToIso(typeof message.timestamp === "number" ? message.timestamp : undefined),
      textPreview: extractTextPreview(message.content),
      stopReason: typeof message.stopReason === "string" ? message.stopReason : null,
      errorMessage: typeof message.errorMessage === "string" ? message.errorMessage : null
    };
  });

  return {
    session: baseSessionInfo,
    cwd: typeof sessionRecord?.cwd === "string" ? sessionRecord.cwd : null,
    startedAt: stringTimestampToIso(typeof sessionRecord?.timestamp === "string" ? sessionRecord.timestamp : undefined),
    messageCount: messageEvents.length,
    userMessageCount: recentMessages.filter((message) => message.role === "user").length,
    assistantMessageCount: recentMessages.filter((message) => message.role === "assistant").length,
    toolMessageCount: recentMessages.filter((message) => message.role === "toolResult").length,
    errorCount: recentMessages.filter((message) => Boolean(message.errorMessage)).length,
    lastError: [...recentMessages].reverse().find((message) => message.errorMessage)?.errorMessage ?? null,
    recentMessages
  };
}

export async function getOpenClawTaskDetail(taskId: string): Promise<OpenClawTaskDetail | null> {
  const cronConfig = await readCronConfig();
  const jobs = cronConfig.jobs ?? [];
  const index = jobs.findIndex((job, jobIndex) => normalizeTaskId(job, jobIndex) === taskId);

  if (index < 0) {
    return null;
  }

  const job = jobs[index];
  const task = normalizeTaskInfo(job, index);
  const runLogPath = getTaskRunLogPath(task.id);
  const recentRuns = await listOpenClawTaskRuns(task.id, 20);

  return {
    task,
    state: normalizeTaskState(job),
    recentRuns,
    runLogPath,
    runLogAvailable: await pathExists(runLogPath),
    rawJson: job as Record<string, unknown>
  };
}

export async function createOpenClawTask(input: unknown): Promise<OpenClawTaskDetail> {
  const normalizedInput = normalizeTaskEditorInput(input);
  const cronConfig = await readCronConfig();
  const jobs = [...(cronConfig.jobs ?? [])];
  const taskId = randomUUID();
  const job = buildTaskRecord(normalizedInput, null, taskId);

  jobs.push(job);
  await persistCronConfig({
    ...cronConfig,
    jobs
  });

  const detail = await getOpenClawTaskDetail(taskId);
  if (!detail) {
    throw new OpenClawTaskEditorError("Task was created but could not be reloaded", {
      taskId
    });
  }

  return detail;
}

export async function updateOpenClawTask(taskId: string, input: unknown): Promise<OpenClawTaskDetail | null> {
  const normalizedInput = normalizeTaskEditorInput(input);
  const cronConfig = await readCronConfig();
  const jobs = [...(cronConfig.jobs ?? [])];
  const index = jobs.findIndex((job, jobIndex) => normalizeTaskId(job, jobIndex) === taskId);

  if (index < 0) {
    return null;
  }

  jobs[index] = buildTaskRecord(normalizedInput, jobs[index], taskId);
  await persistCronConfig({
    ...cronConfig,
    jobs
  });

  return getOpenClawTaskDetail(taskId);
}

export async function deleteOpenClawTask(taskId: string): Promise<OpenClawTaskDeleteResult | null> {
  const cronConfig = await readCronConfig();
  const jobs = [...(cronConfig.jobs ?? [])];
  const index = jobs.findIndex((job, jobIndex) => normalizeTaskId(job, jobIndex) === taskId);

  if (index < 0) {
    return null;
  }

  const task = normalizeTaskInfo(jobs[index], index);
  jobs.splice(index, 1);
  await persistCronConfig({
    ...cronConfig,
    jobs
  });

  const runLogPath = getTaskRunLogPath(task.id);
  let runLogDeleted = false;

  if (await pathExists(runLogPath)) {
    try {
      await unlink(runLogPath);
      runLogDeleted = true;
    } catch {
      runLogDeleted = false;
    }
  }

  return {
    taskId: task.id,
    taskName: task.name,
    deletedAt: new Date().toISOString(),
    runLogPath,
    runLogDeleted
  };
}

export async function setOpenClawTasksEnabled(
  taskIds: string[],
  enabled: boolean
): Promise<OpenClawTaskBulkActionResult> {
  const normalizedIds = [...new Set(taskIds.map((taskId) => taskId.trim()).filter((taskId) => taskId.length > 0))];
  if (normalizedIds.length === 0) {
    throw new OpenClawTaskEditorError("At least one taskId is required for bulk update.", {
      field: "taskIds"
    });
  }

  const cronConfig = await readCronConfig();
  const jobs = [...(cronConfig.jobs ?? [])];
  const affectedTaskNames: string[] = [];

  jobs.forEach((job, index) => {
    const normalizedTaskId = normalizeTaskId(job, index);
    if (!normalizedIds.includes(normalizedTaskId)) {
      return;
    }

    const task = normalizeTaskInfo(job, index);
    const nextJob = {
      ...job,
      enabled,
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now()
    };

    jobs[index] = nextJob;
    affectedTaskNames.push(task.name);
  });

  if (affectedTaskNames.length > 0) {
    await persistCronConfig({
      ...cronConfig,
      jobs
    });
  }

  return {
    action: enabled ? "enable" : "disable",
    taskIds: normalizedIds,
    affectedCount: affectedTaskNames.length,
    affectedTaskNames,
    deletedRunLogCount: 0,
    completedAt: new Date().toISOString()
  };
}

export async function deleteOpenClawTasks(taskIds: string[]): Promise<OpenClawTaskBulkActionResult> {
  const normalizedIds = [...new Set(taskIds.map((taskId) => taskId.trim()).filter((taskId) => taskId.length > 0))];
  if (normalizedIds.length === 0) {
    throw new OpenClawTaskEditorError("At least one taskId is required for bulk delete.", {
      field: "taskIds"
    });
  }

  const cronConfig = await readCronConfig();
  const jobs = [...(cronConfig.jobs ?? [])];
  const keptJobs: typeof jobs = [];
  const affectedTaskNames: string[] = [];
  let deletedRunLogCount = 0;

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    const normalizedTaskId = normalizeTaskId(job, index);

    if (!normalizedIds.includes(normalizedTaskId)) {
      keptJobs.push(job);
      continue;
    }

    const task = normalizeTaskInfo(job, index);
    affectedTaskNames.push(task.name);

    const runLogPath = getTaskRunLogPath(task.id);
    if (await pathExists(runLogPath)) {
      try {
        await unlink(runLogPath);
        deletedRunLogCount += 1;
      } catch {
        // Ignore per-file cleanup failures so the main delete can still succeed.
      }
    }
  }

  if (affectedTaskNames.length > 0) {
    await persistCronConfig({
      ...cronConfig,
      jobs: keptJobs
    });
  }

  return {
    action: "delete",
    taskIds: normalizedIds,
    affectedCount: affectedTaskNames.length,
    affectedTaskNames,
    deletedRunLogCount,
    completedAt: new Date().toISOString()
  };
}

export async function listOpenClawTaskRuns(taskId: string, limit = 20): Promise<OpenClawTaskRunRecord[]> {
  const runLogPath = getTaskRunLogPath(taskId);
  if (!(await pathExists(runLogPath))) {
    return [];
  }

  try {
    const content = await readFile(runLogPath, "utf8");
    const safeLimit = Math.max(1, Math.min(100, Number.isFinite(limit) ? Math.trunc(limit) : 20));

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-safeLimit)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is unknown => entry !== null)
      .map((entry) => normalizeTaskRunRecord(entry))
      .filter((entry): entry is OpenClawTaskRunRecord => Boolean(entry))
      .sort((left, right) => {
        const leftTime = Date.parse(left.ts ?? left.runAt ?? "") || 0;
        const rightTime = Date.parse(right.ts ?? right.runAt ?? "") || 0;
        return rightTime - leftTime;
      });
  } catch {
    return [];
  }
}

function parseEnvNumber(content: string, name: string): number | null {
  const match = content.match(new RegExp(`${name}=([0-9]+)`));
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseEnvString(content: string, name: string): string | null {
  const match = content.match(new RegExp(`${name}=([^\\r\\n]+)`));
  return match?.[1]?.trim().replace(/^"|"$/g, "") ?? null;
}

function parseQuotedCommandPath(commandLine: string, startIndex = 0) {
  const firstQuote = commandLine.indexOf("\"", startIndex);
  if (firstQuote < 0) {
    return null;
  }

  const secondQuote = commandLine.indexOf("\"", firstQuote + 1);
  if (secondQuote < 0) {
    return null;
  }

  return commandLine.slice(firstQuote + 1, secondQuote);
}

function parseGatewayLaunchCommand(content: string) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const launchLine = [...lines].reverse().find((line) => line.startsWith("\""));

  if (!launchLine) {
    return {
      nodeExecutable: null,
      entryScript: null
    };
  }

  const nodeExecutable = parseQuotedCommandPath(launchLine, 0);
  const entryScript = nodeExecutable ? parseQuotedCommandPath(launchLine, launchLine.indexOf("\"", 1) + 1) : null;

  return {
    nodeExecutable,
    entryScript
  };
}

async function probeTcpPort(port: number | null, host = "127.0.0.1", timeoutMs = 1500): Promise<BrowserRelayPortProbe> {
  if (!port) {
    return {
      port,
      reachable: false,
      latencyMs: null,
      error: "Port not configured"
    };
  }

  return await new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finalize = (reachable: boolean, error: string | null) => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      resolve({
        port,
        reachable,
        latencyMs: reachable ? Date.now() - startedAt : null,
        error
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize(true, null));
    socket.once("timeout", () => finalize(false, `Timed out after ${timeoutMs}ms`));
    socket.once("error", (error) => finalize(false, error.message));
    socket.connect(port, host);
  });
}

async function probeJsonEndpoint(
  url: string,
  headers?: Record<string, string>,
  transform?: (payload: unknown) => { version?: string | null; targets?: BrowserRelayTargetInfo[] }
): Promise<{
  probe: BrowserRelayEndpointProbe;
  version: string | null;
  targets: BrowserRelayTargetInfo[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        probe: {
          url,
          reachable: true,
          statusCode: response.status,
          latencyMs,
          error: `HTTP ${response.status}`
        },
        version: null,
        targets: []
      };
    }

    const payload = (await response.json()) as unknown;
    const transformed = transform ? transform(payload) : {};

    return {
      probe: {
        url,
        reachable: true,
        statusCode: response.status,
        latencyMs,
        error: null
      },
      version: transformed.version ?? null,
      targets: transformed.targets ?? []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      probe: {
        url,
        reachable: false,
        statusCode: null,
        latencyMs: null,
        error: message
      },
      version: null,
      targets: []
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonEndpoint<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new OpenClawBrowserRelayActionError(`Relay request failed with HTTP ${response.status}`, {
        url,
        statusCode: response.status
      });
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof OpenClawBrowserRelayActionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new OpenClawBrowserRelayActionError(`Relay request failed: ${message}`, { url });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchRelayTextEndpoint(url: string, headers?: Record<string, string>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal
    });
    const text = await response.text();

    if (!response.ok) {
      throw new OpenClawBrowserRelayActionError(`Relay action failed with HTTP ${response.status}`, {
        url,
        statusCode: response.status,
        body: text
      });
    }

    return text;
  } catch (error) {
    if (error instanceof OpenClawBrowserRelayActionError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new OpenClawBrowserRelayActionError(`Relay action failed: ${message}`, { url });
  } finally {
    clearTimeout(timeout);
  }
}

async function deriveRelayToken(gatewayToken: string, port: number) {
  const encoder = new TextEncoder();
  const key = await webcrypto.subtle.importKey(
    "raw",
    encoder.encode(gatewayToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await webcrypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`openclaw-extension-relay-v1:${port}`)
  );

  return [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function getManagedBrowserRelayUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}

async function resolveBrowserRelayPort() {
  let relayPort = DEFAULT_BROWSER_RELAY_PORT;
  const optionsPath = path.join(getBrowserExtensionDirPath(), "options.js");

  if (await pathExists(optionsPath)) {
    const optionsSource = await readFile(optionsPath, "utf8");
    const match = optionsSource.match(/DEFAULT_PORT\s*=\s*(\d+)/);
    if (match) {
      relayPort = Number(match[1]);
    }
  }

  return relayPort;
}

function buildManagedGatewayCmdContent(gatewayToken: string, relayPort: number) {
  return [
    "@echo off",
    `set "OPENCLAW_GATEWAY_PORT=${relayPort}"`,
    `set "OPENCLAW_GATEWAY_TOKEN=${gatewayToken}"`,
    `set "OPENCLAW_SERVICE_VERSION=${CLAWDESK_MANAGED_GATEWAY_SERVICE_VERSION}"`,
    `set "OPENCLAW_GATEWAY_MANAGED_BY=${CLAWDESK_MANAGED_GATEWAY_MARKER}"`,
    `set "OPENCLAW_GATEWAY_MODE=clawdesk-self-hosted"`,
    "echo This gateway is managed by ClawDesk and starts automatically with the desktop runtime."
  ].join("\r\n");
}

async function ensureManagedGatewayConfig() {
  const gatewayCmdPath = getGatewayCmdPath();
  const relayPort = await resolveBrowserRelayPort();
  let existingContent = "";
  let gatewayToken: string | null = null;

  if (await pathExists(gatewayCmdPath)) {
    existingContent = await readFile(gatewayCmdPath, "utf8");
    gatewayToken = parseEnvString(existingContent, "OPENCLAW_GATEWAY_TOKEN");
  }

  if (!gatewayToken) {
    gatewayToken = generateGatewayToken();
  }

  const nextContent = buildManagedGatewayCmdContent(gatewayToken, relayPort);
  await mkdir(getOpenClawHome(), { recursive: true });
  if (existingContent !== nextContent) {
    await writeFile(gatewayCmdPath, nextContent, "utf8");
  }

  process.env.OPENCLAW_GATEWAY_TOKEN = gatewayToken;
  process.env.OPENCLAW_GATEWAY_PORT = String(relayPort);

  return {
    gatewayCmdPath,
    gatewayToken,
    relayPort
  };
}

async function loadOpenClawRelaySdk() {
  relaySdkPromise ??= (async () => {
    const openClawEntryPath = require.resolve("openclaw");
    const relaySdkPath = path.join(path.dirname(openClawEntryPath), "plugin-sdk", "chrome-sok9EMkr.js");
    const relaySdkModule = (await import(pathToFileURL(relaySdkPath).href)) as {
      C?: EnsureChromeExtensionRelayServer;
      w?: StopChromeExtensionRelayServer;
    };

    if (typeof relaySdkModule.C !== "function" || typeof relaySdkModule.w !== "function") {
      throw new Error("OpenClaw relay SDK exports are unavailable.");
    }

    return {
      ensureChromeExtensionRelayServer: relaySdkModule.C,
      stopChromeExtensionRelayServer: relaySdkModule.w
    };
  })();

  return await relaySdkPromise;
}

function isRelayPortInUseError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "EADDRINUSE"
  );
}

export async function ensureOpenClawManagedBrowserGateway() {
  const config = await ensureManagedGatewayConfig();
  const { ensureChromeExtensionRelayServer } = await loadOpenClawRelaySdk();

  try {
    await ensureChromeExtensionRelayServer({
      cdpUrl: getManagedBrowserRelayUrl(config.relayPort)
    });
  } catch (error) {
    if (isRelayPortInUseError(error)) {
      return {
        ...config,
        alreadyRunning: true
      };
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new OpenClawBrowserRelayActionError(`Failed to start managed gateway: ${message}`, {
      gatewayCmdPath: config.gatewayCmdPath,
      relayPort: config.relayPort
    });
  }

  return {
    ...config,
    alreadyRunning: false
  };
}

export async function stopOpenClawManagedBrowserGateway() {
  const config = await ensureManagedGatewayConfig();
  const { stopChromeExtensionRelayServer } = await loadOpenClawRelaySdk();
  return await stopChromeExtensionRelayServer({
    cdpUrl: getManagedBrowserRelayUrl(config.relayPort)
  });
}

interface BrowserRelayControlContext {
  relayPort: number;
  relayToken: string;
  relayHeaders: Record<string, string>;
  relayHttpBase: string;
  relayWsUrl: string;
}

async function getBrowserRelayControlContext(): Promise<BrowserRelayControlContext> {
  const { gatewayCmdPath, relayPort: defaultRelayPort } = await ensureManagedGatewayConfig();
  const gatewayCmd = await readFile(gatewayCmdPath, "utf8");
  const gatewayToken = parseEnvString(gatewayCmd, "OPENCLAW_GATEWAY_TOKEN");
  if (!gatewayToken) {
    throw new OpenClawBrowserRelayActionError("Gateway token is missing. Save the gateway token before controlling the relay.");
  }

  const relayPort = defaultRelayPort;

  const relayToken = await deriveRelayToken(gatewayToken, relayPort);
  return {
    relayPort,
    relayToken,
    relayHeaders: {
      "x-openclaw-relay-token": relayToken
    },
    relayHttpBase: `http://127.0.0.1:${relayPort}`,
    relayWsUrl: `ws://127.0.0.1:${relayPort}/cdp?token=${encodeURIComponent(relayToken)}`
  };
}

async function ensureBrowserRelayReadyForControl() {
  const [context, relayStatus] = await Promise.all([
    getBrowserRelayControlContext(),
    getOpenClawBrowserRelayStatus()
  ]);

  if (!relayStatus.relayReachable) {
    throw new OpenClawBrowserRelayActionError("Relay is not reachable. Start the browser relay first.", {
      relayPort: relayStatus.relayPort,
      relayStatus: relayStatus.relayStatus
    });
  }

  if (relayStatus.relayAuthStatus === "rejected") {
    throw new OpenClawBrowserRelayActionError(
      "Relay auth is rejected. Re-save the gateway token in the browser extension options first.",
      {
        relayPort: relayStatus.relayPort,
        relayAuthStatus: relayStatus.relayAuthStatus
      }
    );
  }

  if (!relayStatus.extensionConnected) {
    throw new OpenClawBrowserRelayActionError(
      "Browser extension is not connected to the relay. Open Chrome and click the OpenClaw Browser Relay icon first.",
      {
        relayPort: relayStatus.relayPort,
        extensionConnected: relayStatus.extensionConnected
      }
    );
  }

  return {
    context,
    relayStatus
  };
}

function launchShellTarget(targetPath: string) {
  if (process.platform !== "win32") {
    throw new OpenClawBrowserRelayActionError("Relay helper actions are currently implemented for Windows only.", {
      platform: process.platform,
      targetPath
    });
  }

  const child = spawn("cmd.exe", ["/c", "start", "", targetPath], {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function sendBrowserRelayCdpCommand<T>(url: string, method: string, params: Record<string, unknown>) {
  return await new Promise<T>((resolve, reject) => {
    const socket = new WebSocket(url);
    const requestId = 1;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      socket.close();
      reject(
        new OpenClawBrowserRelayActionError(`Relay command timed out: ${method}`, {
          method
        })
      );
    }, 5000);

    const cleanup = () => {
      clearTimeout(timeout);
    };

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });

    socket.addEventListener("message", (event) => {
      if (settled) {
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(String(event.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (payload.id !== requestId) {
        return;
      }

      settled = true;
      cleanup();
      socket.close();

      const errorMessage = getString(payload.error);
      if (errorMessage) {
        reject(
          new OpenClawBrowserRelayActionError(`Relay command failed: ${errorMessage}`, {
            method,
            error: errorMessage
          })
        );
        return;
      }

      resolve((payload.result ?? null) as T);
    });

    socket.addEventListener("error", () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(
        new OpenClawBrowserRelayActionError(`Relay websocket failed while executing ${method}`, {
          method
        })
      );
    });

    socket.addEventListener("close", (event) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(
        new OpenClawBrowserRelayActionError(`Relay websocket closed before ${method} completed`, {
          method,
          code: event.code,
          reason: event.reason
        })
      );
    });
  });
}

export async function getOpenClawBrowserRelayStatus(): Promise<BrowserRelayStatus> {
  const home = getOpenClawHome();
  const extensionPath = getBrowserExtensionDirPath();
  const { gatewayCmdPath } = await ensureManagedGatewayConfig();
  const manifestPath = path.join(extensionPath, "manifest.json");
  const optionsPath = path.join(extensionPath, "options.js");
  const extensionAvailable = await pathExists(extensionPath);
  const extensionManifestAvailable = await pathExists(manifestPath);
  const optionsScriptAvailable = await pathExists(optionsPath);
  const gatewayCmdAvailable = await pathExists(gatewayCmdPath);

  let gatewayPort: number | null = null;
  let gatewayTokenConfigured = false;
  let gatewayToken: string | null = null;
  let relayPort = DEFAULT_BROWSER_RELAY_PORT;
  let gatewayServiceVersion: string | null = null;
  let gatewayNodeExecutable: string | null = null;
  let gatewayEntryScript: string | null = null;
  let gatewayManagedBy: string | null = null;
  let extensionName: string | null = null;
  let extensionVersion: string | null = null;
  let extensionPermissions: string[] = [];
  const notes: string[] = [];

  if (gatewayCmdAvailable) {
    const gatewayCmd = await readFile(gatewayCmdPath, "utf8");
    gatewayPort = parseEnvNumber(gatewayCmd, "OPENCLAW_GATEWAY_PORT");
    gatewayToken = parseEnvString(gatewayCmd, "OPENCLAW_GATEWAY_TOKEN");
    gatewayTokenConfigured = Boolean(gatewayToken);
    gatewayServiceVersion = parseEnvString(gatewayCmd, "OPENCLAW_SERVICE_VERSION");
    gatewayManagedBy = parseEnvString(gatewayCmd, "OPENCLAW_GATEWAY_MANAGED_BY");

    const launchCommand = parseGatewayLaunchCommand(gatewayCmd);
    gatewayNodeExecutable = launchCommand.nodeExecutable;
    gatewayEntryScript = launchCommand.entryScript;
    if (gatewayManagedBy === CLAWDESK_MANAGED_GATEWAY_MARKER && !gatewayEntryScript) {
      gatewayEntryScript = "clawdesk-managed-relay";
    }
  } else {
    notes.push("gateway.cmd not found");
  }

  if (extensionManifestAvailable) {
    const manifest = await readJsonFile<OpenClawExtensionManifest>(manifestPath, {});
    extensionName = manifest.name ?? null;
    extensionVersion = manifest.version ?? null;
    extensionPermissions = manifest.permissions ?? [];
  } else {
    notes.push("browser extension manifest.json not found");
  }

  if (optionsScriptAvailable) {
    const optionsSource = await readFile(optionsPath, "utf8");
    const match = optionsSource.match(/DEFAULT_PORT\s*=\s*(\d+)/);
    if (match) {
      relayPort = Number(match[1]);
    }
  } else {
    notes.push("browser extension options.js not found");
  }

  const gatewayProbe = await probeTcpPort(gatewayPort);
  const relayHeaders =
    gatewayToken && relayPort
      ? {
          "x-openclaw-relay-token": await deriveRelayToken(gatewayToken, relayPort)
        }
      : undefined;

  const relayVersionUrl = `http://127.0.0.1:${relayPort}/json/version`;
  const relayTargetsUrl = `http://127.0.0.1:${relayPort}/json/list`;
  const relayExtensionStatusUrl = `http://127.0.0.1:${relayPort}/extension/status`;
  const versionResult = await probeJsonEndpoint(relayVersionUrl, relayHeaders, (payload) => {
    const record = payload as Record<string, unknown>;
    return {
      version:
        typeof record.Browser === "string"
          ? record.Browser
          : typeof record["User-Agent"] === "string"
            ? record["User-Agent"]
            : null
    };
  });
  const targetsResult = await probeJsonEndpoint(relayTargetsUrl, relayHeaders, (payload) => {
    if (!Array.isArray(payload)) {
      return {
        targets: []
      };
    }

    return {
      targets: payload.map((target) => {
        const record = target as Record<string, unknown>;
        return {
          id: typeof record.id === "string" ? record.id : "",
          type: typeof record.type === "string" ? record.type : null,
          title: typeof record.title === "string" ? record.title : null,
          url: typeof record.url === "string" ? record.url : null,
          webSocketDebuggerUrl:
            typeof record.webSocketDebuggerUrl === "string" ? record.webSocketDebuggerUrl : null
        };
      })
    };
  });
  const extensionStatusPayload = await fetchJsonEndpoint<{ connected?: boolean }>(
    relayExtensionStatusUrl,
    relayHeaders
  ).catch(() => ({ connected: false }));

  const relayReachable = versionResult.probe.reachable;
  const relayVersion = versionResult.version;
  const extensionConnected = Boolean(extensionStatusPayload.connected);
  const targets = targetsResult.targets.filter((target) => target.id.length > 0);
  const targetCount = targets.length;
  const relayStatus: BrowserRelayStatus["relayStatus"] = relayReachable
    ? "online"
    : extensionAvailable
      ? "offline"
      : "unknown";
  const relayAuthStatus: BrowserRelayStatus["relayAuthStatus"] =
    versionResult.probe.statusCode === 401
      ? "rejected"
      : gatewayTokenConfigured
        ? "configured"
        : "missing";
  const gatewayStatus: BrowserRelayStatus["gatewayStatus"] = gatewayPort
    ? gatewayProbe.reachable
      ? "online"
      : "offline"
    : "unknown";

  if (!relayReachable && versionResult.probe.error) {
    notes.push(`relay version probe failed: ${versionResult.probe.error}`);
  }

  if (!targetsResult.probe.reachable && targetsResult.probe.error) {
    notes.push(`relay target probe failed: ${targetsResult.probe.error}`);
  }

  if (gatewayPort && !gatewayProbe.reachable && gatewayProbe.error) {
    notes.push(`gateway probe failed: ${gatewayProbe.error}`);
  }

  if (gatewayManagedBy === CLAWDESK_MANAGED_GATEWAY_MARKER) {
    notes.push("gateway is self-hosted by ClawDesk");
  }

  return {
    relayPort,
    relayStatus,
    relayReachable,
    relayAuthStatus,
    extensionConnected,
    relayVersion,
    extensionPath,
    extensionAvailable,
    extensionManifestPath: manifestPath,
    extensionManifestAvailable,
    extensionName,
    extensionVersion,
    extensionPermissions,
    optionsPath,
    optionsScriptAvailable,
    gatewayCmdPath,
    gatewayCmdAvailable,
    gatewayPort,
    gatewayStatus,
    gatewayProbe,
    gatewayTokenConfigured,
    gatewayServiceVersion,
    gatewayNodeExecutable,
    gatewayEntryScript,
    relayVersionProbe: versionResult.probe,
    relayTargetsProbe: targetsResult.probe,
    targetCount,
    targets,
    checkedAt: new Date().toISOString(),
    notes
  };
}

export async function openOpenClawBrowserRelayTarget(url: string): Promise<BrowserRelayActionResult> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    throw new OpenClawBrowserRelayActionError("Target URL is required.", {
      field: "url"
    });
  }

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new OpenClawBrowserRelayActionError("Target URL must start with http:// or https://", {
      field: "url"
    });
  }

  const { context } = await ensureBrowserRelayReadyForControl();
  const result = await sendBrowserRelayCdpCommand<{ targetId?: string }>(
    context.relayWsUrl,
    "Target.createTarget",
    {
      url: trimmedUrl
    }
  );
  const targetId = getString(result?.targetId) ?? null;

  return {
    action: "open-target",
    targetId,
    targetUrl: trimmedUrl,
    targetPath: null,
    message: targetId
      ? `Opened a new relay-managed target for ${trimmedUrl}.`
      : `Requested a new relay-managed target for ${trimmedUrl}.`,
    checkedAt: new Date().toISOString()
  };
}

export async function activateOpenClawBrowserRelayTarget(targetId: string): Promise<BrowserRelayActionResult> {
  const trimmedTargetId = targetId.trim();
  if (!trimmedTargetId) {
    throw new OpenClawBrowserRelayActionError("targetId is required.", {
      field: "targetId"
    });
  }

  const { context } = await ensureBrowserRelayReadyForControl();
  await fetchRelayTextEndpoint(`${context.relayHttpBase}/json/activate/${encodeURIComponent(trimmedTargetId)}`, context.relayHeaders);

  return {
    action: "activate-target",
    targetId: trimmedTargetId,
    targetUrl: null,
    targetPath: null,
    message: `Requested focus for relay target ${trimmedTargetId}.`,
    checkedAt: new Date().toISOString()
  };
}

export async function closeOpenClawBrowserRelayTarget(targetId: string): Promise<BrowserRelayActionResult> {
  const trimmedTargetId = targetId.trim();
  if (!trimmedTargetId) {
    throw new OpenClawBrowserRelayActionError("targetId is required.", {
      field: "targetId"
    });
  }

  const { context } = await ensureBrowserRelayReadyForControl();
  await fetchRelayTextEndpoint(`${context.relayHttpBase}/json/close/${encodeURIComponent(trimmedTargetId)}`, context.relayHeaders);

  return {
    action: "close-target",
    targetId: trimmedTargetId,
    targetUrl: null,
    targetPath: null,
    message: `Requested close for relay target ${trimmedTargetId}. This closes the attached browser tab.`,
    checkedAt: new Date().toISOString()
  };
}

export async function startOpenClawBrowserGateway(): Promise<BrowserRelayActionResult> {
  const { gatewayCmdPath, alreadyRunning } = await ensureOpenClawManagedBrowserGateway();
  const relay = await getOpenClawBrowserRelayStatus();
  if (relay.gatewayStatus === "online" || relay.relayStatus === "online" || alreadyRunning) {
    return {
      action: "start-gateway",
      targetId: null,
      targetUrl: null,
      targetPath: gatewayCmdPath,
      message: "Managed gateway is already online.",
      checkedAt: new Date().toISOString()
    };
  }

  return {
    action: "start-gateway",
    targetId: null,
    targetUrl: null,
    targetPath: gatewayCmdPath,
    message: "Managed gateway started inside the ClawDesk runtime. Refresh Relay Startup Guide in a few seconds.",
    checkedAt: new Date().toISOString()
  };
}

export async function openOpenClawBrowserExtensionFolder(): Promise<BrowserRelayActionResult> {
  const extensionPath = getBrowserExtensionDirPath();
  if (!(await pathExists(extensionPath))) {
    throw new OpenClawBrowserRelayActionError("Browser extension folder was not found.", {
      extensionPath
    });
  }

  launchShellTarget(extensionPath);
  return {
    action: "open-extension-folder",
    targetId: null,
    targetUrl: null,
    targetPath: extensionPath,
    message: "Opened the browser extension folder.",
    checkedAt: new Date().toISOString()
  };
}

export async function openOpenClawBrowserExtensionOptions(): Promise<BrowserRelayActionResult> {
  const optionsPath = path.join(getBrowserExtensionDirPath(), "options.html");
  if (!(await pathExists(optionsPath))) {
    throw new OpenClawBrowserRelayActionError("Browser extension options page was not found.", {
      optionsPath
    });
  }

  launchShellTarget(optionsPath);
  return {
    action: "open-extension-options",
    targetId: null,
    targetUrl: null,
    targetPath: optionsPath,
    message: "Opened the browser extension options page.",
    checkedAt: new Date().toISOString()
  };
}

export async function listOpenClawPairedDevices(): Promise<OpenClawPairedDeviceInfo[]> {
  const pairedDevices = await readPairedDevicesConfig();

  return Object.entries(pairedDevices)
    .map(([fallbackDeviceId, device]) => {
      const tokenEntries = Object.entries(device.tokens ?? {});
      const lastUsedAt = tokenEntries.reduce<string | null>((latest, [, token]) => {
        const nextValue = timestampToIso(token.lastUsedAtMs);
        if (!nextValue) {
          return latest;
        }

        if (!latest) {
          return nextValue;
        }

        return Date.parse(nextValue) > Date.parse(latest) ? nextValue : latest;
      }, null);

      return {
        deviceId: device.deviceId ?? fallbackDeviceId,
        platform: device.platform ?? null,
        clientId: device.clientId ?? null,
        clientMode: device.clientMode ?? null,
        role: device.role ?? null,
        scopes: device.scopes ?? [],
        approvedScopes: device.approvedScopes ?? [],
        tokenRoles: tokenEntries.map(([tokenRole]) => tokenRole),
        createdAt: timestampToIso(device.createdAtMs),
        approvedAt: timestampToIso(device.approvedAtMs),
        lastUsedAt
      };
    })
    .sort((left, right) => {
      const leftTime = left.lastUsedAt ? Date.parse(left.lastUsedAt) : 0;
      const rightTime = right.lastUsedAt ? Date.parse(right.lastUsedAt) : 0;
      return rightTime - leftTime;
    });
}

function deriveDeviceLastSeenState(lastUsedAt: string | null): OpenClawPairedDeviceDetail["lastSeenState"] {
  if (!lastUsedAt) {
    return "unknown";
  }

  const ageMs = Date.now() - Date.parse(lastUsedAt);
  if (Number.isNaN(ageMs)) {
    return "unknown";
  }

  return ageMs <= 1000 * 60 * 60 * 24 * 7 ? "recent" : "stale";
}

function deriveDeviceApprovalState(device: OpenClawPairedDeviceInfo): OpenClawPairedDeviceDetail["approvalState"] {
  if (device.approvedScopes.length === 0) {
    return "pending";
  }

  return device.approvedScopes.length >= device.scopes.length ? "approved" : "partial";
}

export async function getOpenClawPairedDeviceDetail(
  deviceId: string
): Promise<OpenClawPairedDeviceDetail | null> {
  const devices = await listOpenClawPairedDevices();
  const device = devices.find((item) => item.deviceId === deviceId);

  if (!device) {
    return null;
  }

  const approvalState = deriveDeviceApprovalState(device);
  const lastSeenState = deriveDeviceLastSeenState(device.lastUsedAt);
  const notes: string[] = [];

  if (approvalState === "pending") {
    notes.push("No approved scopes yet.");
  } else if (approvalState === "partial") {
    notes.push("Approved scopes do not cover the full requested scope set.");
  }

  if (lastSeenState === "unknown") {
    notes.push("Device has not reported any recent token usage yet.");
  } else if (lastSeenState === "stale") {
    notes.push("Device has not been used in the last 7 days.");
  }

  if (device.tokenRoles.length === 0) {
    notes.push("No token roles were found in the legacy pairing record.");
  }

  return {
    device,
    scopeCount: device.scopes.length,
    approvedScopeCount: device.approvedScopes.length,
    approvalState,
    lastSeenState,
    notes
  };
}

function buildPendingApprovalPayload(
  requestId: string,
  approval: OpenClawPendingApprovalsConfig[string]
): PairingPendingApproval | null {
  if (!approval) {
    return null;
  }

  return {
    requestId: approval.requestId ?? requestId,
    sessionId: approval.sessionId ?? "",
    clientType: approval.clientType ?? "android",
    deviceName: approval.deviceName ?? "Mobile client",
    requestedScopes: approval.requestedScopes ?? [],
    status: approval.status ?? "pending",
    submittedAt: timestampToIso(approval.submittedAtMs) ?? new Date().toISOString(),
    expiresAt: timestampToIso(approval.expiresAtMs) ?? new Date().toISOString(),
    tokenPreview: approval.token ? `${approval.token.slice(0, 8)}...` : "missing",
    suggestedDeviceId: approval.suggestedDeviceId ?? `paired-${requestId.slice(0, 8)}`
  };
}

export async function listOpenClawPairingAuditEntries(limit = 20): Promise<PairingAuditEntry[]> {
  const config = await readPairingAuditConfig();

  return config
    .slice()
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, Math.max(1, limit));
}

export async function queryOpenClawPairingAudit(
  filters: Partial<PairingAuditFilters> = {}
): Promise<PairingAuditQueryResult> {
  const normalizedFilters: PairingAuditFilters = {
    kind: filters.kind ?? "all",
    actor: filters.actor ?? "all",
    search: filters.search ?? "",
    limit: Math.max(1, filters.limit ?? 20),
    offset: Math.max(0, filters.offset ?? 0)
  };
  const config = await readPairingAuditConfig();
  const search = normalizedFilters.search.trim().toLowerCase();

  const matched = config
    .slice()
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .filter((entry) => {
      const kindMatch = normalizedFilters.kind === "all" || entry.kind === normalizedFilters.kind;
      const actorMatch = normalizedFilters.actor === "all" || entry.actor === normalizedFilters.actor;
      const searchMatch =
        search.length === 0 ||
        JSON.stringify(entry).toLowerCase().includes(search);

      return kindMatch && actorMatch && searchMatch;
    });

  return {
    totalEntries: config.length,
    matchedEntries: matched.length,
    returnedEntries: matched.slice(
      normalizedFilters.offset,
      normalizedFilters.offset + normalizedFilters.limit
    ).length,
    hasMore: normalizedFilters.offset + normalizedFilters.limit < matched.length,
    filters: normalizedFilters,
    entries: matched.slice(normalizedFilters.offset, normalizedFilters.offset + normalizedFilters.limit)
  };
}

export async function exportOpenClawPairingAudit(
  filters: Partial<PairingAuditFilters> = {}
): Promise<PairingAuditExportResult> {
  const result = await queryOpenClawPairingAudit({
    kind: filters.kind,
    actor: filters.actor,
    search: filters.search,
    limit: Number.MAX_SAFE_INTEGER,
    offset: 0
  });
  const generatedAt = new Date().toISOString();
  const safeTimestamp = generatedAt.replace(/[:.]/g, "-");
  const outputPath = path.join(getExportsDirPath(), `pairing-audit-${safeTimestamp}.json`);

  await writeJsonFile(outputPath, {
    generatedAt,
    filters: result.filters,
    totalEntries: result.totalEntries,
    matchedEntries: result.matchedEntries,
    entries: result.entries
  });

  return {
    outputPath,
    generatedAt,
    entryCount: result.entries.length
  };
}

export async function cleanupExpiredOpenClawPairingSessions(): Promise<PairingSessionCleanupResult> {
  const now = Date.now();
  const sessions = await readPairingSessionsConfig();
  const approvals = await readPendingApprovalsConfig();
  const expiredSessionIds = Object.entries(sessions)
    .filter(([, session]) => (session.expiresAtMs ?? 0) > 0 && (session.expiresAtMs ?? 0) <= now)
    .map(([sessionId]) => sessionId);

  let rejectedPendingApprovalCount = 0;

  for (const sessionId of expiredSessionIds) {
    const session = sessions[sessionId];
    if (!session) {
      continue;
    }

    session.status = "expired";

    const relatedPendingApproval = Object.values(approvals).find(
      (approval) => approval.sessionId === sessionId && approval.status === "pending"
    );

    if (relatedPendingApproval) {
      relatedPendingApproval.status = "rejected";
      relatedPendingApproval.reason = "Pairing session expired before desktop approval.";
      relatedPendingApproval.decidedAtMs = now;
      rejectedPendingApprovalCount += 1;
    }

    await appendPairingAuditEntry({
      kind: "session-expired",
      summary: `Pairing session ${sessionId} expired.`,
      actor: "desktop",
      requestId: relatedPendingApproval?.requestId ?? null,
      sessionId,
      deviceId: relatedPendingApproval?.suggestedDeviceId ?? null,
      details: {
        expiresAt: timestampToIso(session.expiresAtMs),
        rejectedPendingApproval: Boolean(relatedPendingApproval)
      }
    });

    delete sessions[sessionId];
  }

  await Promise.all([writePairingSessionsConfig(sessions), writePendingApprovalsConfig(approvals)]);
  lastPairingMaintenanceAt = now;

  return {
    cleanedAt: new Date(now).toISOString(),
    removedSessionCount: expiredSessionIds.length,
    rejectedPendingApprovalCount,
    message:
      expiredSessionIds.length > 0
        ? `Cleaned up ${expiredSessionIds.length} expired pairing session(s).`
        : "No expired pairing sessions were found."
  };
}

export async function getOpenClawActivePairingSession(): Promise<Pick<PairingCenterSessionPayload, "sessionId" | "expiresAt"> | null> {
  await runOpenClawPairingMaintenanceIfDue();
  const config = await readPairingSessionsConfig();
  const activeSession = Object.values(config)
    .filter((session) => session.sessionId && session.expiresAtMs && (session.status === "ready" || session.status === "claimed"))
    .sort((left, right) => (right.createdAtMs ?? 0) - (left.createdAtMs ?? 0))[0];

  if (!activeSession?.sessionId || !activeSession.expiresAtMs) {
    return null;
  }

  if (activeSession.expiresAtMs <= Date.now()) {
    return null;
  }

  return {
    sessionId: activeSession.sessionId,
    expiresAt: new Date(activeSession.expiresAtMs).toISOString()
  };
}

export async function createOpenClawPairingSession(): Promise<PairingCenterSessionPayload> {
  await runOpenClawPairingMaintenanceIfDue(true);
  const sessionId = randomUUID();
  const token = generatePairingToken();
  const now = Date.now();
  const expiresAtMs = now + 1000 * 60 * 10;
  const sessions = await readPairingSessionsConfig();

  sessions[sessionId] = {
    sessionId,
    token,
    createdAtMs: now,
    expiresAtMs,
    defaultScopes: ["device.read", "task.read", "logs.read", "relay.read", "alerts.read"],
    supportedClients: ["android", "mini-program"],
    approvalMode: "desktop-approval-required",
    transport: "qr+token",
    status: "ready"
  };

  await writePairingSessionsConfig(sessions);

  await appendPairingAuditEntry({
    kind: "session-created",
    summary: `Created pairing session ${sessionId}.`,
    actor: "desktop",
    requestId: null,
    sessionId,
    deviceId: null,
    details: {
      expiresAt: new Date(expiresAtMs).toISOString(),
      supportedClients: ["android", "mini-program"]
    }
  });

  return {
    sessionId,
    token,
    pairingUri: buildPairingUri(token),
    qrText: buildPairingUri(token),
    expiresAt: new Date(expiresAtMs).toISOString(),
    defaultScopes: ["device.read", "task.read", "logs.read", "relay.read", "alerts.read"],
    supportedClients: ["android", "mini-program"],
    approvalMode: "desktop-approval-required",
    transport: "qr+token",
    notes: [
      "This short-lived token is for desktop-approved pairing only.",
      "Phase one mobile clients should request read-mostly scopes."
    ]
  };
}

export async function listOpenClawPendingApprovals(): Promise<PairingPendingApproval[]> {
  await runOpenClawPairingMaintenanceIfDue();
  const approvals = await readPendingApprovalsConfig();

  return Object.entries(approvals)
    .map(([requestId, approval]) => buildPendingApprovalPayload(requestId, approval))
    .filter((approval): approval is PairingPendingApproval => Boolean(approval))
    .filter((approval) => approval.status === "pending")
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt));
}

export async function submitOpenClawPairingRequest(input: unknown): Promise<PairingPendingApproval> {
  await runOpenClawPairingMaintenanceIfDue();
  const body = getRequiredRecord(input, "request body");
  const token = getRequiredText(body.token, "token");
  const clientType = getRequiredEnum(body.clientType, "clientType", ["android", "mini-program"]);
  const deviceName = getRequiredText(body.deviceName, "deviceName");
  const requestedScopes = normalizeScopeList(body.requestedScopes, "requestedScopes");

  const sessions = await readPairingSessionsConfig();
  const sessionEntry = Object.values(sessions).find((session) => session.token === token);

  if (!sessionEntry?.sessionId) {
    throw new OpenClawPairingError("Pairing token was not found.", {
      tokenPreview: `${token.slice(0, 8)}...`
    });
  }

  const expiresAtMs = sessionEntry.expiresAtMs ?? 0;
  if (expiresAtMs <= Date.now()) {
    sessionEntry.status = "expired";
    await writePairingSessionsConfig(sessions);
    throw new OpenClawPairingError("Pairing token has expired.", {
      sessionId: sessionEntry.sessionId
    });
  }

  if (sessionEntry.status && sessionEntry.status !== "ready") {
    throw new OpenClawPairingError("Pairing token has already been used.", {
      sessionId: sessionEntry.sessionId,
      status: sessionEntry.status
    });
  }

  const approvals = await readPendingApprovalsConfig();
  const requestId = randomUUID();
  const suggestedDeviceId = `paired-${requestId.slice(0, 8)}`;

  approvals[requestId] = {
    requestId,
    sessionId: sessionEntry.sessionId,
    token,
    clientType,
    deviceName,
    requestedScopes,
    status: "pending",
    submittedAtMs: Date.now(),
    expiresAtMs,
    suggestedDeviceId
  };

  sessionEntry.status = "claimed";
  sessionEntry.claimedRequestId = requestId;

  await Promise.all([writePendingApprovalsConfig(approvals), writePairingSessionsConfig(sessions)]);

  await appendPairingAuditEntry({
    kind: "request-submitted",
    summary: `Received pairing request ${requestId} from ${clientType}.`,
    actor: "mobile",
    requestId,
    sessionId: sessionEntry.sessionId,
    deviceId: suggestedDeviceId,
    details: {
      clientType,
      deviceName,
      requestedScopes
    }
  });

  return buildPendingApprovalPayload(requestId, approvals[requestId]) as PairingPendingApproval;
}

export async function approveOpenClawPendingApproval(
  requestId: string,
  approvedScopes?: string[]
): Promise<PairingApprovalResult | null> {
  const approvals = await readPendingApprovalsConfig();
  const approval = approvals[requestId];
  if (!approval) {
    return null;
  }

  const requestedScopes = approval.requestedScopes ?? [];
  const finalApprovedScopes =
    approvedScopes && approvedScopes.length > 0
      ? approvedScopes.filter((scope) => requestedScopes.includes(scope))
      : requestedScopes;

  const pairedDevices = await readPairedDevicesConfig();
  const deviceId = approval.suggestedDeviceId ?? `paired-${requestId.slice(0, 8)}`;
  const now = Date.now();

  pairedDevices[deviceId] = {
    ...(pairedDevices[deviceId] ?? {}),
    deviceId,
    platform: approval.clientType ?? "android",
    clientId: approval.deviceName ?? deviceId,
    clientMode: "mobile",
    role: "viewer",
    scopes: requestedScopes,
    approvedScopes: finalApprovedScopes,
    tokens: {
      mobile: {
        lastUsedAtMs: now
      }
    },
    createdAtMs: pairedDevices[deviceId]?.createdAtMs ?? approval.submittedAtMs ?? now,
    approvedAtMs: now
  };

  approval.status = "approved";
  approval.decidedAtMs = now;
  approval.approvedScopes = finalApprovedScopes;

  const sessions = await readPairingSessionsConfig();
  const session = approval.sessionId ? sessions[approval.sessionId] : undefined;
  if (session) {
    session.status = "approved";
  }

  await Promise.all([
    writePairedDevicesConfig(pairedDevices),
    writePendingApprovalsConfig(approvals),
    writePairingSessionsConfig(sessions)
  ]);

  await appendPairingAuditEntry({
    kind: "request-approved",
    summary: `Approved pairing request ${requestId}.`,
    actor: "desktop",
    requestId,
    sessionId: approval.sessionId ?? null,
    deviceId,
    details: {
      requestedScopes,
      approvedScopes: finalApprovedScopes
    }
  });

  return {
    requestId,
    decision: "approved",
    decidedAt: new Date(now).toISOString(),
    deviceId,
    approvedScopes: finalApprovedScopes,
    message: `Approved pairing request ${requestId}.`
  };
}

export async function rejectOpenClawPendingApproval(
  requestId: string,
  reason?: string
): Promise<PairingApprovalResult | null> {
  const approvals = await readPendingApprovalsConfig();
  const approval = approvals[requestId];
  if (!approval) {
    return null;
  }

  const now = Date.now();
  approval.status = "rejected";
  approval.decidedAtMs = now;
  approval.reason = reason ?? "Rejected on desktop.";

  const sessions = await readPairingSessionsConfig();
  const session = approval.sessionId ? sessions[approval.sessionId] : undefined;
  if (session) {
    session.status = "rejected";
  }

  await Promise.all([writePendingApprovalsConfig(approvals), writePairingSessionsConfig(sessions)]);

  await appendPairingAuditEntry({
    kind: "request-rejected",
    summary: `Rejected pairing request ${requestId}.`,
    actor: "desktop",
    requestId,
    sessionId: approval.sessionId ?? null,
    deviceId: approval.suggestedDeviceId ?? null,
    details: {
      reason: approval.reason ?? null
    }
  });

  return {
    requestId,
    decision: "rejected",
    decidedAt: new Date(now).toISOString(),
    deviceId: null,
    approvedScopes: [],
    message: `Rejected pairing request ${requestId}.`
  };
}

export async function updateOpenClawPairedDeviceApprovedScopes(
  deviceId: string,
  approvedScopes: string[]
): Promise<PairedDeviceMutationResult | null> {
  const pairedDevices = await readPairedDevicesConfig();
  const device = pairedDevices[deviceId];
  if (!device) {
    return null;
  }

  const requestedScopes = device.scopes ?? [];
  const normalizedApprovedScopes = [...new Set(approvedScopes.filter((scope) => requestedScopes.includes(scope)))];
  device.approvedScopes = normalizedApprovedScopes;
  device.approvedAtMs = normalizedApprovedScopes.length > 0 ? Date.now() : undefined;

  await writePairedDevicesConfig(pairedDevices);

  await appendPairingAuditEntry({
    kind: "device-scopes-updated",
    summary:
      normalizedApprovedScopes.length > 0
        ? `Updated approved scopes for device ${deviceId}.`
        : `Revoked all approved scopes for device ${deviceId}.`,
    actor: "desktop",
    requestId: null,
    sessionId: null,
    deviceId,
    details: {
      approvedScopes: normalizedApprovedScopes,
      requestedScopes
    }
  });

  return {
    deviceId,
    action: "update-approved-scopes",
    appliedAt: new Date().toISOString(),
    approvedScopes: normalizedApprovedScopes,
    removed: false,
    message:
      normalizedApprovedScopes.length > 0
        ? `Updated approved scopes for device ${deviceId}.`
        : `Revoked all approved scopes for device ${deviceId}.`
  };
}

export async function removeOpenClawPairedDevice(deviceId: string): Promise<PairedDeviceMutationResult | null> {
  const pairedDevices = await readPairedDevicesConfig();
  const device = pairedDevices[deviceId];
  if (!device) {
    return null;
  }

  delete pairedDevices[deviceId];
  await writePairedDevicesConfig(pairedDevices);

  await appendPairingAuditEntry({
    kind: "device-removed",
    summary: `Removed paired device ${deviceId}.`,
    actor: "desktop",
    requestId: null,
    sessionId: null,
    deviceId,
    details: {
      approvedScopes: device.approvedScopes ?? [],
      requestedScopes: device.scopes ?? []
    }
  });

  return {
    deviceId,
    action: "remove-device",
    appliedAt: new Date().toISOString(),
    approvedScopes: device.approvedScopes ?? [],
    removed: true,
    message: `Removed paired device ${deviceId}.`
  };
}

function buildBrowserRelayStartupStep(
  id: BrowserRelayStartupStep["id"],
  status: BrowserRelayStartupStep["status"],
  evidence: string | null
): BrowserRelayStartupStep {
  return {
    id,
    status,
    evidence
  };
}

export async function getOpenClawBrowserRelayStartupGuide(): Promise<BrowserRelayStartupGuide> {
  const relay = await getOpenClawBrowserRelayStatus();
  const steps: BrowserRelayStartupGuide["steps"] = [];
  const issueCodes: BrowserRelayStartupGuide["issueCodes"] = [];

  const extensionFilesReady =
    relay.extensionAvailable && relay.extensionManifestAvailable && relay.optionsScriptAvailable;
  steps.push(
    buildBrowserRelayStartupStep(
      "extension-files",
      extensionFilesReady ? "complete" : "action-required",
      extensionFilesReady ? relay.extensionPath : relay.notes[0] ?? "Extension files are incomplete."
    )
  );
  if (!extensionFilesReady) {
    issueCodes.push("extension-files-missing");
  }

  steps.push(
    buildBrowserRelayStartupStep(
      "gateway-config",
      relay.gatewayTokenConfigured ? "complete" : "action-required",
      relay.gatewayCmdAvailable ? relay.gatewayCmdPath : "gateway.cmd is missing."
    )
  );
  if (!relay.gatewayTokenConfigured) {
    issueCodes.push("gateway-token-missing");
  }

  steps.push(
    buildBrowserRelayStartupStep(
      "gateway-process",
      relay.gatewayStatus === "online"
        ? "complete"
        : relay.gatewayCmdAvailable
          ? "action-required"
          : "blocked",
      relay.gatewayPort ? `Gateway port ${relay.gatewayPort}` : "Gateway port not configured."
    )
  );
  if (relay.gatewayStatus !== "online") {
    issueCodes.push("gateway-offline");
  }

  steps.push(
    buildBrowserRelayStartupStep(
      "relay-process",
      relay.relayReachable ? "complete" : extensionFilesReady ? "action-required" : "blocked",
      `Relay port ${relay.relayPort}`
    )
  );
  if (!relay.relayReachable) {
    issueCodes.push("relay-offline");
  }

  steps.push(
    buildBrowserRelayStartupStep(
      "relay-auth",
      relay.relayAuthStatus === "rejected"
        ? "action-required"
        : relay.gatewayTokenConfigured
          ? "complete"
          : "blocked",
      relay.relayAuthStatus
    )
  );
  if (relay.relayAuthStatus === "rejected") {
    issueCodes.push("relay-auth-rejected");
  }

  steps.push(
    buildBrowserRelayStartupStep(
      "extension-connection",
      relay.extensionConnected ? "complete" : relay.relayReachable ? "action-required" : "blocked",
      relay.extensionConnected ? "Extension reported connected." : "Open the browser extension popup once."
    )
  );
  if (!relay.extensionConnected) {
    issueCodes.push("extension-disconnected");
  }

  let overallStatus: BrowserRelayStartupGuide["overallStatus"] = "ready";
  let nextActionCode: BrowserRelayStartupGuide["nextActionCode"] = "none";

  if (!extensionFilesReady) {
    overallStatus = "missing-extension-files";
    nextActionCode = "install-extension-files";
  } else if (!relay.gatewayTokenConfigured) {
    overallStatus = "missing-token";
    nextActionCode = "save-gateway-token";
  } else if (relay.gatewayStatus !== "online") {
    overallStatus = "gateway-offline";
    nextActionCode = "start-gateway";
  } else if (!relay.relayReachable) {
    overallStatus = "relay-offline";
    nextActionCode = "start-relay";
  } else if (relay.relayAuthStatus === "rejected") {
    overallStatus = "auth-rejected";
    nextActionCode = "resave-token";
  } else if (!relay.extensionConnected) {
    overallStatus = "extension-disconnected";
    nextActionCode = "connect-extension";
  }

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    nextActionCode,
    issueCodes,
    steps
  };
}
