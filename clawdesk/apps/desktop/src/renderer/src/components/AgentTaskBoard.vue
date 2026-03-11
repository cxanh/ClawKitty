<script setup lang="ts">
import { onMounted, ref } from "vue";

import type { AgentApprovalHint, AgentTaskBoardPayload, AgentTaskCard } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  createAgentSafeActionFromTask,
  getAgentTaskBoard,
  requestAgentTaskHintApproval,
  updateAgentTaskStatus
} from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const savingTaskId = ref("");
const approvalRequestingKey = ref("");
const safeActionCreatingTaskId = ref("");
const error = ref("");
const message = ref("");
const board = ref<AgentTaskBoardPayload | null>(null);

const statusOptions: AgentTaskCard["status"][] = ["draft", "ready", "in-progress", "blocked", "done"];

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
  return t(`agentTasks.approvalPolicy.${policy}`);
}

async function requestApproval(task: AgentTaskCard, hint: AgentApprovalHint) {
  approvalRequestingKey.value = `${task.taskId}:${hint.toolId}`;
  error.value = "";
  message.value = "";

  try {
    const result = await requestAgentTaskHintApproval(task.taskId, hint.toolId);
    message.value = result.message;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentTasks.failedRequestApproval", { message: detail });
  } finally {
    approvalRequestingKey.value = "";
  }
}

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentTaskBoard();
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentTasks.failedLoad", { message: detail });
  } finally {
    loading.value = false;
  }
}

async function setStatus(task: AgentTaskCard, status: AgentTaskCard["status"]) {
  savingTaskId.value = task.taskId;
  error.value = "";
  message.value = "";

  try {
    const updated = await updateAgentTaskStatus(task.taskId, status);
    if (board.value) {
      board.value = {
        ...board.value,
        tasks: board.value.tasks.map((item) => (item.taskId === updated.taskId ? updated : item))
      };
      board.value = await getAgentTaskBoard();
    }
    message.value = t("agentTasks.statusUpdated", { title: updated.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentTasks.failedStatusUpdate", { message: detail });
  } finally {
    savingTaskId.value = "";
  }
}

async function createSafeAction(task: AgentTaskCard) {
  safeActionCreatingTaskId.value = task.taskId;
  error.value = "";
  message.value = "";

  try {
    const action = await createAgentSafeActionFromTask(task.taskId);
    message.value = t("agentTasks.safeActionCreated", { title: action.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentTasks.failedCreateSafeAction", { message: detail });
  } finally {
    safeActionCreatingTaskId.value = "";
  }
}

onMounted(() => {
  void loadBoard();
});
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-label">{{ t("agentTasks.eyebrow") }}</p>
        <h3>{{ t("agentTasks.title") }}</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? t("common.refreshing") : t("agentTasks.refresh") }}
      </button>
    </div>

    <p class="panel-meta">{{ t("agentTasks.copy") }}</p>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section
      v-if="message"
      class="status-banner status-info"
    >
      {{ message }}
    </section>

    <div class="stats-grid compact-stats">
      <article class="panel accent-cyan compact-panel">
        <p class="panel-label">{{ t("agentTasks.total") }}</p>
        <h3>{{ board?.total ?? 0 }}</h3>
      </article>
      <article class="panel accent-gold compact-panel">
        <p class="panel-label">{{ t("agentTasks.ready") }}</p>
        <h3>{{ board?.statusCounts.ready ?? 0 }}</h3>
      </article>
      <article class="panel accent-rose compact-panel">
        <p class="panel-label">{{ t("agentTasks.inProgress") }}</p>
        <h3>{{ board?.statusCounts['in-progress'] ?? 0 }}</h3>
      </article>
      <article class="panel accent-green compact-panel">
        <p class="panel-label">{{ t("agentTasks.done") }}</p>
        <h3>{{ board?.statusCounts.done ?? 0 }}</h3>
      </article>
    </div>

    <div
      v-if="!board?.tasks.length"
      class="empty-state"
    >
      {{ t("agentTasks.noTasks") }}
    </div>

    <div
      v-else
      class="agent-task-grid"
    >
      <article
        v-for="task in board?.tasks"
        :key="task.taskId"
        class="info-card"
      >
        <div class="panel-head">
          <div>
            <strong>{{ task.title }}</strong>
            <p class="panel-meta">{{ task.summary }}</p>
          </div>
          <span class="chip">{{ task.status }}</span>
        </div>

        <div class="tag-row">
          <span
            v-for="tag in task.tags"
            :key="tag"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <ul class="metric-list">
          <li
            v-for="item in task.checklist"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>

        <p class="panel-meta">
          {{ t("agentTasks.sourceConversation") }}: {{ task.sourceConversationId }}
        </p>
        <div class="tag-row">
          <span class="chip">
            {{ t("agentTasks.replyMode") }}: {{ task.sourceReplyMode }}
          </span>
          <span
            v-if="task.sourceOrchestration"
            class="chip"
          >
            {{
              task.sourceOrchestration.source === "provider"
                ? t("agentTasks.providerBacked")
                : t("agentTasks.fallbackBacked")
            }}
          </span>
          <span
            v-if="task.sourceOrchestration?.providerId"
            class="chip"
          >
            {{ t("agentTasks.provider") }}: {{ task.sourceOrchestration.providerId }}
          </span>
          <span
            v-if="task.sourceOrchestration?.modelId"
            class="chip"
          >
            {{ t("agentTasks.model") }}: {{ task.sourceOrchestration.modelId }}
          </span>
        </div>
        <p
          v-if="task.sourceOrchestration?.fallbackReason"
          class="panel-meta"
        >
          {{ t("agentTasks.fallbackReason") }}: {{ task.sourceOrchestration.fallbackReason }}
        </p>
        <div
          v-if="task.approvalHints.length"
          class="section-stack"
        >
          <p class="panel-label">{{ t("agentTasks.approvalHeadsUp") }}</p>
          <div class="info-grid single-column-grid">
            <div
              v-for="hint in task.approvalHints"
              :key="`${task.taskId}-${hint.toolId}`"
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
                  :disabled="approvalRequestingKey === `${task.taskId}:${hint.toolId}`"
                  @click="requestApproval(task, hint)"
                >
                  {{
                    approvalRequestingKey === `${task.taskId}:${hint.toolId}`
                      ? t("common.working")
                      : t("agentTasks.requestApproval")
                  }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <p class="panel-meta">
          {{ t("agentTasks.updatedAt") }}: {{ formatDateTime(task.updatedAt) }}
        </p>

        <div class="action-row">
          <button
            class="secondary-button"
            :disabled="safeActionCreatingTaskId === task.taskId"
            @click="createSafeAction(task)"
          >
            {{
              safeActionCreatingTaskId === task.taskId
                ? t("common.working")
                : t("agentTasks.createSafeAction")
            }}
          </button>
          <button
            v-for="status in statusOptions"
            :key="status"
            class="secondary-button"
            :disabled="savingTaskId === task.taskId || status === task.status"
            @click="setStatus(task, status)"
          >
            {{ t(`agentTasks.status.${status}`) }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
