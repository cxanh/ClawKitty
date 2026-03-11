<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type { LogQueryResult, LogSummary, LogTailEntry, RuntimeHealth } from "@clawdesk/shared-types";

import { useI18n } from "../services/i18n";
import { exportLogs, getLogSummary, getRuntimeHealth, queryLogs } from "../services/runtime-api";

const { t } = useI18n();
const health = ref<RuntimeHealth | null>(null);
const logSummary = ref<LogSummary | null>(null);
const queryResult = ref<LogQueryResult | null>(null);
const selectedFile = ref<"desktop.log" | "runtime.log" | "error.log">("error.log");
const levelFilter = ref<"all" | "info" | "warn" | "error">("all");
const search = ref("");
const lineLimit = ref(80);
const loading = ref(false);
const queryLoading = ref(false);
const exportLoading = ref(false);
const error = ref("");
const exportMessage = ref("");
const selectedEntryKey = ref<string | null>(null);
const copyMessage = ref("");

const selectedEntry = computed<LogTailEntry | null>(() => {
  if (!selectedEntryKey.value || !queryResult.value) {
    return null;
  }

  return (
    queryResult.value.entries.find(
      (entry) => `${entry.timestamp ?? "no-ts"}-${entry.raw}` === selectedEntryKey.value
    ) ?? null
  );
});

const selectedEntryDetails = computed(() =>
  selectedEntry.value?.details ? JSON.stringify(selectedEntry.value.details, null, 2) : ""
);

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const [nextHealth, nextLogSummary] = await Promise.all([
      getRuntimeHealth(),
      getLogSummary()
    ]);

    health.value = nextHealth;
    logSummary.value = nextLogSummary;
    await runQuery();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("logs.failedMetadata", { message });
  } finally {
    loading.value = false;
  }
}

async function runQuery() {
  queryLoading.value = true;
  error.value = "";
  copyMessage.value = "";

  try {
    queryResult.value = await queryLogs(selectedFile.value, {
      lines: lineLimit.value,
      level: levelFilter.value,
      search: search.value
    });
    selectedEntryKey.value = queryResult.value.entries[0]
      ? `${queryResult.value.entries[0].timestamp ?? "no-ts"}-${queryResult.value.entries[0].raw}`
      : null;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("logs.failedQuery", { message });
  } finally {
    queryLoading.value = false;
  }
}

function setFile(fileName: "desktop.log" | "runtime.log" | "error.log") {
  selectedFile.value = fileName;
  void runQuery();
}

function setLevel(level: "all" | "info" | "warn" | "error") {
  levelFilter.value = level;
  void runQuery();
}

async function exportCurrentLogs() {
  exportLoading.value = true;
  error.value = "";

  try {
    const result = await exportLogs();
    exportMessage.value = t("logs.exportCreated", { path: result.outputPath });
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("logs.failedExport", { message });
  } finally {
    exportLoading.value = false;
  }
}

function selectEntry(entry: LogTailEntry) {
  selectedEntryKey.value = `${entry.timestamp ?? "no-ts"}-${entry.raw}`;
  copyMessage.value = "";
}

async function copyText(value: string, label: string) {
  if (!value) {
    copyMessage.value = t("logs.noCopySource", { label });
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    copyMessage.value = t("logs.copied", { label });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    copyMessage.value = t("logs.failedCopy", { label, message });
  }
}

