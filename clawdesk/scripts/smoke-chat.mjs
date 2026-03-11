import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import {
  createAgentChatConversation,
  getAgentChatBootstrap,
  sendAgentChatMessage
} from "../packages/runtime-server/src/services/chat.service.ts";

const chatHome = path.join(os.tmpdir(), "clawdesk-chat-smoke");
process.env.OPENCLAW_HOME = chatHome;

await rm(chatHome, { recursive: true, force: true });

const first = await createAgentChatConversation({ title: "Smoke chat" });
const sent = await sendAgentChatMessage({
  conversationId: first.conversationId,
  content: "帮我设计课程提醒流程，支持前一晚提醒和午休后提醒。"
});
const bootstrap = await getAgentChatBootstrap();

console.log(
  JSON.stringify(
    {
      conversationId: sent.conversation.conversationId,
      messageCount: sent.conversation.messageCount,
      replyMode: sent.replyMode,
      suggestedActions: sent.suggestedActions,
      orchestrationSource: sent.orchestration.source,
      orchestrationProvider: sent.orchestration.providerId,
      fallbackReason: sent.orchestration.fallbackReason,
      approvalHintCount: sent.approvalHints.length,
      approvalPolicies: sent.approvalHints.map((item) => `${item.toolId}:${item.policy}`),
      bootstrapConversationCount: bootstrap.conversations.length,
      providerCount: bootstrap.capabilities.providerCount
    },
    null,
    2
  )
);

