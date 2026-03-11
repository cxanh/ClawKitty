<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import type { ActivityFeedItem, ActivityFeedPayload, ApprovalActionType } from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getCurrentLocale } from "../services/ui-preferences";
import { getActivityFeed, getActivityFeedItem } from "../services/runtime-api";

const { t } = useI18n();
type ActivityCategory = "all" | "agent" | "approval" | "reminder" | "files" | "system";

const loading = ref(true);
const detailLoading = ref(false);
const error = ref("");
const feed = ref<ActivityFeedPayload | null>(null);
const selectedActivity = ref<ActivityFeedItem | null>(null);
const activeCategory = ref<ActivityCategory>("all");

function localText(zh: string, en: string) {
  return getCurrentLocale() === "zh-CN" ? zh : en;
}

const total = computed(() => feed.value?.total ?? 0);

function getCategory(item: ActivityFeedItem): ActivityCategory {
  if (item.kind.startsWith("approval-request-")) {
    return "approval";
  }

  if (
    item.kind.includes("reminder") ||
    item.kind.includes("course-schedule")
  ) {
    return "reminder";
  }

  if (item.kind.includes("file-workspace")) {
    return "files";
  }

  if (
    item.kind.startsWith("chat-") ||
    item.kind.startsWith("agent-task-") ||
    item.kind.startsWith("agent-safe-action-") ||
    item.kind.startsWith("agent-study-roadmap-")
  ) {
    return "agent";
  }

  return "system";
}

const allItems = computed(() => feed.value?.items ?? []);
const filteredItems = computed(() =>
  activeCategory.value === "all"
    ? allItems.value
    : allItems.value.filter((item) => getCategory(item) === activeCategory.value)
);
const latestKind = computed(
  () => selectedActivity.value?.kind ?? filteredItems.value[0]?.kind ?? allItems.value[0]?.kind ?? "--"
);
const categoryOptions = computed(() => [
  {
    id: "all" as const,
    label: localText("全部", "All"),
    count: allItems.value.length
  },
  {
    id: "agent" as const,
    label: localText("Agent", "Agent"),
    count: allItems.value.filter((item) => getCategory(item) === "agent").length
  },
  {
    id: "approval" as const,
    label: localText("审批", "Approvals"),
    count: allItems.value.filter((item) => getCategory(item) === "approval").length
  },
  {
    id: "reminder" as const,
    label: localText("提醒", "Reminders"),
    count: allItems.value.filter((item) => getCategory(item) === "reminder").length
  },
  {
    id: "files" as const,
    label: localText("文件", "Files"),
    count: allItems.value.filter((item) => getCategory(item) === "files").length
  },
  {
    id: "system" as const,
    label: localText("系统", "System"),
    count: allItems.value.filter((item) => getCategory(item) === "system").length
  }
]);
const activityGuide = computed(() => [
  localText("先看 Agent 事件，说明用户发起了什么。", "Start with Agent events to explain what the user asked for."),
  localText("再看提醒、文件或审批事件，说明系统具体往下做了什么。", "Then switch to reminder, file, or approval events to explain what the system did next."),
  localText("最后点开详情，展示结果透明、可追溯。", "Open the detail panel last to show that the workflow is transparent and traceable.")
]);

function getApprovalMeta(item: ActivityFeedItem | null) {
  if (!item || !item.kind.startsWith("approval-request-")) {
    return null;
  }

  const metadata = item.metadata ?? {};
  const rawActionType = typeof metadata.actionType === "string" ? metadata.actionType : null;
  const targetLabel = typeof metadata.targetLabel === "string" ? metadata.targetLabel : item.summary;
  const origin = typeof metadata.origin === "string" ? metadata.origin : null;
  const toolId = typeof metadata.toolId === "string" ? metadata.toolId : null;
  const requestId = typeof metadata.requestId === "string" ? metadata.requestId : null;
  const execution = "execution" in metadata ? metadata.execution : null;

  if (rawActionType !== "process-kill" && rawActionType !== "device-remove" && rawActionType !== "agent-tool-access") {
    return null;
  }

  const actionType: ApprovalActionType = rawActionType;

  const decision =
    item.kind === "approval-request-created"
      ? "pending"
      : item.kind === "approval-request-approved"
        ? "approved"
        : "rejected";

  return {
    actionType,
    targetLabel,
    origin,
    toolId,
    requestId,
    execution,
    decision,
    isPreApproval: actionType === "agent-tool-access",
    executedNow: decision === "approved" && actionType !== "agent-tool-access" && Boolean(execution)
  };
}

