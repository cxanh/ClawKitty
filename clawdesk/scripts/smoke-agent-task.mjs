import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { createAgentTaskFromChat, getAgentTaskBoard, updateAgentTaskStatus } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const taskHome = path.join(os.tmpdir(), "clawdesk-agent-task-smoke");
process.env.OPENCLAW_HOME = taskHome;

await rm(taskHome, { recursive: true, force: true });

const chatResult = await sendAgentChatMessage({
  content: "帮我做一个六周 Python 学习计划，适合零基础新生。"
});
const created = await createAgentTaskFromChat({ conversationId: chatResult.conversation.conversationId });
if (!created) {
  throw new Error("Expected agent task card to be created.");
}

await updateAgentTaskStatus(created.taskId, { status: "ready" });
const board = await getAgentTaskBoard();

console.log(
  JSON.stringify(
    {
      total: board.total,
      ready: board.statusCounts.ready,
      firstTitle: board.tasks[0]?.title ?? null,
      firstReplyMode: board.tasks[0]?.sourceReplyMode ?? null,
      firstTaskSource: board.tasks[0]?.sourceOrchestration?.source ?? null,
      firstTaskFallbackReason: board.tasks[0]?.sourceOrchestration?.fallbackReason ?? null,
      firstTaskApprovalHintCount: board.tasks[0]?.approvalHints.length ?? 0,
      firstTaskApprovalPolicies: board.tasks[0]?.approvalHints.map((item) => `${item.toolId}:${item.policy}`) ?? []
    },
    null,
    2
  )
);
