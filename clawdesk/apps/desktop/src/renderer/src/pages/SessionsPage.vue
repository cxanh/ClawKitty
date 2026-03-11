<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import type { OpenClawSessionDetail, OpenClawSessionInfo } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getSessionDetail, getSessions } from "../services/runtime-api";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const sessions = ref<OpenClawSessionInfo[]>([]);
const selectedSession = ref<OpenClawSessionDetail | null>(null);
const search = ref("");
const loading = ref(false);
const detailLoading = ref(false);
const error = ref("");

const filteredSessions = computed(() => {
  const keyword = search.value.trim().toLowerCase();

  if (!keyword) {
    return sessions.value;
  }

  return sessions.value.filter((session) =>
    [
      session.sessionId,
      session.agentId,
      session.modelProvider,
      session.model,
      session.originLabel
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword))
  );
});

const abortedCount = computed(() => sessions.value.filter((session) => session.abortedLastRun).length);
const latestUpdatedAt = computed(() => sessions.value[0]?.updatedAt ?? null);

async function selectSession(sessionId: string, syncRoute = true) {
  detailLoading.value = true;
  error.value = "";

  try {
    selectedSession.value = await getSessionDetail(sessionId);

    if (syncRoute && route.query.sessionId !== sessionId) {
      await router.replace({
        path: "/sessions",
        query: { sessionId }
      });
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("sessions.failedDetail", { message });
  } finally {
    detailLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const nextSessions = await getSessions();
    sessions.value = nextSessions;

    const preferredSessionId =
      typeof route.query.sessionId === "string"
        ? route.query.sessionId
        : selectedSession.value?.session.sessionId ?? nextSessions[0]?.sessionId;

    if (preferredSessionId) {
      await selectSession(preferredSessionId, false);
    } else {
      selectedSession.value = null;
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("sessions.failedInventory", { message });
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.sessionId,
  (sessionId) => {
    if (typeof sessionId !== "string") {
      return;
    }

    if (sessionId === selectedSession.value?.session.sessionId) {
      return;
    }

    if (!sessions.value.some((session) => session.sessionId === sessionId)) {
      return;
    }

    void selectSession(sessionId, false);
  }
);

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("sessions.eyebrow") }}</p>
        <h2>{{ t("sessions.title") }}</h2>
        <p class="page-copy">
          {{ t("sessions.copy") }}
        </p>
      </div>

      <div class="page-actions inline-actions">
        <input
          v-model="search"
          class="text-input"
          type="text"
          :placeholder="t('sessions.searchPlaceholder')"
        />
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("sessions.refreshSessions") }}
        </button>
      </div>
    </header>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("sessions.totalSessions") }}</p>
        <h2>{{ sessions.length }}</h2>
        <p class="panel-meta">{{ t("sessions.loadedFromIndex") }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("sessions.abortedLastRun") }}</p>
        <h2>{{ abortedCount }}</h2>
        <p class="panel-meta">{{ t("sessions.interruptedSessions") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("sessions.selectedMessages") }}</p>
        <h2>{{ selectedSession?.messageCount ?? 0 }}</h2>
        <p class="panel-meta">{{ t("sessions.previewCount") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("sessions.latestUpdate") }}</p>
        <h2>{{ latestUpdatedAt ? t("common.recent") : "--" }}</h2>
        <p class="panel-meta">{{ formatDateTime(latestUpdatedAt) }}</p>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("sessions.sessionInventory") }}</p>
            <h3>{{ t("processes.rows", { count: filteredSessions.length }) }}</h3>
          </div>
          <span class="chip">{{ t("sessions.openclawIndex") }}</span>
        </div>

        <div
          v-if="filteredSessions.length === 0"
          class="empty-state"
        >
          {{ t("sessions.noMatchedSessions") }}
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data-table">
            <thead>
            <tr>
                <th>{{ t("sessions.session") }}</th>
                <th>{{ t("sessions.providerModel") }}</th>
                <th>{{ t("sessions.agent") }}</th>
                <th>{{ t("sessions.updated") }}</th>
                <th>{{ t("sessions.status") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="session in filteredSessions"
                :key="session.sessionId"
                :class="[
                  'click-row',
                  { 'active-row': session.sessionId === selectedSession?.session.sessionId }
                ]"
                @click="selectSession(session.sessionId)"
              >
                <td>{{ session.sessionId }}</td>
                <td>{{ session.modelProvider ?? "--" }} / {{ session.model ?? "--" }}</td>
                <td>{{ session.agentId }}</td>
                <td>{{ formatDateTime(session.updatedAt) }}</td>
                <td>{{ session.abortedLastRun ? t("sessions.aborted") : t("sessions.ok") }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("sessions.sessionDetail") }}</p>
            <h3>{{ selectedSession?.session.sessionId ?? t("sessions.noSessionSelected") }}</h3>
          </div>
          <span class="chip">{{ detailLoading ? t("common.loading") : t("common.current") }}</span>
        </div>

        <div
          v-if="!selectedSession"
          class="empty-state"
        >
          {{ t("sessions.selectSession") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("processes.started") }}</dt>
              <dd>{{ formatDateTime(selectedSession.startedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.updated") }}</dt>
              <dd>{{ formatDateTime(selectedSession.session.updatedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.cwd") }}</dt>
              <dd>{{ selectedSession.cwd ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.origin") }}</dt>
              <dd>{{ selectedSession.session.originLabel ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.userMessages") }}</dt>
              <dd>{{ selectedSession.userMessageCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.assistantMessages") }}</dt>
              <dd>{{ selectedSession.assistantMessageCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.toolMessages") }}</dt>
              <dd>{{ selectedSession.toolMessageCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.totalErrors") }}</dt>
              <dd>{{ selectedSession.errorCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.sessionFile") }}</dt>
              <dd>{{ selectedSession.session.sessionFile ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.abortedLastRun") }}</dt>
              <dd>{{ selectedSession.session.abortedLastRun ? t("common.yes") : t("common.no") }}</dd>
            </div>
          </dl>

          <p class="panel-meta">{{ selectedSession.lastError ?? t("sessions.noRecentSessionError") }}</p>

          <div class="action-row">
            <button
              class="secondary-button"
              :disabled="detailLoading"
              @click="void selectSession(selectedSession.session.sessionId, false)"
            >
              {{ detailLoading ? t("common.refreshing") : t("sessions.refreshDetail") }}
            </button>
          </div>

          <div class="message-stack">
            <article
              v-for="message in selectedSession.recentMessages"
              :key="message.id"
              class="message-card"
            >
              <div class="message-head">
                <strong>{{ message.role }}</strong>
                <span>{{ formatDateTime(message.timestamp) }}</span>
              </div>
              <p>{{ message.textPreview || t("sessions.emptyPreview") }}</p>
              <p
                v-if="message.stopReason || message.errorMessage"
                class="message-meta"
              >
                {{ message.stopReason ?? t("sessions.noStopReason") }} / {{ message.errorMessage ?? t("sessions.noError") }}
              </p>
            </article>
          </div>
        </template>
      </article>
    </section>
  </section>
</template>
