<script setup lang="ts">
import { onMounted, ref } from "vue";

import type { AgentSafeActionsBoardPayload, AgentSafeActionRecord } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  createAgentFileWorkspaceFromSafeAction,
  createAgentReminderPlanFromSafeAction,
  createAgentStudyRoadmapFromSafeAction,
  getAgentSafeActionsBoard,
  updateAgentSafeActionStatus
} from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const savingActionId = ref("");
const creatingReminderPlanActionId = ref("");
const creatingStudyRoadmapActionId = ref("");
const creatingFileWorkspaceActionId = ref("");
const error = ref("");
const message = ref("");
const board = ref<AgentSafeActionsBoardPayload | null>(null);

const statusOptions: AgentSafeActionRecord["status"][] = ["draft", "ready", "saved"];

function kindLabel(kind: AgentSafeActionRecord["kind"]) {
  return t(`agentActions.kind.${kind}`);
}

function canCreateReminderPlan(action: AgentSafeActionRecord) {
  return action.kind === "course-reminder-draft" || action.kind === "memory-item";
}

function canCreateStudyRoadmap(action: AgentSafeActionRecord) {
  return action.kind === "study-plan-draft";
}

function canCreateFileWorkspace(action: AgentSafeActionRecord) {
  return action.kind === "file-organization-brief";
}

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentSafeActionsBoard();
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentActions.failedLoad", { message: detail });
  } finally {
    loading.value = false;
  }
}

