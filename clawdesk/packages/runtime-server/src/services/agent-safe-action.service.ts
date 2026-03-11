import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentApprovalHint,
  AgentChatReplyMode,
  AgentSafeActionsBoardPayload,
  AgentSafeActionFromChatInput,
  AgentSafeActionFromTaskInput,
  AgentSafeActionRecord,
  AgentSafeActionStatusUpdateInput,
  AgentTaskCard
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { getAgentTaskBoard } from "./agent-task.service.js";
import { getAgentChatConversationDetail } from "./chat.service.js";

class AgentSafeActionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSafeActionValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getSafeActionFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "safe-actions.json");
}

async function ensureSafeActionDirectory() {
  await mkdir(path.dirname(getSafeActionFilePath()), { recursive: true });
}

async function readSafeActions() {
  try {
    const raw = await readFile(getSafeActionFilePath(), "utf8");
    return (JSON.parse(raw) as AgentSafeActionRecord[]).map((action) => ({
      ...action,
      approvalHints: action.approvalHints ?? [],
      sourceOrchestration: action.sourceOrchestration ?? null
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function getAgentSafeAction(actionId: string) {
  const actions = await readSafeActions();
  return actions.find((item) => item.actionId === actionId) ?? null;
}

async function writeSafeActions(actions: AgentSafeActionRecord[]) {
  await ensureSafeActionDirectory();
  await writeFile(getSafeActionFilePath(), JSON.stringify(actions, null, 2), "utf8");
}

function buildStatusCounts(actions: AgentSafeActionRecord[]) {
  return actions.reduce<AgentSafeActionsBoardPayload["statusCounts"]>(
    (counts, action) => {
      counts[action.status] += 1;
      return counts;
    },
    {
      draft: 0,
      ready: 0,
      saved: 0
    }
  );
}

function summarizeExcerpt(input: string) {
  const normalized = input.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No source excerpt captured.";
  }

  return normalized.length > 160 ? `${normalized.slice(0, 160)}...` : normalized;
}

function buildActionTemplate(replyMode: AgentChatReplyMode) {
  switch (replyMode) {
    case "course-reminder":
      return {
        kind: "course-reminder-draft" as const,
        status: "draft" as const,
        title: "Course reminder draft",
        summary:
          "Prepared a low-risk draft for schedule import and reminder windows before we wire it into real reminder execution.",
        tags: ["course-reminder", "freshman", "safe-action"],
        details: [
          "Collect weekday, start time, course name, and classroom fields.",
          "Default reminder window: night before for early classes.",
          "Default reminder window: 13:30 for afternoon classes."
        ],
        nextSteps: [
          "Import the course timetable.",
          "Confirm reminder windows for weekdays and weekends.",
          "Later connect this draft to calendar/mobile reminder delivery."
        ]
      };
    case "file-search":
      return {
        kind: "file-organization-brief" as const,
        status: "ready" as const,
        title: "File organization brief",
        summary:
          "Saved a structured brief for file lookup and organization so we can turn it into a searchable freshman-friendly file workspace.",
        tags: ["file-search", "organization", "safe-action"],
        details: [
          "Return file path, stored time, and size as the default result shape.",
          "Keep course materials and application materials as top-level categories.",
          "Reserve Everything-style local search as a future acceleration layer."
        ],
        nextSteps: [
          "Define the first batch of categories to support.",
          "Choose how to display result freshness and duplicates.",
          "Design the time-first and event-first file views."
        ]
      };
    case "study-plan":
      return {
        kind: "study-plan-draft" as const,
        status: "draft" as const,
        title: "Study plan draft",
        summary:
          "Created a study-plan draft the user can refine before we connect it to reminders, reviews, and longer-term progress tracking.",
        tags: ["study-plan", "learning", "safe-action"],
        details: [
          "Clarify the learning goal and target finish line.",
          "Break the goal into weekly milestones.",
          "Add daily effort guidance and weekly review moments."
        ],
        nextSteps: [
          "Confirm the language or subject to learn.",
          "Confirm daily or weekly time budget.",
          "Turn milestones into Agent task cards or reminders."
        ]
      };
    case "memory-reminder":
      return {
        kind: "memory-item" as const,
        status: "saved" as const,
        title: "Memory item saved",
        summary:
          "Saved a low-risk memory/reminder item so the Agent can remember the event before we add richer scheduling and outreach suggestions.",
        tags: ["memory", "reminder", "safe-action"],
        details: [
          "Capture the event context, date, and importance.",
          "Keep reminder timing adjustable by closeness and urgency.",
          "Reserve gift and greeting suggestions for later enrichment."
        ],
        nextSteps: [
          "Confirm the exact date or time window.",
          "Choose reminder lead time.",
          "Later connect it to mobile and desktop reminder delivery."
        ]
      };
    default:
      return {
        kind: "memory-item" as const,
        status: "ready" as const,
        title: "Agent note saved",
        summary:
          "Stored the conversation outcome as a lightweight safe action so it stays visible even before we connect it to a stronger execution workflow.",
        tags: ["general", "safe-action"],
        details: [
          "Preserve the conversation outcome in a beginner-friendly summary.",
          "Keep it visible from Task Center.",
          "Use it as a stepping stone toward a richer task or reminder."
        ],
        nextSteps: ["Review the note.", "Decide whether it becomes a task card.", "Decide whether it needs a reminder."]
      };
  }
}

function describeActionSource(action: Pick<AgentSafeActionRecord, "sourceReplyMode" | "sourceOrchestration">) {
  const source = action.sourceOrchestration?.source;
  if (source === "provider") {
    return `${action.sourceReplyMode} provider-backed reply`;
  }

  if (source === "heuristic") {
    return `${action.sourceReplyMode} fallback reply`;
  }

  return `${action.sourceReplyMode} reply`;
}

function sortActions(actions: AgentSafeActionRecord[]) {
  return actions.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildSafeActionRecord(input: {
  sourceConversationId: string | null;
  sourceTaskId: string | null;
  sourceReplyMode: AgentChatReplyMode;
  sourceOrchestration?: AgentSafeActionRecord["sourceOrchestration"];
  approvalHints?: AgentApprovalHint[];
  sourceExcerpt: string;
}) {
  const template = buildActionTemplate(input.sourceReplyMode);
  const now = new Date().toISOString();

  return {
    actionId: crypto.randomUUID(),
    kind: template.kind,
    title: template.title,
    summary: template.summary,
    sourceConversationId: input.sourceConversationId,
    sourceTaskId: input.sourceTaskId,
    sourceReplyMode: input.sourceReplyMode,
    sourceOrchestration: input.sourceOrchestration ?? null,
    sourceExcerpt: summarizeExcerpt(input.sourceExcerpt),
    approvalHints: input.approvalHints ?? [],
    status: template.status,
    createdAt: now,
    updatedAt: now,
    tags: template.tags,
    details: template.details,
    nextSteps: template.nextSteps
  } satisfies AgentSafeActionRecord;
}

async function findTask(taskId: string) {
  const board = await getAgentTaskBoard();
  return board.tasks.find((task) => task.taskId === taskId) ?? null;
}

function dedupeExistingAction(actions: AgentSafeActionRecord[], next: AgentSafeActionRecord) {
  if (next.sourceTaskId) {
    return actions.find((action) => action.sourceTaskId === next.sourceTaskId && action.kind === next.kind);
  }

  return actions.find((action) => {
    return Boolean(next.sourceConversationId) &&
      action.sourceConversationId === next.sourceConversationId &&
      action.kind === next.kind &&
      action.status !== "saved";
  });
}

export async function getAgentSafeActionsBoard(): Promise<AgentSafeActionsBoardPayload> {
  const actions = sortActions(await readSafeActions());

  return {
    generatedAt: new Date().toISOString(),
    total: actions.length,
    statusCounts: buildStatusCounts(actions),
    actions
  };
}

export async function createAgentSafeActionFromChat(input: AgentSafeActionFromChatInput) {
  const conversation = await getAgentChatConversationDetail(input.conversationId);
  if (!conversation) {
    return null;
  }

  const lastAssistantMessage = [...conversation.messages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistantMessage) {
    throw new AgentSafeActionValidationError("Conversation has no assistant reply to save as a safe action yet.");
  }

  const sourceUserMessage = [...conversation.messages].reverse().find((message) => message.role === "user");
  const nextAction = buildSafeActionRecord({
    sourceConversationId: conversation.conversationId,
    sourceTaskId: null,
    sourceReplyMode: lastAssistantMessage.replyMode ?? "general",
    sourceOrchestration: lastAssistantMessage.orchestration ?? null,
    approvalHints: lastAssistantMessage.approvalHints ?? [],
    sourceExcerpt: sourceUserMessage?.content ?? lastAssistantMessage.content
  });

  const actions = await readSafeActions();
  const existing = dedupeExistingAction(actions, nextAction);
  if (existing) {
    return existing;
  }

  actions.push(nextAction);
  await writeSafeActions(actions);
  await appendActivityItem({
    kind: "agent-safe-action-created",
    title: "Safe Agent action created",
    summary: `Saved ${nextAction.title} from a ${describeActionSource(nextAction)}.`,
    actor: "agent",
    relatedConversationId: nextAction.sourceConversationId,
    metadata: {
      kind: nextAction.kind,
      status: nextAction.status,
      sourceReplyMode: nextAction.sourceReplyMode,
      sourceOrchestration: nextAction.sourceOrchestration,
      approvalHints: nextAction.approvalHints
    }
  });
  return nextAction;
}

export async function createAgentSafeActionFromTask(input: AgentSafeActionFromTaskInput) {
  const task = await findTask(input.taskId);
  if (!task) {
    return null;
  }

  const nextAction = buildSafeActionRecord({
    sourceConversationId: task.sourceConversationId,
    sourceTaskId: task.taskId,
    sourceReplyMode: task.sourceReplyMode,
    sourceOrchestration: task.sourceOrchestration ?? null,
    approvalHints: task.approvalHints ?? [],
    sourceExcerpt: `${task.title}: ${task.summary}`
  });

  const actions = await readSafeActions();
  const existing = dedupeExistingAction(actions, nextAction);
  if (existing) {
    return existing;
  }

  actions.push(nextAction);
  await writeSafeActions(actions);
  await appendActivityItem({
    kind: "agent-safe-action-created",
    title: "Safe Agent action created",
    summary: `Saved ${nextAction.title} from task card "${task.title}".`,
    actor: "agent",
    relatedConversationId: nextAction.sourceConversationId,
    relatedTaskId: nextAction.sourceTaskId,
    metadata: {
      kind: nextAction.kind,
      status: nextAction.status,
      sourceReplyMode: nextAction.sourceReplyMode,
      sourceOrchestration: nextAction.sourceOrchestration,
      approvalHints: nextAction.approvalHints
    }
  });
  return nextAction;
}

export async function updateAgentSafeActionStatus(actionId: string, input: AgentSafeActionStatusUpdateInput) {
  const actions = await readSafeActions();
  const action = actions.find((item) => item.actionId === actionId);
  if (!action) {
    return null;
  }

  action.status = input.status;
  action.updatedAt = new Date().toISOString();
  await writeSafeActions(actions);
  await appendActivityItem({
    kind: "agent-safe-action-status-updated",
    title: "Safe Agent action updated",
    summary: `${action.title} is now ${action.status}.`,
    actor: "user",
    relatedConversationId: action.sourceConversationId,
    relatedTaskId: action.sourceTaskId,
    metadata: {
      kind: action.kind,
      status: action.status,
      sourceReplyMode: action.sourceReplyMode,
      sourceOrchestration: action.sourceOrchestration,
      approvalHints: action.approvalHints
    }
  });
  return action;
}

export { AgentSafeActionValidationError };
