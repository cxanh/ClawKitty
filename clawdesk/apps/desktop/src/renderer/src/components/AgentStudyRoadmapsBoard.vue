<script setup lang="ts">
import { onMounted, ref } from "vue";

import type { AgentStudyRoadmapsBoardPayload, AgentStudyRoadmapRecord } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  getAgentStudyRoadmapsBoard,
  updateAgentStudyRoadmapStatus
} from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const savingRoadmapId = ref("");
const error = ref("");
const message = ref("");
const board = ref<AgentStudyRoadmapsBoardPayload | null>(null);

const statusOptions: AgentStudyRoadmapRecord["status"][] = ["draft", "active", "completed"];

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentStudyRoadmapsBoard();
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentStudyRoadmaps.failedLoad", { message: detail });
  } finally {
    loading.value = false;
  }
}

async function setStatus(roadmap: AgentStudyRoadmapRecord, status: AgentStudyRoadmapRecord["status"]) {
  savingRoadmapId.value = roadmap.roadmapId;
  error.value = "";
  message.value = "";

  try {
    const updated = await updateAgentStudyRoadmapStatus(roadmap.roadmapId, status);
    if (board.value) {
      board.value = {
        ...board.value,
        roadmaps: board.value.roadmaps.map((item) => (item.roadmapId === updated.roadmapId ? updated : item))
      };
      board.value = await getAgentStudyRoadmapsBoard();
    }
    message.value = t("agentStudyRoadmaps.statusUpdated", { title: updated.title });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("agentStudyRoadmaps.failedStatusUpdate", { message: detail });
  } finally {
    savingRoadmapId.value = "";
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
        <p class="panel-label">{{ t("agentStudyRoadmaps.eyebrow") }}</p>
        <h3>{{ t("agentStudyRoadmaps.title") }}</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? t("common.refreshing") : t("agentStudyRoadmaps.refresh") }}
      </button>
    </div>

    <p class="panel-meta">{{ t("agentStudyRoadmaps.copy") }}</p>

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
        <p class="panel-label">{{ t("agentStudyRoadmaps.total") }}</p>
        <h3>{{ board?.total ?? 0 }}</h3>
      </article>
      <article class="panel accent-gold compact-panel">
        <p class="panel-label">{{ t("agentStudyRoadmaps.draft") }}</p>
        <h3>{{ board?.statusCounts.draft ?? 0 }}</h3>
      </article>
      <article class="panel accent-green compact-panel">
        <p class="panel-label">{{ t("agentStudyRoadmaps.active") }}</p>
        <h3>{{ board?.statusCounts.active ?? 0 }}</h3>
      </article>
      <article class="panel accent-rose compact-panel">
        <p class="panel-label">{{ t("agentStudyRoadmaps.completed") }}</p>
        <h3>{{ board?.statusCounts.completed ?? 0 }}</h3>
      </article>
    </div>

    <div
      v-if="!board?.roadmaps.length"
      class="empty-state"
    >
      {{ t("agentStudyRoadmaps.noRoadmaps") }}
    </div>

    <div
      v-else
      class="agent-task-grid"
    >
      <article
        v-for="roadmap in board.roadmaps"
        :key="roadmap.roadmapId"
        class="info-card"
      >
        <div class="panel-head">
          <div>
            <strong>{{ roadmap.title }}</strong>
            <p class="panel-meta">{{ roadmap.summary }}</p>
          </div>
          <span class="chip">{{ t(`agentStudyRoadmaps.status.${roadmap.status}`) }}</span>
        </div>

        <div class="tag-row">
          <span
            v-for="tag in roadmap.tags"
            :key="`${roadmap.roadmapId}-${tag}`"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <div class="section-stack">
          <div>
            <p class="panel-label">{{ t("agentStudyRoadmaps.goalSummary") }}</p>
            <ul class="metric-list">
              <li
                v-for="item in roadmap.goalSummary"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>

          <div>
            <p class="panel-label">{{ t("agentStudyRoadmaps.milestones") }}</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="milestone in roadmap.milestones"
                :key="milestone.milestoneId"
                class="info-card"
              >
                <strong>{{ milestone.title }}</strong>
                <p class="panel-meta">{{ milestone.targetWeek }}</p>
                <p>{{ milestone.summary }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">{{ t("agentStudyRoadmaps.weeklyPlan") }}</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="week in roadmap.weeklyPlan"
                :key="week.weekId"
                class="info-card"
              >
                <strong>{{ week.label }}</strong>
                <p class="panel-meta">{{ week.focus }}</p>
                <ul class="metric-list">
                  <li
                    v-for="task in week.tasks"
                    :key="task"
                  >
                    {{ task }}
                  </li>
                </ul>
                <p class="panel-meta">{{ week.reviewCheckpoint }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">{{ t("agentStudyRoadmaps.deliveryChannels") }}</p>
            <div class="tag-row">
              <span
                v-for="channel in roadmap.deliveryChannels"
                :key="`${roadmap.roadmapId}-${channel}`"
                class="chip"
              >
                {{ t(`agentStudyRoadmaps.delivery.${channel}`) }}
              </span>
            </div>
          </div>

          <div>
            <p class="panel-label">{{ t("agentStudyRoadmaps.notes") }}</p>
            <ul class="metric-list">
              <li
                v-for="note in roadmap.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>
          </div>
        </div>

        <p class="panel-meta">{{ t("agentStudyRoadmaps.sourceAction") }}: {{ roadmap.sourceActionId }}</p>
        <p class="panel-meta">{{ t("agentStudyRoadmaps.updatedAt") }}: {{ formatDateTime(roadmap.updatedAt) }}</p>

        <div class="action-row">
          <button
            v-for="status in statusOptions"
            :key="`${roadmap.roadmapId}-${status}`"
            class="secondary-button"
            :disabled="savingRoadmapId === roadmap.roadmapId || status === roadmap.status"
            @click="setStatus(roadmap, status)"
          >
            {{ t(`agentStudyRoadmaps.status.${status}`) }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
