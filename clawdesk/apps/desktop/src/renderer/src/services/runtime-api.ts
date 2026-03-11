import type {
  ApprovalRequestCreateResult,
  ApprovalRequestDecisionResult,
  ApprovalRequestItem,
  ActivityFeedItem,
  ActivityFeedPayload,
  AgentChatBootstrapPayload,
  AgentChatConversationCreateInput,
  AgentChatConversationDetail,
  AgentChatConversationSummary,
  AgentChatMessageSendInput,
  AgentChatSendMessageResult,
  AgentSafeActionsBoardPayload,
  AgentSafeActionRecord,
  AgentReminderPlansBoardPayload,
  AgentReminderPlanRecord,
  AgentCourseScheduleBoardPayload,
  AgentCourseScheduleEntry,
  AgentCourseScheduleEntryInput,
  AgentCourseScheduleImportInput,
  AgentCourseScheduleImportResult,
  AgentFileWorkspaceRecord,
  AgentFileWorkspaceOrganizationPreview,
  AgentFileWorkspaceSearchResult,
  AgentFileWorkspacesBoardPayload,
  AgentStudyRoadmapsBoardPayload,
  AgentStudyRoadmapRecord,
  AgentTaskBoardPayload,
  AgentTaskCard,
  ApiResponse,
  CapabilitiesOverviewPayload,
  CapabilityModelInfo,
  CapabilitySkillInfo,
  CapabilityToolInfo,
  PermissionPolicyMode,
  PermissionToolPolicy,
  PermissionsOverviewPayload,
  OpenClawAuthProfileInfo,
  OpenClawPairedDeviceDetail,
  PairingAuditEntry,
  PairingAuditExportResult,
  PairingAuditQueryResult,
  PairedDeviceMutationResult,
  OpenClawSessionDetail,
  OpenClawOverview,
  OpenClawPairedDeviceInfo,
  PairingCenterStatusPayload,
  OpenClawProviderInfo,
  OpenClawSessionInfo,
  OpenClawTaskDetail,
  OpenClawTaskDeleteResult,
  OpenClawTaskEditorInput,
  OpenClawTaskInfo,
  OpenClawTaskRunRecord,
  OpenClawTaskBulkActionResult,
  BrowserRelayMonitorState,
  BrowserRelayActionResult,
  BrowserRelayStartupGuide,
  BrowserRelayStatus,
  DesktopOnboardingStatusPayload,
  LogExportResult,
  LogQueryResult,
  LogSummary,
  LogTailResult,
  RuntimeHealth,
  RuntimeProcessInfo,
  RuntimeProcessKillResult,
  SystemSummary,
  MobileBootstrapPayload,
  MobileOverviewPayload,
  MobileAuthBoundary,
  MobileAlertsSummaryPayload,
  MobilePairingFlowPayload,
  MobilePairingStatusPayload,
  PairingApprovalResult,
  PairingCenterSessionPayload,
  PairingPendingApproval,
  PairingSessionCleanupResult
} from "@clawdesk/shared-types";

export const runtimeBaseUrl = window.clawdesk?.runtimeBaseUrl ?? "http://127.0.0.1:47890";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runtimeBaseUrl}${path}`, init);
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message = payload.success ? response.statusText : payload.error.message;
    throw new Error(message || "Runtime request failed.");
  }

  return payload.data;
}

async function fetchJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function getRuntimeHealth() {
  return fetchJson<RuntimeHealth>("/api/v1/runtime/health");
}

export function getApprovalRequests(limit = 20) {
  return fetchJson<ApprovalRequestItem[]>(`/api/v1/approvals?limit=${encodeURIComponent(String(limit))}`);
}

export function requestProcessKillApproval(pid: number) {
  return requestJson<ApprovalRequestCreateResult>("/api/v1/approvals/process-kill", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ pid })
  });
}

export function requestDeviceRemoveApproval(deviceId: string) {
  return requestJson<ApprovalRequestCreateResult>("/api/v1/approvals/device-remove", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ deviceId })
  });
}

export function requestChatHintApproval(conversationId: string, toolId: string) {
  return requestJson<ApprovalRequestCreateResult>("/api/v1/approvals/chat-hint", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ conversationId, toolId })
  });
}

export function requestAgentTaskHintApproval(taskId: string, toolId: string) {
  return requestJson<ApprovalRequestCreateResult>("/api/v1/approvals/agent-task-hint", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ taskId, toolId })
  });
}

export function approveApprovalRequest(requestId: string) {
  return requestJson<ApprovalRequestDecisionResult>(`/api/v1/approvals/${encodeURIComponent(requestId)}/approve`, {
    method: "POST"
  });
}

export function rejectApprovalRequest(requestId: string, reason?: string) {
  return requestJson<ApprovalRequestDecisionResult>(`/api/v1/approvals/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason })
  });
}

