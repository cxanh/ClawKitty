export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface RuntimeHealth {
  status: "online" | "offline" | "degraded";
  version: string;
  uptimeSec: number;
  collectorStatus: "online" | "offline" | "degraded";
  openclawCoreStatus: "planned" | "online" | "offline";
  browserRelayStatus: "online" | "offline" | "unknown";
}

export type DesktopOnboardingActionCode =
  | "none"
  | "open-settings"
  | "start-gateway"
  | "open-extension-folder"
  | "open-extension-options"
  | "connect-extension"
  | "explore-workspace";

export interface DesktopOnboardingStep {
  id: "managed-home" | "runtime" | "gateway" | "extension-files" | "extension-connection" | "workspace";
  status: "complete" | "action-required";
  evidence: string;
  actionCode: DesktopOnboardingActionCode;
}

export interface DesktopOnboardingStatusPayload {
  generatedAt: string;
  dataHome: string;
  dataHomeSource: DesktopBridge["dataHomeSource"];
  legacyHome: string | null;
  bundledExtensionAvailable: boolean;
  isBlankWorkspace: boolean;
  counts: {
    providers: number;
    authProfiles: number;
    sessions: number;
    tasks: number;
    devices: number;
  };
  relay: Pick<
    BrowserRelayStatus,
    "gatewayStatus" | "relayStatus" | "extensionConnected" | "targetCount" | "extensionAvailable"
  >;
  paths: {
    extensionPath: string;
    extensionOptionsPath: string;
  };
  completionState:
    | "waiting-gateway"
    | "waiting-extension-files"
    | "waiting-extension-connect"
    | "relay-ready"
    | "relay-active"
    | "workspace-ready";
  completionMessage: string;
  relayTargetsPreview: string[];
  nextActionCode: Exclude<DesktopOnboardingActionCode, "none">;
  steps: DesktopOnboardingStep[];
}

export interface CpuSnapshot {
  usagePct: number;
  temperatureC: number | null;
}

export interface MemorySnapshot {
  usedBytes: number;
  totalBytes: number;
}

export interface GpuSummary {
  name: string;
  usagePct: number | null;
  memoryUsedMb: number | null;
  memoryTotalMb: number | null;
  temperatureC: number | null;
}

export interface DiskSummary {
  mount: string;
  usedPct: number;
  sizeBytes: number;
  availableBytes: number;
}

export interface NetworkSnapshot {
  rxBytesPerSec: number;
  txBytesPerSec: number;
}

export interface SystemSummary {
  deviceId: string;
  hostname: string;
  platform: string;
  runtimeStatus: "online" | "offline" | "degraded";
  agentStatus: "planned" | "ready" | "busy" | "offline";
  lastHeartbeatAt: string;
  uptimeSec: number;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  gpu: GpuSummary[];
  disk: DiskSummary[];
  network: NetworkSnapshot;
}

export interface DesktopBridge {
  runtimeBaseUrl: string;
  appVersion: string;
  platform: string;
  userDataDir: string;
  dataHome: string;
  dataHomeSource: "fresh" | "legacy-import" | "existing-managed" | "unknown";
  legacyHome: string | null;
  bundledExtensionAvailable: boolean;
}

export interface OpenClawProviderInfo {
  id: string;
  displayName: string;
  baseUrl: string | null;
  apiKind: string | null;
  modelCount: number;
}

export interface OpenClawAuthProfileInfo {
  id: string;
  providerId: string;
  mode: string;
  hasStoredCredentials: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  errorCount: number;
}

export interface OpenClawSessionInfo {
  sessionId: string;
  sessionKey: string;
  agentId: string;
  updatedAt: string | null;
  modelProvider: string | null;
  model: string | null;
  originLabel: string | null;
  abortedLastRun: boolean;
  sessionFile: string | null;
}

export interface OpenClawTaskInfo {
  id: string;
  name: string;
  type: string;
  description: string | null;
  enabled: boolean;
  deleteAfterRun: boolean;
  agentId: string | null;
  sessionKey: string | null;
  scheduleKind: string | null;
  nextRunAt: string | null;
  runningAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "skipped" | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveErrors: number;
  source: string;
}

export interface OpenClawOverview {
  homePath: string;
  available: boolean;
  providerCount: number;
  authProfileCount: number;
  sessionCount: number;
  taskCount: number;
  latestSessionUpdatedAt: string | null;
}

export interface OpenClawPairedDeviceInfo {
  deviceId: string;
  platform: string | null;
  clientId: string | null;
  clientMode: string | null;
  role: string | null;
  scopes: string[];
  approvedScopes: string[];
  tokenRoles: string[];
  createdAt: string | null;
  approvedAt: string | null;
  lastUsedAt: string | null;
}

