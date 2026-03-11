<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type {
  AgentCourseReminderPreset,
  AgentCourseScheduleBoardPayload,
  AgentCourseScheduleEntry,
  AgentCourseScheduleEntryInput,
  AgentCourseScheduleImportMode,
  AgentCourseWeekday
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  createAgentCourseScheduleEntry,
  deleteAgentCourseScheduleEntry,
  getAgentCourseScheduleBoard,
  importAgentCourseSchedule,
  updateAgentCourseScheduleEntry
} from "../services/runtime-api";

const { t } = useI18n();

const board = ref<AgentCourseScheduleBoardPayload | null>(null);
const loading = ref(true);
const saving = ref(false);
const deletingEntryId = ref("");
const editingEntryId = ref<string | null>(null);
const message = ref("");
const error = ref("");
const importText = ref("");
const importMode = ref<AgentCourseScheduleImportMode>("append");
const importing = ref(false);

const form = ref<AgentCourseScheduleEntryInput>({
  courseName: "",
  weekday: "monday",
  startTime: "08:00",
  endTime: "09:35",
  location: "",
  notes: [],
  reminderPreset: "morning-class",
  nightBeforeReminder: true,
  afternoonReminder: false,
  sourcePlanId: null
});
const notesText = ref("");

const weekdayOptions: AgentCourseWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];

const reminderPresetOptions: AgentCourseReminderPreset[] = ["morning-class", "afternoon-class", "custom"];

const total = computed(() => board.value?.total ?? 0);

function resetForm() {
  editingEntryId.value = null;
  notesText.value = "";
  form.value = {
    courseName: "",
    weekday: "monday",
    startTime: "08:00",
    endTime: "09:35",
    location: "",
    notes: [],
    reminderPreset: "morning-class",
    nightBeforeReminder: true,
    afternoonReminder: false,
    sourcePlanId: null
  };
}

function applyPreset(preset: AgentCourseReminderPreset) {
  if (preset === "morning-class") {
    form.value.nightBeforeReminder = true;
    form.value.afternoonReminder = false;
    return;
  }

  if (preset === "afternoon-class") {
    form.value.nightBeforeReminder = false;
    form.value.afternoonReminder = true;
    return;
  }
}

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentCourseScheduleBoard();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : t("common.unknownError");
  } finally {
    loading.value = false;
  }
}

function editEntry(entry: AgentCourseScheduleEntry) {
  editingEntryId.value = entry.entryId;
  form.value = {
    courseName: entry.courseName,
    weekday: entry.weekday,
    startTime: entry.startTime,
    endTime: entry.endTime,
    location: entry.location ?? "",
    notes: [...entry.notes],
    reminderPreset: entry.reminderPreset,
    nightBeforeReminder: entry.nightBeforeReminder,
    afternoonReminder: entry.afternoonReminder,
    sourcePlanId: entry.sourcePlanId
  };
  notesText.value = entry.notes.join("\n");
}

async function saveEntry() {
  saving.value = true;
  error.value = "";
  message.value = "";
  form.value.notes = notesText.value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    if (editingEntryId.value) {
      await updateAgentCourseScheduleEntry(editingEntryId.value, form.value);
      message.value = t("agentCourseSchedule.updated");
    } else {
      await createAgentCourseScheduleEntry(form.value);
      message.value = t("agentCourseSchedule.created");
    }

    await loadBoard();
    resetForm();
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : t("common.unknownError");
  } finally {
    saving.value = false;
  }
}