export function getDesktopOnboardingStatus() {
  return fetchJson<DesktopOnboardingStatusPayload>("/api/v1/runtime/onboarding");
}

export function getAgentChatBootstrap() {
  return fetchJson<AgentChatBootstrapPayload>("/api/v1/chat/bootstrap");
}

export function getAgentChatConversations() {
  return fetchJson<AgentChatConversationSummary[]>("/api/v1/chat/conversations");
}

export function getAgentChatConversationDetail(conversationId: string) {
  return fetchJson<AgentChatConversationDetail>(`/api/v1/chat/conversations/${encodeURIComponent(conversationId)}`);
}

export function createAgentChatConversation(input: AgentChatConversationCreateInput = {}) {
  return requestJson<AgentChatConversationDetail>("/api/v1/chat/conversations", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function sendAgentChatMessage(input: AgentChatMessageSendInput) {
  return requestJson<AgentChatSendMessageResult>("/api/v1/chat/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function getAgentTaskBoard() {
  return fetchJson<AgentTaskBoardPayload>("/api/v1/agent-tasks");
}

export function getAgentSafeActionsBoard() {
  return fetchJson<AgentSafeActionsBoardPayload>("/api/v1/agent-safe-actions");
}

export function createAgentSafeActionFromChat(conversationId: string) {
  return requestJson<AgentSafeActionRecord>("/api/v1/agent-safe-actions/from-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ conversationId })
  });
}

export function createAgentSafeActionFromTask(taskId: string) {
  return requestJson<AgentSafeActionRecord>("/api/v1/agent-safe-actions/from-task", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ taskId })
  });
}

export function updateAgentSafeActionStatus(actionId: string, status: AgentSafeActionRecord["status"]) {
  return requestJson<AgentSafeActionRecord>(`/api/v1/agent-safe-actions/${encodeURIComponent(actionId)}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status })
  });
}

export function getAgentFileWorkspacesBoard() {
  return fetchJson<AgentFileWorkspacesBoardPayload>("/api/v1/agent-file-workspaces");
}

export function createAgentFileWorkspaceFromSafeAction(actionId: string) {
  return requestJson<AgentFileWorkspaceRecord>("/api/v1/agent-file-workspaces/from-safe-action", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ actionId })
  });
}

export function updateAgentFileWorkspaceStatus(workspaceId: string, status: AgentFileWorkspaceRecord["status"]) {
  return requestJson<AgentFileWorkspaceRecord>(
    `/api/v1/agent-file-workspaces/${encodeURIComponent(workspaceId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ status })
    }
  );
}

export function searchAgentFileWorkspace(workspaceId: string, query: string, limit = 12) {
  return requestJson<AgentFileWorkspaceSearchResult>(
    `/api/v1/agent-file-workspaces/${encodeURIComponent(workspaceId)}/search`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ query, limit })
    }
  );
}

export function previewAgentFileWorkspaceOrganization(workspaceId: string, query: string, limit = 12) {
  return requestJson<AgentFileWorkspaceOrganizationPreview>(
    `/api/v1/agent-file-workspaces/${encodeURIComponent(workspaceId)}/preview`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ query, limit })
    }
  );
}

export function getAgentReminderPlansBoard() {
  return fetchJson<AgentReminderPlansBoardPayload>("/api/v1/agent-reminder-plans");
}

export function createAgentReminderPlanFromSafeAction(actionId: string) {
  return requestJson<AgentReminderPlanRecord>("/api/v1/agent-reminder-plans/from-safe-action", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ actionId })
  });
}

