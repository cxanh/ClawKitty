<script setup lang="ts">
import { onMounted, ref } from "vue";

import type {
  AgentMemoryReminderEventType,
  AgentMemoryReminderImportance,
  AgentMemoryReminderRelationship,
  AgentMemoryReminderSuggestionFocus,
  AgentReminderPlansBoardPayload,
  AgentReminderPlanRecord
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  getAgentReminderPlansBoard,
  updateAgentReminderPlanStatus
} from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const savingPlanId = ref("");
const error = ref("");
const message = ref("");
const board = ref<AgentReminderPlansBoardPayload | null>(null);

const statusOptions: AgentReminderPlanRecord["status"][] = ["draft", "active", "paused"];

function kindLabel(kind: AgentReminderPlanRecord["kind"]) {
  return t(`agentReminderPlans.kind.${kind}`);
}

function memoryEventLabel(eventType: AgentMemoryReminderEventType) {
  return t(`agentReminderPlans.memory.eventType.${eventType}`);
}

function memoryImportanceLabel(importance: AgentMemoryReminderImportance) {
  return t(`agentReminderPlans.memory.importance.${importance}`);
}

function memoryRelationshipLabel(relationship: AgentMemoryReminderRelationship) {
  return t(`agentReminderPlans.memory.relationship.${relationship}`);
}

function memorySuggestionFocusLabel(suggestionFocus: AgentMemoryReminderSuggestionFocus) {
  return t(`agentReminderPlans.memory.suggestionFocus.${suggestionFocus}`);
}

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentReminderPlansBoard();
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentReminderPlans.failedLoad", { message: detail });
  } finally {
    loading.value = false;
  }
}

async function setStatus(plan: AgentReminderPlanRecord, status: AgentReminderPlanRecord["status"]) {
  savingPlanId.value = plan.planId;
  error.value = "";
  message.value = "";

  try {
    const updated = await updateAgentReminderPlanStatus(plan.planId, status);
    if (board.value) {
      board.value = {
        ...board.value,
        plans: board.value.plans.map((item) => (item.planId === updated.planId ? updated : item))
      };
      board.value = await getAgentReminderPlansBoard();
    }
    message.value = t("agentReminderPlans.statusUpdated", { title: updated.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentReminderPlans.failedStatusUpdate", { message: detail });
  } finally {
    savingPlanId.value = "";
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
        <p class="panel-label">{{ t("agentReminderPlans.eyebrow") }}</p>
        <h3>{{ t("agentReminderPlans.title") }}</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? t("common.refreshing") : t("agentReminderPlans.refresh") }}
      </button>
    </div>

    <p class="panel-meta">{{ t("agentReminderPlans.copy") }}</p>

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
        <p class="panel-label">{{ t("agentReminderPlans.total") }}</p>
        <h3>{{ board?.total ?? 0 }}</h3>
      </article>
      <article class="panel accent-gold compact-panel">
        <p class="panel-label">{{ t("agentReminderPlans.draft") }}</p>
        <h3>{{ board?.statusCounts.draft ?? 0 }}</h3>
      </article>
      <article class="panel accent-green compact-panel">
        <p class="panel-label">{{ t("agentReminderPlans.active") }}</p>
        <h3>{{ board?.statusCounts.active ?? 0 }}</h3>
      </article>
      <article class="panel accent-rose compact-panel">
        <p class="panel-label">{{ t("agentReminderPlans.paused") }}</p>
        <h3>{{ board?.statusCounts.paused ?? 0 }}</h3>
      </article>
    </div>

    <div
      v-if="!board?.plans.length"
      class="empty-state"
    >
      {{ t("agentReminderPlans.noPlans") }}
    </div>

    <div
      v-else
      class="agent-task-grid"
    >
      <article
        v-for="plan in board.plans"
        :key="plan.planId"
        class="info-card"
      >
        <div class="panel-head">
          <div>
            <strong>{{ plan.title }}</strong>
            <p class="panel-meta">{{ plan.summary }}</p>
          </div>
          <span class="chip">{{ t(`agentReminderPlans.status.${plan.status}`) }}</span>
        </div>

        <div class="tag-row">
          <span class="chip">{{ kindLabel(plan.kind) }}</span>
          <span
            v-for="tag in plan.tags"
            :key="`${plan.planId}-${tag}`"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <div class="section-stack">
          <div>
            <p class="panel-label">{{ t("agentReminderPlans.scheduleOutline") }}</p>
            <ul class="metric-list">
              <li
                v-for="item in plan.scheduleOutline"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>

          <div>
            <p class="panel-label">{{ t("agentReminderPlans.reminderWindows") }}</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="window in plan.reminderWindows"
                :key="window.windowId"
                class="info-card"
              >
                <strong>{{ window.label }}</strong>
                <p class="panel-meta">{{ window.timingHint }}</p>
                <p>{{ window.summary }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">{{ t("agentReminderPlans.deliveryChannels") }}</p>
            <div class="tag-row">
              <span
                v-for="channel in plan.deliveryChannels"
                :key="`${plan.planId}-${channel}`"
                class="chip"
              >
                {{ t(`agentReminderPlans.delivery.${channel}`) }}
              </span>
            </div>
          </div>

          <div v-if="plan.memoryProfile">
            <p class="panel-label">{{ t("agentReminderPlans.memory.title") }}</p>
            <div class="tag-row">
              <span class="chip">{{ t("agentReminderPlans.memory.eventTypeLabel") }}: {{ memoryEventLabel(plan.memoryProfile.eventType) }}</span>
              <span class="chip">{{ t("agentReminderPlans.memory.importanceLabel") }}: {{ memoryImportanceLabel(plan.memoryProfile.importance) }}</span>
              <span class="chip">{{ t("agentReminderPlans.memory.relationshipLabel") }}: {{ memoryRelationshipLabel(plan.memoryProfile.relationship) }}</span>
              <span class="chip">{{ t("agentReminderPlans.memory.suggestionFocusLabel") }}: {{ memorySuggestionFocusLabel(plan.memoryProfile.suggestionFocus) }}</span>
            </div>

            <div class="info-grid single-column-grid">
              <div
                v-for="suggestion in plan.memoryProfile.suggestions"
                :key="suggestion.suggestionId"
                class="info-card"
              >
                <strong>{{ suggestion.title }}</strong>
                <p class="panel-meta">{{ t(`agentReminderPlans.memory.suggestionKind.${suggestion.kind}`) }}</p>
                <p>{{ suggestion.summary }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">{{ t("agentReminderPlans.notes") }}</p>
            <ul class="metric-list">
              <li
                v-for="note in plan.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>
          </div>
        </div>

        <div class="tag-row">
          <span class="chip">{{ t("agentReminderPlans.replyMode") }}: {{ plan.sourceReplyMode }}</span>
          <span class="chip">{{ t("agentReminderPlans.sourceAction") }}: {{ plan.sourceActionId }}</span>
        </div>

        <p class="panel-meta">{{ t("agentReminderPlans.updatedAt") }}: {{ formatDateTime(plan.updatedAt) }}</p>

        <div class="action-row">
          <button
            v-for="status in statusOptions"
            :key="`${plan.planId}-${status}`"
            class="secondary-button"
            :disabled="savingPlanId === plan.planId || status === plan.status"
            @click="setStatus(plan, status)"
          >
            {{ t(`agentReminderPlans.status.${status}`) }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