async function removeEntry(entryId: string) {
  deletingEntryId.value = entryId;
  error.value = "";
  message.value = "";

  try {
    await deleteAgentCourseScheduleEntry(entryId);
    message.value = t("agentCourseSchedule.deleted");
    await loadBoard();
    if (editingEntryId.value === entryId) {
      resetForm();
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : t("common.unknownError");
  } finally {
    deletingEntryId.value = "";
  }
}

async function runImport() {
  importing.value = true;
  error.value = "";
  message.value = "";

  try {
    const result = await importAgentCourseSchedule({
      text: importText.value,
      mode: importMode.value
    });
    await loadBoard();
    message.value = t("agentCourseSchedule.imported", {
      created: String(result.createdCount),
      updated: String(result.updatedCount),
      skipped: String(result.skippedCount)
    });
    if (result.errors.length > 0) {
      error.value = result.errors.join(" ");
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : t("common.unknownError");
  } finally {
    importing.value = false;
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
        <p class="panel-label">{{ t("agentCourseSchedule.eyebrow") }}</p>
        <h3>{{ t("agentCourseSchedule.title") }}</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? t("common.refreshing") : t("agentCourseSchedule.refresh") }}
      </button>
    </div>

    <p class="panel-meta">{{ t("agentCourseSchedule.copy") }}</p>

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
        <p class="panel-label">{{ t("agentCourseSchedule.total") }}</p>
        <h3>{{ total }}</h3>
      </article>
      <article
        v-for="weekday in weekdayOptions"
        :key="weekday"
        class="panel compact-panel"
      >
        <p class="panel-label">{{ t(`agentCourseSchedule.weekday.${weekday}`) }}</p>
        <h3>{{ board?.weekdayCounts[weekday] ?? 0 }}</h3>
      </article>
    </div>

    <div class="info-grid">
      <article class="info-card">
        <div class="panel-head">
          <div>
            <strong>{{ t("agentCourseSchedule.importTitle") }}</strong>
            <p class="panel-meta">{{ t("agentCourseSchedule.importCopy") }}</p>
          </div>
        </div>

        <div class="section-stack">
          <label class="field-block">
            <span class="panel-label">{{ t("agentCourseSchedule.importMode") }}</span>
            <select v-model="importMode">
              <option value="append">{{ t("agentCourseSchedule.importModeValue.append") }}</option>
              <option value="replace">{{ t("agentCourseSchedule.importModeValue.replace") }}</option>
            </select>
          </label>

          <label class="field-block">
            <span class="panel-label">{{ t("agentCourseSchedule.importText") }}</span>
            <textarea
              v-model="importText"
              rows="8"
              :placeholder="t('agentCourseSchedule.importPlaceholder')"
            />
          </label>

          <div class="info-card">
            <p class="panel-label">{{ t("agentCourseSchedule.importExampleTitle") }}</p>
            <pre class="code-block">{{ t("agentCourseSchedule.importExample") }}</pre>
          </div>

          <div class="action-row">
            <button
              class="primary-button"
              :disabled="importing"
              @click="runImport"
            >
              {{ importing ? t("common.working") : t("agentCourseSchedule.importAction") }}
            </button>
          </div>
        </div>
      </article>

      <article class="info-card">
        <div class="panel-head">
          <div>
            <strong>{{ editingEntryId ? t("agentCourseSchedule.editTitle") : t("agentCourseSchedule.createTitle") }}</strong>
            <p class="panel-meta">{{ t("agentCourseSchedule.formCopy") }}</p>
          </div>
        </div>

        <div class="section-stack">
          <label class="field-block">
            <span class="panel-label">{{ t("agentCourseSchedule.courseName") }}</span>
            <input v-model="form.courseName" />
          </label>

          <div class="info-grid">
            <label class="field-block">
              <span class="panel-label">{{ t("agentCourseSchedule.weekdayLabel") }}</span>
              <select v-model="form.weekday">
                <option
                  v-for="weekday in weekdayOptions"
                  :key="weekday"
                  :value="weekday"
                >
                  {{ t(`agentCourseSchedule.weekday.${weekday}`) }}
                </option>
              </select>
            </label>

            <label class="field-block">
              <span class="panel-label">{{ t("agentCourseSchedule.reminderPreset") }}</span>
              <select
                v-model="form.reminderPreset"
                @change="applyPreset(form.reminderPreset)"
              >
                <option
                  v-for="preset in reminderPresetOptions"
                  :key="preset"
                  :value="preset"
                >
                  {{ t(`agentCourseSchedule.preset.${preset}`) }}
                </option>
              </select>
            </label>
          </div>

          <div class="info-grid">
            <label class="field-block">
              <span class="panel-label">{{ t("agentCourseSchedule.startTime") }}</span>
              <input v-model="form.startTime" />
            </label>

            <label class="field-block">
              <span class="panel-label">{{ t("agentCourseSchedule.endTime") }}</span>
              <input v-model="form.endTime" />
            </label>
          </div>

          <label class="field-block">
            <span class="panel-label">{{ t("agentCourseSchedule.location") }}</span>
            <input v-model="form.location" />
          </label>

          <label class="field-block">
            <span class="panel-label">{{ t("agentCourseSchedule.notes") }}</span>
            <textarea
              v-model="notesText"
              rows="4"
            />
          </label>

          <div class="tag-row">
            <label class="checkbox-chip">
              <input v-model="form.nightBeforeReminder" type="checkbox" />
              <span>{{ t("agentCourseSchedule.nightBeforeReminder") }}</span>
            </label>
            <label class="checkbox-chip">
              <input v-model="form.afternoonReminder" type="checkbox" />
              <span>{{ t("agentCourseSchedule.afternoonReminder") }}</span>
            </label>
          </div>

          <div class="action-row">
            <button
              class="primary-button"
              :disabled="saving"
              @click="saveEntry"
            >
              {{ saving ? t("common.saving") : editingEntryId ? t("agentCourseSchedule.saveEntry") : t("agentCourseSchedule.addEntry") }}
            </button>
            <button
              class="secondary-button"
              :disabled="saving"
              @click="resetForm"
            >
              {{ t("agentCourseSchedule.reset") }}
            </button>
          </div>
        </div>
      </article>

      <article class="info-card">
        <div class="panel-head">
          <div>
            <strong>{{ t("agentCourseSchedule.entries") }}</strong>
            <p class="panel-meta">{{ t("agentCourseSchedule.entriesCopy") }}</p>
          </div>
        </div>

        <div
          v-if="!board?.entries.length"
          class="empty-state"
        >
          {{ t("agentCourseSchedule.empty") }}
        </div>

        <div
          v-else
          class="agent-task-grid"
        >
          <article
            v-for="entry in board.entries"
            :key="entry.entryId"
            class="info-card"
          >
            <div class="panel-head">
              <div>
                <strong>{{ entry.courseName }}</strong>
                <p class="panel-meta">
                  {{ t(`agentCourseSchedule.weekday.${entry.weekday}`) }} · {{ entry.startTime }} - {{ entry.endTime }}
                </p>
              </div>
              <span class="chip">{{ t(`agentCourseSchedule.preset.${entry.reminderPreset}`) }}</span>
            </div>

            <div class="tag-row">
              <span class="chip">{{ entry.location || t("agentCourseSchedule.locationTbd") }}</span>
              <span
                v-if="entry.nightBeforeReminder"
                class="chip"
              >
                {{ t("agentCourseSchedule.nightBeforeReminder") }}
              </span>
              <span
                v-if="entry.afternoonReminder"
                class="chip"
              >
                {{ t("agentCourseSchedule.afternoonReminder") }}
              </span>
            </div>

            <ul
              v-if="entry.notes.length"
              class="metric-list"
            >
              <li
                v-for="note in entry.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>

            <p class="panel-meta">{{ t("agentCourseSchedule.updatedAt") }}: {{ formatDateTime(entry.updatedAt) }}</p>

            <div class="action-row">
              <button
                class="secondary-button"
                @click="editEntry(entry)"
              >
                {{ t("agentCourseSchedule.edit") }}
              </button>
              <button
                class="secondary-button danger-button"
                :disabled="deletingEntryId === entry.entryId"
                @click="removeEntry(entry.entryId)"
              >
                {{ deletingEntryId === entry.entryId ? t("common.deleting") : t("agentCourseSchedule.delete") }}
              </button>
            </div>
          </article>
        </div>
      </article>
    </div>
  </section>
</template>