export function updateAgentReminderPlanStatus(planId: string, status: AgentReminderPlanRecord["status"]) {
  return requestJson<AgentReminderPlanRecord>(`/api/v1/agent-reminder-plans/${encodeURIComponent(planId)}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status })
  });
}

export function getAgentCourseScheduleBoard() {
  return fetchJson<AgentCourseScheduleBoardPayload>("/api/v1/agent-course-schedule");
}

export function createAgentCourseScheduleEntry(input: AgentCourseScheduleEntryInput) {
  return requestJson<AgentCourseScheduleEntry>("/api/v1/agent-course-schedule", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function updateAgentCourseScheduleEntry(entryId: string, input: AgentCourseScheduleEntryInput) {
  return requestJson<AgentCourseScheduleEntry>(`/api/v1/agent-course-schedule/${encodeURIComponent(entryId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function deleteAgentCourseScheduleEntry(entryId: string) {
  return requestJson<AgentCourseScheduleEntry>(`/api/v1/agent-course-schedule/${encodeURIComponent(entryId)}`, {
    method: "DELETE"
  });
}

export function importAgentCourseSchedule(input: AgentCourseScheduleImportInput) {
  return requestJson<AgentCourseScheduleImportResult>("/api/v1/agent-course-schedule/import", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function getAgentStudyRoadmapsBoard() {
  return fetchJson<AgentStudyRoadmapsBoardPayload>("/api/v1/agent-study-roadmaps");
}

export function createAgentStudyRoadmapFromSafeAction(actionId: string) {
  return requestJson<AgentStudyRoadmapRecord>("/api/v1/agent-study-roadmaps/from-safe-action", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ actionId })
  });
}

export function updateAgentStudyRoadmapStatus(roadmapId: string, status: AgentStudyRoadmapRecord["status"]) {
  return requestJson<AgentStudyRoadmapRecord>(
    `/api/v1/agent-study-roadmaps/${encodeURIComponent(roadmapId)}/status`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ status })
    }
  );
}

export function createAgentTaskFromChat(conversationId: string) {
  return requestJson<AgentTaskCard>("/api/v1/agent-tasks/from-chat", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ conversationId })
  });
}

export function updateAgentTaskStatus(taskId: string, status: AgentTaskCard["status"]) {
  return requestJson<AgentTaskCard>(`/api/v1/agent-tasks/${encodeURIComponent(taskId)}/status`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ status })
  });
}

export function getActivityFeed(limit = 40) {
  return fetchJson<ActivityFeedPayload>(`/api/v1/activity?limit=${encodeURIComponent(String(limit))}`);
}

export function getActivityFeedItem(activityId: string) {
  return fetchJson<ActivityFeedItem>(`/api/v1/activity/${encodeURIComponent(activityId)}`);
}

export function getCapabilitiesOverview() {
  return fetchJson<CapabilitiesOverviewPayload>("/api/v1/capabilities");
}

export function getPermissionsOverview() {
  return fetchJson<PermissionsOverviewPayload>("/api/v1/permissions");
}

