<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type {
  OpenClawTaskDetail,
  OpenClawTaskEditorInput,
  OpenClawTaskInfo,
  OpenClawTaskRunRecord,
  RuntimeHealth
} from "@clawdesk/shared-types";

import AgentSafeActionsBoard from "../components/AgentSafeActionsBoard.vue";
import AgentCourseScheduleBoard from "../components/AgentCourseScheduleBoard.vue";
import AgentFileWorkspacesBoard from "../components/AgentFileWorkspacesBoard.vue";
import AgentReminderPlansBoard from "../components/AgentReminderPlansBoard.vue";
import AgentStudyRoadmapsBoard from "../components/AgentStudyRoadmapsBoard.vue";
import AgentTaskBoard from "../components/AgentTaskBoard.vue";
import { formatDateTime, formatDurationMs } from "../services/format";
import { useI18n } from "../services/i18n";
import { getCurrentLocale } from "../services/ui-preferences";
import {
  bulkUpdateTasks,
  createTask,
  deleteTask,
  getRuntimeHealth,
  getTaskDetail,
  getTaskRuns,
  getTasks,
  updateTask
} from "../services/runtime-api";
const { t } = useI18n();

type ScheduleKind = "every" | "cron" | "at";
type EditorMode = "create" | "edit";
type PayloadKind = "systemEvent" | "openUrl" | "notify";
type BulkTaskAction = "enable" | "disable" | "delete";

function localText(zh: string, en: string) {
  return getCurrentLocale() === "zh-CN" ? zh : en;
}