function exportQueryJson() {
  if (!queryResult.value) {
    copyMessage.value = t("logs.runQueryBeforeExport");
    return;
  }

  const fileName = `${selectedFile.value.replace(".log", "")}-query-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(queryResult.value, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  copyMessage.value = t("logs.currentQueryExported", { fileName });
}

async function filterBySelectedLevel() {
  const level = selectedEntry.value?.level;
  if (level !== "info" && level !== "warn" && level !== "error") {
    copyMessage.value = t("logs.noStructuredLevel");
    return;
  }

  levelFilter.value = level;
  await runQuery();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("logs.eyebrow") }}</p>
        <h2>{{ t("logs.title") }}</h2>
        <p class="page-copy">
          {{ t("logs.copy") }}
        </p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("logs.refreshLogs") }}
        </button>
        <button
          class="secondary-button"
          :disabled="exportLoading"
          @click="exportCurrentLogs"
        >
          {{ exportLoading ? t("common.exporting") : t("common.exportLogs") }}
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
      v-if="exportMessage"
      class="status-banner"
    >
      {{ exportMessage }}
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("logs.runtimeDiagnostics") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("openclaw.status") }}</dt>
            <dd>{{ health?.status ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("logs.collector") }}</dt>
            <dd>{{ health?.collectorStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("logs.openclawBridge") }}</dt>
            <dd>{{ health?.openclawCoreStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("logs.browserRelay") }}</dt>
            <dd>{{ health?.browserRelayStatus ?? "--" }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("logs.currentLogDirectory") }}</p>
        <p class="panel-meta">{{ logSummary?.logDir ?? "--" }}</p>
      </article>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("logs.logQuery") }}</p>
          <h3>{{ selectedFile }}</h3>
        </div>
        <span class="chip">
          {{ queryLoading ? t("common.loading") : t("logs.matches", { returned: queryResult?.returnedEntries ?? 0, matched: queryResult?.matchedEntries ?? 0 }) }}
        </span>
      </div>

      <div class="action-row">
        <button
          v-for="fileName in ['error.log', 'runtime.log', 'desktop.log']"
          :key="fileName"
          class="secondary-button"
          :disabled="queryLoading && selectedFile === fileName"
          @click="setFile(fileName as 'desktop.log' | 'runtime.log' | 'error.log')"
        >
          {{ fileName }}
        </button>
      </div>

      <div class="action-row">
        <button
          v-for="level in ['all', 'error', 'warn', 'info']"
          :key="level"
          class="secondary-button"
          :disabled="queryLoading && levelFilter === level"
          @click="setLevel(level as 'all' | 'info' | 'warn' | 'error')"
        >
          {{ level }}
        </button>
        <input
          v-model="search"
          class="text-input"
          type="text"
          :placeholder="t('logs.searchPlaceholder')"
          @keyup.enter="runQuery"
        />
        <input
          v-model.number="lineLimit"
          class="text-input small-input"
          type="number"
          min="10"
          max="500"
          step="10"
          @keyup.enter="runQuery"
        />
        <button
          class="primary-button"
          :disabled="queryLoading"
          @click="runQuery"
        >
          {{ queryLoading ? t("common.searching") : t("common.runQuery") }}
        </button>
        <button
          class="secondary-button"
          :disabled="!queryResult"
          @click="exportQueryJson"
        >
          {{ t("common.exportQueryJson") }}
        </button>
      </div>

      <p class="panel-meta">{{ queryResult?.path ?? t("logs.runQueryHint") }}</p>
      <p class="panel-meta">
        {{ t("common.total") }}: {{ queryResult?.totalEntries ?? 0 }} / {{ t("common.matched") }}: {{ queryResult?.matchedEntries ?? 0 }} / {{ t("common.returned") }}: {{ queryResult?.returnedEntries ?? 0 }}
      </p>
      <p
        v-if="copyMessage"
        class="panel-meta"
      >
        {{ copyMessage }}
      </p>

      <div
        v-if="!(queryResult?.entries.length)"
        class="empty-state"
      >
        {{ t("logs.noMatchedEntries") }}
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <table class="data-table compact-table">
          <thead>
            <tr>
              <th>{{ t("logs.time") }}</th>
              <th>{{ t("logs.level") }}</th>
              <th>{{ t("logs.message") }}</th>
              <th>{{ t("logs.details") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in queryResult.entries"
              :key="`${entry.timestamp ?? 'no-ts'}-${entry.raw}`"
              class="click-row"
              :class="{ 'active-row': selectedEntryKey === `${entry.timestamp ?? 'no-ts'}-${entry.raw}` }"
              @click="selectEntry(entry)"
            >
              <td>{{ entry.timestamp ?? "--" }}</td>
              <td>{{ entry.level ?? t("common.raw") }}</td>
              <td>{{ entry.message ?? entry.raw }}</td>
              <td class="path-cell">{{ entry.details ? JSON.stringify(entry.details) : "--" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("logs.selectedEntry") }}</p>
          <h3>{{ selectedEntry?.message ?? selectedEntry?.raw ?? t("logs.noLogEntrySelected") }}</h3>
        </div>
        <span class="chip">{{ selectedEntry?.level ?? t("common.raw") }}</span>
      </div>

        <div
          v-if="!selectedEntry"
          class="empty-state"
        >
          {{ t("logs.selectLogEntry") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("logs.timestamp") }}</dt>
              <dd>{{ selectedEntry.timestamp ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("logs.level") }}</dt>
              <dd>{{ selectedEntry.level ?? t("common.raw") }}</dd>
            </div>
            <div class="kv-wide">
              <dt>{{ t("logs.message") }}</dt>
              <dd>{{ selectedEntry.message ?? "--" }}</dd>
            </div>
          </dl>

        <div class="action-row">
          <button
            class="secondary-button"
            @click="copyText(selectedEntry.raw, t('logs.rawLogLine'))"
          >
            {{ t("logs.copyRawLine") }}
          </button>
          <button
            class="secondary-button"
            @click="copyText(selectedEntryDetails, t('logs.detailsJson'))"
          >
            {{ t("logs.copyDetailsJson") }}
          </button>
          <button
            class="secondary-button"
            @click="filterBySelectedLevel"
          >
            {{ t("logs.filterByLevel") }}
          </button>
        </div>

        <div class="section-stack">
          <div>
            <p class="panel-label">{{ t("logs.structuredDetails") }}</p>
            <pre class="log-tail">{{ selectedEntryDetails || t("logs.noStructuredDetails") }}</pre>
          </div>
          <div>
            <p class="panel-label">{{ t("logs.rawLine") }}</p>
            <pre class="log-tail">{{ selectedEntry.raw }}</pre>
          </div>
        </div>
      </template>
    </section>

    <section
      v-for="file in logSummary?.files ?? []"
      :key="file.name"
      class="panel"
    >
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ file.name }}</p>
          <h3>{{ file.exists ? t("common.available") : t("common.missing") }}</h3>
        </div>
        <span class="chip">{{ file.sizeBytes }} bytes</span>
      </div>
      <p class="panel-meta">{{ file.path }}</p>
      <p class="panel-meta">{{ t("logs.modified") }}: {{ file.modifiedAt ?? "--" }}</p>
      <pre class="log-tail">{{ file.tailLines.join("\n") || t("logs.noLogLinesYet") }}</pre>
    </section>
  </section>
</template>
