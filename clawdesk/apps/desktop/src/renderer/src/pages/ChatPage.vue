<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type {
  AgentApprovalHint,
  AgentChatBootstrapPayload,
  AgentChatConversationDetail,
  AgentChatOrchestrationMeta,
  AgentChatStarterPrompt
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getCurrentLocale } from "../services/ui-preferences";
import {
  createAgentSafeActionFromChat,
  createAgentTaskFromChat,
  createAgentChatConversation,
  getAgentChatBootstrap,
  getAgentChatConversationDetail,
  requestChatHintApproval,
  sendAgentChatMessage
} from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const sending = ref(false);
const refreshing = ref(false);
const error = ref("");
const actionMessage = ref("");
const draft = ref("");
const selectedConversationId = ref("");
const latestSuggestedActions = ref<string[]>([]);
const approvalRequestingToolId = ref("");
const taskCreating = ref(false);
const safeActionCreating = ref(false);
const bootstrap = ref<AgentChatBootstrapPayload | null>(null);
const conversation = ref<AgentChatConversationDetail | null>(null);

function localText(zh: string, en: string) {
  return getCurrentLocale() === "zh-CN" ? zh : en;
}

const activeConversationTags = computed(() => conversation.value?.tags ?? []);
const conversationCount = computed(() => bootstrap.value?.conversations.length ?? 0);
const starterPrompts = computed(() => bootstrap.value?.starterPrompts ?? []);
const latestAssistantMessage = computed(() => {
  const messages = conversation.value?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") {
      return message;
    }
  }

  return null;
});
const hasActionableReply = computed(() => Boolean(latestAssistantMessage.value));
const chatPlaybook = computed(() => [
  localText("1. 先告诉 Agent 你要完成什么事。", "1. Tell the Agent what you want to get done."),
  localText("2. 看回复是否已经拆出任务、提醒或整理建议。", "2. Check whether the reply already breaks down tasks, reminders, or file help."),
  localText("3. 需要沉淀时，转成任务卡或安全动作。", "3. Save the result as a task card or safe action when you want to keep it.")
]);
const conversationStage = computed(() => {
  if (!conversation.value) {
    return {
      title: localText("还没有开始对话", "No conversation started yet"),
      copy: localText("先新建一段对话，或者直接使用右侧 starter prompts。", "Start a new conversation or use one of the starter prompts on the right."),
      tone: "status-info"
    };
  }

  if (!latestAssistantMessage.value) {
    return {
      title: localText("等待 Agent 首次回复", "Waiting for the first Agent reply"),
      copy: localText("你已经有对话了，现在发一条消息，Agent 会给出下一步建议。", "You already have a conversation. Send a message and the Agent will propose next steps."),
      tone: "status-info"
    };
  }

  if (latestApprovalHints.value.length > 0) {
    return {
      title: localText("有动作需要先确认权限", "There are actions that need permission first"),
      copy: localText("本轮回复已经给出能力建议；如果要继续执行高风险动作，可以先发起审批请求。", "This reply already contains action hints. Request approval first if you want to proceed with higher-risk actions."),
      tone: "status-error"
    };
  }

  return {
    title: localText("这段对话已经可以继续沉淀", "This conversation is ready to turn into work"),
    copy: localText("你可以把当前结果沉淀成任务卡，或者保存为安全动作，后续继续执行。", "You can turn the current result into a task card or save it as a safe action for follow-up."),
    tone: "status-success"
  };
});
const nextStepGuide = computed(() => {
  if (!conversation.value) {
    return localText("建议先点击右上角 New Conversation，或者直接试一个 starter prompt。", "Start with New Conversation or try one of the starter prompts.");
  }

  if (!latestAssistantMessage.value) {
    return localText("对当前会话发一条具体消息，例如“帮我整理下周课程提醒”。", "Send a concrete prompt such as “Help me organize next week's class reminders.”");
  }

  if (latestApprovalHints.value.length > 0) {
    return localText("如果你想让 Agent 后续继续调用工具，可以先发起审批请求，再回到对话继续推进。", "If you want the Agent to use tools next, request approval first and then continue the conversation.");
  }

  return localText("现在最适合把这轮结果转成任务卡或安全动作，方便后续跟进。", "The best next move is to turn this reply into a task card or safe action.");
});
const latestApprovalHints = computed<AgentApprovalHint[]>(() => {
  const messages = conversation.value?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant" && message.approvalHints?.length) {
      return message.approvalHints;
    }
  }

  return [];
});
const latestOrchestration = computed<AgentChatOrchestrationMeta | null>(() => {
  const messages = conversation.value?.messages ?? [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant" && message.orchestration) {
      return message.orchestration;
    }
  }

  return null;
});
const latestReplySourceLabel = computed(() => {
  if (!latestOrchestration.value) {
    return t("chat.replySourceUnavailable");
  }

  return latestOrchestration.value.source === "provider"
    ? t("chat.providerReply")
    : t("chat.fallbackReply");
});