export interface OpenClawPairedDeviceDetail {
  device: OpenClawPairedDeviceInfo;
  scopeCount: number;
  approvedScopeCount: number;
  approvalState: "approved" | "partial" | "pending";
  lastSeenState: "recent" | "stale" | "unknown";
  notes: string[];
}

export interface RuntimeProcessInfo {
  pid: number;
  name: string;
  cpuPct: number;
  memoryMb: number;
  virtualMemoryMb: number | null;
  startedAt: string | null;
  path: string | null;
}

export interface RuntimeProcessKillResult {
  pid: number;
  name: string;
  status: "terminated";
  requestedAt: string;
  method: "process.kill";
}

export interface OpenClawSessionMessagePreview {
  id: string;
  role: string;
  timestamp: string | null;
  textPreview: string;
  stopReason: string | null;
  errorMessage: string | null;
}

export interface OpenClawSessionDetail {
  session: OpenClawSessionInfo;
  cwd: string | null;
  startedAt: string | null;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolMessageCount: number;
  errorCount: number;
  lastError: string | null;
  recentMessages: OpenClawSessionMessagePreview[];
}

export interface OpenClawTaskDetail {
  task: OpenClawTaskInfo;
  state: OpenClawTaskStateSummary;
  recentRuns: OpenClawTaskRunRecord[];
  runLogPath: string;
  runLogAvailable: boolean;
  rawJson: Record<string, unknown>;
}

export interface OpenClawTaskDeleteResult {
  taskId: string;
  taskName: string;
  deletedAt: string;
  runLogPath: string;
  runLogDeleted: boolean;
}

export interface OpenClawTaskBulkActionResult {
  action: "enable" | "disable" | "delete";
  taskIds: string[];
  affectedCount: number;
  affectedTaskNames: string[];
  deletedRunLogCount: number;
  completedAt: string;
}

export interface OpenClawTaskStateSummary {
  nextRunAt: string | null;
  runningAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: "ok" | "error" | "skipped" | null;
  lastStatus: "ok" | "error" | "skipped" | null;
  lastError: string | null;
  lastDurationMs: number | null;
  consecutiveErrors: number;
  lastDelivered: boolean | null;
  lastDeliveryStatus: "delivered" | "not-delivered" | "unknown" | "not-requested" | null;
  lastDeliveryError: string | null;
  lastFailureAlertAt: string | null;
}

export interface OpenClawTaskRunUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
}

export interface OpenClawTaskRunRecord {
  ts: string | null;
  action: string;
  status: "ok" | "error" | "skipped" | null;
  error: string | null;
  summary: string | null;
  delivered: boolean | null;
  deliveryStatus: "delivered" | "not-delivered" | "unknown" | "not-requested" | null;
  deliveryError: string | null;
  sessionId: string | null;
  sessionKey: string | null;
  runAt: string | null;
  durationMs: number | null;
  nextRunAt: string | null;
  model: string | null;
  provider: string | null;
  jobName: string | null;
  usage: OpenClawTaskRunUsage | null;
  raw: Record<string, unknown>;
}

export type OpenClawTaskScheduleInput =
  | {
      kind: "every";
      everyMs: number;
    }
  | {
      kind: "cron";
      expr: string;
      tz: string | null;
    }
  | {
      kind: "at";
      at: string;
    };

export type OpenClawTaskPayloadInput =
  | {
      kind: "systemEvent";
      text: string;
    }
  | {
      kind: "openUrl";
      url: string;
      openMode: "external" | "relay";
      label: string | null;
    }
  | {
      kind: "notify";
      title: string;
      body: string;
      level: "info" | "warn" | "error";
    };

export interface OpenClawTaskEditorInput {
  name: string;
  description: string | null;
  enabled: boolean;
  deleteAfterRun: boolean;
  agentId: string | null;
  sessionKey: string | null;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  schedule: OpenClawTaskScheduleInput;
  payload: OpenClawTaskPayloadInput;
}

