import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";
import assert from "node:assert/strict";

import { createAgentTaskFromChat, getAgentTaskBoard, updateAgentTaskStatus } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const taskHome = path.join(os.tmpdir(), "clawdesk-agent-task-smoke");
process.env.OPENCLAW_HOME = taskHome;

await rm(taskHome, { recursive: true, force: true });

const chatResult = await sendAgentChatMessage({
  content: "帮我做一个六周 Python 学习计划，适合零基础新生。"
});
const created = await createAgentTaskFromChat({ conversationId: chatResult.conversation.conversationId });
assert.ok(created, "Expected agent task card to be created.");

const updated = await updateAgentTaskStatus(created.taskId, { status: "ready" });
assert.ok(updated, "Expected created task status to be updatable.");
assert.equal(updated.status, "ready", "Expected task status to become ready.");

const board = await getAgentTaskBoard();
const current = board.tasks.find((item) => item.taskId === created.taskId);

assert.ok(current, "Expected the created task to exist in task board.");
assert.equal(board.total, 1, "Expected exactly one task in isolated smoke environment.");
assert.equal(board.statusCounts.ready, 1, "Expected ready status count to include the updated task.");
assert.ok((current.approvalHints?.length ?? 0) > 0, "Expected task to contain approval hints for explainability.");
assert.equal(current.sourceConversationId, chatResult.conversation.conversationId, "Expected task to link back to source conversation.");

console.log(
  JSON.stringify(
    {
      total: board.total,
      ready: board.statusCounts.ready,
      taskId: current.taskId,
      title: current.title,
      replyMode: current.sourceReplyMode,
      source: current.sourceOrchestration?.source ?? null,
      approvalHintCount: current.approvalHints.length
    },
    null,
    2
  )
);
