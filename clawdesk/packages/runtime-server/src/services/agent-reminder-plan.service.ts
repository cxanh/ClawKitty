import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentReminderPlanFromSafeActionInput,
  AgentReminderPlansBoardPayload,
  AgentMemoryReminderEventType,
  AgentMemoryReminderImportance,
  AgentMemoryReminderProfile,
  AgentMemoryReminderRelationship,
  AgentMemoryReminderSuggestion,
  AgentReminderPlanRecord,
  AgentReminderPlanStatusUpdateInput,
  AgentSafeActionRecord
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { syncReminderDeliveriesForPlan } from "./agent-reminder-delivery.service.js";
import { getAgentSafeAction } from "./agent-safe-action.service.js";

class AgentReminderPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentReminderPlanValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getReminderPlanFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "reminder-plans.json");
}

async function ensureReminderPlanDirectory() {
  await mkdir(path.dirname(getReminderPlanFilePath()), { recursive: true });
}

async function readReminderPlans(): Promise<AgentReminderPlanRecord[]> {
  try {
    const raw = await readFile(getReminderPlanFilePath(), "utf8");
    return (JSON.parse(raw) as AgentReminderPlanRecord[]).map((plan): AgentReminderPlanRecord => ({
      ...plan,
      sourceOrchestration: plan.sourceOrchestration ?? null,
      reminderWindows: (plan.reminderWindows ?? []).map((window) => ({
        ...window,
        offsetMinutes: window.offsetMinutes ?? 0
      })),
      memoryProfile: plan.memoryProfile ?? null
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeReminderPlans(plans: AgentReminderPlanRecord[]) {
  await ensureReminderPlanDirectory();
  await writeFile(getReminderPlanFilePath(), JSON.stringify(plans, null, 2), "utf8");
}

function buildStatusCounts(plans: AgentReminderPlanRecord[]) {
  return plans.reduce<AgentReminderPlansBoardPayload["statusCounts"]>(
    (counts, plan) => {
      counts[plan.status] += 1;
      return counts;
    },
    {
      draft: 0,
      active: 0,
      paused: 0
    }
  );
}

function sortPlans(plans: AgentReminderPlanRecord[]) {
  return plans.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function inferMemoryEventType(action: AgentSafeActionRecord): AgentMemoryReminderEventType {
  const text = `${action.title} ${action.summary} ${action.sourceExcerpt} ${action.details.join(" ")}`.toLowerCase();

  if (/birthday|生日|生辰|诞辰/.test(text)) {
    return "birthday";
  }

  if (/meeting|会议|开会|面试|答辩|汇报/.test(text)) {
    return "meeting";
  }

  if (/deadline|ddl|截止|due|提交|报名|申请/.test(text)) {
    return "deadline";
  }

  return "general";
}

function inferMemoryRelationship(action: AgentSafeActionRecord): AgentMemoryReminderRelationship {
  const text = `${action.title} ${action.summary} ${action.sourceExcerpt}`.toLowerCase();

  if (/自己|本人|myself|self/.test(text)) {
    return "self";
  }

  if (/家人|family|爸爸|妈妈|父母|姐姐|哥哥|弟弟|妹妹/.test(text)) {
    return "family";
  }

  if (/闺蜜|铁子|best friend|very close|close friend|亲近/.test(text)) {
    return "close-friend";
  }

  if (/朋友|friend/.test(text)) {
    return "friend";
  }

  if (/室友|同学|classmate|舍友/.test(text)) {
    return "classmate";
  }

  if (/小组|团队|team|社团|部门/.test(text)) {
    return "team";
  }

  return "general";
}

function inferMemoryImportance(
  eventType: AgentMemoryReminderEventType,
  relationship: AgentMemoryReminderRelationship
): AgentMemoryReminderImportance {
  if (eventType === "deadline") {
    return "important";
  }

  if (eventType === "birthday" && ["family", "close-friend"].includes(relationship)) {
    return "important";
  }

  if (eventType === "meeting") {
    return "standard";
  }

  if (relationship === "self") {
    return "standard";
  }

  return "light";
}

function buildMemorySuggestions(
  eventType: AgentMemoryReminderEventType,
  relationship: AgentMemoryReminderRelationship
): { suggestionFocus: AgentMemoryReminderProfile["suggestionFocus"]; suggestions: AgentMemoryReminderSuggestion[] } {
  if (eventType === "birthday") {
    const suggestions: AgentMemoryReminderSuggestion[] = [
      {
        suggestionId: crypto.randomUUID(),
        kind: "greeting",
        title: "Prepare a warm greeting",
        summary:
          relationship === "close-friend" || relationship === "family"
            ? "Draft a longer and more personal birthday message."
            : "Prepare a short birthday wish that feels warm but not overdone."
      },
      {
        suggestionId: crypto.randomUUID(),
        kind: "gift",
        title: "Keep a lightweight gift idea ready",
        summary:
          relationship === "close-friend" || relationship === "family"
            ? "Consider a practical or sentimental gift that matches the person's habits."
            : "Consider a low-pressure snack, drink, or stationery gift."
      }
    ];

    return {
      suggestionFocus: "gift-and-greeting",
      suggestions
    };
  }

  if (eventType === "meeting") {
    return {
      suggestionFocus: "prep-checklist",
      suggestions: [
        {
          suggestionId: crypto.randomUUID(),
          kind: "prep",
          title: "Prepare agenda and materials",
          summary: "Confirm the meeting time, location, and the one thing you need to bring or present."
        },
        {
          suggestionId: crypto.randomUUID(),
          kind: "checklist",
          title: "Leave buffer time",
          summary: "Reserve a small buffer before the meeting so you are not rushing at the last minute."
        }
      ]
    };
  }

  if (eventType === "deadline") {
    return {
      suggestionFocus: "follow-through",
      suggestions: [
        {
          suggestionId: crypto.randomUUID(),
          kind: "prep",
          title: "Prepare a submit-ready checklist",
          summary: "List the files, forms, or links needed before the deadline window closes."
        },
        {
          suggestionId: crypto.randomUUID(),
          kind: "checklist",
          title: "Add a final confirmation pass",
          summary: "Leave time for upload, naming check, and one final review before submission."
        }
      ]
    };
  }

  return {
    suggestionFocus: "none",
    suggestions: [
      {
        suggestionId: crypto.randomUUID(),
        kind: "checklist",
        title: "Keep the reminder lightweight",
        summary: "Use one early reminder and one follow-up reminder, then refine once the event details are clearer."
      }
    ]
  };
}

function buildMemoryReminderWindows(
  eventType: AgentMemoryReminderEventType,
  importance: AgentMemoryReminderImportance
) {
  if (eventType === "birthday") {
    return [
      {
        windowId: crypto.randomUUID(),
        label: "Preparation reminder",
        timingHint: importance === "important" ? "3 days before" : "1 day before",
        summary: "Leave time to prepare a message, plan, or small gift.",
        offsetMinutes: importance === "important" ? 4_320 : 1_440
      },
      {
        windowId: crypto.randomUUID(),
        label: "Day-of reminder",
        timingHint: "09:00 on the day",
        summary: "Send the greeting early enough that it still feels thoughtful.",
        offsetMinutes: 0
      }
    ];
  }

  if (eventType === "meeting") {
    return [
      {
        windowId: crypto.randomUUID(),
        label: "Prep reminder",
        timingHint: "1 day before",
        summary: "Confirm place, agenda, and any materials that need to be ready.",
        offsetMinutes: 1_440
      },
      {
        windowId: crypto.randomUUID(),
        label: "Go-time reminder",
        timingHint: "45 minutes before",
        summary: "Use this to leave on time and avoid arriving rushed.",
        offsetMinutes: 45
      }
    ];
  }

  if (eventType === "deadline") {
    return [
      {
        windowId: crypto.randomUUID(),
        label: "Early checkpoint",
        timingHint: "2 days before",
        summary: "Check whether the work is complete enough to avoid a last-minute scramble.",
        offsetMinutes: 2_880
      },
      {
        windowId: crypto.randomUUID(),
        label: "Submission buffer",
        timingHint: "3 hours before",
        summary: "Use this final reminder for upload, formatting, and confirmation.",
        offsetMinutes: 180
      }
    ];
  }

  return [
    {
      windowId: crypto.randomUUID(),
      label: "Primary reminder",
      timingHint: "1 day before",
      summary: "Use this for the first nudge before the event.",
      offsetMinutes: 1_440
    },
    {
      windowId: crypto.randomUUID(),
      label: "Follow-up reminder",
      timingHint: "2 hours before",
      summary: "Use this when the event is close and still needs attention.",
      offsetMinutes: 120
    }
  ];
}

function buildMemoryReminderProfile(action: AgentSafeActionRecord): AgentMemoryReminderProfile {
  const eventType = inferMemoryEventType(action);
  const relationship = inferMemoryRelationship(action);
  const importance = inferMemoryImportance(eventType, relationship);
  const { suggestionFocus, suggestions } = buildMemorySuggestions(eventType, relationship);

  return {
    eventType,
    importance,
    relationship,
    suggestionFocus,
    suggestions
  };
}

function buildReminderPlanTemplate(action: AgentSafeActionRecord) {
  if (action.kind === "course-reminder-draft") {
    return {
      kind: "course-reminder-plan" as const,
      title: "Course reminder plan",
      summary:
        "Turn the saved course reminder draft into a reusable reminder plan with consistent timing windows for early and afternoon classes.",
      status: "draft" as const,
      tags: [...new Set([...action.tags, "reminder-plan"])],
      scheduleOutline: [
        "Night-before reminder for next-morning classes",
        "Same-day 13:30 reminder for afternoon classes"
      ],
      reminderWindows: [
        {
          windowId: crypto.randomUUID(),
          label: "Night-before reminder",
          timingHint: "20:30 on the previous evening",
          summary: "Use this for classes that start early the next morning.",
          offsetMinutes: 690
        },
        {
          windowId: crypto.randomUUID(),
          label: "Afternoon class reminder",
          timingHint: "13:30 on the same day",
          summary: "Use this for classes that begin after lunch.",
          offsetMinutes: 90
        }
      ],
      deliveryChannels: ["desktop", "mobile-planned"] as const,
      memoryProfile: null,
      notes: [
        "Still needs timetable import before it becomes a live reminder.",
        "Designed for beginner-friendly, low-noise reminders."
      ]
    };
  }

  if (action.kind === "memory-item") {
    const memoryProfile = buildMemoryReminderProfile(action);
    const reminderWindows = buildMemoryReminderWindows(memoryProfile.eventType, memoryProfile.importance);
    return {
      kind: "memory-reminder-plan" as const,
      title: "Memory reminder plan",
      summary:
        "Turn the saved memory item into a reminder plan with event-aware reminder windows, suggestion prompts, and a more beginner-friendly follow-through strategy.",
      status: "draft" as const,
      tags: [...new Set([...action.tags, "reminder-plan"])],
      scheduleOutline: reminderWindows.map((window) => `${window.label}: ${window.timingHint}`),
      reminderWindows,
      deliveryChannels: ["desktop", "mobile-planned"] as const,
      memoryProfile,
      notes: [
        `Event type: ${memoryProfile.eventType}.`,
        `Importance: ${memoryProfile.importance}.`,
        `Relationship context: ${memoryProfile.relationship}.`,
        memoryProfile.suggestionFocus === "gift-and-greeting"
          ? "The plan now keeps lightweight gift and greeting suggestions ready."
          : "The plan now keeps a preparation-oriented checklist for the event."
      ]
    };
  }

  return null;
}

export async function getAgentReminderPlansBoard(): Promise<AgentReminderPlansBoardPayload> {
  const plans = sortPlans(await readReminderPlans());

  return {
    generatedAt: new Date().toISOString(),
    total: plans.length,
    statusCounts: buildStatusCounts(plans),
    plans
  };
}

export async function createAgentReminderPlanFromSafeAction(input: AgentReminderPlanFromSafeActionInput) {
  const action = await getAgentSafeAction(input.actionId);
  if (!action) {
    return null;
  }

  const template = buildReminderPlanTemplate(action);
  if (!template) {
    throw new AgentReminderPlanValidationError(
      `Safe action kind ${action.kind} cannot become a reminder plan yet.`
    );
  }

  const plans = await readReminderPlans();
  const existing = plans.find((plan) => plan.sourceActionId === action.actionId && plan.kind === template.kind);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextPlan: AgentReminderPlanRecord = {
    planId: crypto.randomUUID(),
    kind: template.kind,
    title: template.title,
    summary: template.summary,
    sourceActionId: action.actionId,
    sourceConversationId: action.sourceConversationId,
    sourceTaskId: action.sourceTaskId,
    sourceReplyMode: action.sourceReplyMode,
    sourceOrchestration: action.sourceOrchestration ?? null,
    status: template.status,
    createdAt: now,
    updatedAt: now,
    tags: template.tags,
    scheduleOutline: template.scheduleOutline,
    reminderWindows: template.reminderWindows,
    deliveryChannels: [...template.deliveryChannels],
    memoryProfile: template.memoryProfile ?? null,
    notes: template.notes
  };

  plans.push(nextPlan);
  await writeReminderPlans(plans);
  await appendActivityItem({
    kind: "agent-reminder-plan-created",
    title: "Reminder plan created",
    summary: `Created ${nextPlan.title} from safe action "${action.title}".`,
    actor: "agent",
    relatedConversationId: nextPlan.sourceConversationId,
    relatedTaskId: nextPlan.sourceTaskId,
    metadata: {
      kind: nextPlan.kind,
      status: nextPlan.status,
      sourceActionId: nextPlan.sourceActionId,
      sourceReplyMode: nextPlan.sourceReplyMode,
      sourceOrchestration: nextPlan.sourceOrchestration,
      memoryProfile: nextPlan.memoryProfile
    }
  });
  return nextPlan;
}

export async function updateAgentReminderPlanStatus(planId: string, input: AgentReminderPlanStatusUpdateInput) {
  const plans = await readReminderPlans();
  const plan = plans.find((item) => item.planId === planId);
  if (!plan) {
    return null;
  }

  plan.status = input.status;
  plan.updatedAt = new Date().toISOString();
  await writeReminderPlans(plans);
  const sourceAction = await getAgentSafeAction(plan.sourceActionId);
  await syncReminderDeliveriesForPlan(plan, sourceAction?.sourceExcerpt ?? plan.summary);
  await appendActivityItem({
    kind: "agent-reminder-plan-status-updated",
    title: "Reminder plan updated",
    summary: `${plan.title} is now ${plan.status}.`,
    actor: "user",
    relatedConversationId: plan.sourceConversationId,
    relatedTaskId: plan.sourceTaskId,
    metadata: {
      kind: plan.kind,
      status: plan.status,
      sourceActionId: plan.sourceActionId,
      sourceReplyMode: plan.sourceReplyMode,
      sourceOrchestration: plan.sourceOrchestration,
      memoryProfile: plan.memoryProfile
    }
  });
  return plan;
}

export { AgentReminderPlanValidationError };