interface TaskEditorForm {
  mode: EditorMode;
  taskId: string | null;
  name: string;
  description: string;
  enabled: boolean;
  deleteAfterRun: boolean;
  agentId: string;
  sessionKey: string;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  scheduleKind: ScheduleKind;
  everyMs: string;
  cronExpr: string;
  cronTz: string;
  at: string;
  payloadKind: PayloadKind;
  payloadText: string;
  payloadUrl: string;
  payloadOpenMode: "external" | "relay";
  payloadLabel: string;
  notifyTitle: string;
  notifyBody: string;
  notifyLevel: "info" | "warn" | "error";
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function buildEmptyEditor(mode: EditorMode = "create"): TaskEditorForm {
  return {
    mode,
    taskId: null,
    name: "",
    description: "",
    enabled: true,
    deleteAfterRun: false,
    agentId: "main",
    sessionKey: "",
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    scheduleKind: "every",
    everyMs: "3600000",
    cronExpr: "0 * * * *",
    cronTz: "Asia/Shanghai",
    at: "",
    payloadKind: "systemEvent",
    payloadText: "",
    payloadUrl: "https://example.com",
    payloadOpenMode: "external",
    payloadLabel: "",
    notifyTitle: "",
    notifyBody: "",
    notifyLevel: "info"
  };
}

function deriveEditorFromTask(detail: OpenClawTaskDetail, mode: EditorMode = "edit") {
  const raw = toRecord(detail.rawJson) ?? {};
  const schedule = toRecord(raw.schedule);
  const payload = toRecord(raw.payload);
  const scheduleKind = schedule?.kind;
  const payloadKind = payload?.kind;

  if (payloadKind && payloadKind !== "systemEvent" && payloadKind !== "openUrl" && payloadKind !== "notify") {
    return {
      form: null,
      reason: t("tasks.unsupportedPayload", { kind: String(payloadKind) })
    };
  }

  if (scheduleKind !== "every" && scheduleKind !== "cron" && scheduleKind !== "at") {
    return {
      form: null,
      reason: t("tasks.unsupportedSchedule", { kind: String(scheduleKind ?? "unknown") })
    };
  }

  const nextForm = buildEmptyEditor(mode);
  nextForm.taskId = mode === "edit" ? detail.task.id : null;
  nextForm.name = mode === "edit" ? detail.task.name : `${detail.task.name} copy`;
  nextForm.description = detail.task.description ?? "";
  nextForm.enabled = detail.task.enabled;
  nextForm.deleteAfterRun = detail.task.deleteAfterRun;
  nextForm.agentId = typeof raw.agentId === "string" ? raw.agentId : detail.task.agentId ?? "main";
  nextForm.sessionKey = typeof raw.sessionKey === "string" ? raw.sessionKey : detail.task.sessionKey ?? "";
  nextForm.sessionTarget = raw.sessionTarget === "isolated" ? "isolated" : "main";
  nextForm.wakeMode = raw.wakeMode === "now" ? "now" : "next-heartbeat";
  nextForm.scheduleKind = scheduleKind;
  nextForm.everyMs =
    scheduleKind === "every" && typeof schedule?.everyMs === "number"
      ? String(schedule.everyMs)
      : nextForm.everyMs;
  nextForm.cronExpr =
    scheduleKind === "cron" && typeof schedule?.expr === "string"
      ? schedule.expr
      : nextForm.cronExpr;
  nextForm.cronTz =
    scheduleKind === "cron" && typeof schedule?.tz === "string"
      ? schedule.tz
      : nextForm.cronTz;
  nextForm.at =
    scheduleKind === "at"
      ? toDatetimeLocalValue(typeof schedule?.at === "string" ? schedule.at : detail.task.nextRunAt)
      : "";
  nextForm.payloadKind = payloadKind === "openUrl" || payloadKind === "notify" ? payloadKind : "systemEvent";
  nextForm.payloadText = typeof payload?.text === "string" ? payload.text : "";
  nextForm.payloadUrl = typeof payload?.url === "string" ? payload.url : nextForm.payloadUrl;
  nextForm.payloadOpenMode = payload?.openMode === "relay" ? "relay" : "external";
  nextForm.payloadLabel = typeof payload?.label === "string" ? payload.label : "";
  nextForm.notifyTitle = typeof payload?.title === "string" ? payload.title : "";
  nextForm.notifyBody = typeof payload?.body === "string" ? payload.body : "";
  nextForm.notifyLevel =
    payload?.level === "warn" || payload?.level === "error" ? payload.level : "info";

  return {
    form: nextForm,
    reason: ""
  };
}

function buildEditorInput(form: TaskEditorForm): OpenClawTaskEditorInput {
  const name = form.name.trim();
  if (!name) {
    throw new Error(t("tasks.taskNameRequired"));
  }

  let schedule: OpenClawTaskEditorInput["schedule"];
  if (form.scheduleKind === "every") {
    const everyMs = Number.parseInt(form.everyMs, 10);
    if (!Number.isFinite(everyMs) || everyMs < 1000) {
      throw new Error(t("tasks.everyMin"));
    }

    schedule = {
      kind: "every",
      everyMs
    };
  } else if (form.scheduleKind === "cron") {
    const expr = form.cronExpr.trim();
    if (!expr) {
      throw new Error(t("tasks.cronRequired"));
    }

    schedule = {
      kind: "cron",
      expr,
      tz: form.cronTz.trim() || null
    };
  } else {
    const at = form.at.trim();
    if (!at) {
      throw new Error(t("tasks.runAtRequired"));
    }

    const timestamp = Date.parse(at);
    if (Number.isNaN(timestamp)) {
      throw new Error(t("tasks.runAtInvalid"));
    }

    schedule = {
      kind: "at",
      at: new Date(timestamp).toISOString()
    };
  }

  let payload: OpenClawTaskEditorInput["payload"];
  if (form.payloadKind === "systemEvent") {
    const payloadText = form.payloadText.trim();
    if (!payloadText) {
      throw new Error(t("tasks.payloadRequired"));
    }

    payload = {
      kind: "systemEvent",
      text: payloadText
    };
  } else if (form.payloadKind === "openUrl") {
    const payloadUrl = form.payloadUrl.trim();
    if (!payloadUrl) {
      throw new Error(t("tasks.payloadUrlRequired"));
    }

    payload = {
      kind: "openUrl",
      url: payloadUrl,
      openMode: form.payloadOpenMode,
      label: form.payloadLabel.trim() || null
    };
  } else {
    const notifyTitle = form.notifyTitle.trim();
    const notifyBody = form.notifyBody.trim();
    if (!notifyTitle) {
      throw new Error(t("tasks.notifyTitleRequired"));
    }

    if (!notifyBody) {
      throw new Error(t("tasks.notifyBodyRequired"));
    }

    payload = {
      kind: "notify",
      title: notifyTitle,
      body: notifyBody,
      level: form.notifyLevel
    };
  }

  return {
    name,
    description: form.description.trim() || null,
    enabled: form.enabled,
    deleteAfterRun: form.deleteAfterRun,
    agentId: form.agentId.trim() || null,
    sessionKey: form.sessionKey.trim() || null,
    sessionTarget: form.sessionTarget,
    wakeMode: form.wakeMode,
    schedule,
    payload
  };
}

const health = ref<RuntimeHealth | null>(null);
const tasks = ref<OpenClawTaskInfo[]>([]);
const selectedTaskIds = ref<string[]>([]);
const selectedTask = ref<OpenClawTaskDetail | null>(null);
const taskRuns = ref<OpenClawTaskRunRecord[]>([]);
const editor = ref<TaskEditorForm>(buildEmptyEditor());
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const deleting = ref(false);
const error = ref("");
const editorMessage = ref("");
const saveMessage = ref("");

const enabledTaskCount = computed(() => tasks.value.filter((task) => task.enabled).length);
const errorTaskCount = computed(() => tasks.value.filter((task) => task.lastRunStatus === "error").length);
const runningTaskCount = computed(() => tasks.value.filter((task) => Boolean(task.runningAt)).length);
const selectedTaskCount = computed(() => selectedTaskIds.value.length);
const allVisibleSelected = computed(
  () => tasks.value.length > 0 && tasks.value.every((task) => selectedTaskIds.value.includes(task.id))
);
const selectedTaskId = computed(() => selectedTask.value?.task.id ?? null);
const isEditingExisting = computed(() => editor.value.mode === "edit" && Boolean(editor.value.taskId));
const actionBusy = computed(() => saving.value || deleting.value);
const editorHeadline = computed(() => (isEditingExisting.value ? t("tasks.editBasicTask") : t("tasks.createBasicTask")));
const taskCenterGuide = computed(() => [
  localText("先看上面的 Agent 看板，它们是面向答辩和日常使用的主流程。", "Start with the Agent boards above. They are the primary flow for demo and daily use."),
  localText("需要沉淀提醒、学习计划、文件整理时，优先从安全动作继续往下走。", "When you want to keep reminders, study plans, or file work, continue from safe actions."),
  localText("下面的 Basic Task 区域保留给 OpenClaw cron 兼容能力。", "The Basic Task section below is retained for OpenClaw cron compatibility.")
]);
const taskCenterFocus = computed(() => {
  if (tasks.value.length === 0) {
    return {
      title: localText("当前以 Agent 工作台为主", "The Agent workspace is the current primary flow"),
      copy: localText("如果你只是演示产品主线，可以先看任务卡、安全动作、提醒计划和学习路线图。", "If you are demonstrating the main story, focus on task cards, safe actions, reminder plans, and study roadmaps first.")
    };
  }

  return {
    title: localText("Agent 工作台 + 兼容自动化并存", "Agent workspace and compatibility automation are both available"),
    copy: localText("上半区负责用户可读任务，下半区保留 legacy cron 编辑能力，适合展示技术延续性。", "The top half is for user-readable agent work. The lower half keeps legacy cron editing for compatibility.")
  };
});
const scheduleHelp = computed(() => {
  if (editor.value.scheduleKind === "every") {
    return t("tasks.repeatByInterval");
  }

  if (editor.value.scheduleKind === "cron") {
    return t("tasks.useCron");
  }

  return t("tasks.useLocalTime");
});
const payloadHelp = computed(() => {
  if (editor.value.payloadKind === "systemEvent") {
    return t("tasks.payloadHelpSystemEvent");
  }

  if (editor.value.payloadKind === "openUrl") {
    return t("tasks.payloadHelpOpenUrl");
  }

  return t("tasks.payloadHelpNotify");
});

async function loadTaskSelection(taskId: string) {
  detailLoading.value = true;
  error.value = "";

  try {
    const [detail, runs] = await Promise.all([getTaskDetail(taskId), getTaskRuns(taskId, 20)]);
    selectedTask.value = detail;
    taskRuns.value = runs;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("tasks.failedDetail", { message });
  } finally {
    detailLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const [nextHealth, nextTasks] = await Promise.all([getRuntimeHealth(), getTasks()]);
    health.value = nextHealth;
    tasks.value = nextTasks;
    selectedTaskIds.value = selectedTaskIds.value.filter((taskId) => nextTasks.some((task) => task.id === taskId));

    if (selectedTask.value) {
      const stillExists = nextTasks.find((task) => task.id === selectedTask.value?.task.id);
      if (stillExists) {
        await loadTaskSelection(stillExists.id);
      } else {
        selectedTask.value = null;
        taskRuns.value = [];

        if (editor.value.mode === "edit") {
          editor.value = buildEmptyEditor("create");
        }
      }
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("tasks.failedTaskData", { message });
  } finally {
    loading.value = false;
  }
}

async function selectTask(task: OpenClawTaskInfo) {
  saveMessage.value = "";
  editorMessage.value = "";
  await loadTaskSelection(task.id);
}

function setTaskChecked(taskId: string, checked: boolean) {
  if (checked) {
    if (!selectedTaskIds.value.includes(taskId)) {
      selectedTaskIds.value = [...selectedTaskIds.value, taskId];
    }
    return;
  }

  selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== taskId);
}

function toggleAllVisibleTasks(checked: boolean) {
  selectedTaskIds.value = checked ? tasks.value.map((task) => task.id) : [];
}

function handleVisibleSelectionChange(event: Event) {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
  toggleAllVisibleTasks(checked);
}

function handleTaskSelectionChange(taskId: string, event: Event) {
  const checked = (event.target as HTMLInputElement | null)?.checked ?? false;
  setTaskChecked(taskId, checked);
}

function startCreateTask() {
  editor.value = buildEmptyEditor("create");
  editorMessage.value = t("tasks.creatingDraft");
  saveMessage.value = "";
}

function startEditSelectedTask() {
  if (!selectedTask.value) {
    editorMessage.value = t("tasks.editNeedSelection");
    return;
  }

  const derived = deriveEditorFromTask(selectedTask.value, "edit");
  if (!derived.form) {
    editorMessage.value = derived.reason;
    return;
  }

  editor.value = derived.form;
  editorMessage.value = t("tasks.editingSelected");
  saveMessage.value = "";
}

function duplicateSelectedTask() {
  if (!selectedTask.value) {
    editorMessage.value = t("tasks.duplicateNeedSelection");
    return;
  }

  const derived = deriveEditorFromTask(selectedTask.value, "create");
  if (!derived.form) {
    editorMessage.value = derived.reason;
    return;
  }

  editor.value = derived.form;
  editorMessage.value = t("tasks.duplicatingSelected");
  saveMessage.value = "";
}

function resetEditor() {
  if (editor.value.mode === "edit" && selectedTask.value && editor.value.taskId === selectedTask.value.task.id) {
    const derived = deriveEditorFromTask(selectedTask.value, "edit");
    if (derived.form) {
      editor.value = derived.form;
      editorMessage.value = t("tasks.resetToSelected");
      return;
    }
  }

  startCreateTask();
}

function applySchedulePreset(preset: "every-5m" | "every-1h" | "cron-daily-9" | "at-10m") {
  if (preset === "every-5m") {
    editor.value.scheduleKind = "every";
    editor.value.everyMs = "300000";
    editorMessage.value = t("tasks.presetEvery5m");
    return;
  }

  if (preset === "every-1h") {
    editor.value.scheduleKind = "every";
    editor.value.everyMs = "3600000";
    editorMessage.value = t("tasks.presetEvery1h");
    return;
  }

  if (preset === "cron-daily-9") {
    editor.value.scheduleKind = "cron";
    editor.value.cronExpr = "0 9 * * *";
    editor.value.cronTz = "Asia/Shanghai";
    editorMessage.value = t("tasks.presetDaily9");
    return;
  }

  editor.value.scheduleKind = "at";
  editor.value.at = toDatetimeLocalValue(new Date(Date.now() + 10 * 60 * 1000).toISOString());
  editorMessage.value = t("tasks.presetOnce10m");
}

async function saveTask() {
  saving.value = true;
  editorMessage.value = "";
  saveMessage.value = "";
  const saveMode = editor.value.mode;

  try {
    const payload = buildEditorInput(editor.value);
    const detail =
      editor.value.mode === "edit" && editor.value.taskId
        ? await updateTask(editor.value.taskId, payload)
        : await createTask(payload);

    selectedTask.value = detail;
    taskRuns.value = detail.recentRuns;
    await load();

    const derived = deriveEditorFromTask(detail, "edit");
    if (derived.form) {
      editor.value = derived.form;
    }

    saveMessage.value =
      saveMode === "edit"
        ? t("tasks.taskUpdated", { name: detail.task.name })
        : t("tasks.taskCreated", { name: detail.task.name });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    editorMessage.value = t("tasks.failedSave", { message });
  } finally {
    saving.value = false;
  }
}

async function deleteSelectedTask() {
  if (!selectedTask.value) {
    editorMessage.value = "Select a task before deleting.";
    return;
  }

  const taskId = selectedTask.value.task.id;
  const taskName = selectedTask.value.task.name;
  const confirmed = window.confirm(t("tasks.deleteConfirm", { name: taskName }));
  if (!confirmed) {
    return;
  }

  deleting.value = true;
  error.value = "";
  editorMessage.value = "";
  saveMessage.value = "";

  try {
    const result = await deleteTask(taskId);
    selectedTask.value = null;
    taskRuns.value = [];
    selectedTaskIds.value = selectedTaskIds.value.filter((id) => id !== taskId);

    if (editor.value.taskId === taskId) {
      editor.value = buildEmptyEditor("create");
    }

    await load();
    saveMessage.value = result.runLogDeleted
      ? t("tasks.taskDeletedWithRunLog", { name: result.taskName })
      : t("tasks.taskDeleted", { name: result.taskName });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("tasks.failedDelete", { message });
  } finally {
    deleting.value = false;
  }
}

async function runBulkTaskAction(action: BulkTaskAction) {
  if (selectedTaskIds.value.length === 0) {
    editorMessage.value = t("tasks.bulkNeedSelection");
    return;
  }

  if (action === "delete") {
    const confirmed = window.confirm(
      t("tasks.bulkDeleteConfirm", {
        count: selectedTaskIds.value.length
      })
    );
    if (!confirmed) {
      return;
    }
  }

  saving.value = true;
  error.value = "";
  editorMessage.value = "";
  saveMessage.value = "";

  try {
    const result = await bulkUpdateTasks(action, selectedTaskIds.value);
    if (action === "delete") {
      selectedTask.value = null;
      taskRuns.value = [];
      if (editor.value.taskId && result.taskIds.includes(editor.value.taskId)) {
        editor.value = buildEmptyEditor("create");
      }
      selectedTaskIds.value = [];
    }

    await load();

    if (action === "enable") {
      saveMessage.value = t("tasks.bulkEnabled", { count: result.affectedCount });
    } else if (action === "disable") {
      saveMessage.value = t("tasks.bulkDisabled", { count: result.affectedCount });
    } else {
      saveMessage.value = t("tasks.bulkDeleted", {
        count: result.affectedCount
      });
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("tasks.failedBulkAction", { message });
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("tasks.eyebrow") }}</p>
        <h2>{{ t("tasks.title") }}</h2>
        <p class="page-copy">
          {{ t("tasks.copy") }}
        </p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("tasks.refreshTasks") }}
        </button>
        <button
          class="secondary-button"
          :disabled="actionBusy"
          @click="startCreateTask"
        >
          {{ t("tasks.newBasicTask") }}
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
      v-if="editorMessage"
      class="status-banner status-error"
    >
      {{ editorMessage }}
    </section>

    <section
      v-if="saveMessage"
      class="status-banner"
    >
      {{ saveMessage }}
    </section>

    <section class="info-grid">
      <article class="info-card">
        <strong>{{ localText("Task Center 使用顺序", "How to use Task Center") }}</strong>
        <ul class="metric-list compact-list">
          <li
            v-for="step in taskCenterGuide"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </article>

      <article class="info-card">
        <strong>{{ localText("当前重点", "Current focus") }}</strong>
        <p>{{ taskCenterFocus.title }}</p>
        <p class="panel-meta">{{ taskCenterFocus.copy }}</p>
      </article>

      <article class="info-card">
        <strong>{{ localText("推荐演示顺序", "Recommended demo order") }}</strong>
        <div class="tag-row">
          <span class="chip">Task cards</span>
          <span class="chip">Safe actions</span>
          <span class="chip">Reminder plans</span>
          <span class="chip">Study roadmaps</span>
          <span class="chip">File workspace</span>
        </div>
        <p class="panel-meta">
          {{ localText("如果要展示兼容能力，再切到 Basic Task 编辑器。", "Switch to the Basic Task editor only when you want to show compatibility support.") }}
        </p>
      </article>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Agent workspace", "Agent workspace") }}</p>
      <h3>{{ localText("先展示用户能理解的任务结果", "Start with user-readable task outcomes") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "这一层聚焦在聊天结果如何变成任务卡、提醒计划、学习路线图和文件工作台，更适合毕业设计演示。",
            "This layer shows how chat results become task cards, reminder plans, study roadmaps, and file workspaces. It is the best entry point for the graduation demo."
          )
        }}
      </p>
    </section>

    <AgentTaskBoard />
    <AgentSafeActionsBoard />
    <AgentFileWorkspacesBoard />
    <AgentCourseScheduleBoard />
    <AgentReminderPlansBoard />
    <AgentStudyRoadmapsBoard />

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("tasks.runtime") }}</p>
        <h2>{{ health?.status ?? "--" }}</h2>
        <p class="panel-meta">{{ t("tasks.collector") }}: {{ health?.collectorStatus ?? "--" }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("tasks.totalTasks") }}</p>
        <h2>{{ tasks.length }}</h2>
        <p class="panel-meta">{{ t("tasks.legacyCronEntries") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("tasks.enabled") }}</p>
        <h2>{{ enabledTaskCount }}</h2>
        <p class="panel-meta">{{ t("tasks.currentlyActive") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("tasks.failuresRunning") }}</p>
        <h2>{{ errorTaskCount }} / {{ runningTaskCount }}</h2>
        <p class="panel-meta">{{ t("tasks.recentErrorsRunning") }}</p>
      </article>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Compatibility tools", "Compatibility tools") }}</p>
      <h3>{{ localText("保留 legacy cron 编辑与运行记录", "Keep legacy cron editing and run history") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "这里继续保留 OpenClaw 的基础任务能力，帮助你说明系统不是全新重做，而是在兼容层上持续演进。",
            "This section keeps the OpenClaw-style basic task capability so you can explain that the system evolves from the compatibility layer instead of replacing it outright."
          )
        }}
      </p>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("tasks.taskDefinitions") }}</p>
            <h3>{{ t("tasks.bulkSelection", { count: selectedTaskCount }) }}</h3>
          </div>
          <span class="chip">{{ selectedTaskCount }}</span>
        </div>
        <div
          v-if="tasks.length > 0"
          class="action-row"
        >
          <label class="checkbox-field">
            <input
              :checked="allVisibleSelected"
              type="checkbox"
              @change="handleVisibleSelectionChange"
            >
            <span>{{ t("tasks.selectAllVisible") }}</span>
          </label>
          <button
            class="secondary-button"
            :disabled="actionBusy || selectedTaskCount === 0"
            @click="runBulkTaskAction('enable')"
          >
            {{ t("tasks.enableSelected") }}
          </button>
          <button
            class="secondary-button"
            :disabled="actionBusy || selectedTaskCount === 0"
            @click="runBulkTaskAction('disable')"
          >
            {{ t("tasks.disableSelected") }}
          </button>
          <button
            class="danger-button"
            :disabled="actionBusy || selectedTaskCount === 0"
            @click="runBulkTaskAction('delete')"
          >
            {{ t("tasks.deleteSelectedBulk") }}
          </button>
        </div>
        <div
          v-if="tasks.length === 0"
          class="empty-state"
        >
          {{ t("tasks.noTasksDefined") }}
        </div>
        <div
          v-else
          class="table-wrap"
        >
          <table class="data-table">
            <thead>
              <tr>
                <th>{{ t("tasks.select") }}</th>
                <th>ID</th>
                <th>{{ t("tasks.name") }}</th>
                <th>Type</th>
                <th>{{ t("tasks.schedule") }}</th>
                <th>{{ t("tasks.enabled") }}</th>
                <th>{{ t("tasks.lastRun") }}</th>
                <th>{{ t("sessions.status") }}</th>
                <th>{{ t("tasks.nextRun") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in tasks"
                :key="task.id"
                class="click-row"
                :class="{ 'active-row': task.id === selectedTaskId }"
                @click="selectTask(task)"
              >
                <td @click.stop>
                  <input
                    :checked="selectedTaskIds.includes(task.id)"
                    type="checkbox"
                    @change="handleTaskSelectionChange(task.id, $event)"
                  >
                </td>
                <td>{{ task.id }}</td>
                <td>{{ task.name }}</td>
                <td>{{ task.type }}</td>
                <td>{{ task.scheduleKind ?? "--" }}</td>
                <td>{{ task.enabled ? "yes" : "no" }}</td>
                <td>{{ formatDateTime(task.lastRunAt) }}</td>
                <td>{{ task.lastRunStatus ?? "--" }}</td>
                <td>{{ formatDateTime(task.nextRunAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("tasks.selectedTask") }}</p>
            <h3>{{ selectedTask?.task.name ?? t("tasks.noTaskSelected") }}</h3>
          </div>
          <span class="chip">{{ detailLoading ? t("common.loading") : t("common.current") }}</span>
        </div>

        <div
          v-if="!selectedTask"
          class="empty-state"
        >
          {{ t("tasks.selectTask") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("tasks.taskId") }}</dt>
              <dd>{{ selectedTask.task.id }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.name") }}</dt>
              <dd>{{ selectedTask.task.name }}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{{ selectedTask.task.type }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.schedule") }}</dt>
              <dd>{{ selectedTask.task.scheduleKind ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.enabled") }}</dt>
              <dd>{{ selectedTask.task.enabled ? t("common.yes") : t("common.no") }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.deleteAfterRun") }}</dt>
              <dd>{{ selectedTask.task.deleteAfterRun ? t("common.yes") : t("common.no") }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.agentId") }}</dt>
              <dd>{{ selectedTask.task.agentId ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.sessionKey") }}</dt>
              <dd>{{ selectedTask.task.sessionKey ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.nextRun") }}</dt>
              <dd>{{ formatDateTime(selectedTask.state.nextRunAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.runningAt") }}</dt>
              <dd>{{ formatDateTime(selectedTask.state.runningAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.lastRun") }}</dt>
              <dd>{{ formatDateTime(selectedTask.state.lastRunAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.lastStatus") }}</dt>
              <dd>{{ selectedTask.state.lastRunStatus ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.lastDuration") }}</dt>
              <dd>{{ formatDurationMs(selectedTask.state.lastDurationMs) }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.delivery") }}</dt>
              <dd>{{ selectedTask.state.lastDeliveryStatus ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.consecutiveErrors") }}</dt>
              <dd>{{ selectedTask.state.consecutiveErrors }}</dd>
            </div>
            <div>
              <dt>{{ t("tasks.failureAlert") }}</dt>
              <dd>{{ formatDateTime(selectedTask.state.lastFailureAlertAt) }}</dd>
            </div>
          </dl>

          <p class="panel-meta">{{ selectedTask.state.lastError ?? t("tasks.noRecordedTaskError") }}</p>
          <p class="panel-meta">{{ t("tasks.runLog") }}: {{ selectedTask.runLogAvailable ? selectedTask.runLogPath : t("tasks.noRunLogFile") }}</p>

          <div class="action-row">
            <button
              class="secondary-button"
              :disabled="detailLoading || actionBusy"
              @click="void loadTaskSelection(selectedTask.task.id)"
            >
              {{ detailLoading ? t("common.refreshing") : t("tasks.refreshDetail") }}
            </button>
            <button
              class="secondary-button"
              :disabled="actionBusy"
              @click="startEditSelectedTask"
            >
              {{ t("tasks.editSelectedTask") }}
            </button>
            <button
              class="secondary-button"
              :disabled="actionBusy"
              @click="duplicateSelectedTask"
            >
              {{ t("tasks.duplicateIntoEditor") }}
            </button>
            <button
              class="danger-button"
              :disabled="actionBusy"
              @click="deleteSelectedTask"
            >
              {{ deleting ? t("common.deleting") : t("tasks.deleteSelectedTask") }}
            </button>
          </div>

          <div class="section-stack">
            <div>
              <p class="panel-label">{{ t("tasks.recentRuns") }}</p>
              <div
                v-if="taskRuns.length === 0"
                class="empty-state"
              >
                {{ t("tasks.noTaskRunRecords") }}
              </div>
              <div
                v-else
                class="table-wrap"
              >
                <table class="data-table compact-table">
                  <thead>
                    <tr>
                      <th>{{ t("logs.time") }}</th>
                      <th>{{ t("sessions.status") }}</th>
                      <th>{{ t("tasks.delivery") }}</th>
                      <th>{{ t("tasks.lastDuration") }}</th>
                      <th>Model</th>
                      <th>Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="run in taskRuns"
                      :key="`${run.ts ?? 'no-ts'}-${run.action}-${run.summary ?? run.error ?? 'entry'}`"
                    >
                      <td>{{ formatDateTime(run.ts ?? run.runAt) }}</td>
                      <td>{{ run.status ?? "--" }}</td>
                      <td>{{ run.deliveryStatus ?? "--" }}</td>
                      <td>{{ formatDurationMs(run.durationMs) }}</td>
                      <td>{{ run.provider ?? "--" }} / {{ run.model ?? "--" }}</td>
                      <td>{{ run.summary ?? run.error ?? "--" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p class="panel-label">{{ t("tasks.rawDefinition") }}</p>
              <pre class="log-tail">{{ JSON.stringify(selectedTask.rawJson, null, 2) }}</pre>
            </div>
          </div>
        </template>
      </article>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("tasks.taskEditor") }}</p>
          <h3>{{ editorHeadline }}</h3>
        </div>
        <span class="chip">{{ editor.mode }}</span>
      </div>

      <div class="form-grid">
        <label
          v-if="isEditingExisting"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.taskId") }}</span>
          <input
            :value="editor.taskId ?? '--'"
            class="text-input text-input-block"
            readonly
          >
        </label>

        <label class="form-field">
          <span>{{ t("tasks.name") }}</span>
          <input
            v-model="editor.name"
            class="text-input text-input-block"
            :placeholder="t('tasks.hourlyHealthPing')"
          >
        </label>

        <label class="form-field">
          <span>{{ t("tasks.agentId") }}</span>
          <input
            v-model="editor.agentId"
            class="text-input text-input-block"
            placeholder="main"
          >
        </label>

        <label class="form-field form-field-wide">
          <span>{{ t("tasks.description") }}</span>
          <input
            v-model="editor.description"
            class="text-input text-input-block"
            :placeholder="t('tasks.descriptionPlaceholder')"
          >
        </label>

        <label class="form-field">
          <span>{{ t("tasks.sessionKey") }}</span>
          <input
            v-model="editor.sessionKey"
            class="text-input text-input-block"
            :placeholder="t('tasks.optionalSessionKey')"
          >
        </label>

        <label class="form-field">
          <span>{{ t("tasks.sessionTarget") }}</span>
          <select
            v-model="editor.sessionTarget"
            class="text-input text-input-block"
          >
            <option value="main">
              main
            </option>
            <option value="isolated">
              isolated
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t("tasks.wakeMode") }}</span>
          <select
            v-model="editor.wakeMode"
            class="text-input text-input-block"
          >
            <option value="next-heartbeat">
              next-heartbeat
            </option>
            <option value="now">
              now
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t("tasks.scheduleKind") }}</span>
          <select
            v-model="editor.scheduleKind"
            class="text-input text-input-block"
          >
            <option value="every">
              every
            </option>
            <option value="cron">
              cron
            </option>
            <option value="at">
              at
            </option>
          </select>
        </label>

        <div class="form-field form-field-wide">
          <span>{{ t("tasks.scheduleTemplates") }}</span>
          <div class="action-row">
            <button
              class="secondary-button"
              type="button"
              @click="applySchedulePreset('every-5m')"
            >
              {{ t("tasks.presetEvery5mShort") }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="applySchedulePreset('every-1h')"
            >
              {{ t("tasks.presetEvery1hShort") }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="applySchedulePreset('cron-daily-9')"
            >
              {{ t("tasks.presetDaily9Short") }}
            </button>
            <button
              class="secondary-button"
              type="button"
              @click="applySchedulePreset('at-10m')"
            >
              {{ t("tasks.presetOnce10mShort") }}
            </button>
          </div>
        </div>

        <label
          v-if="editor.scheduleKind === 'every'"
          class="form-field"
        >
          <span>{{ t("tasks.everyMs") }}</span>
          <input
            v-model="editor.everyMs"
            class="text-input text-input-block"
            type="number"
            min="1000"
            step="1000"
            placeholder="3600000"
          >
        </label>

        <label
          v-if="editor.scheduleKind === 'cron'"
          class="form-field"
        >
          <span>{{ t("tasks.cronExpr") }}</span>
          <input
            v-model="editor.cronExpr"
            class="text-input text-input-block"
            placeholder="0 * * * *"
          >
        </label>

        <label
          v-if="editor.scheduleKind === 'cron'"
          class="form-field"
        >
          <span>{{ t("tasks.cronTz") }}</span>
          <input
            v-model="editor.cronTz"
            class="text-input text-input-block"
            placeholder="Asia/Shanghai"
          >
        </label>

        <label
          v-if="editor.scheduleKind === 'at'"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.runAt") }}</span>
          <input
            v-model="editor.at"
            class="text-input text-input-block"
            type="datetime-local"
          >
        </label>

        <label class="form-field">
          <span>{{ t("tasks.payloadKind") }}</span>
          <select
            v-model="editor.payloadKind"
            class="text-input text-input-block"
          >
            <option value="systemEvent">
              systemEvent
            </option>
            <option value="openUrl">
              openUrl
            </option>
            <option value="notify">
              notify
            </option>
          </select>
        </label>

        <label
          v-if="editor.payloadKind === 'openUrl'"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.payloadUrl") }}</span>
          <input
            v-model="editor.payloadUrl"
            class="text-input text-input-block"
            placeholder="https://example.com"
          >
        </label>

        <label
          v-if="editor.payloadKind === 'openUrl'"
          class="form-field"
        >
          <span>{{ t("tasks.openMode") }}</span>
          <select
            v-model="editor.payloadOpenMode"
            class="text-input text-input-block"
          >
            <option value="external">
              external
            </option>
            <option value="relay">
              relay
            </option>
          </select>
        </label>

        <label
          v-if="editor.payloadKind === 'openUrl'"
          class="form-field"
        >
          <span>{{ t("tasks.payloadLabel") }}</span>
          <input
            v-model="editor.payloadLabel"
            class="text-input text-input-block"
            :placeholder="t('tasks.payloadLabelPlaceholder')"
          >
        </label>

        <label
          v-if="editor.payloadKind === 'notify'"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.notifyTitle") }}</span>
          <input
            v-model="editor.notifyTitle"
            class="text-input text-input-block"
            :placeholder="t('tasks.notifyTitlePlaceholder')"
          >
        </label>

        <label
          v-if="editor.payloadKind === 'notify'"
          class="form-field"
        >
          <span>{{ t("tasks.notifyLevel") }}</span>
          <select
            v-model="editor.notifyLevel"
            class="text-input text-input-block"
          >
            <option value="info">
              info
            </option>
            <option value="warn">
              warn
            </option>
            <option value="error">
              error
            </option>
          </select>
        </label>

        <label
          v-if="editor.payloadKind === 'notify'"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.notifyBody") }}</span>
          <textarea
            v-model="editor.notifyBody"
            class="text-area"
            rows="4"
            :placeholder="t('tasks.notifyBodyPlaceholder')"
          />
        </label>

        <label
          v-if="editor.payloadKind === 'systemEvent'"
          class="form-field form-field-wide"
        >
          <span>{{ t("tasks.payloadText") }}</span>
          <textarea
            v-model="editor.payloadText"
            class="text-area"
            rows="5"
            :placeholder="t('tasks.payloadPlaceholder')"
          />
        </label>
        <label class="checkbox-field">
          <input
            v-model="editor.enabled"
            type="checkbox"
          >
          <span>{{ t("tasks.enabled") }}</span>
        </label>

        <label class="checkbox-field">
          <input
            v-model="editor.deleteAfterRun"
            type="checkbox"
          >
          <span>{{ t("tasks.deleteAfterRun") }}</span>
        </label>
      </div>

      <p class="panel-meta">{{ scheduleHelp }}</p>
      <p class="panel-meta">{{ payloadHelp }}</p>

      <div class="action-row">
        <button
          class="primary-button"
          :disabled="actionBusy"
          @click="saveTask"
        >
          {{ saving ? t("common.saving") : isEditingExisting ? t("tasks.saveTask") : t("tasks.createTask") }}
        </button>
        <button
          class="secondary-button"
          :disabled="actionBusy"
          @click="resetEditor"
        >
          {{ t("tasks.resetEditor") }}
        </button>
        <button
          class="secondary-button"
          :disabled="actionBusy || !selectedTask"
          @click="duplicateSelectedTask"
        >
          {{ t("tasks.duplicateSelected") }}
        </button>
      </div>
    </section>
  </section>
</template>
