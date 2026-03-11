import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  ApprovalRequestCreateResult,
  ApprovalRequestDecisionResult,
  ApprovalRequestItem,
  AgentApprovalHint
} from "@clawdesk/shared-types";
import { getOpenClawPairedDeviceDetail, removeOpenClawPairedDevice } from "@clawdesk/openclaw-core";

import { appendActivityItem } from "./activity.service.js";
import { getAgentTaskBoard } from "./agent-task.service.js";
import { getAgentChatConversationDetail } from "./chat.service.js";
import { getProcessByPid, killProcessByPid } from "./process.service.js";

export class ApprovalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getApprovalFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "approval-requests.json");
}

async function ensureApprovalDirectory() {
  await mkdir(path.dirname(getApprovalFilePath()), { recursive: true });
}

async function readApprovalRequests() {
  try {
    const raw = await readFile(getApprovalFilePath(), "utf8");
    return JSON.parse(raw) as ApprovalRequestItem[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeApprovalRequests(requests: ApprovalRequestItem[]) {
  await ensureApprovalDirectory();
  await writeFile(getApprovalFilePath(), JSON.stringify(requests, null, 2), "utf8");
}

export async function listApprovalRequests(limit = 20) {
  const requests = await readApprovalRequests();
  return requests
    .sort((left, right) => Date.parse(right.requestedAt) - Date.parse(left.requestedAt))
    .slice(0, Math.max(1, limit));
}

function buildPendingDuplicateMatch(request: ApprovalRequestItem, actionType: ApprovalRequestItem["actionType"], key: string, value: unknown) {
  return request.status === "pending" && request.actionType === actionType && request.metadata?.[key] === value;
}

function resolveHint(hints: AgentApprovalHint[] | undefined, toolId: string) {
  return hints?.find((hint) => hint.toolId === toolId) ?? null;
}

export async function createProcessKillApprovalRequest(pid: number): Promise<ApprovalRequestCreateResult> {
  const processInfo = await getProcessByPid(pid);
  if (!processInfo) {
    throw new ApprovalValidationError(`Process ${pid} not found.`);
  }

  const requests = await readApprovalRequests();
  const existing = requests.find((request) => buildPendingDuplicateMatch(request, "process-kill", "pid", pid));
  if (existing) {
    return {
      created: false,
      request: existing,
      message: `Approval request already pending for ${processInfo.name} (${pid}).`
    };
  }

  const request: ApprovalRequestItem = {
    requestId: crypto.randomUUID(),
    actionType: "process-kill",
    title: "Terminate process",
    summary: `Request approval to terminate ${processInfo.name} (${pid}).`,
    status: "pending",
    risk: "high",
    requestedAt: new Date().toISOString(),
    requestedBy: "user",
    targetLabel: `${processInfo.name} (${pid})`,
    decisionAt: null,
    decidedBy: null,
    reason: null,
    metadata: {
      pid,
      name: processInfo.name,
      path: processInfo.path
    }
  };

  requests.push(request);
  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-created",
    title: "Approval request created",
    summary: request.summary,
    actor: "user",
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel
    }
  });

  return {
    created: true,
    request,
    message: `Approval request created for ${processInfo.name} (${pid}).`
  };
}

export async function createDeviceRemoveApprovalRequest(deviceId: string): Promise<ApprovalRequestCreateResult> {
  const detail = await getOpenClawPairedDeviceDetail(deviceId);
  if (!detail) {
    throw new ApprovalValidationError(`Device ${deviceId} not found.`);
  }

  const requests = await readApprovalRequests();
  const existing = requests.find((request) => buildPendingDuplicateMatch(request, "device-remove", "deviceId", deviceId));
  if (existing) {
    return {
      created: false,
      request: existing,
      message: `Approval request already pending for device ${deviceId}.`
    };
  }

  const request: ApprovalRequestItem = {
    requestId: crypto.randomUUID(),
    actionType: "device-remove",
    title: "Remove paired device",
    summary: `Request approval to remove paired device ${deviceId}.`,
    status: "pending",
    risk: "high",
    requestedAt: new Date().toISOString(),
    requestedBy: "user",
    targetLabel: `${deviceId}${detail.device.clientId ? ` / ${detail.device.clientId}` : ""}`,
    decisionAt: null,
    decidedBy: null,
    reason: null,
    metadata: {
      deviceId,
      clientId: detail.device.clientId,
      platform: detail.device.platform
    }
  };

  requests.push(request);
  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-created",
    title: "Approval request created",
    summary: request.summary,
    actor: "user",
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel
    }
  });

  return {
    created: true,
    request,
    message: `Approval request created for device ${deviceId}.`
  };
}