export function updatePermissionRiskDefaults(input: {
  low?: PermissionPolicyMode;
  medium?: PermissionPolicyMode;
  high?: PermissionPolicyMode;
}) {
  return requestJson<PermissionsOverviewPayload>("/api/v1/permissions/risk-defaults", {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function updatePermissionToolPolicy(toolId: string, policy: PermissionPolicyMode) {
  return requestJson<PermissionToolPolicy>(`/api/v1/permissions/tools/${encodeURIComponent(toolId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ policy })
  });
}

export function getCapabilityModels() {
  return fetchJson<CapabilityModelInfo[]>("/api/v1/capabilities/models");
}

export function getCapabilitySkills() {
  return fetchJson<CapabilitySkillInfo[]>("/api/v1/capabilities/skills");
}

export function getCapabilityTools() {
  return fetchJson<CapabilityToolInfo[]>("/api/v1/capabilities/tools");
}

export function getSystemSummary() {
  return fetchJson<SystemSummary>("/api/v1/system/summary");
}

export function getOpenClawOverview() {
  return fetchJson<OpenClawOverview>("/api/v1/openclaw/overview");
}

export function getSessions() {
  return fetchJson<OpenClawSessionInfo[]>("/api/v1/agents/sessions");
}

export function getSessionDetail(sessionId: string) {
  return fetchJson<OpenClawSessionDetail>(`/api/v1/agents/sessions/${encodeURIComponent(sessionId)}`);
}

export function getProviders() {
  return fetchJson<OpenClawProviderInfo[]>("/api/v1/models/providers");
}

export function getAuthProfiles() {
  return fetchJson<OpenClawAuthProfileInfo[]>("/api/v1/auth/profiles");
}

export function getDevices() {
  return fetchJson<OpenClawPairedDeviceInfo[]>("/api/v1/devices");
}

export function getDeviceDetail(deviceId: string) {
  return fetchJson<OpenClawPairedDeviceDetail>(`/api/v1/devices/${encodeURIComponent(deviceId)}`);
}

export function updateDeviceApprovedScopes(deviceId: string, approvedScopes: string[]) {
  return requestJson<PairedDeviceMutationResult>(`/api/v1/devices/${encodeURIComponent(deviceId)}/scopes`, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ approvedScopes })
  });
}

export function removeDevice(deviceId: string) {
  return requestJson<PairedDeviceMutationResult>(`/api/v1/devices/${encodeURIComponent(deviceId)}`, {
    method: "DELETE"
  });
}

export function getPairingCenterStatus() {
  return fetchJson<PairingCenterStatusPayload>("/api/v1/devices/pairing-center");
}

export function createPairingCenterSession() {
  return requestJson<PairingCenterSessionPayload>("/api/v1/devices/pairing-center/session", {
    method: "POST"
  });
}

export function getPendingApprovals() {
  return fetchJson<PairingPendingApproval[]>("/api/v1/devices/pending-approvals");
}

export function getPairingAudit(limit = 20) {
  return fetchJson<PairingAuditEntry[]>(`/api/v1/devices/pairing-audit?limit=${encodeURIComponent(String(limit))}`);
}

export function queryPairingAudit(options: {
  kind?: PairingAuditQueryResult["filters"]["kind"];
  actor?: PairingAuditQueryResult["filters"]["actor"];
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const params = new URLSearchParams({
    kind: options.kind ?? "all",
    actor: options.actor ?? "all",
    search: options.search ?? "",
    limit: String(options.limit ?? 20),
    offset: String(options.offset ?? 0)
  });

  return fetchJson<PairingAuditQueryResult>(`/api/v1/devices/pairing-audit/query?${params.toString()}`);
}

export function exportPairingAudit(options: {
  kind?: PairingAuditQueryResult["filters"]["kind"];
  actor?: PairingAuditQueryResult["filters"]["actor"];
  search?: string;
  limit?: number;
  offset?: number;
} = {}) {
  return requestJson<PairingAuditExportResult>("/api/v1/devices/pairing-audit/export", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      kind: options.kind ?? "all",
      actor: options.actor ?? "all",
      search: options.search ?? "",
      limit: options.limit ?? 20,
      offset: options.offset ?? 0
    })
  });
}

export function cleanupExpiredPairingSessions() {
  return requestJson<PairingSessionCleanupResult>("/api/v1/devices/pairing-center/cleanup", {
    method: "POST"
  });
}

export function approvePendingApproval(requestId: string, approvedScopes?: string[]) {
  return requestJson<PairingApprovalResult>(`/api/v1/devices/pending-approvals/${encodeURIComponent(requestId)}/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ approvedScopes })
  });
}

export function rejectPendingApproval(requestId: string, reason?: string) {
  return requestJson<PairingApprovalResult>(`/api/v1/devices/pending-approvals/${encodeURIComponent(requestId)}/reject`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ reason })
  });
}

export function getTasks() {
  return fetchJson<OpenClawTaskInfo[]>("/api/v1/tasks");
}

export function getTaskDetail(taskId: string) {
  return fetchJson<OpenClawTaskDetail>(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
}

export function getTaskRuns(taskId: string, limit = 20) {
  const query = `?limit=${encodeURIComponent(String(limit))}`;
  return fetchJson<OpenClawTaskRunRecord[]>(`/api/v1/tasks/${encodeURIComponent(taskId)}/runs${query}`);
}

export function createTask(input: OpenClawTaskEditorInput) {
  return requestJson<OpenClawTaskDetail>("/api/v1/tasks", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function updateTask(taskId: string, input: OpenClawTaskEditorInput) {
  return requestJson<OpenClawTaskDetail>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export function deleteTask(taskId: string) {
  return requestJson<OpenClawTaskDeleteResult>(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE"
  });
}

export function bulkUpdateTasks(action: "enable" | "disable" | "delete", taskIds: string[]) {
  return requestJson<OpenClawTaskBulkActionResult>("/api/v1/tasks/bulk", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ action, taskIds })
  });
}

