import os from "node:os";
import path from "node:path";
import { readFile, rm, writeFile } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { createAgentCourseScheduleEntry } from "../packages/runtime-server/src/services/agent-course-schedule.service.ts";
import { pollDueReminderDeliveries } from "../packages/runtime-server/src/services/agent-reminder-delivery.service.ts";
import {
  createAgentReminderPlanFromSafeAction,
  updateAgentReminderPlanStatus
} from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const reminderHome = path.join(os.tmpdir(), "clawdesk-agent-course-reminder-deliveries-smoke");
process.env.OPENCLAW_HOME = reminderHome;

await rm(reminderHome, { recursive: true, force: true });

const now = new Date();
const weekdayMap = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const todayWeekday = weekdayMap[now.getDay()];

const chat = await sendAgentChatMessage({
  content: "Help me set up course reminders for my morning classes and keep a night-before reminder."
});
const safeAction = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!safeAction) {
  throw new Error("Expected a course reminder safe action before delivery polling.");
}

const plan = await createAgentReminderPlanFromSafeAction({ actionId: safeAction.actionId });
if (!plan) {
  throw new Error("Expected a course reminder plan before delivery polling.");
}

await createAgentCourseScheduleEntry({
  courseName: "Linear Algebra",
  weekday: todayWeekday,
  startTime: "08:00",
  endTime: "09:35",
  location: "Teaching Building A-201",
  notes: ["Morning study reminder smoke test"],
  reminderPreset: "morning-class",
  nightBeforeReminder: true,
  afternoonReminder: true,
  sourcePlanId: plan.planId
});

await updateAgentReminderPlanStatus(plan.planId, { status: "active" });

const reminderDeliveryPath = path.join(reminderHome, "agent-assistant", "reminder-deliveries.json");
const reminderDeliveries = JSON.parse(await readFile(reminderDeliveryPath, "utf8"));
const forcedPast = new Date(Date.now() - 60_000).toISOString();
for (const delivery of reminderDeliveries) {
  if (delivery.planId === plan.planId) {
    delivery.scheduledFor = forcedPast;
    delivery.updatedAt = forcedPast;
  }
}
await writeFile(reminderDeliveryPath, JSON.stringify(reminderDeliveries, null, 2), "utf8");

const due = await pollDueReminderDeliveries();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      totalDue: due.totalDue,
      firstDeliveryTitle: due.deliveries[0]?.notificationTitle ?? null,
      firstDeliveryEventType: due.deliveries[0]?.eventType ?? null,
      firstDeliveryWindow: due.deliveries[0]?.windowLabel ?? null,
      latestActivityKind: feed.items[0]?.kind ?? null
    },
    null,
    2
  )
);