function getOrchestrationMeta(item: ActivityFeedItem | null) {
  const orchestration = item?.metadata?.orchestration;
  if (!orchestration || typeof orchestration !== "object") {
    return null;
  }

  const source = "source" in orchestration ? orchestration.source : null;
  if (source !== "provider" && source !== "heuristic") {
    return null;
  }

  return {
    source,
    providerId: "providerId" in orchestration && typeof orchestration.providerId === "string" ? orchestration.providerId : null,
    modelId: "modelId" in orchestration && typeof orchestration.modelId === "string" ? orchestration.modelId : null,
    fallbackReason:
      "fallbackReason" in orchestration && typeof orchestration.fallbackReason === "string"
        ? orchestration.fallbackReason
        : null
  };
}

function getKindLabel(kind: ActivityFeedItem["kind"]) {
  const key = `activity.kind.${kind}`;
  const translated = t(key);
  if (translated !== key) {
    return translated;
  }

  return kind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getApprovalActionLabel(actionType: ApprovalActionType) {
  return t(`activity.approvalAction.${actionType}`);
}

function getApprovalOriginLabel(origin: string | null) {
  if (origin === "chat" || origin === "task") {
    return t(`activity.approvalOrigin.${origin}`);
  }

  return t("activity.approvalOrigin.direct");
}

function getApprovalDecisionLabel(item: ActivityFeedItem | null) {
  const meta = getApprovalMeta(item);
  if (!meta) {
    return "";
  }

  return t(`activity.approvalDecision.${meta.decision}`);
}

function approvalDecisionClass(item: ActivityFeedItem | null) {
  const meta = getApprovalMeta(item);
  if (!meta) {
    return "";
  }

  if (meta.decision === "approved") {
    return "status-success";
  }

  if (meta.decision === "rejected") {
    return "status-error";
  }

  return "status-info";
}

function getApprovalOutcomeText(item: ActivityFeedItem | null) {
  const meta = getApprovalMeta(item);
  if (!meta) {
    return "";
  }

  if (meta.decision === "pending") {
    return t("activity.approvalOutcome.pending");
  }

  if (meta.isPreApproval) {
    return meta.decision === "approved"
      ? t("activity.approvalOutcome.preApproved")
      : t("activity.approvalOutcome.preApprovalRejected");
  }

  return meta.decision === "approved"
    ? t("activity.approvalOutcome.executed")
    : t("activity.approvalOutcome.executionRejected");
}

async function selectActivity(activityId: string) {
  detailLoading.value = true;
  error.value = "";

  try {
    selectedActivity.value = await getActivityFeedItem(activityId);
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("activity.failedDetail", { message });
  } finally {
    detailLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    feed.value = await getActivityFeed(40);
    if (feed.value.items[0]) {
      selectedActivity.value = await getActivityFeedItem(feed.value.items[0].activityId);
    } else {
      selectedActivity.value = null;
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("activity.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

watch(filteredItems, async (items) => {
  if (items.length === 0) {
    selectedActivity.value = null;
    return;
  }

  const currentId = selectedActivity.value?.activityId;
  if (currentId && items.some((item) => item.activityId === currentId)) {
    return;
  }

  await selectActivity(items[0].activityId);
});

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("activity.eyebrow") }}</p>
        <h2>{{ t("activity.title") }}</h2>
        <p class="page-copy">{{ t("activity.copy") }}</p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("activity.refresh") }}
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
        <p class="panel-label">{{ t("activity.totalEvents") }}</p>
        <h2>{{ total }}</h2>
        <p class="panel-meta">{{ t("activity.recentTimeline") }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("activity.currentFocus") }}</p>
        <h3>{{ latestKind }}</h3>
        <p class="panel-meta">{{ t("activity.currentFocusCopy") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ localText("审批事件", "Approval events") }}</p>
        <h2>{{ categoryOptions.find((item) => item.id === "approval")?.count ?? 0 }}</h2>
        <p class="panel-meta">{{ localText("用于说明哪些动作经过了确认。", "Use this to explain which actions needed confirmation.") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ localText("提醒与文件", "Reminder and file events") }}</p>
        <h2>
          {{
            (categoryOptions.find((item) => item.id === "reminder")?.count ?? 0) +
            (categoryOptions.find((item) => item.id === "files")?.count ?? 0)
          }}
        </h2>
        <p class="panel-meta">{{ localText("这两类最能体现 Agent 真正推进了什么。", "These two categories best show the Agent doing real follow-up work.") }}</p>
      </article>
    </section>

    <section class="info-grid">
      <article class="info-card">
        <strong>{{ localText("时间线怎么讲", "How to present the timeline") }}</strong>
        <ul class="metric-list compact-list">
          <li
            v-for="step in activityGuide"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </article>

      <article class="info-card">
        <strong>{{ localText("事件分类过滤", "Category filters") }}</strong>
        <div class="filter-row">
          <button
            v-for="option in categoryOptions"
            :key="option.id"
            class="chip-button"
            :class="{ 'chip-button-active': option.id === activeCategory }"
            @click="activeCategory = option.id"
          >
            {{ option.label }} · {{ option.count }}
          </button>
        </div>
        <p class="panel-meta">
          {{
            localText(
              "先切到 Agent / 审批 / 提醒 / 文件 这些分类，再点右侧详情，会比直接滚完整时间线更容易讲清楚。",
              "Switch to Agent, Approval, Reminder, or Files first. It is easier to explain than scrolling the full timeline."
            )
          }}
        </p>
      </article>
    </section>

    <section class="chat-layout">
      <article class="panel chat-column">
        <div class="panel-head">
          <p class="panel-label">{{ t("activity.timeline") }}</p>
          <span class="chip">{{ filteredItems.length }}</span>
        </div>

        <div
          v-if="filteredItems.length"
          class="chat-list"
        >
          <button
            v-for="item in filteredItems"
            :key="item.activityId"
            class="chat-thread"
            :class="{ 'chat-thread-active': item.activityId === selectedActivity?.activityId }"
            @click="selectActivity(item.activityId)"
          >
            <div class="chat-thread-head">
              <strong>{{ item.title }}</strong>
              <span>{{ formatDateTime(item.occurredAt) }}</span>
            </div>
            <p>{{ item.summary }}</p>
            <div class="tag-row">
              <span class="chip">{{ getKindLabel(item.kind) }}</span>
              <span class="chip">{{ item.actor }}</span>
              <span
                v-if="getApprovalMeta(item)"
                class="chip"
                :class="approvalDecisionClass(item)"
              >
                {{ getApprovalDecisionLabel(item) }}
              </span>
              <span
                v-if="getApprovalMeta(item)"
                class="chip"
              >
                {{ getApprovalActionLabel(getApprovalMeta(item)!.actionType) }}
              </span>
              <span
                v-if="getOrchestrationMeta(item)"
                class="chip"
              >
                {{
                  getOrchestrationMeta(item)?.source === "provider"
                    ? t("activity.providerReply")
                    : t("activity.fallbackReply")
                }}
              </span>
            </div>
          </button>
        </div>

        <p
          v-else
          class="empty-state"
        >
          {{ localText("当前分类下还没有事件。切回 All 看完整时间线。", "There are no events in this category yet. Switch back to All to see the full timeline.") }}
        </p>
      </article>

      <article class="panel chat-column chat-main">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("activity.selectedEvent") }}</p>
            <h3>{{ selectedActivity?.title ?? t("activity.noEventSelected") }}</h3>
          </div>
          <span class="chip">
            {{ detailLoading ? t("common.loading") : t("common.current") }}
          </span>
        </div>

        <div
          v-if="selectedActivity"
          class="section-stack"
        >
          <article class="message-card">
            <div class="message-head">
              <strong>{{ getKindLabel(selectedActivity.kind) }}</strong>
              <span class="message-meta">{{ formatDateTime(selectedActivity.occurredAt) }}</span>
            </div>
            <p>{{ selectedActivity.summary }}</p>
          </article>

          <dl class="kv-grid">
            <div>
              <dt>{{ t("activity.actor") }}</dt>
              <dd>{{ selectedActivity.actor }}</dd>
            </div>
            <div>
              <dt>{{ t("activity.kindLabel") }}</dt>
              <dd>{{ getKindLabel(selectedActivity.kind) }}</dd>
            </div>
            <div>
              <dt>{{ t("activity.relatedConversation") }}</dt>
              <dd>{{ selectedActivity.relatedConversationId ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("activity.relatedTask") }}</dt>
              <dd>{{ selectedActivity.relatedTaskId ?? "--" }}</dd>
            </div>
          </dl>

          <div
            v-if="getApprovalMeta(selectedActivity)"
            class="section-stack"
          >
            <p class="panel-label">{{ t("activity.approvalSummary") }}</p>
            <dl class="kv-grid">
              <div>
                <dt>{{ t("activity.approvalActionLabel") }}</dt>
                <dd>{{ getApprovalActionLabel(getApprovalMeta(selectedActivity)!.actionType) }}</dd>
              </div>
              <div>
                <dt>{{ t("activity.approvalDecisionLabel") }}</dt>
                <dd>{{ getApprovalDecisionLabel(selectedActivity) }}</dd>
              </div>
              <div>
                <dt>{{ t("activity.approvalTarget") }}</dt>
                <dd>{{ getApprovalMeta(selectedActivity)!.targetLabel }}</dd>
              </div>
              <div>
                <dt>{{ t("activity.approvalOriginLabel") }}</dt>
                <dd>{{ getApprovalOriginLabel(getApprovalMeta(selectedActivity)!.origin) }}</dd>
              </div>
              <div>
                <dt>{{ t("activity.approvalRequestId") }}</dt>
                <dd>{{ getApprovalMeta(selectedActivity)!.requestId ?? "--" }}</dd>
              </div>
              <div>
                <dt>{{ t("activity.approvalOutcomeLabel") }}</dt>
                <dd>{{ getApprovalOutcomeText(selectedActivity) }}</dd>
              </div>
            </dl>
            <p
              v-if="getApprovalMeta(selectedActivity)!.toolId"
              class="panel-meta"
            >
              {{ t("activity.approvalToolId") }}: {{ getApprovalMeta(selectedActivity)!.toolId }}
            </p>
          </div>

          <div
            v-if="getOrchestrationMeta(selectedActivity)"
            class="section-stack"
          >
            <p class="panel-label">{{ t("activity.replySource") }}</p>
            <div class="tag-row">
              <span class="chip">
                {{
                  getOrchestrationMeta(selectedActivity)?.source === "provider"
                    ? t("activity.providerReply")
                    : t("activity.fallbackReply")
                }}
              </span>
              <span
                v-if="getOrchestrationMeta(selectedActivity)?.providerId"
                class="chip"
              >
                {{ t("activity.provider") }}: {{ getOrchestrationMeta(selectedActivity)?.providerId }}
              </span>
              <span
                v-if="getOrchestrationMeta(selectedActivity)?.modelId"
                class="chip"
              >
                {{ t("activity.model") }}: {{ getOrchestrationMeta(selectedActivity)?.modelId }}
              </span>
            </div>
            <p
              v-if="getOrchestrationMeta(selectedActivity)?.fallbackReason"
              class="panel-meta"
            >
              {{ t("activity.fallbackReason") }}: {{ getOrchestrationMeta(selectedActivity)?.fallbackReason }}
            </p>
          </div>

          <div>
            <p class="panel-label">{{ t("activity.metadata") }}</p>
            <pre class="log-tail">{{ JSON.stringify(selectedActivity.metadata, null, 2) }}</pre>
          </div>
        </div>

        <div
          v-else
          class="empty-state"
        >
          {{ t("activity.noEventSelected") }}
        </div>
      </article>
    </section>
  </section>
</template>
