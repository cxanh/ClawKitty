import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { pollDueReminderDeliveries } from "../packages/runtime-server/src/services/agent-reminder-delivery.service.ts";
import { createAgentReminderPlanFromSafeAction, updateAgentReminderPlanStatus } from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const reminderDeliveryHome = path.join(os.tmpdir(), "clawdesk-agent-reminder-deliveries-smoke");
process.env.OPENCLAW_HOME = reminderDeliveryHome;

await rm(reminderDeliveryHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content: "Please remember that my close friend's birthday is tomorrow and I want help preparing a gift and a warm birthday message."
});
const safeAction = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!safeAction) {
  throw new Error("Expected safe action before delivery polling.");
}

const plan = await createAgentReminderPlanFromSafeAction({ actionId: safeAction.actionId });
if (!plan) {
  throw new Error("Expected reminder plan before delivery polling.");
}

await updateAgentReminderPlanStatus(plan.planId, { status: "active" });
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