function approvalHintClass(policy: AgentApprovalHint["policy"]) {
  if (policy === "deny") {
    return "status-error";
  }

  if (policy === "allow") {
    return "status-success";
  }

  return "status-info";
}

function approvalPolicyLabel(policy: AgentApprovalHint["policy"]) {
  return t(`chat.approvalPolicy.${policy}`);
}

async function requestApprovalForHint(hint: AgentApprovalHint) {
  if (!selectedConversationId.value) {
    error.value = t("chat.needConversationForTask");
    return;
  }

  approvalRequestingToolId.value = hint.toolId;
  error.value = "";
  actionMessage.value = "";

  try {
    const result = await requestChatHintApproval(selectedConversationId.value, hint.toolId);
    actionMessage.value = result.message;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedRequestApproval", { message });
  } finally {
    approvalRequestingToolId.value = "";
  }
}

async function loadConversation(conversationId: string) {
  conversation.value = await getAgentChatConversationDetail(conversationId);
  selectedConversationId.value = conversationId;
}

async function loadBootstrap(preserveSelection = true) {
  bootstrap.value = await getAgentChatBootstrap();

  if (!preserveSelection) {
    selectedConversationId.value = "";
  }

  const stillExists = bootstrap.value.conversations.some(
    (item) => item.conversationId === selectedConversationId.value
  );

  if (selectedConversationId.value && stillExists) {
    await loadConversation(selectedConversationId.value);
    return;
  }

  const firstConversation = bootstrap.value.conversations[0];
  if (firstConversation) {
    await loadConversation(firstConversation.conversationId);
    return;
  }

  conversation.value = null;
  selectedConversationId.value = "";
}