export async function createChatToolApprovalRequest(
  conversationId: string,
  toolId: string
): Promise<ApprovalRequestCreateResult> {
  const conversation = await getAgentChatConversationDetail(conversationId);
  if (!conversation) {
    throw new ApprovalValidationError(`Conversation ${conversationId} not found.`);
  }

  const lastAssistantMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.approvalHints?.length);
  const hint = resolveHint(lastAssistantMessage?.approvalHints, toolId);
  if (!hint) {
    throw new ApprovalValidationError(`No approval-sensitive tool hint found for ${toolId} in conversation ${conversationId}.`);
  }

  const requests = await readApprovalRequests();
  const existing = requests.find(
    (request) =>
      request.status === "pending" &&
      request.actionType === "agent-tool-access" &&
      request.metadata?.origin === "chat" &&
      request.metadata?.conversationId === conversationId &&
      request.metadata?.toolId === toolId
  );
  if (existing) {
    return {
      created: false,
      request: existing,
      message: `Approval request already pending for ${hint.toolDisplayName} in this conversation.`
    };
  }

  const request: ApprovalRequestItem = {
    requestId: crypto.randomUUID(),
    actionType: "agent-tool-access",
    title: "Pre-approve Agent tool access",
    summary: `Request approval so the Agent can use ${hint.toolDisplayName} for the current conversation when needed.`,
    status: "pending",
    risk: hint.risk,
    requestedAt: new Date().toISOString(),
    requestedBy: "user",
    targetLabel: `${hint.toolDisplayName} / ${conversation.title}`,
    decisionAt: null,
    decidedBy: null,
    reason: null,
    metadata: {
      origin: "chat",
      conversationId,
      toolId: hint.toolId,
      toolDisplayName: hint.toolDisplayName,
      policy: hint.policy,
      hintSummary: hint.summary
    }
  };

  requests.push(request);
  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-created",
    title: "Approval request created",
    summary: request.summary,
    actor: "user",
    relatedConversationId: conversationId,
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel,
      toolId: hint.toolId,
      origin: "chat"
    }
  });

  return {
    created: true,
    request,
    message: `Approval request created for ${hint.toolDisplayName} in this conversation.`
  };
}

export async function createAgentTaskToolApprovalRequest(
  taskId: string,
  toolId: string
): Promise<ApprovalRequestCreateResult> {
  const board = await getAgentTaskBoard();
  const task = board.tasks.find((item) => item.taskId === taskId);
  if (!task) {
    throw new ApprovalValidationError(`Task ${taskId} not found.`);
  }

  const hint = resolveHint(task.approvalHints, toolId);
  if (!hint) {
    throw new ApprovalValidationError(`No approval-sensitive tool hint found for ${toolId} in task ${taskId}.`);
  }

  const requests = await readApprovalRequests();
  const existing = requests.find(
    (request) =>
      request.status === "pending" &&
      request.actionType === "agent-tool-access" &&
      request.metadata?.origin === "task" &&
      request.metadata?.taskId === taskId &&
      request.metadata?.toolId === toolId
  );
  if (existing) {
    return {
      created: false,
      request: existing,
      message: `Approval request already pending for ${hint.toolDisplayName} in this task.`
    };
  }

  const request: ApprovalRequestItem = {
    requestId: crypto.randomUUID(),
    actionType: "agent-tool-access",
    title: "Pre-approve Agent tool access",
    summary: `Request approval so the Agent can use ${hint.toolDisplayName} for task "${task.title}" when needed.`,
    status: "pending",
    risk: hint.risk,
    requestedAt: new Date().toISOString(),
    requestedBy: "user",
    targetLabel: `${hint.toolDisplayName} / ${task.title}`,
    decisionAt: null,
    decidedBy: null,
    reason: null,
    metadata: {
      origin: "task",
      taskId,
      conversationId: task.sourceConversationId,
      toolId: hint.toolId,
      toolDisplayName: hint.toolDisplayName,
      policy: hint.policy,
      hintSummary: hint.summary
    }
  };

  requests.push(request);
  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-created",
    title: "Approval request created",
    summary: request.summary,
    actor: "user",
    relatedConversationId: task.sourceConversationId,
    relatedTaskId: taskId,
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel,
      toolId: hint.toolId,
      origin: "task"
    }
  });

  return {
    created: true,
    request,
    message: `Approval request created for ${hint.toolDisplayName} in task "${task.title}".`
  };
}

