<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type { RuntimeProcessInfo } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getProcessDetail, getProcesses, requestProcessKillApproval } from "../services/runtime-api";

const processes = ref<RuntimeProcessInfo[]>([]);
const selectedProcess = ref<RuntimeProcessInfo | null>(null);
const search = ref("");
const loading = ref(false);
const detailLoading = ref(false);
const actionLoading = ref(false);
const error = ref("");
const actionMessage = ref("");
const killConfirmArmed = ref(false);
const { t } = useI18n();

const processCount = computed(() => processes.value.length);

async function refresh() {
  loading.value = true;
  error.value = "";

  try {
    processes.value = await getProcesses(search.value);

    if (selectedProcess.value) {
      const updatedSelection = processes.value.find((process) => process.pid === selectedProcess.value?.pid);
      if (updatedSelection) {
        selectedProcess.value = await getProcessDetail(updatedSelection.pid);
      } else {
        selectedProcess.value = null;
        killConfirmArmed.value = false;
      }
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("processes.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

async function selectProcess(processInfo: RuntimeProcessInfo) {
  detailLoading.value = true;
  actionMessage.value = "";
  killConfirmArmed.value = false;

  try {
    selectedProcess.value = await getProcessDetail(processInfo.pid);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("processes.failedDetail", { message });
  } finally {
    detailLoading.value = false;
  }
}

async function requestKill() {
  if (!selectedProcess.value) {
    return;
  }

  if (!killConfirmArmed.value) {
    killConfirmArmed.value = true;
    actionMessage.value = t("processes.confirmTerminate", {
      pid: selectedProcess.value.pid,
      name: selectedProcess.value.name
    });
    return;
  }

  actionLoading.value = true;
  error.value = "";

  try {
    const result = await requestProcessKillApproval(selectedProcess.value.pid);
    actionMessage.value = result.message;
    killConfirmArmed.value = false;
    await refresh();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("processes.failedTerminate", { message });
    killConfirmArmed.value = false;
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("processes.eyebrow") }}</p>
        <h2>{{ t("processes.title") }}</h2>
        <p class="page-copy">
          {{ t("processes.copy") }}
        </p>
      </div>

      <div class="page-actions inline-actions">
        <input
          v-model="search"
          class="text-input"
          type="text"
          :placeholder="t('processes.searchPlaceholder')"
          @keyup.enter="refresh"
        />
        <button
          class="primary-button"
          :disabled="loading"
          @click="refresh"
        >
          {{ loading ? t("common.loading") : t("common.search") }}
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
      class="status-banner"
    >
      {{ actionMessage }}
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("processes.topProcesses") }}</p>
            <h3>{{ t("processes.rows", { count: processCount }) }}</h3>
          </div>
          <span class="chip">{{ t("processes.sortedByCpu") }}</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
            <tr>
                <th>{{ t("processes.pid") }}</th>
                <th>{{ t("processes.name") }}</th>
                <th>{{ t("processes.cpu") }} %</th>
                <th>{{ t("processes.memory") }} MB</th>
                <th>{{ t("processes.started") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="process in processes"
                :key="process.pid"
                class="click-row"
                @click="selectProcess(process)"
              >
                <td>{{ process.pid }}</td>
                <td>{{ process.name }}</td>
                <td>{{ process.cpuPct }}</td>
                <td>{{ process.memoryMb }}</td>
                <td>{{ formatDateTime(process.startedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("processes.selectedProcess") }}</p>
            <h3>{{ selectedProcess ? selectedProcess.name : t("processes.noProcessSelected") }}</h3>
          </div>
          <span class="chip">{{ detailLoading ? t("common.loading") : t("common.current") }}</span>
        </div>

        <div
          v-if="!selectedProcess"
          class="empty-state"
        >
          {{ t("processes.selectProcess") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("processes.pid") }}</dt>
              <dd>{{ selectedProcess.pid }}</dd>
            </div>
            <div>
              <dt>{{ t("processes.name") }}</dt>
              <dd>{{ selectedProcess.name }}</dd>
            </div>
            <div>
              <dt>{{ t("processes.cpu") }}</dt>
              <dd>{{ selectedProcess.cpuPct }}%</dd>
            </div>
            <div>
              <dt>{{ t("processes.memory") }}</dt>
              <dd>{{ selectedProcess.memoryMb }} MB</dd>
            </div>
            <div>
              <dt>{{ t("processes.virtualMemory") }}</dt>
              <dd>{{ selectedProcess.virtualMemoryMb ?? "--" }} MB</dd>
            </div>
            <div>
              <dt>{{ t("processes.started") }}</dt>
              <dd>{{ formatDateTime(selectedProcess.startedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("processes.path") }}</dt>
              <dd>{{ selectedProcess.path ?? "--" }}</dd>
            </div>
          </dl>

          <div class="action-row">
            <button
              class="secondary-button"
              :disabled="detailLoading || actionLoading"
              @click="void selectProcess(selectedProcess)"
            >
              {{ detailLoading ? t("common.refreshing") : t("processes.refreshDetail") }}
            </button>
            <button
              class="danger-button"
              :disabled="actionLoading"
              @click="requestKill"
            >
              {{ actionLoading ? t("common.working") : killConfirmArmed ? t("processes.confirmTerminateShort") : t("processes.terminateProcess") }}
            </button>
          </div>
        </template>
      </article>
    </section>
  </section>
</template>
