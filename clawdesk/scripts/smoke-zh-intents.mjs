import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { createAgentFileWorkspaceFromSafeAction } from "../packages/runtime-server/src/services/agent-file-workspace.service.ts";
import { createAgentReminderPlanFromSafeAction } from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const home = path.join(os.tmpdir(), "clawdesk-zh-intents-smoke");
process.env.OPENCLAW_HOME = home;

await rm(home, { recursive: true, force: true });

const memoryChat = await sendAgentChatMessage({
  content: "三天后是我好朋友的生日，请提醒我准备礼物和祝福语。"
});
const memoryAction = await createAgentSafeActionFromChat({
  conversationId: memoryChat.conversation.conversationId
});
const memoryPlan = memoryAction
  ? await createAgentReminderPlanFromSafeAction({ actionId: memoryAction.actionId })
  : null;

const fileChat = await sendAgentChatMessage({
  content: "帮我查找报名材料和课程作业文件，并按课程和事件分类。"
});
const fileAction = await createAgentSafeActionFromChat({
  conversationId: fileChat.conversation.conversationId
});
const fileWorkspace = fileAction
  ? await createAgentFileWorkspaceFromSafeAction({ actionId: fileAction.actionId })
  : null;

console.log(
  JSON.stringify(
    {
      memoryReplyMode: memoryChat.replyMode,
      memoryActionKind: memoryAction?.kind ?? null,
      memoryEventType: memoryPlan?.memoryProfile?.eventType ?? null,
      memoryRelationship: memoryPlan?.memoryProfile?.relationship ?? null,
      fileReplyMode: fileChat.replyMode,
      fileActionKind: fileAction?.kind ?? null,
      fileWorkspaceCreated: Boolean(fileWorkspace)
    },
    null,
    2
  )
);