export async function approveApprovalRequest(requestId: string): Promise<ApprovalRequestDecisionResult | null> {
  const requests = await readApprovalRequests();
  const request = requests.find((item) => item.requestId === requestId);
  if (!request) {
    return null;
  }

  if (request.status !== "pending") {
    throw new ApprovalValidationError(`Approval request ${requestId} is already ${request.status}.`);
  }

  let execution: ApprovalRequestDecisionResult["execution"] = null;
  if (request.actionType === "process-kill") {
    const pid = Number(request.metadata?.pid);
    if (!Number.isFinite(pid)) {
      throw new ApprovalValidationError("Process approval request is missing a valid pid.");
    }

    execution = await killProcessByPid(pid);
    if (!execution) {
      throw new ApprovalValidationError(`Process ${pid} no longer exists.`);
    }
  } else if (request.actionType === "device-remove") {
    const deviceId = typeof request.metadata?.deviceId === "string" ? request.metadata.deviceId : "";
    if (!deviceId) {
      throw new ApprovalValidationError("Device approval request is missing a device id.");
    }

    execution = await removeOpenClawPairedDevice(deviceId);
    if (!execution) {
      throw new ApprovalValidationError(`Device ${deviceId} no longer exists.`);
    }
  } else if (request.actionType === "agent-tool-access") {
    execution = null;
  }

  request.status = "approved";
  request.decisionAt = new Date().toISOString();
  request.decidedBy = "user";
  request.reason = "Approved from desktop approval center.";

  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-approved",
    title: "Approval request approved",
    summary:
      request.actionType === "agent-tool-access"
        ? `${request.title} was approved for ${request.targetLabel}. The Agent can treat this step as pre-approved later.`
        : `${request.title} was approved and executed for ${request.targetLabel}.`,
    actor: "user",
    relatedConversationId: typeof request.metadata?.conversationId === "string" ? request.metadata.conversationId : null,
    relatedTaskId: typeof request.metadata?.taskId === "string" ? request.metadata.taskId : null,
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel,
      execution,
      origin: typeof request.metadata?.origin === "string" ? request.metadata.origin : null,
      toolId: typeof request.metadata?.toolId === "string" ? request.metadata.toolId : null
    }
  });

  return {
    request,
    message: `${request.title} approved for ${request.targetLabel}.`,
    executed: request.actionType !== "agent-tool-access",
    execution
  };
}

export async function rejectApprovalRequest(requestId: string, reason?: string): Promise<ApprovalRequestDecisionResult | null> {
  const requests = await readApprovalRequests();
  const request = requests.find((item) => item.requestId === requestId);
  if (!request) {
    return null;
  }

  if (request.status !== "pending") {
    throw new ApprovalValidationError(`Approval request ${requestId} is already ${request.status}.`);
  }

  request.status = "rejected";
  request.decisionAt = new Date().toISOString();
  request.decidedBy = "user";
  request.reason = reason?.trim() || "Rejected from desktop approval center.";

  await writeApprovalRequests(requests);
  await appendActivityItem({
    kind: "approval-request-rejected",
    title: "Approval request rejected",
    summary: `${request.title} was rejected for ${request.targetLabel}.`,
    actor: "user",
    relatedConversationId: typeof request.metadata?.conversationId === "string" ? request.metadata.conversationId : null,
    relatedTaskId: typeof request.metadata?.taskId === "string" ? request.metadata.taskId : null,
    metadata: {
      requestId: request.requestId,
      actionType: request.actionType,
      targetLabel: request.targetLabel,
      reason: request.reason,
      origin: typeof request.metadata?.origin === "string" ? request.metadata.origin : null,
      toolId: typeof request.metadata?.toolId === "string" ? request.metadata.toolId : null
    }
  });

  return {
    request,
    message: `${request.title} rejected for ${request.targetLabel}.`,
    executed: false,
    execution: null
  };
}
