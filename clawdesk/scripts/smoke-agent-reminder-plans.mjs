import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { createAgentReminderPlanFromSafeAction, getAgentReminderPlansBoard, updateAgentReminderPlanStatus } from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const reminderPlanHome = path.join(os.tmpdir(), "clawdesk-agent-reminder-plans-smoke");
process.env.OPENCLAW_HOME = reminderPlanHome;

await rm(reminderPlanHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content: "Please remember that my close friend's birthday is three days from now and I want both a gift suggestion and a warm birthday message."
});
const safeAction = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!safeAction) {
  throw new Error("Expected safe action to be created before reminder plan conversion.");
}

const plan = await createAgentReminderPlanFromSafeAction({ actionId: safeAction.actionId });
if (!plan) {
  throw new Error("Expected reminder plan to be created from safe action.");
}

await updateAgentReminderPlanStatus(plan.planId, { status: "active" });
const board = await getAgentReminderPlansBoard();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      total: board.total,
      statusCounts: board.statusCounts,
      firstKind: board.plans[0]?.kind ?? null,
      firstStatus: board.plans[0]?.status ?? null,
      firstSourceActionId: board.plans[0]?.sourceActionId ?? null,
      firstMemoryEventType: board.plans[0]?.memoryProfile?.eventType ?? null,
      firstMemoryRelationship: board.plans[0]?.memoryProfile?.relationship ?? null,
      firstMemorySuggestionFocus: board.plans[0]?.memoryProfile?.suggestionFocus ?? null,
      firstMemorySuggestionCount: board.plans[0]?.memoryProfile?.suggestions.length ?? 0,
      windowCount: board.plans[0]?.reminderWindows.length ?? 0,
      activityKinds: feed.items.map((item) => item.kind),
      latestReminderPlanKind:
        feed.items.find((item) => item.kind === "agent-reminder-plan-created")?.metadata?.kind ?? null
    },
    null,
    2
  )
);