export function getProcesses(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return fetchJson<RuntimeProcessInfo[]>(`/api/v1/processes${query}`);
}

export function getProcessDetail(pid: number) {
  return fetchJson<RuntimeProcessInfo>(`/api/v1/processes/${pid}`);
}

export async function killProcess(pid: number) {
  const response = await fetch(`${runtimeBaseUrl}/api/v1/processes/${pid}/kill`, {
    method: "POST"
  });
  const payload = (await response.json()) as ApiResponse<RuntimeProcessKillResult>;

  if (!response.ok || !payload.success) {
    const message = payload.success ? response.statusText : payload.error.message;
    throw new Error(message || "Process termination failed.");
  }

  return payload.data;
}

export function getBrowserRelayStatus() {
  return fetchJson<BrowserRelayStatus>("/api/v1/browser/relay");
}

export function getBrowserRelayStartupGuide() {
  return fetchJson<BrowserRelayStartupGuide>("/api/v1/browser/relay/guide");
}

export function getBrowserRelayEvents(limit = 20) {
  return fetchJson<BrowserRelayMonitorState>(`/api/v1/browser/relay/events?limit=${encodeURIComponent(String(limit))}`);
}

export function openBrowserRelayTarget(url: string) {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/open-target", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ url })
  });
}

export function startBrowserRelayGateway() {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/start-gateway", {
    method: "POST"
  });
}

export function openBrowserRelayExtensionFolder() {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/open-extension-folder", {
    method: "POST"
  });
}

export function openBrowserRelayExtensionOptions() {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/open-extension-options", {
    method: "POST"
  });
}

export function activateBrowserRelayTarget(targetId: string) {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/activate-target", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ targetId })
  });
}

export function closeBrowserRelayTarget(targetId: string) {
  return requestJson<BrowserRelayActionResult>("/api/v1/browser/relay/close-target", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ targetId })
  });
}

export function getLogSummary() {
  return fetchJson<LogSummary>("/api/v1/logs/summary");
}

export function getLogTail(file: "desktop.log" | "runtime.log" | "error.log", lines = 80) {
  const query = `?file=${encodeURIComponent(file)}&lines=${encodeURIComponent(String(lines))}`;
  return fetchJson<LogTailResult>(`/api/v1/logs/tail${query}`);
}

export function queryLogs(
  file: "desktop.log" | "runtime.log" | "error.log",
  options: {
    lines?: number;
    level?: "all" | "info" | "warn" | "error";
    search?: string;
  } = {}
) {
  const params = new URLSearchParams({
    file,
    lines: String(options.lines ?? 80),
    level: options.level ?? "all",
    search: options.search ?? ""
  });

  return fetchJson<LogQueryResult>(`/api/v1/logs/query?${params.toString()}`);
}

export async function exportLogs() {
  const response = await fetch(`${runtimeBaseUrl}/api/v1/logs/export`, {
    method: "POST"
  });
  const payload = (await response.json()) as ApiResponse<LogExportResult>;

  if (!response.ok || !payload.success) {
    const message = payload.success ? response.statusText : payload.error.message;
    throw new Error(message || "Log export failed.");
  }

  return payload.data;
}

export function getMobileBootstrap() {
  return fetchJson<MobileBootstrapPayload>("/api/v1/mobile/bootstrap");
}

export function getMobileOverview() {
  return fetchJson<MobileOverviewPayload>("/api/v1/mobile/overview");
}

export function getMobileAuthBoundary() {
  return fetchJson<MobileAuthBoundary>("/api/v1/mobile/auth-boundary");
}

export function getMobileAlertsSummary(limit = 10) {
  return fetchJson<MobileAlertsSummaryPayload>(
    `/api/v1/mobile/alerts-summary?limit=${encodeURIComponent(String(limit))}`
  );
}

export function getMobilePairingFlow() {
  return fetchJson<MobilePairingFlowPayload>("/api/v1/mobile/pairing-flow");
}

export function getMobilePairingStatus() {
  return fetchJson<MobilePairingStatusPayload>("/api/v1/mobile/pairing-status");
}

export function submitMobilePairingRequest(input: {
  token: string;
  clientType: "android" | "mini-program";
  deviceName: string;
  requestedScopes: string[];
}) {
  return requestJson<PairingPendingApproval>("/api/v1/mobile/pairing-request", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });
}