async function initialLoad() {
  loading.value = true;
  error.value = "";

  try {
    await loadBootstrap(false);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

async function refresh() {
  refreshing.value = true;
  error.value = "";

  try {
    await loadBootstrap();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedRefresh", { message });
  } finally {
    refreshing.value = false;
  }
}

async function handleCreateConversation() {
  sending.value = true;
  error.value = "";
  actionMessage.value = "";

  try {
    const detail = await createAgentChatConversation();
    conversation.value = detail;
    selectedConversationId.value = detail.conversationId;
    latestSuggestedActions.value = [];
    draft.value = "";
    await loadBootstrap();
    actionMessage.value = t("chat.createdConversation");
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedCreate", { message });
  } finally {
    sending.value = false;
  }
}

async function sendMessage(prompt?: AgentChatStarterPrompt) {
  const content = (prompt?.prompt ?? draft.value).trim();
  if (!content) {
    error.value = t("chat.messageRequired");
    return;
  }

  sending.value = true;
  error.value = "";
  actionMessage.value = "";

  try {
    const result = await sendAgentChatMessage({
      conversationId: selectedConversationId.value || undefined,
      content
    });

    conversation.value = result.conversation;
    selectedConversationId.value = result.conversation.conversationId;
    latestSuggestedActions.value = result.suggestedActions;
    draft.value = "";
    await loadBootstrap();
    actionMessage.value = result.createdConversation ? t("chat.startedConversation") : t("chat.sentMessage");
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedSend", { message });
  } finally {
    sending.value = false;
  }
}

async function createTaskCardFromConversation() {
  if (!selectedConversationId.value) {
    error.value = t("chat.needConversationForTask");
    return;
  }

  taskCreating.value = true;
  error.value = "";

  try {
    const task = await createAgentTaskFromChat(selectedConversationId.value);
    actionMessage.value = t("chat.createdTaskCard", { title: task.title });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedCreateTaskCard", { message });
  } finally {
    taskCreating.value = false;
  }
}

async function createSafeActionFromConversation() {
  if (!selectedConversationId.value) {
    error.value = t("chat.needConversationForTask");
    return;
  }

  safeActionCreating.value = true;
  error.value = "";

  try {
    const action = await createAgentSafeActionFromChat(selectedConversationId.value);
    actionMessage.value = t("chat.createdSafeAction", { title: action.title });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("chat.failedCreateSafeAction", { message });
  } finally {
    safeActionCreating.value = false;
  }
}

onMounted(() => {
  void initialLoad();
});
</script>

<template>
  <section
    v-if="loading"
    class="page"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("chat.eyebrow") }}</p>
        <h2>{{ t("chat.title") }}</h2>
        <p class="page-copy">{{ t("common.loading") }}</p>
      </div>
    </header>
  </section>

  <section
    v-else
    class="page"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("chat.eyebrow") }}</p>
        <h2>{{ t("chat.title") }}</h2>
        <p class="page-copy">{{ t("chat.copy") }}</p>
      </div>

      <div class="page-actions">
        <button
          class="secondary-button"
          :disabled="refreshing || sending"
          @click="refresh"
        >
          {{ refreshing ? t("common.refreshing") : t("chat.refresh") }}
        </button>
        <button
          class="primary-button"
          :disabled="sending"
          @click="handleCreateConversation"
        >
          {{ t("chat.newConversation") }}
        </button>
      </div>
    </header>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section
      v-if="actionMessage"
      class="status-banner status-info"
    >
      {{ actionMessage }}
    </section>

    <section class="info-grid">
      <article class="info-card">
        <strong>{{ localText("本页怎么用", "How to use this page") }}</strong>
        <ul class="metric-list compact-list">
          <li
            v-for="step in chatPlaybook"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </article>

      <article class="info-card">
        <div class="panel-head">
          <strong>{{ localText("当前对话进度", "Conversation progress") }}</strong>
          <span
            class="chip"
            :class="conversationStage.tone"
          >
            {{ hasActionableReply ? localText("可继续", "Ready") : localText("待开始", "Start") }}
          </span>
        </div>
        <p>{{ conversationStage.title }}</p>
        <p class="panel-meta">{{ conversationStage.copy }}</p>
      </article>

      <article class="info-card">
        <strong>{{ localText("建议下一步", "Recommended next step") }}</strong>
        <p>{{ nextStepGuide }}</p>
        <div class="action-row">
          <button
            v-if="!conversation"
            class="secondary-button"
            :disabled="sending"
            @click="handleCreateConversation"
          >
            {{ t("chat.newConversation") }}
          </button>
          <button
            v-else-if="hasActionableReply"
            class="secondary-button"
            :disabled="taskCreating || !selectedConversationId"
            @click="createTaskCardFromConversation"
          >
            {{ taskCreating ? t("common.working") : t("chat.createTaskCard") }}
          </button>
          <button
            v-else
            class="secondary-button"
            :disabled="sending"
            @click="sendMessage(starterPrompts[0])"
          >
            {{ t("chat.usePrompt") }}
          </button>
        </div>
      </article>
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("chat.agentMode") }}</p>
        <h3>{{ t("chat.singlePrimaryAgent") }}</h3>
        <p class="panel-meta">{{ t("chat.agentModeCopy") }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("chat.reminderMode") }}</p>
        <h3>{{ t("chat.lightProactive") }}</h3>
        <p class="panel-meta">{{ t("chat.reminderModeCopy") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("chat.conversations") }}</p>
        <h2>{{ conversationCount }}</h2>
        <p class="panel-meta">{{ t("chat.savedAgentThreads") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("chat.availableCapabilities") }}</p>
        <h3>{{ bootstrap?.agentDisplayName ?? "Campus Agent" }}</h3>
        <p class="panel-meta">{{ t("chat.capabilitySummary") }}</p>
      </article>
    </section>

    <section class="chat-layout">
      <article class="panel chat-column">
        <div class="panel-head">
          <p class="panel-label">{{ t("chat.conversationList") }}</p>
          <span class="chip">{{ conversationCount }}</span>
        </div>

        <div
          v-if="bootstrap?.conversations.length"
          class="chat-list"
        >
          <button
            v-for="item in bootstrap?.conversations"
            :key="item.conversationId"
            class="chat-thread"
            :class="{ 'chat-thread-active': item.conversationId === selectedConversationId }"
            @click="loadConversation(item.conversationId)"
          >
            <div class="chat-thread-head">
              <strong>{{ item.title }}</strong>
              <span>{{ formatDateTime(item.updatedAt) }}</span>
            </div>
            <p>{{ item.preview }}</p>
            <div class="tag-row">
              <span
                v-for="tag in item.tags"
                :key="tag"
                class="chip"
              >
                {{ tag }}
              </span>
            </div>
          </button>
        </div>

        <p
          v-else
          class="empty-state"
        >
          {{ t("chat.noConversations") }}
        </p>
      </article>

      <article class="panel chat-column chat-main">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("chat.activeConversation") }}</p>
            <h3>{{ conversation?.title ?? t("chat.noConversationSelected") }}</h3>
          </div>
          <span
            v-if="conversation"
            class="chip"
          >
            {{ conversation.messageCount }} {{ t("chat.messages") }}
          </span>
        </div>

        <div
          v-if="activeConversationTags.length"
          class="tag-row"
        >
          <span
            v-for="tag in activeConversationTags"
            :key="tag"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <div
          v-if="conversation"
          class="chat-message-stack"
        >
          <article
            v-for="message in conversation.messages"
            :key="message.messageId"
            class="chat-bubble"
            :class="message.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'"
          >
            <div class="message-head">
              <strong>{{ message.role === "user" ? t("chat.you") : bootstrap?.agentDisplayName }}</strong>
              <span class="message-meta">{{ formatDateTime(message.createdAt) }}</span>
            </div>
            <p>{{ message.content }}</p>
            <div
              v-if="message.role === 'assistant' && message.orchestration"
              class="section-stack"
            >
              <div class="tag-row">
                <span class="chip">
                  {{ message.orchestration.source === "provider" ? t("chat.providerReply") : t("chat.fallbackReply") }}
                </span>
                <span
                  v-if="message.orchestration.providerId"
                  class="chip"
                >
                  {{ t("chat.provider") }}: {{ message.orchestration.providerId }}
                </span>
                <span
                  v-if="message.orchestration.modelId"
                  class="chip"
                >
                  {{ t("chat.model") }}: {{ message.orchestration.modelId }}
                </span>
              </div>
              <p
                v-if="message.orchestration.durationMs !== null"
                class="panel-meta"
              >
                {{ t("chat.duration") }}: {{ message.orchestration.durationMs }} ms
              </p>
              <p
                v-if="message.orchestration.fallbackReason"
                class="panel-meta"
              >
                {{ t("chat.fallbackReason") }}: {{ message.orchestration.fallbackReason }}
              </p>
            </div>
            <div
              v-if="message.role === 'assistant' && message.approvalHints?.length"
              class="section-stack"
            >
              <p class="panel-label">{{ t("chat.approvalHeadsUp") }}</p>
              <div class="info-grid single-column-grid">
                <div
                  v-for="hint in message.approvalHints"
                  :key="`${message.messageId}-${hint.toolId}`"
                  class="info-card"
                >
                  <div class="tag-row">
                    <span class="chip">{{ hint.toolDisplayName }}</span>
                    <span
                      class="chip"
                      :class="approvalHintClass(hint.policy)"
                    >
                      {{ approvalPolicyLabel(hint.policy) }}
                    </span>
                  </div>
                  <p class="panel-meta">{{ hint.summary }}</p>
                  <div class="action-row">
                    <button
                      class="secondary-button"
                      :disabled="approvalRequestingToolId === hint.toolId"
                      @click="requestApprovalForHint(hint)"
                    >
                      {{ approvalRequestingToolId === hint.toolId ? t("common.working") : t("chat.requestApproval") }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          <p>{{ t("chat.emptyConversationState") }}</p>
          <div class="action-row">
            <button
              class="primary-button"
              :disabled="sending"
              @click="handleCreateConversation"
            >
              {{ t("chat.newConversation") }}
            </button>
            <button
              v-if="starterPrompts[0]"
              class="secondary-button"
              :disabled="sending"
              @click="sendMessage(starterPrompts[0])"
            >
              {{ t("chat.usePrompt") }}
            </button>
          </div>
        </div>

        <div class="chat-composer">
          <label class="form-field">
            <span>{{ t("chat.messageInput") }}</span>
            <textarea
              v-model="draft"
              class="text-area chat-textarea"
              :placeholder="t('chat.placeholder')"
              rows="5"
            />
          </label>

          <div class="composer-hint">
            {{ nextStepGuide }}
          </div>

        <div class="action-row">
          <button
            class="primary-button"
            :disabled="sending"
            @click="sendMessage()"
          >
            {{ sending ? t("common.working") : t("chat.send") }}
          </button>
          <button
            class="secondary-button"
            :disabled="taskCreating || !selectedConversationId"
            @click="createTaskCardFromConversation"
          >
            {{ taskCreating ? t("common.working") : t("chat.createTaskCard") }}
          </button>
          <button
            class="secondary-button"
            :disabled="safeActionCreating || !selectedConversationId"
            @click="createSafeActionFromConversation"
          >
            {{ safeActionCreating ? t("common.working") : t("chat.createSafeAction") }}
          </button>
        </div>
      </div>
      </article>

      <article class="panel chat-column">
        <p class="panel-label">{{ t("chat.starterPrompts") }}</p>
        <div class="info-grid single-column-grid">
          <div
            v-for="prompt in starterPrompts"
            :key="prompt.id"
            class="info-card"
          >
            <strong>{{ prompt.title }}</strong>
            <p>{{ prompt.prompt }}</p>
            <div class="action-row">
              <button
                class="secondary-button"
                :disabled="sending"
                @click="sendMessage(prompt)"
              >
                {{ t("chat.usePrompt") }}
              </button>
            </div>
          </div>
        </div>

        <p class="panel-label">{{ t("chat.capabilities") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("chat.providers") }}</dt>
            <dd>{{ bootstrap?.capabilities.providerCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("chat.tasks") }}</dt>
            <dd>{{ bootstrap?.capabilities.taskCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("chat.devices") }}</dt>
            <dd>{{ bootstrap?.capabilities.pairedDeviceCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("chat.browserRelay") }}</dt>
            <dd>{{ bootstrap?.capabilities.supportsBrowserRelay ? t("common.available") : t("common.unavailable") }}</dd>
          </div>
        </dl>

        <div class="section-stack">
          <p class="panel-label">{{ t("chat.latestReplyEngine") }}</p>
          <div class="tag-row">
            <span class="chip">{{ latestReplySourceLabel }}</span>
            <span
              v-if="latestOrchestration?.providerId"
              class="chip"
            >
              {{ t("chat.provider") }}: {{ latestOrchestration.providerId }}
            </span>
            <span
              v-if="latestOrchestration?.modelId"
              class="chip"
            >
              {{ t("chat.model") }}: {{ latestOrchestration.modelId }}
            </span>
          </div>
          <p
            v-if="latestOrchestration?.durationMs !== null"
            class="panel-meta"
          >
            {{ t("chat.duration") }}: {{ latestOrchestration?.durationMs }} ms
          </p>
          <p
            v-if="latestOrchestration?.fallbackReason"
            class="panel-meta"
          >
            {{ t("chat.fallbackReason") }}: {{ latestOrchestration.fallbackReason }}
          </p>
        </div>

        <div
          v-if="latestSuggestedActions.length"
          class="section-stack"
        >
          <p class="panel-label">{{ t("chat.suggestedNextActions") }}</p>
          <div class="tag-row">
            <span
              v-for="action in latestSuggestedActions"
              :key="action"
              class="chip"
            >
              {{ action }}
            </span>
          </div>
        </div>

        <div
          v-if="latestApprovalHints.length"
          class="section-stack"
        >
          <p class="panel-label">{{ t("chat.approvalHeadsUp") }}</p>
          <div class="info-grid single-column-grid">
            <div
              v-for="hint in latestApprovalHints"
              :key="`latest-${hint.toolId}`"
              class="info-card"
            >
              <div class="tag-row">
                <span class="chip">{{ hint.toolDisplayName }}</span>
                <span
                  class="chip"
                  :class="approvalHintClass(hint.policy)"
                >
                  {{ approvalPolicyLabel(hint.policy) }}
                </span>
              </div>
              <p class="panel-meta">{{ hint.summary }}</p>
              <div class="action-row">
                <button
                  class="secondary-button"
                  :disabled="approvalRequestingToolId === hint.toolId"
                  @click="requestApprovalForHint(hint)"
                >
                  {{ approvalRequestingToolId === hint.toolId ? t("common.working") : t("chat.requestApproval") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>
