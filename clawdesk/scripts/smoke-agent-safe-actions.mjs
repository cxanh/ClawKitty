import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import {
  createAgentSafeActionFromChat,
  createAgentSafeActionFromTask,
  getAgentSafeActionsBoard,
  updateAgentSafeActionStatus
} from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { createAgentTaskFromChat } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const safeActionHome = path.join(os.tmpdir(), "clawdesk-agent-safe-actions-smoke");
process.env.OPENCLAW_HOME = safeActionHome;

await rm(safeActionHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content: "Help me build a course reminder flow for tomorrow's classes and add a night-before reminder for 8 a.m. study sessions."
});
const fromChat = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!fromChat) {
  throw new Error("Expected a safe action to be created from chat.");
}

const task = await createAgentTaskFromChat({ conversationId: chat.conversation.conversationId });
if (!task) {
  throw new Error("Expected an Agent task card to be created.");
}

const fromTask = await createAgentSafeActionFromTask({ taskId: task.taskId });
if (!fromTask) {
  throw new Error("Expected a safe action to be created from task.");
}

await updateAgentSafeActionStatus(fromChat.actionId, { status: "saved" });
const board = await getAgentSafeActionsBoard();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      total: board.total,
      statusCounts: board.statusCounts,
      firstKind: board.actions[0]?.kind ?? null,
      firstStatus: board.actions[0]?.status ?? null,
      firstSourceReplyMode: board.actions[0]?.sourceReplyMode ?? null,
      secondSourceTaskId: board.actions[1]?.sourceTaskId ?? null,
      activityKinds: feed.items.map((item) => item.kind),
      latestSafeActionKind:
        feed.items.find((item) => item.kind === "agent-safe-action-created")?.metadata?.kind ?? null
    },
    null,
    2
  )
);
