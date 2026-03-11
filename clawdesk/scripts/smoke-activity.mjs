import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { approveApprovalRequest, createChatToolApprovalRequest } from "../packages/runtime-server/src/services/approval.service.ts";
import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { createAgentTaskFromChat, updateAgentTaskStatus } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const activityHome = path.join(os.tmpdir(), "clawdesk-activity-smoke");
process.env.OPENCLAW_HOME = activityHome;

await rm(activityHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content: "Help me design a file organization workflow so I can find application materials quickly and later clean up old duplicates."
});
const task = await createAgentTaskFromChat({ conversationId: chat.conversation.conversationId });
if (!task) {
  throw new Error("Expected task card to be created.");
}

await updateAgentTaskStatus(task.taskId, { status: "in-progress" });
const approvalRequest = await createChatToolApprovalRequest(chat.conversation.conversationId, "file-delete");
await approveApprovalRequest(approvalRequest.request.requestId);
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      total: feed.total,
      firstKind: feed.items[0]?.kind ?? null,
      kinds: feed.items.map((item) => item.kind),
      firstOrchestrationSource: feed.items[0]?.metadata?.orchestration?.source ?? null,
      latestApprovalActionType: feed.items.find((item) => item.kind.startsWith("approval-request-"))?.metadata?.actionType ?? null,
      latestApprovalOrigin: feed.items.find((item) => item.kind.startsWith("approval-request-"))?.metadata?.origin ?? null
    },
    null,
    2
  )
);