async function setStatus(action: AgentSafeActionRecord, status: AgentSafeActionRecord["status"]) {
  savingActionId.value = action.actionId;
  error.value = "";
  message.value = "";

  try {
    const updated = await updateAgentSafeActionStatus(action.actionId, status);
    if (board.value) {
      board.value = {
        ...board.value,
        actions: board.value.actions.map((item) => (item.actionId === updated.actionId ? updated : item))
      };
      board.value = await getAgentSafeActionsBoard();
    }
    message.value = t("agentActions.statusUpdated", { title: updated.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentActions.failedStatusUpdate", { message: detail });
  } finally {
    savingActionId.value = "";
  }
}

async function createReminderPlan(action: AgentSafeActionRecord) {
  creatingReminderPlanActionId.value = action.actionId;
  error.value = "";
  message.value = "";

  try {
    const plan = await createAgentReminderPlanFromSafeAction(action.actionId);
    message.value = t("agentActions.reminderPlanCreated", { title: plan.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentActions.failedReminderPlan", { message: detail });
  } finally {
    creatingReminderPlanActionId.value = "";
  }
}

async function createStudyRoadmap(action: AgentSafeActionRecord) {
  creatingStudyRoadmapActionId.value = action.actionId;
  error.value = "";
  message.value = "";

  try {
    const roadmap = await createAgentStudyRoadmapFromSafeAction(action.actionId);
    message.value = t("agentActions.studyRoadmapCreated", { title: roadmap.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentActions.failedStudyRoadmap", { message: detail });
  } finally {
    creatingStudyRoadmapActionId.value = "";
  }
}

async function createFileWorkspace(action: AgentSafeActionRecord) {
  creatingFileWorkspaceActionId.value = action.actionId;
  error.value = "";
  message.value = "";

  try {
    const workspace = await createAgentFileWorkspaceFromSafeAction(action.actionId);
    message.value = `Created ${workspace.title}.`;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = `Failed to create file workspace: ${detail}`;
  } finally {
    creatingFileWorkspaceActionId.value = "";
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
        <p class="panel-label">{{ t("agentActions.eyebrow") }}</p>
        <h3>{{ t("agentActions.title") }}</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? t("common.refreshing") : t("agentActions.refresh") }}
      </button>
    </div>

    <p class="panel-meta">{{ t("agentActions.copy") }}</p>

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
        <p class="panel-label">{{ t("agentActions.total") }}</p>
        <h3>{{ board?.total ?? 0 }}</h3>
      </article>
      <article class="panel accent-gold compact-panel">
        <p class="panel-label">{{ t("agentActions.draft") }}</p>
        <h3>{{ board?.statusCounts.draft ?? 0 }}</h3>
      </article>
      <article class="panel accent-rose compact-panel">
        <p class="panel-label">{{ t("agentActions.ready") }}</p>
        <h3>{{ board?.statusCounts.ready ?? 0 }}</h3>
      </article>
      <article class="panel accent-green compact-panel">
        <p class="panel-label">{{ t("agentActions.saved") }}</p>
        <h3>{{ board?.statusCounts.saved ?? 0 }}</h3>
      </article>
    </div>

    <div
      v-if="!board?.actions.length"
      class="empty-state"
    >
      {{ t("agentActions.noActions") }}
    </div>

    <div
      v-else
      class="agent-task-grid"
    >
      <article
        v-for="action in board.actions"
        :key="action.actionId"
        class="info-card"
      >
        <div class="panel-head">
          <div>
            <strong>{{ action.title }}</strong>
            <p class="panel-meta">{{ action.summary }}</p>
          </div>
          <span class="chip">{{ t(`agentActions.status.${action.status}`) }}</span>
        </div>

        <div class="tag-row">
          <span class="chip">{{ kindLabel(action.kind) }}</span>
          <span
            v-for="tag in action.tags"
            :key="`${action.actionId}-${tag}`"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <p class="panel-meta">
          {{ t("agentActions.sourceExcerpt") }}: {{ action.sourceExcerpt }}
        </p>

        <div class="section-stack">
          <div>
            <p class="panel-label">{{ t("agentActions.details") }}</p>
            <ul class="metric-list">
              <li
                v-for="detail in action.details"
                :key="detail"
              >
                {{ detail }}
              </li>
            </ul>
          </div>

          <div>
            <p class="panel-label">{{ t("agentActions.nextSteps") }}</p>
            <ul class="metric-list">
              <li
                v-for="step in action.nextSteps"
                :key="step"
              >
                {{ step }}
              </li>
            </ul>
          </div>
        </div>

        <div class="tag-row">
          <span class="chip">{{ t("agentActions.replyMode") }}: {{ action.sourceReplyMode }}</span>
          <span
            v-if="action.sourceConversationId"
            class="chip"
          >
            {{ t("agentActions.sourceConversation") }}: {{ action.sourceConversationId }}
          </span>
          <span
            v-if="action.sourceTaskId"
            class="chip"
          >
            {{ t("agentActions.sourceTask") }}: {{ action.sourceTaskId }}
          </span>
        </div>

        <p class="panel-meta">
          {{ t("agentActions.updatedAt") }}: {{ formatDateTime(action.updatedAt) }}
        </p>

        <div class="action-row">
          <button
            v-if="canCreateReminderPlan(action)"
            class="secondary-button"
            :disabled="creatingReminderPlanActionId === action.actionId"
            @click="createReminderPlan(action)"
          >
            {{
              creatingReminderPlanActionId === action.actionId
                ? t("common.working")
                : t("agentActions.createReminderPlan")
            }}
          </button>
          <button
            v-if="canCreateFileWorkspace(action)"
            class="secondary-button"
            :disabled="creatingFileWorkspaceActionId === action.actionId"
            @click="createFileWorkspace(action)"
          >
            {{
              creatingFileWorkspaceActionId === action.actionId
                ? t("common.working")
                : "Create file workspace"
            }}
          </button>
          <button
            v-if="canCreateStudyRoadmap(action)"
            class="secondary-button"
            :disabled="creatingStudyRoadmapActionId === action.actionId"
            @click="createStudyRoadmap(action)"
          >
            {{
              creatingStudyRoadmapActionId === action.actionId
                ? t("common.working")
                : t("agentActions.createStudyRoadmap")
            }}
          </button>
          <button
            v-for="status in statusOptions"
            :key="`${action.actionId}-${status}`"
            class="secondary-button"
            :disabled="savingActionId === action.actionId || status === action.status"
            @click="setStatus(action, status)"
          >
            {{ t(`agentActions.status.${status}`) }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
