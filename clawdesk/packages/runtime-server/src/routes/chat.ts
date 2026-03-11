import type { FastifyInstance } from "fastify";

import type {
  AgentChatConversationCreateInput,
  AgentChatConversationDetail,
  AgentChatConversationSummary,
  AgentChatMessageSendInput,
  AgentChatSendMessageResult,
  AgentChatBootstrapPayload
} from "@clawdesk/shared-types";

import {
  AgentChatValidationError,
  createAgentChatConversation,
  getAgentChatBootstrap,
  getAgentChatConversationDetail,
  listAgentChatConversations,
  sendAgentChatMessage
} from "../services/chat.service.js";
import { failure, success } from "../services/response.service.js";

export async function registerChatRoutes(server: FastifyInstance) {
  server.get("/api/v1/chat/bootstrap", async () => {
    const payload: AgentChatBootstrapPayload = await getAgentChatBootstrap();
    return success(payload);
  });

  server.get("/api/v1/chat/conversations", async () => {
    const payload: AgentChatConversationSummary[] = await listAgentChatConversations();
    return success(payload);
  });

  server.get("/api/v1/chat/conversations/:conversationId", async (request, reply) => {
    const { conversationId } = request.params as { conversationId: string };
    const payload: AgentChatConversationDetail | null = await getAgentChatConversationDetail(conversationId);

    if (!payload) {
      reply.code(404);
      return failure("CHAT_CONVERSATION_NOT_FOUND", `Conversation ${conversationId} not found.`);
    }

    return success(payload);
  });

  server.post("/api/v1/chat/conversations", async (request, reply) => {
    const payload = await createAgentChatConversation((request.body ?? {}) as AgentChatConversationCreateInput);
    reply.code(201);
    return success(payload);
  });

  server.post("/api/v1/chat/messages", async (request, reply) => {
    try {
      const payload: AgentChatSendMessageResult = await sendAgentChatMessage(
        (request.body ?? {}) as AgentChatMessageSendInput
      );

      if (payload.createdConversation) {
        reply.code(201);
      }

      return success(payload);
    } catch (error) {
      if (error instanceof AgentChatValidationError) {
        reply.code(400);
        return failure("CHAT_MESSAGE_INVALID", error.message);
      }

      throw error;
    }
  });
}
