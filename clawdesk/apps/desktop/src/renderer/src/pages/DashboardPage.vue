<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { OpenClawOverview, OpenClawSessionInfo, RuntimeHealth, SystemSummary } from "@clawdesk/shared-types";

import { formatBytesToGb, formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getOpenClawOverview, getRuntimeHealth, getSessions, getSystemSummary, runtimeBaseUrl } from "../services/runtime-api";
import { getCurrentLocale } from "../services/ui-preferences";

const desktopPlatform = window.clawdesk?.platform ?? "unknown";
const { t } = useI18n();

const health = ref<RuntimeHealth | null>(null);
const summary = ref<SystemSummary | null>(null);
const overview = ref<OpenClawOverview | null>(null);
const sessions = ref<OpenClawSessionInfo[]>([]);
const loading = ref(false);
const error = ref("");
const refreshedAt = ref("");

let refreshTimer: number | null = null;

const memoryPct = computed(() => {
  if (!summary.value) {
    return 0;
  }

  return Math.round((summary.value.memory.usedBytes / summary.value.memory.totalBytes) * 100);
});

const primaryGpu = computed(() => summary.value?.gpu[0] ?? null);
const primaryDisk = computed(() => summary.value?.disk[0] ?? null);

async function refresh() {
  loading.value = true;
  error.value = "";

  try {
    const [nextHealth, nextSummary, nextOverview, nextSessions] = await Promise.all([
      getRuntimeHealth(),
      getSystemSummary(),
      getOpenClawOverview(),
      getSessions()
    ]);

    health.value = nextHealth;
    summary.value = nextSummary;
    overview.value = nextOverview;
    sessions.value = nextSessions.slice(0, 4);
    refreshedAt.value = new Date().toLocaleTimeString(getCurrentLocale());
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("dashboard.runtimeUnavailable", { message });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
  refreshTimer = window.setInterval(() => {
    void refresh();
  }, 5000);
});

onUnmounted(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("dashboard.eyebrow") }}</p>
        <h2>{{ t("dashboard.title") }}</h2>
        <p class="page-copy">
          {{ t("dashboard.copy") }}
        </p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="refresh"
        >
          {{ loading ? t("common.refreshing") : t("dashboard.refreshNow") }}
        </button>
        <p class="runtime-target">Runtime: {{ runtimeBaseUrl }}</p>
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
        <p class="panel-label">{{ t("dashboard.runtime") }}</p>
        <h2>{{ health?.status ?? "--" }}</h2>
        <p class="panel-meta">{{ t("dashboard.lastRefresh") }}: {{ refreshedAt || t("common.pending") }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("dashboard.cpu") }}</p>
        <h2>{{ summary?.cpu.usagePct ?? 0 }}%</h2>
        <p class="panel-meta">{{ t("dashboard.temp") }}: {{ summary?.cpu.temperatureC ?? "--" }} C</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("dashboard.memory") }}</p>
        <h2>{{ memoryPct }}%</h2>
        <p class="panel-meta">
          {{ summary ? `${formatBytesToGb(summary.memory.usedBytes)} / ${formatBytesToGb(summary.memory.totalBytes)} GB` : t("dashboard.waitingForData") }}
        </p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("dashboard.openclawSessions") }}</p>
        <h2>{{ overview?.sessionCount ?? 0 }}</h2>
        <p class="panel-meta">{{ t("dashboard.providers") }}: {{ overview?.providerCount ?? 0 }}</p>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("dashboard.deviceSummary") }}</p>
            <h3>{{ summary?.hostname ?? "ASUS-PC" }}</h3>
          </div>
          <span class="chip">{{ summary?.platform ?? desktopPlatform }}</span>
        </div>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("dashboard.deviceId") }}</dt>
            <dd>{{ summary?.deviceId ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.agentStatus") }}</dt>
            <dd>{{ summary?.agentStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.gpu") }}</dt>
            <dd>{{ primaryGpu?.name ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.disk") }}</dt>
            <dd>{{ primaryDisk?.mount ?? "--" }} / {{ primaryDisk?.usedPct ?? "--" }}%</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.lastHeartbeat") }}</dt>
            <dd>{{ formatDateTime(summary?.lastHeartbeatAt) }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.uptime") }}</dt>
            <dd>{{ summary?.uptimeSec ?? 0 }} sec</dd>
          </div>
        </dl>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("dashboard.compatibilityBridge") }}</p>
            <h3>{{ overview?.available ? t("common.connected") : t("common.unavailable") }}</h3>
          </div>
          <span class="chip">legacy bridge</span>
        </div>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("settings.openclawHome") }}</dt>
            <dd>{{ overview?.homePath ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.authProfiles") }}</dt>
            <dd>{{ overview?.authProfileCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.tasks") }}</dt>
            <dd>{{ overview?.taskCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("dashboard.latestSession") }}</dt>
            <dd>{{ formatDateTime(overview?.latestSessionUpdatedAt) }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="panel">
      <p class="panel-label">{{ t("dashboard.recentSessions") }}</p>
      <div
        v-if="sessions.length === 0"
        class="empty-state"
      >
        {{ t("dashboard.noImportedSessions") }}
      </div>
      <ul
        v-else
        class="session-list"
      >
        <li
          v-for="session in sessions"
          :key="session.sessionId"
          class="session-row"
        >
          <div>
            <strong>{{ session.sessionId }}</strong>
            <p>{{ session.modelProvider ?? "--" }} / {{ session.model ?? "--" }}</p>
          </div>
          <div class="session-meta">
            <span>{{ session.agentId }}</span>
            <span>{{ formatDateTime(session.updatedAt) }}</span>
          </div>
        </li>
      </ul>
    </section>
  </section>
</template>
