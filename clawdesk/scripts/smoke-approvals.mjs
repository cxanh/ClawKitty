import os from "node:os";
import path from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import {
  approveApprovalRequest,
  createAgentTaskToolApprovalRequest,
  createChatToolApprovalRequest,
  createDeviceRemoveApprovalRequest,
  createProcessKillApprovalRequest,
  rejectApprovalRequest
} from "../packages/runtime-server/src/services/approval.service.ts";
import { getOpenClawPairedDeviceDetail } from "../packages/openclaw-core/src/index.ts";
import { createAgentTaskFromChat } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const approvalsHome = path.join(os.tmpdir(), "clawdesk-approvals-smoke");
process.env.OPENCLAW_HOME = approvalsHome;

await rm(approvalsHome, { recursive: true, force: true });
await mkdir(path.join(approvalsHome, "devices"), { recursive: true });
await writeFile(
  path.join(approvalsHome, "devices", "paired.json"),
  JSON.stringify(
    {
      "paired-smoke": {
        deviceId: "paired-smoke",
        platform: "android",
        clientId: "android-smoke",
        clientMode: "paired",
        role: "mobile-companion",
        scopes: ["device.read", "task.read"],
        approvedScopes: ["device.read", "task.read"],
        createdAtMs: Date.now(),
        approvedAtMs: Date.now(),
        tokens: {}
      }
    },
    null,
    2
  ),
  "utf8"
);

const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  stdio: "ignore"
});

let processApproveResult = null;
let deviceRejectResult = null;
let chatApprovalApproveResult = null;
let taskApprovalRejectResult = null;

try {
  const processRequest = await createProcessKillApprovalRequest(child.pid);
  processApproveResult = await approveApprovalRequest(processRequest.request.requestId);

  const deviceRequest = await createDeviceRemoveApprovalRequest("paired-smoke");
  deviceRejectResult = await rejectApprovalRequest(deviceRequest.request.requestId, "Smoke reject");

  const chatResult = await sendAgentChatMessage({
    content: "帮我规划课程提醒流程，后面我可能还想继续让 Agent 帮我创建提醒任务。"
  });
  const chatApprovalRequest = await createChatToolApprovalRequest(chatResult.conversation.conversationId, "task-write");
  chatApprovalApproveResult = await approveApprovalRequest(chatApprovalRequest.request.requestId);

  const task = await createAgentTaskFromChat({ conversationId: chatResult.conversation.conversationId });
  if (!task) {
    throw new Error("Expected Agent task card for approval smoke.");
  }
  const taskApprovalRequest = await createAgentTaskToolApprovalRequest(task.taskId, "task-write");
  taskApprovalRejectResult = await rejectApprovalRequest(taskApprovalRequest.request.requestId, "Smoke reject task pre-approval");

  const remainingDevice = await getOpenClawPairedDeviceDetail("paired-smoke");
  const feed = await getActivityFeed(10);

  console.log(
    JSON.stringify(
      {
        processRequestCreated: processRequest.created,
        processApprovalStatus: processApproveResult?.request.status ?? null,
        deviceRequestCreated: deviceRequest.created,
        deviceRejectStatus: deviceRejectResult?.request.status ?? null,
        chatApprovalCreated: chatApprovalRequest.created,
        chatApprovalStatus: chatApprovalApproveResult?.request.status ?? null,
        chatApprovalExecuted: chatApprovalApproveResult?.executed ?? null,
        taskApprovalCreated: taskApprovalRequest.created,
        taskApprovalStatus: taskApprovalRejectResult?.request.status ?? null,
        deviceStillExistsAfterReject: Boolean(remainingDevice),
        recentKinds: feed.items.slice(0, 6).map((item) => item.kind)
      },
      null,
      2
    )
  );
} finally {
  try {
    child.kill();
  } catch {}
  await rm(approvalsHome, { recursive: true, force: true });
}
