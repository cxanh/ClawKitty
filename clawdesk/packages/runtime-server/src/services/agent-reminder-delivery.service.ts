import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentCourseScheduleEntry,
  AgentMemoryReminderEventType,
  AgentReminderDeliveriesPollPayload,
  AgentReminderDeliveryRecord,
  AgentReminderPlanRecord
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { listAgentCourseScheduleEntries } from "./agent-course-schedule.service.js";

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getReminderDeliveryFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "reminder-deliveries.json");
}

async function ensureReminderDeliveryDirectory() {
  await mkdir(path.dirname(getReminderDeliveryFilePath()), { recursive: true });
}

async function readReminderDeliveries(): Promise<AgentReminderDeliveryRecord[]> {
  try {
    const raw = await readFile(getReminderDeliveryFilePath(), "utf8");
    return (JSON.parse(raw) as AgentReminderDeliveryRecord[]).map((delivery) => ({
      ...delivery,
      deliveredAt: delivery.deliveredAt ?? null
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeReminderDeliveries(deliveries: AgentReminderDeliveryRecord[]) {
  await ensureReminderDeliveryDirectory();
  await writeFile(getReminderDeliveryFilePath(), JSON.stringify(deliveries, null, 2), "utf8");
}

function chineseNumberToInt(input: string) {
  const directMap: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };

  if (/^\d+$/.test(input)) {
    return Number(input);
  }

  if (input === "十") {
    return 10;
  }

  if (input.endsWith("十")) {
    const tens = directMap[input.slice(0, -1)] ?? 1;
    return tens * 10;
  }

  if (input.includes("十")) {
    const [left, right] = input.split("十");
    const tens = left ? directMap[left] ?? 1 : 1;
    const ones = right ? directMap[right] ?? 0 : 0;
    return tens * 10 + ones;
  }

  return directMap[input] ?? 0;
}

function extractRelativeDayOffset(text: string) {
  const lower = text.toLowerCase();

  if (/day after tomorrow/.test(lower) || /后天/.test(text)) {
    return 2;
  }

  if (/tomorrow/.test(lower) || /明天/.test(text)) {
    return 1;
  }

  if (/today/.test(lower) || /今天/.test(text)) {
    return 0;
  }

  if (/next week/.test(lower) || /下周/.test(text)) {
    return 7;
  }

  const englishMatch = lower.match(/(?:in\s+)?(\d+)\s+days?(?:\s+from\s+now)?/);
  if (englishMatch?.[1]) {
    return Number(englishMatch[1]);
  }

  const chineseMatch = text.match(/([零一二两三四五六七八九十\d]+)\s*天后/u);
  if (chineseMatch?.[1]) {
    return chineseNumberToInt(chineseMatch[1]);
  }

  return null;
}

function extractClock(text: string) {
  const lower = text.toLowerCase();
  const timeMatch = lower.match(/\b(\d{1,2}):(\d{2})\b/);
  if (timeMatch) {
    return {
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2])
    };
  }

  const ampmMatch = lower.match(/\b(\d{1,2})\s*(a\.?m\.?|am|p\.?m\.?|pm)\b/);
  if (ampmMatch) {
    let hour = Number(ampmMatch[1]);
    const period = ampmMatch[2];
    if (/p/.test(period) && hour < 12) {
      hour += 12;
    }
    if (/a/.test(period) && hour === 12) {
      hour = 0;
    }

    return {
      hour,
      minute: 0
    };
  }

  const chineseHalfMatch = text.match(/(上午|下午|晚上)?([零一二两三四五六七八九十\d]{1,3})点半/u);
  if (chineseHalfMatch?.[2]) {
    let hour = chineseNumberToInt(chineseHalfMatch[2]);
    if (chineseHalfMatch[1] === "下午" || chineseHalfMatch[1] === "晚上") {
      hour = hour < 12 ? hour + 12 : hour;
    }

    return {
      hour,
      minute: 30
    };
  }

  const chineseHourMatch = text.match(/(上午|下午|晚上)?([零一二两三四五六七八九十\d]{1,3})点/u);
  if (chineseHourMatch?.[2]) {
    let hour = chineseNumberToInt(chineseHourMatch[2]);
    if (chineseHourMatch[1] === "下午" || chineseHourMatch[1] === "晚上") {
      hour = hour < 12 ? hour + 12 : hour;
    }

    return {
      hour,
      minute: 0
    };
  }

  return null;
}

function defaultClockForEventType(eventType: AgentMemoryReminderEventType) {
  if (eventType === "birthday") {
    return { hour: 9, minute: 0 };
  }

  if (eventType === "meeting") {
    return { hour: 14, minute: 0 };
  }

  if (eventType === "deadline") {
    return { hour: 18, minute: 0 };
  }

  return { hour: 10, minute: 0 };
}

function resolveEventDate(sourceExcerpt: string, eventType: AgentMemoryReminderEventType) {
  const dayOffset = extractRelativeDayOffset(sourceExcerpt) ?? (eventType === "birthday" ? 3 : 1);
  const clock = extractClock(sourceExcerpt) ?? defaultClockForEventType(eventType);
  const eventAt = new Date();
  eventAt.setSeconds(0, 0);
  eventAt.setDate(eventAt.getDate() + dayOffset);
  eventAt.setHours(clock.hour, clock.minute, 0, 0);
  return eventAt;
}

function buildNotificationBody(plan: AgentReminderPlanRecord, delivery: { windowLabel: string; eventType: AgentMemoryReminderEventType | "course" | "general"; }) {
  if (plan.kind === "course-reminder-plan") {
    return `${plan.summary} Reminder window: ${delivery.windowLabel}. Open ClawDesk to review the class details.`;
  }

  if (plan.kind === "memory-reminder-plan") {
    if (delivery.eventType === "birthday") {
      return `${plan.summary} Open ClawDesk to review gift and greeting suggestions.`;
    }

    if (delivery.eventType === "meeting") {
      return `${plan.summary} Open ClawDesk to review the prep checklist before you head out.`;
    }

    if (delivery.eventType === "deadline") {
      return `${plan.summary} Open ClawDesk to review the submit checklist and final buffer.`;
    }
  }

  return `${plan.summary} Reminder window: ${delivery.windowLabel}.`;
}

function buildNotificationTitle(plan: AgentReminderPlanRecord, eventType: AgentMemoryReminderEventType | "course" | "general") {
  if (plan.kind === "course-reminder-plan" || eventType === "course") {
    return "Course reminder";
  }

  if (plan.kind === "memory-reminder-plan") {
    if (eventType === "birthday") {
      return "Birthday reminder";
    }

    if (eventType === "meeting") {
      return "Meeting reminder";
    }

    if (eventType === "deadline") {
      return "Deadline reminder";
    }
  }

  return plan.title;
}

function weekdayToJsIndex(weekday: AgentCourseScheduleEntry["weekday"]) {
  const map: Record<AgentCourseScheduleEntry["weekday"], number> = {
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
    sunday: 0
  };

  return map[weekday];
}

function nextWeekdayDate(weekday: AgentCourseScheduleEntry["weekday"], baseDate: Date) {
  const next = new Date(baseDate);
  next.setSeconds(0, 0);
  const delta = (weekdayToJsIndex(weekday) - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + delta);
  return next;
}

function scheduleCourseReminder(
  entry: AgentCourseScheduleEntry,
  plan: AgentReminderPlanRecord,
  label: string,
  scheduledAt: Date
): AgentReminderDeliveryRecord {
  const now = new Date().toISOString();
  const scheduleText = `${entry.courseName} ${entry.startTime}-${entry.endTime}`;
  const locationText = entry.location ? ` at ${entry.location}` : "";

  return {
    deliveryId: crypto.randomUUID(),
    planId: plan.planId,
    planKind: plan.kind,
    planTitle: plan.title,
    sourceActionId: plan.sourceActionId,
    sourceConversationId: plan.sourceConversationId,
    sourceTaskId: plan.sourceTaskId,
    status: plan.status === "active" ? "pending" : "paused",
    channel: "desktop",
    eventType: "course",
    windowLabel: `${label}: ${entry.courseName}`,
    scheduledFor: scheduledAt.toISOString(),
    createdAt: now,
    updatedAt: now,
    deliveredAt: null,
    notificationTitle: buildNotificationTitle(plan, "course"),
    notificationBody: `${scheduleText}${locationText}. ${label}.`
  };
}

function buildDeliveriesForPlan(plan: AgentReminderPlanRecord, sourceExcerpt: string) {
  if (plan.kind !== "memory-reminder-plan") {
    return [] satisfies AgentReminderDeliveryRecord[];
  }

  const eventType = plan.memoryProfile?.eventType ?? "general";
  const eventAt = resolveEventDate(sourceExcerpt, eventType);

  return plan.reminderWindows.map((window): AgentReminderDeliveryRecord => {
    const scheduledFor = new Date(eventAt.getTime() - window.offsetMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    return {
      deliveryId: crypto.randomUUID(),
      planId: plan.planId,
      planKind: plan.kind,
      planTitle: plan.title,
      sourceActionId: plan.sourceActionId,
      sourceConversationId: plan.sourceConversationId,
      sourceTaskId: plan.sourceTaskId,
      status: plan.status === "active" ? "pending" : "paused",
      channel: "desktop",
      eventType,
      windowLabel: window.label,
      scheduledFor,
      createdAt: now,
      updatedAt: now,
      deliveredAt: null,
      notificationTitle: buildNotificationTitle(plan, eventType),
      notificationBody: buildNotificationBody(plan, {
        windowLabel: window.label,
        eventType
      })
    };
  });
}

function buildCourseDeliveriesForPlan(plan: AgentReminderPlanRecord, entries: AgentCourseScheduleEntry[]) {
  const baseDate = new Date();
  baseDate.setSeconds(0, 0);

  return entries
    .filter((entry) => !entry.sourcePlanId || entry.sourcePlanId === plan.planId)
    .flatMap((entry) => {
      const classDate = nextWeekdayDate(entry.weekday, baseDate);
      const deliveries: AgentReminderDeliveryRecord[] = [];

      if (entry.nightBeforeReminder) {
        const nightBefore = new Date(classDate);
        nightBefore.setDate(nightBefore.getDate() - 1);
        nightBefore.setHours(20, 30, 0, 0);
        deliveries.push(scheduleCourseReminder(entry, plan, "Night-before reminder", nightBefore));
      }

      if (entry.afternoonReminder) {
        const afternoon = new Date(classDate);
        afternoon.setHours(13, 30, 0, 0);
        deliveries.push(scheduleCourseReminder(entry, plan, "Afternoon reminder", afternoon));
      }

      return deliveries;
    });
}

export async function syncReminderDeliveriesForPlan(plan: AgentReminderPlanRecord, sourceExcerpt: string) {
  const deliveries = await readReminderDeliveries();
  const existingForPlan = deliveries.filter((item) => item.planId === plan.planId);

  if (plan.status !== "active") {
    let changed = false;
    for (const delivery of existingForPlan) {
      if (delivery.status === "pending") {
        delivery.status = "paused";
        delivery.updatedAt = new Date().toISOString();
        changed = true;
      }
    }

    if (changed) {
      await writeReminderDeliveries(deliveries);
    }

    return deliveries.filter((item) => item.planId === plan.planId);
  }

  let nextDeliveries: AgentReminderDeliveryRecord[] = [];
  if (plan.kind === "memory-reminder-plan") {
    nextDeliveries = buildDeliveriesForPlan(plan, sourceExcerpt);
  } else if (plan.kind === "course-reminder-plan") {
    nextDeliveries = buildCourseDeliveriesForPlan(plan, await listAgentCourseScheduleEntries());
  } else {
    return existingForPlan;
  }

  const preservedDelivered = deliveries.filter(
    (item) => item.planId === plan.planId && item.status === "delivered"
  );
  const mergedDeliveries = deliveries.filter((item) => item.planId !== plan.planId || item.status === "delivered");

  for (const nextDelivery of nextDeliveries) {
    const existing = mergedDeliveries.find(
      (item) => item.planId === plan.planId && item.windowLabel === nextDelivery.windowLabel
    );

    if (existing) {
      existing.status = existing.status === "delivered" ? "delivered" : "pending";
      existing.updatedAt = new Date().toISOString();
      existing.scheduledFor = nextDelivery.scheduledFor;
      existing.notificationTitle = nextDelivery.notificationTitle;
      existing.notificationBody = nextDelivery.notificationBody;
      existing.eventType = nextDelivery.eventType;
      continue;
    }

    mergedDeliveries.push(nextDelivery);
  }

  if (preservedDelivered.length === 0 && nextDeliveries.length === 0) {
    await writeReminderDeliveries(mergedDeliveries);
    return [];
  }

  await writeReminderDeliveries(mergedDeliveries);
  return mergedDeliveries.filter((item) => item.planId === plan.planId);
}

export async function pollDueReminderDeliveries(limit = 5): Promise<AgentReminderDeliveriesPollPayload> {
  const deliveries = await readReminderDeliveries();
  const now = Date.now();
  const due = deliveries
    .filter((item) => item.status === "pending" && Date.parse(item.scheduledFor) <= now)
    .sort((left, right) => Date.parse(left.scheduledFor) - Date.parse(right.scheduledFor))
    .slice(0, Math.max(1, limit));

  if (due.length > 0) {
    const deliveredAt = new Date().toISOString();

    for (const item of due) {
      item.status = "delivered";
      item.deliveredAt = deliveredAt;
      item.updatedAt = deliveredAt;

      await appendActivityItem({
        kind: "agent-reminder-delivery-delivered",
        title: "Reminder delivered",
        summary: `${item.planTitle} sent a desktop reminder for ${item.windowLabel}.`,
        actor: "system",
        relatedConversationId: item.sourceConversationId,
        relatedTaskId: item.sourceTaskId,
        metadata: {
          deliveryId: item.deliveryId,
          planId: item.planId,
          planKind: item.planKind,
          eventType: item.eventType,
          windowLabel: item.windowLabel,
          scheduledFor: item.scheduledFor
        }
      });
    }

    await writeReminderDeliveries(deliveries);
  }

  return {
    generatedAt: new Date().toISOString(),
    totalDue: due.length,
    deliveries: due
  };
}