export interface BrowserRelayEndpointProbe {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

export interface BrowserRelayPortProbe {
  port: number | null;
  reachable: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface BrowserRelayTargetInfo {
  id: string;
  type: string | null;
  title: string | null;
  url: string | null;
  webSocketDebuggerUrl: string | null;
}

export interface BrowserRelayStatus {
  relayPort: number;
  relayStatus: "online" | "offline" | "unknown";
  relayReachable: boolean;
  relayAuthStatus: "configured" | "missing" | "rejected" | "unknown";
  extensionConnected: boolean;
  relayVersion: string | null;
  extensionPath: string;
  extensionAvailable: boolean;
  extensionManifestPath: string;
  extensionManifestAvailable: boolean;
  extensionName: string | null;
  extensionVersion: string | null;
  extensionPermissions: string[];
  optionsPath: string;
  optionsScriptAvailable: boolean;
  gatewayCmdPath: string;
  gatewayCmdAvailable: boolean;
  gatewayPort: number | null;
  gatewayStatus: "online" | "offline" | "unknown";
  gatewayProbe: BrowserRelayPortProbe;
  gatewayTokenConfigured: boolean;
  gatewayServiceVersion: string | null;
  gatewayNodeExecutable: string | null;
  gatewayEntryScript: string | null;
  relayVersionProbe: BrowserRelayEndpointProbe;
  relayTargetsProbe: BrowserRelayEndpointProbe;
  targetCount: number;
  targets: BrowserRelayTargetInfo[];
  checkedAt: string;
  notes: string[];
}

export interface BrowserRelayActionResult {
  action:
    | "open-target"
    | "activate-target"
    | "close-target"
    | "start-gateway"
    | "open-extension-folder"
    | "open-extension-options";
  targetId: string | null;
  targetUrl: string | null;
  targetPath?: string | null;
  message: string;
  checkedAt: string;
}

export interface BrowserRelayStartupStep {
  id:
    | "extension-files"
    | "gateway-config"
    | "gateway-process"
    | "relay-process"
    | "relay-auth"
    | "extension-connection";
  status: "complete" | "action-required" | "blocked";
  evidence: string | null;
}

export interface BrowserRelayStartupGuide {
  generatedAt: string;
  overallStatus:
    | "ready"
    | "missing-extension-files"
    | "missing-token"
    | "gateway-offline"
    | "relay-offline"
    | "auth-rejected"
    | "extension-disconnected";
  nextActionCode:
    | "none"
    | "install-extension-files"
    | "save-gateway-token"
    | "start-gateway"
    | "start-relay"
    | "resave-token"
    | "connect-extension";
  issueCodes: Array<
    | "extension-files-missing"
    | "gateway-token-missing"
    | "gateway-offline"
    | "relay-offline"
    | "relay-auth-rejected"
    | "extension-disconnected"
  >;
  steps: BrowserRelayStartupStep[];
}

export interface BrowserRelayEvent {
  id: string;
  timestamp: string;
  kind: "snapshot" | "relay-status" | "relay-auth" | "gateway-status" | "target-count" | "notes" | "error";
  severity: "info" | "warn" | "error";
  summary: string;
  details: Record<string, unknown>;
}

export interface BrowserRelayMonitorState {
  startedAt: string;
  lastCheckedAt: string | null;
  pollIntervalMs: number;
  current: BrowserRelayStatus | null;
  eventCount: number;
  events: BrowserRelayEvent[];
}

export interface LogFileInfo {
  name: string;
  path: string;
  exists: boolean;
  sizeBytes: number;
  modifiedAt: string | null;
  tailLines: string[];
}

export interface LogSummary {
  logDir: string;
  files: LogFileInfo[];
}

export interface LogTailEntry {
  raw: string;
  timestamp: string | null;
  level: string | null;
  message: string | null;
  details: Record<string, unknown> | null;
}

export interface LogTailResult {
  file: string;
  path: string;
  exists: boolean;
  lineCount: number;
  entries: LogTailEntry[];
}

export interface LogQueryFilters {
  level: "all" | "info" | "warn" | "error";
  search: string;
  lines: number;
}

export interface LogQueryResult {
  file: string;
  path: string;
  exists: boolean;
  totalEntries: number;
  matchedEntries: number;
  returnedEntries: number;
  filters: LogQueryFilters;
  entries: LogTailEntry[];
}

export interface LogExportResult {
  outputPath: string;
  generatedAt: string;
  fileCount: number;
}

export interface MobileBootstrapPayload {
  generatedAt: string;
  runtime: RuntimeHealth;
  system: SystemSummary;
  openclaw: OpenClawOverview;
  pairedDevices: {
    total: number;
    approved: number;
    pending: number;
    recentCount: number;
    staleCount: number;
    recent: OpenClawPairedDeviceInfo[];
  };
  tasks: {
    total: number;
    enabled: number;
    error: number;
    running: number;
    recent: OpenClawTaskInfo[];
  };
  browserRelay: {
    relayStatus: BrowserRelayStatus["relayStatus"];
    relayAuthStatus: BrowserRelayStatus["relayAuthStatus"];
    extensionConnected: boolean;
    targetCount: number;
    checkedAt: string;
  };
  authBoundary: MobileAuthBoundary;
}

export interface MobileAuthBoundary {
  pairingRequired: boolean;
  supportedClients: Array<"android" | "mini-program">;
  recommendedPollIntervalSec: number;
  supportedScopes: string[];
  plannedWriteScopes: string[];
  restrictedActions: string[];
  notes: string[];
}

export interface MobileOverviewPayload {
  generatedAt: string;
  runtime: Pick<RuntimeHealth, "status" | "collectorStatus" | "openclawCoreStatus" | "browserRelayStatus" | "uptimeSec">;
  host: Pick<SystemSummary, "hostname" | "deviceId" | "platform" | "lastHeartbeatAt">;
  pairedDevices: {
    total: number;
    approved: number;
    pending: number;
    recent: number;
    stale: number;
  };
  tasks: {
    total: number;
    enabled: number;
    error: number;
    running: number;
  };
  browserRelay: {
    relayStatus: BrowserRelayStatus["relayStatus"];
    relayAuthStatus: BrowserRelayStatus["relayAuthStatus"];
    extensionConnected: boolean;
    targetCount: number;
  };
  alerts: {
    total: number;
    error: number;
    warn: number;
    latestMessage: string | null;
    latestTimestamp: string | null;
  };
}

export interface MobileAlertItem {
  sourceFile: string;
  timestamp: string | null;
  level: "warn" | "error";
  message: string | null;
  details: Record<string, unknown> | null;
}

export interface MobileAlertsSummaryPayload {
  generatedAt: string;
  total: number;
  errorCount: number;
  warnCount: number;
  latest: MobileAlertItem[];
}

export interface MobilePairingStep {
  id:
    | "desktop-prepare"
    | "show-qr"
    | "mobile-scan"
    | "desktop-approve"
    | "scope-confirm"
    | "poll-runtime";
  title: string;
  owner: "desktop" | "mobile" | "shared";
  status: "ready" | "planned";
  summary: string;
}

export interface MobilePairingFlowPayload {
  generatedAt: string;
  supportedClients: Array<"android" | "mini-program">;
  approvalMode: "desktop-approval-required";
  pairingTransport: "qr+token";
  requiredDesktopActions: string[];
  requiredMobileActions: string[];
  defaultScopes: string[];
  optionalScopes: string[];
  writeScopesPlanned: string[];
  restrictedActions: string[];
  steps: MobilePairingStep[];
  notes: string[];
}

export interface PairingAuditEntry {
  id: string;
  timestamp: string;
  kind:
    | "session-created"
    | "session-expired"
    | "request-submitted"
    | "request-approved"
    | "request-rejected"
    | "device-scopes-updated"
    | "device-removed";
  summary: string;
  actor: "desktop" | "mobile";
  requestId: string | null;
  sessionId: string | null;
  deviceId: string | null;
  details: Record<string, unknown>;
}

export interface PairingAuditFilters {
  kind:
    | "all"
    | "session-created"
    | "session-expired"
    | "request-submitted"
    | "request-approved"
    | "request-rejected"
    | "device-scopes-updated"
    | "device-removed";
  actor: "all" | "desktop" | "mobile";
  search: string;
  limit: number;
  offset: number;
}

export interface PairingAuditQueryResult {
  totalEntries: number;
  matchedEntries: number;
  returnedEntries: number;
  hasMore: boolean;
  filters: PairingAuditFilters;
  entries: PairingAuditEntry[];
}

export interface PairingAuditExportResult {
  outputPath: string;
  generatedAt: string;
  entryCount: number;
}

export interface PairingSessionCleanupResult {
  cleanedAt: string;
  removedSessionCount: number;
  rejectedPendingApprovalCount: number;
  message: string;
}

export interface MobilePairingStatusPayload {
  generatedAt: string;
  approvalMode: "desktop-approval-required";
  pairingTransport: "qr+token";
  runtimeReady: boolean;
  relayReady: boolean;
  desktopReady: boolean;
  hasActivePairingSession: boolean;
  activePairingSession: {
    sessionId: string;
    expiresAt: string;
  } | null;
  pendingApprovalCount: number;
  recentAudit: PairingAuditEntry[];
  supportedClients: Array<"android" | "mini-program">;
  supportedScopes: string[];
  plannedWriteScopes: string[];
  notes: string[];
}

export interface PairingCenterStatusPayload {
  generatedAt: string;
  approvalMode: "desktop-approval-required";
  transport: "qr+token";
  supportedClients: Array<"android" | "mini-program">;
  runtimeReady: boolean;
  relayReady: boolean;
  pairedDevices: {
    total: number;
    approved: number;
    pending: number;
    recent: number;
  };
  defaultScopes: string[];
  plannedWriteScopes: string[];
  restrictedActions: string[];
  nextSteps: string[];
  notes: string[];
}

export interface PairingCenterSessionPayload {
  sessionId: string;
  token: string;
  pairingUri: string;
  qrText: string;
  expiresAt: string;
  defaultScopes: string[];
  supportedClients: Array<"android" | "mini-program">;
  approvalMode: "desktop-approval-required";
  transport: "qr+token";
  notes: string[];
}

export interface PairingRequestInput {
  token: string;
  clientType: "android" | "mini-program";
  deviceName: string;
  requestedScopes: string[];
}

export interface PairingPendingApproval {
  requestId: string;
  sessionId: string;
  clientType: "android" | "mini-program";
  deviceName: string;
  requestedScopes: string[];
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  expiresAt: string;
  tokenPreview: string;
  suggestedDeviceId: string;
}

export interface PairingApprovalResult {
  requestId: string;
  decision: "approved" | "rejected";
  decidedAt: string;
  deviceId: string | null;
  approvedScopes: string[];
  message: string;
}

export interface PairedDeviceMutationResult {
  deviceId: string;
  action: "remove-device" | "update-approved-scopes";
  appliedAt: string;
  approvedScopes: string[];
  removed: boolean;
  message: string;
}

export type AgentChatReplyMode =
  | "welcome"
  | "course-reminder"
  | "file-search"
  | "study-plan"
  | "memory-reminder"
  | "general";

export interface AgentChatOrchestrationMeta {
  source: "provider" | "heuristic";
  providerId: string | null;
  modelId: string | null;
  durationMs: number | null;
  fallbackReason: string | null;
}

export interface AgentApprovalHint {
  toolId: string;
  toolDisplayName: string;
  risk: PermissionRiskLevel;
  policy: PermissionPolicyMode;
  summary: string;
}

export interface AgentChatStarterPrompt {
  id: string;
  title: string;
  prompt: string;
  scenario: "course-reminder" | "file-search" | "study-plan" | "general";
}

export interface AgentChatCapabilitySnapshot {
  agentMode: "single-primary-agent";
  reminderMode: "light-proactive";
  providerCount: number;
  taskCount: number;
  deviceCount: number;
  pairedDeviceCount: number;
  supportsMobilePairing: boolean;
  supportsBrowserRelay: boolean;
}

export interface AgentChatConversationSummary {
  conversationId: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  tags: string[];
}

export interface AgentChatMessage {
  messageId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  replyMode?: AgentChatReplyMode;
  orchestration?: AgentChatOrchestrationMeta;
  approvalHints?: AgentApprovalHint[];
}

export interface AgentChatConversationDetail extends AgentChatConversationSummary {
  messages: AgentChatMessage[];
}

export interface AgentChatBootstrapPayload {
  generatedAt: string;
  agentDisplayName: string;
  capabilities: AgentChatCapabilitySnapshot;
  starterPrompts: AgentChatStarterPrompt[];
  conversations: AgentChatConversationSummary[];
}

export interface AgentChatConversationCreateInput {
  title?: string;
}

export interface AgentChatMessageSendInput {
  conversationId?: string;
  content: string;
}

export interface AgentChatSendMessageResult {
  createdConversation: boolean;
  conversation: AgentChatConversationDetail;
  replyMode: AgentChatReplyMode;
  suggestedActions: string[];
  orchestration: AgentChatOrchestrationMeta;
  approvalHints: AgentApprovalHint[];
}

export interface AgentTaskCard {
  taskId: string;
  title: string;
  summary: string;
  sourceConversationId: string;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentChatOrchestrationMeta | null;
  approvalHints: AgentApprovalHint[];
  status: "draft" | "ready" | "in-progress" | "blocked" | "done";
  createdAt: string;
  updatedAt: string;
  tags: string[];
  checklist: string[];
}

export interface AgentTaskBoardPayload {
  generatedAt: string;
  total: number;
  statusCounts: Record<AgentTaskCard["status"], number>;
  tasks: AgentTaskCard[];
}

export interface AgentTaskFromChatInput {
  conversationId: string;
}

export interface AgentTaskStatusUpdateInput {
  status: AgentTaskCard["status"];
}

export type AgentSafeActionKind =
  | "course-reminder-draft"
  | "file-organization-brief"
  | "study-plan-draft"
  | "memory-item";

export type AgentSafeActionStatus = "draft" | "ready" | "saved";

export interface AgentSafeActionRecord {
  actionId: string;
  kind: AgentSafeActionKind;
  title: string;
  summary: string;
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentChatOrchestrationMeta | null;
  sourceExcerpt: string;
  approvalHints: AgentApprovalHint[];
  status: AgentSafeActionStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  details: string[];
  nextSteps: string[];
}

export interface AgentSafeActionsBoardPayload {
  generatedAt: string;
  total: number;
  statusCounts: Record<AgentSafeActionStatus, number>;
  actions: AgentSafeActionRecord[];
}

export interface AgentSafeActionFromChatInput {
  conversationId: string;
}

export interface AgentSafeActionFromTaskInput {
  taskId: string;
}

export interface AgentSafeActionStatusUpdateInput {
  status: AgentSafeActionStatus;
}

export type AgentReminderPlanKind = "course-reminder-plan" | "memory-reminder-plan";

export type AgentReminderPlanStatus = "draft" | "active" | "paused";

export interface AgentReminderWindow {
  windowId: string;
  label: string;
  timingHint: string;
  summary: string;
  offsetMinutes: number;
}

export type AgentMemoryReminderEventType = "birthday" | "meeting" | "deadline" | "general";

export type AgentMemoryReminderImportance = "light" | "standard" | "important";

export type AgentMemoryReminderRelationship =
  | "self"
  | "classmate"
  | "friend"
  | "close-friend"
  | "team"
  | "family"
  | "general";

export type AgentMemoryReminderSuggestionFocus =
  | "gift-and-greeting"
  | "prep-checklist"
  | "follow-through"
  | "none";

export interface AgentMemoryReminderSuggestion {
  suggestionId: string;
  kind: "gift" | "greeting" | "prep" | "checklist";
  title: string;
  summary: string;
}

export interface AgentMemoryReminderProfile {
  eventType: AgentMemoryReminderEventType;
  importance: AgentMemoryReminderImportance;
  relationship: AgentMemoryReminderRelationship;
  suggestionFocus: AgentMemoryReminderSuggestionFocus;
  suggestions: AgentMemoryReminderSuggestion[];
}

export interface AgentReminderPlanRecord {
  planId: string;
  kind: AgentReminderPlanKind;
  title: string;
  summary: string;
  sourceActionId: string;
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentChatOrchestrationMeta | null;
  status: AgentReminderPlanStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  scheduleOutline: string[];
  reminderWindows: AgentReminderWindow[];
  deliveryChannels: Array<"desktop" | "mobile-planned">;
  memoryProfile?: AgentMemoryReminderProfile | null;
  notes: string[];
}

export type AgentReminderDeliveryStatus = "pending" | "delivered" | "paused";

export interface AgentReminderDeliveryRecord {
  deliveryId: string;
  planId: string;
  planKind: AgentReminderPlanKind;
  planTitle: string;
  sourceActionId: string;
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  status: AgentReminderDeliveryStatus;
  channel: "desktop";
  eventType: AgentMemoryReminderEventType | "course" | "general";
  windowLabel: string;
  scheduledFor: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
  notificationTitle: string;
  notificationBody: string;
}

export interface AgentReminderDeliveriesPollPayload {
  generatedAt: string;
  totalDue: number;
  deliveries: AgentReminderDeliveryRecord[];
}

export interface AgentReminderPlansBoardPayload {
  generatedAt: string;
  total: number;
  statusCounts: Record<AgentReminderPlanStatus, number>;
  plans: AgentReminderPlanRecord[];
}

export interface AgentReminderPlanFromSafeActionInput {
  actionId: string;
}

export interface AgentReminderPlanStatusUpdateInput {
  status: AgentReminderPlanStatus;
}

export type AgentCourseWeekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

export type AgentCourseReminderPreset = "morning-class" | "afternoon-class" | "custom";

export interface AgentCourseScheduleEntry {
  entryId: string;
  courseName: string;
  weekday: AgentCourseWeekday;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string[];
  reminderPreset: AgentCourseReminderPreset;
  nightBeforeReminder: boolean;
  afternoonReminder: boolean;
  sourcePlanId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCourseScheduleBoardPayload {
  generatedAt: string;
  total: number;
  weekdayCounts: Record<AgentCourseWeekday, number>;
  entries: AgentCourseScheduleEntry[];
}

export interface AgentCourseScheduleEntryInput {
  courseName: string;
  weekday: AgentCourseWeekday;
  startTime: string;
  endTime: string;
  location: string | null;
  notes: string[];
  reminderPreset: AgentCourseReminderPreset;
  nightBeforeReminder: boolean;
  afternoonReminder: boolean;
  sourcePlanId?: string | null;
}

export type AgentCourseScheduleImportMode = "append" | "replace";

export interface AgentCourseScheduleImportInput {
  text: string;
  mode: AgentCourseScheduleImportMode;
}

export interface AgentCourseScheduleImportResult {
  mode: AgentCourseScheduleImportMode;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalRows: number;
  errors: string[];
}

export type AgentFileWorkspaceStatus = "draft" | "active" | "archived";

export interface AgentFileSearchRoot {
  rootId: string;
  label: string;
  path: string;
  exists: boolean;
  source: "desktop" | "documents" | "downloads" | "onedrive-documents" | "custom";
}

export interface AgentFileWorkspaceTimeView {
  viewId: string;
  label: string;
  summary: string;
}

export interface AgentFileWorkspaceEventView {
  viewId: string;
  label: string;
  summary: string;
  exampleItems: string[];
}

export interface AgentFileWorkspaceRecord {
  workspaceId: string;
  title: string;
  summary: string;
  sourceActionId: string;
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentChatOrchestrationMeta | null;
  status: AgentFileWorkspaceStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  searchRoots: AgentFileSearchRoot[];
  resultFields: string[];
  timeViews: AgentFileWorkspaceTimeView[];
  eventViews: AgentFileWorkspaceEventView[];
  plannedIntegrations: string[];
  notes: string[];
}

export interface AgentFileWorkspacesBoardPayload {
  generatedAt: string;
  total: number;
  statusCounts: Record<AgentFileWorkspaceStatus, number>;
  workspaces: AgentFileWorkspaceRecord[];
}

export interface AgentFileWorkspaceFromSafeActionInput {
  actionId: string;
}

export interface AgentFileWorkspaceStatusUpdateInput {
  status: AgentFileWorkspaceStatus;
}

export interface AgentFileWorkspaceSearchQuery {
  query: string;
  limit?: number;
}

export interface AgentFileWorkspaceSearchResultItem {
  resultId: string;
  rootLabel: string;
  path: string;
  fileName: string;
  extension: string | null;
  sizeBytes: number;
  storedAt: string;
  eventTag: "course-material" | "application-material" | "personal-admin" | "general";
}

export interface AgentFileWorkspaceTimeGroup {
  key: "recent-7d" | "this-week" | "older";
  label: string;
  count: number;
  results: AgentFileWorkspaceSearchResultItem[];
}

export interface AgentFileWorkspaceEventGroup {
  key: AgentFileWorkspaceSearchResultItem["eventTag"];
  label: string;
  count: number;
  results: AgentFileWorkspaceSearchResultItem[];
}

export interface AgentFileWorkspaceSearchAcceleration {
  provider: "native-fallback" | "everything-cli";
  available: boolean;
  used: boolean;
  executablePath: string | null;
  note: string | null;
}

export interface AgentFileWorkspaceSuggestionCard {
  suggestionId: string;
  kind: "time-bucket" | "event-bucket" | "review-step";
  title: string;
  summary: string;
  confidence: "high" | "medium";
  readOnly: true;
  examplePaths: string[];
}

export interface AgentFileWorkspaceSearchResult {
  workspaceId: string;
  query: string;
  generatedAt: string;
  searchedRootCount: number;
  matchedCount: number;
  returnedCount: number;
  acceleration: AgentFileWorkspaceSearchAcceleration;
  results: AgentFileWorkspaceSearchResultItem[];
  timeGroups: AgentFileWorkspaceTimeGroup[];
  eventGroups: AgentFileWorkspaceEventGroup[];
  suggestions: AgentFileWorkspaceSuggestionCard[];
}

export interface AgentFileWorkspacePreviewInput {
  query: string;
  limit?: number;
}

export interface AgentFileWorkspacePreviewItem {
  previewId: string;
  sourcePath: string;
  fileName: string;
  eventTag: AgentFileWorkspaceSearchResultItem["eventTag"];
  suggestedFolder: string;
  suggestedReason: string;
  confidence: "high" | "medium";
}

export interface AgentFileWorkspacePreviewGroup {
  key: string;
  label: string;
  count: number;
  items: AgentFileWorkspacePreviewItem[];
}

export interface AgentFileWorkspaceOrganizationPreview {
  workspaceId: string;
  query: string;
  generatedAt: string;
  totalItems: number;
  readOnly: true;
  groups: AgentFileWorkspacePreviewGroup[];
  items: AgentFileWorkspacePreviewItem[];
  note: string;
}

export type AgentStudyRoadmapStatus = "draft" | "active" | "completed";

export interface AgentStudyRoadmapMilestone {
  milestoneId: string;
  title: string;
  summary: string;
  targetWeek: string;
}

export interface AgentStudyRoadmapWeek {
  weekId: string;
  label: string;
  focus: string;
  tasks: string[];
  reviewCheckpoint: string;
}

export interface AgentStudyRoadmapRecord {
  roadmapId: string;
  title: string;
  summary: string;
  sourceActionId: string;
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentChatOrchestrationMeta | null;
  status: AgentStudyRoadmapStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  goalSummary: string[];
  milestones: AgentStudyRoadmapMilestone[];
  weeklyPlan: AgentStudyRoadmapWeek[];
  deliveryChannels: Array<"desktop" | "mobile-planned">;
  notes: string[];
}

export interface AgentStudyRoadmapsBoardPayload {
  generatedAt: string;
  total: number;
  statusCounts: Record<AgentStudyRoadmapStatus, number>;
  roadmaps: AgentStudyRoadmapRecord[];
}

export interface AgentStudyRoadmapFromSafeActionInput {
  actionId: string;
}

export interface AgentStudyRoadmapStatusUpdateInput {
  status: AgentStudyRoadmapStatus;
}

export type ActivityFeedKind =
  | "chat-conversation-created"
  | "chat-message-sent"
  | "agent-task-created"
  | "agent-task-status-updated"
  | "agent-safe-action-created"
  | "agent-safe-action-status-updated"
  | "agent-reminder-plan-created"
  | "agent-reminder-plan-status-updated"
  | "agent-reminder-delivery-delivered"
  | "agent-course-schedule-updated"
  | "agent-file-workspace-created"
  | "agent-file-workspace-status-updated"
  | "agent-file-workspace-preview-created"
  | "agent-study-roadmap-created"
  | "agent-study-roadmap-status-updated"
  | "permission-policy-updated"
  | "permission-tool-policy-updated"
  | "approval-request-created"
  | "approval-request-approved"
  | "approval-request-rejected";

export interface ActivityFeedItem {
  activityId: string;
  kind: ActivityFeedKind;
  title: string;
  summary: string;
  actor: "user" | "agent" | "system";
  occurredAt: string;
  relatedConversationId: string | null;
  relatedTaskId: string | null;
  metadata: Record<string, unknown>;
}

export interface ActivityFeedPayload {
  generatedAt: string;
  total: number;
  items: ActivityFeedItem[];
}

export type PermissionRiskLevel = "low" | "medium" | "high";

export type PermissionPolicyMode = "allow" | "ask" | "desktop-approve" | "deny";

export interface PermissionRiskDefault {
  risk: PermissionRiskLevel;
  policy: PermissionPolicyMode;
  description: string;
}

export interface PermissionToolPolicy {
  toolId: string;
  displayName: string;
  description: string;
  risk: PermissionRiskLevel;
  policy: PermissionPolicyMode;
  recommendedPolicy: PermissionPolicyMode;
  source: "default" | "override" | "locked";
  desktopOnly: boolean;
  mobileVisible: boolean;
}

export interface PermissionDeviceSnapshot {
  total: number;
  approved: number;
  partial: number;
  pending: number;
  recent: number;
}

export interface PermissionApprovalHistoryEntry {
  entryId: string;
  source: "pairing-audit" | "policy-activity";
  timestamp: string;
  title: string;
  summary: string;
  actor: string;
  decision: "approved" | "rejected" | "updated" | "revoked";
}

export interface PermissionsOverviewPayload {
  generatedAt: string;
  riskDefaults: PermissionRiskDefault[];
  toolPolicies: PermissionToolPolicy[];
  deviceSnapshot: PermissionDeviceSnapshot;
  pendingRequests: ApprovalRequestItem[];
  approvalHistory: PermissionApprovalHistoryEntry[];
}

export interface PermissionRiskDefaultsUpdateInput {
  low?: PermissionPolicyMode;
  medium?: PermissionPolicyMode;
  high?: PermissionPolicyMode;
}

export interface PermissionToolPolicyUpdateInput {
  policy: PermissionPolicyMode;
}

export type ApprovalActionType = "process-kill" | "device-remove" | "agent-tool-access";

export type ApprovalRequestStatus = "pending" | "approved" | "rejected";

export interface ApprovalRequestItem {
  requestId: string;
  actionType: ApprovalActionType;
  title: string;
  summary: string;
  status: ApprovalRequestStatus;
  risk: PermissionRiskLevel;
  requestedAt: string;
  requestedBy: "user" | "agent" | "system";
  targetLabel: string;
  decisionAt: string | null;
  decidedBy: "user" | "agent" | "system" | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export interface ApprovalRequestCreateResult {
  created: boolean;
  request: ApprovalRequestItem;
  message: string;
}

export interface ApprovalRequestDecisionResult {
  request: ApprovalRequestItem;
  message: string;
  executed: boolean;
  execution: RuntimeProcessKillResult | PairedDeviceMutationResult | null;
}

export type CapabilityAvailability = "available" | "partial" | "planned";

export interface CapabilityModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  apiKind: string | null;
  baseUrl: string | null;
  modelCount: number;
  availability: CapabilityAvailability;
  notes: string[];
}

export interface CapabilitySkillInfo {
  id: string;
  displayName: string;
  category: "study" | "organization" | "planning" | "awareness";
  availability: CapabilityAvailability;
  summary: string;
  beginnerValue: string;
  triggerExamples: string[];
  requiresApproval: boolean;
}

export interface CapabilityToolInfo {
  id: string;
  displayName: string;
  availability: CapabilityAvailability;
  summary: string;
  riskLevel: "low" | "medium" | "high";
  mobileReady: boolean;
  currentPolicy: PermissionPolicyMode;
  recommendedPolicy: PermissionPolicyMode;
  policySource: "default" | "override" | "locked";
  approvalRequired: boolean;
  notes: string[];
}

export interface CapabilitiesOverviewPayload {
  generatedAt: string;
  counts: {
    models: number;
    availableSkills: number;
    availableTools: number;
  };
  models: CapabilityModelInfo[];
  skills: CapabilitySkillInfo[];
  tools: CapabilityToolInfo[];
}
