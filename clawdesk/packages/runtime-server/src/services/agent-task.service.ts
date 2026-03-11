import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentTaskBoardPayload,
  AgentTaskCard,
  AgentTaskFromChatInput,
  AgentTaskStatusUpdateInput
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { buildApprovalHintsForReplyMode } from "./agent-approval-hints.service.js";
import { getAgentChatConversationDetail } from "./chat.service.js";

class AgentTaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTaskValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getTaskFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "tasks.json");
}

async function ensureTaskDirectory() {
  await mkdir(path.dirname(getTaskFilePath()), { recursive: true });
}

async function readTaskCards() {
  try {
    const raw = await readFile(getTaskFilePath(), "utf8");
    return (JSON.parse(raw) as AgentTaskCard[]).map((task) => ({
      ...task,
      approvalHints: task.approvalHints ?? []
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeTaskCards(tasks: AgentTaskCard[]) {
  await ensureTaskDirectory();
  await writeFile(getTaskFilePath(), JSON.stringify(tasks, null, 2), "utf8");
}

function buildStatusCounts(tasks: AgentTaskCard[]) {
  return tasks.reduce<AgentTaskBoardPayload["statusCounts"]>(
    (counts, task) => {
      counts[task.status] += 1;
      return counts;
    },
    {
      draft: 0,
      ready: 0,
      "in-progress": 0,
      blocked: 0,
      done: 0
    }
  );
}

function buildTaskTemplate(replyMode: AgentTaskCard["sourceReplyMode"]) {
  switch (replyMode) {
    case "course-reminder":
      return {
        title: "Set up course reminder workflow",
        summary:
          "Turn the current course-reminder discussion into a usable flow with schedule import, night-before alerts, and post-lunch reminders.",
        tags: ["course-reminder", "freshman"],
        checklist: [
          "Collect weekday / time / course / location data",
          "Define night-before reminder window",
          "Define 13:30 afternoon reminder window"
        ]
      };
    case "file-search":
      return {
        title: "Design file search workflow",
        summary:
          "Break the file-management discussion into search, metadata display, and future Everything-style integration steps.",
        tags: ["file-search", "organization"],
        checklist: [
          "Define target file categories",
          "Return path, stored time, and size",
          "Plan Everything-based integration"
        ]
      };
    case "study-plan":
      return {
        title: "Draft study plan",
        summary:
          "Convert the study-plan chat into milestones, weekly targets, and lightweight reminders for follow-through.",
        tags: ["study-plan", "learning"],
        checklist: [
          "Define learning goal and time budget",
          "Break plan into weekly milestones",
          "Add review and catch-up reminders"
        ]
      };
    case "memory-reminder":
      return {
        title: "Set up proactive reminder playbook",
        summary:
          "Turn the memory/reminder conversation into rules for meetings, birthdays, and other important personal events.",
        tags: ["memory", "proactive"],
        checklist: [
          "Capture event type and importance",
          "Define reminder timing",
          "Prepare suggestion templates"
        ]
      };
    default:
      return {
        title: "Review Agent conversation",
        summary:
          "Convert the current conversation into a clear next-step task so the Agent can track it as a concrete unit of work.",
        tags: ["general"],
        checklist: ["Clarify desired outcome", "Choose next concrete step", "Track progress in Task Center"]
      };
  }
}

function describeTaskSource(task: Pick<AgentTaskCard, "sourceReplyMode" | "sourceOrchestration">) {
  const replyMode = task.sourceReplyMode;
  const source = task.sourceOrchestration?.source;

  if (source === "provider") {
    return `${replyMode} provider-backed reply`;
  }

  if (source === "heuristic") {
    return `${replyMode} fallback reply`;
  }

  return `${replyMode} reply`;
}

export async function getAgentTaskBoard(): Promise<AgentTaskBoardPayload> {
  const tasks = await readTaskCards();
  const sorted = tasks.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  return {
    generatedAt: new Date().toISOString(),
    total: sorted.length,
    statusCounts: buildStatusCounts(sorted),
    tasks: sorted
  };
}

export async function createAgentTaskFromChat(input: AgentTaskFromChatInput) {
  const conversation = await getAgentChatConversationDetail(input.conversationId);
  if (!conversation) {
    return null;
  }

  const lastAssistantMessage = [...conversation.messages].reverse().find((message) => message.role === "assistant");
  if (!lastAssistantMessage) {
    throw new AgentTaskValidationError("Conversation has no assistant reply to turn into a task card yet.");
  }

  const template = buildTaskTemplate(lastAssistantMessage.replyMode ?? "general");
  const approvalHints =
    lastAssistantMessage.approvalHints && lastAssistantMessage.approvalHints.length
      ? lastAssistantMessage.approvalHints
      : await buildApprovalHintsForReplyMode(lastAssistantMessage.replyMode ?? "general");
  const now = new Date().toISOString();
  const nextTask: AgentTaskCard = {
    taskId: crypto.randomUUID(),
    title: template.title,
    summary: template.summary,
    sourceConversationId: conversation.conversationId,
    sourceReplyMode: lastAssistantMessage.replyMode ?? "general",
    sourceOrchestration: lastAssistantMessage.orchestration ?? null,
    approvalHints,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    tags: [...new Set([...template.tags, ...conversation.tags])],
    checklist: template.checklist
  };

  const tasks = await readTaskCards();
  const exists = tasks.find(
    (task) =>
      task.sourceConversationId === nextTask.sourceConversationId &&
      task.sourceReplyMode === nextTask.sourceReplyMode &&
      task.status !== "done"
  );

  if (exists) {
    return exists;
  }

  tasks.push(nextTask);
  await writeTaskCards(tasks);
  await appendActivityItem({
    kind: "agent-task-created",
    title: "Agent task card created",
    summary: `Created a new task card from the conversation using a ${describeTaskSource(nextTask)}: ${nextTask.title}`,
    actor: "agent",
    relatedConversationId: nextTask.sourceConversationId,
    relatedTaskId: nextTask.taskId,
    metadata: {
      sourceReplyMode: nextTask.sourceReplyMode,
      status: nextTask.status,
      orchestration: nextTask.sourceOrchestration,
      approvalHints: nextTask.approvalHints
    }
  });
  return nextTask;
}

export async function updateAgentTaskStatus(taskId: string, input: AgentTaskStatusUpdateInput) {
  const tasks = await readTaskCards();
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) {
    return null;
  }

  task.status = input.status;
  task.updatedAt = new Date().toISOString();
  await writeTaskCards(tasks);
  await appendActivityItem({
    kind: "agent-task-status-updated",
    title: "Agent task status changed",
    summary: `Task "${task.title}" is now ${task.status}.`,
    actor: "user",
    relatedConversationId: task.sourceConversationId,
    relatedTaskId: task.taskId,
    metadata: {
      status: task.status,
      sourceReplyMode: task.sourceReplyMode,
      orchestration: task.sourceOrchestration ?? null,
      approvalHints: task.approvalHints
    }
  });
  return task;
}

export { AgentTaskValidationError };
