<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type {
  ApprovalRequestItem,
  PermissionPolicyMode,
  PermissionRiskLevel,
  PermissionsOverviewPayload,
  PermissionToolPolicy
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getCurrentLocale } from "../services/ui-preferences";
import {
  approveApprovalRequest,
  getPermissionsOverview,
  rejectApprovalRequest,
  updatePermissionRiskDefaults,
  updatePermissionToolPolicy
} from "../services/runtime-api";

const { t } = useI18n();

function localText(zh: string, en: string) {
  return getCurrentLocale() === "zh-CN" ? zh : en;
}

const loading = ref(true);
const savingDefaults = ref(false);
const savingToolId = ref("");
const approvalActionId = ref("");
const error = ref("");
const message = ref("");
const overview = ref<PermissionsOverviewPayload | null>(null);

const riskDrafts = ref<Record<PermissionRiskLevel, PermissionPolicyMode>>({
  low: "allow",
  medium: "ask",
  high: "desktop-approve"
});
const toolDrafts = ref<Record<string, PermissionPolicyMode>>({});

const policyOptions: PermissionPolicyMode[] = ["allow", "ask", "desktop-approve", "deny"];

const deviceSnapshot = computed(() => overview.value?.deviceSnapshot);
const toolPolicies = computed(() => overview.value?.toolPolicies ?? []);
const approvalHistory = computed(() => overview.value?.approvalHistory ?? []);
const pendingRequests = computed(() => overview.value?.pendingRequests ?? []);
const pendingRequestCount = computed(() => pendingRequests.value.filter((item) => item.status === "pending").length);
const lockedToolCount = computed(() => toolPolicies.value.filter((tool) => tool.source === "locked").length);
const desktopOnlyToolCount = computed(() => toolPolicies.value.filter((tool) => tool.desktopOnly).length);
const permissionsGuide = computed(() => [
  localText("先看默认风险策略，说明系统怎么区分低风险、中风险和高风险动作。", "Start with the default risk policies to explain how the system separates low, medium, and high-risk actions."),
  localText("再看工具级策略，说明哪些能力可以放开、哪些仍然被锁定。", "Then move to the tool-level policies to show what can be opened up and what remains locked."),
  localText("最后展示待审批请求，说明高风险动作不会绕过用户确认。", "Finish with pending approvals to show that higher-risk actions do not bypass user confirmation.")
]);
const permissionsFocus = computed(() => {
  if (pendingRequestCount.value > 0) {
    return {
      title: localText("当前最值得展示的是审批中心", "The approval center is the strongest talking point right now"),
      copy: localText("有待审批请求时，最能说明系统如何在“Agent 能力”和“安全边界”之间保持平衡。", "Pending requests are the clearest way to show how the system balances Agent capability with safety boundaries.")
    };
  }

  return {
    title: localText("当前重点是权限边界设计", "The current focus is permission-boundary design"),
    copy: localText("这页最适合说明：哪些动作能自动执行，哪些动作需要询问，哪些动作永远不会直接放开。", "This page is best for explaining what can run automatically, what requires confirmation, and what should never be opened directly.")
  };
});

function syncDrafts(payload: PermissionsOverviewPayload) {
  riskDrafts.value = payload.riskDefaults.reduce<Record<PermissionRiskLevel, PermissionPolicyMode>>(
    (result, item) => {
      result[item.risk] = item.policy;
      return result;
    },
    {
      low: "allow",
      medium: "ask",
      high: "desktop-approve"
    }
  );

  toolDrafts.value = payload.toolPolicies.reduce<Record<string, PermissionPolicyMode>>((result, item) => {
    result[item.toolId] = item.policy;
    return result;
  }, {});
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const payload = await getPermissionsOverview();
    overview.value = payload;
    syncDrafts(payload);
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("permissions.failedLoad", { message: detail });
  } finally {
    loading.value = false;
  }
}

async function saveRiskDefaults() {
  savingDefaults.value = true;
  error.value = "";
  message.value = "";

  try {
    const payload = await updatePermissionRiskDefaults(riskDrafts.value);
    overview.value = payload;
    syncDrafts(payload);
    message.value = t("permissions.defaultsSaved");
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("permissions.failedSaveDefaults", { message: detail });
  } finally {
    savingDefaults.value = false;
  }
}

async function saveToolPolicy(tool: PermissionToolPolicy) {
  savingToolId.value = tool.toolId;
  error.value = "";
  message.value = "";

  try {
    await updatePermissionToolPolicy(tool.toolId, toolDrafts.value[tool.toolId] ?? tool.policy);
    await load();
    message.value = t("permissions.toolSaved", { title: tool.displayName });
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("permissions.failedSaveTool", { message: detail });
  } finally {
    savingToolId.value = "";
  }
}

async function approveRequest(request: ApprovalRequestItem) {
  approvalActionId.value = request.requestId;
  error.value = "";
  message.value = "";

  try {
    const result = await approveApprovalRequest(request.requestId);
    await load();
    message.value = result.message;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("permissions.failedApproveRequest", { message: detail });
  } finally {
    approvalActionId.value = "";
  }
}

async function rejectRequest(request: ApprovalRequestItem) {
  approvalActionId.value = request.requestId;
  error.value = "";
  message.value = "";

  try {
    const result = await rejectApprovalRequest(request.requestId, "Rejected from desktop approval center.");
    await load();
    message.value = result.message;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("permissions.failedRejectRequest", { message: detail });
  } finally {
    approvalActionId.value = "";
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
        <p class="eyebrow">{{ t("permissions.eyebrow") }}</p>
        <h2>{{ t("permissions.title") }}</h2>
        <p class="page-copy">{{ t("permissions.copy") }}</p>
      </div>

      <div class="page-actions">
        <button
          class="secondary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("permissions.refresh") }}
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
      v-if="message"
      class="status-banner status-info"
    >
      {{ message }}
    </section>

    <section class="info-grid">
      <article class="info-card">
        <strong>{{ localText("本页怎么讲", "How to present this page") }}</strong>
        <ul class="metric-list compact-list">
          <li
            v-for="step in permissionsGuide"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </article>

      <article class="info-card">
        <strong>{{ localText("当前重点", "Current focus") }}</strong>
        <p>{{ permissionsFocus.title }}</p>
        <p class="panel-meta">{{ permissionsFocus.copy }}</p>
      </article>

      <article class="info-card">
        <strong>{{ localText("边界摘要", "Boundary summary") }}</strong>
        <div class="tag-row">
          <span class="chip">{{ localText("待审批", "Pending") }} · {{ pendingRequestCount }}</span>
          <span class="chip">{{ localText("锁定工具", "Locked tools") }} · {{ lockedToolCount }}</span>
          <span class="chip">{{ localText("仅桌面", "Desktop only") }} · {{ desktopOnlyToolCount }}</span>
        </div>
        <p class="panel-meta">
          {{ localText("这组数字适合用来总结系统的安全策略不是口头承诺，而是有实际控制面的。", "These numbers are useful when you want to show that safety is enforced by a real control layer, not just by narration.") }}
        </p>
      </article>
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("permissions.deviceTotal") }}</p>
        <h2>{{ deviceSnapshot?.total ?? 0 }}</h2>
        <p class="panel-meta">{{ t("permissions.deviceTotalCopy") }}</p>
      </article>
      <article class="panel accent-gold">
        <p class="panel-label">{{ t("permissions.deviceApproved") }}</p>
        <h2>{{ deviceSnapshot?.approved ?? 0 }}</h2>
        <p class="panel-meta">{{ t("permissions.deviceApprovedCopy") }}</p>
      </article>
      <article class="panel accent-rose">
        <p class="panel-label">{{ t("permissions.devicePending") }}</p>
        <h2>{{ deviceSnapshot?.pending ?? 0 }}</h2>
        <p class="panel-meta">{{ t("permissions.devicePendingCopy") }}</p>
      </article>
      <article class="panel accent-green">
        <p class="panel-label">{{ t("permissions.pendingRequests") }}</p>
        <h2>{{ pendingRequests.filter((item) => item.status === "pending").length }}</h2>
        <p class="panel-meta">{{ t("permissions.pendingRequestsCopy") }}</p>
      </article>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Policy design", "Policy design") }}</p>
      <h3>{{ localText("先讲规则，再讲动作", "Explain the rules before the actions") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "这一层用来说明系统如何定义风险边界。低风险动作可以自动执行，中风险动作可以按策略询问，高风险动作必须经过明确审批。",
            "This section explains how the system defines risk boundaries. Low-risk actions may run automatically, medium-risk actions can be configured to ask first, and higher-risk actions require explicit approval."
          )
        }}
      </p>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("permissions.defaultPolicies") }}</p>
            <h3>{{ t("permissions.defaultPoliciesTitle") }}</h3>
          </div>
          <button
            class="primary-button"
            :disabled="savingDefaults"
            @click="saveRiskDefaults"
          >
            {{ savingDefaults ? t("common.saving") : t("permissions.saveDefaults") }}
          </button>
        </div>

        <div class="info-grid single-column-grid">
          <div
            v-for="item in overview?.riskDefaults ?? []"
            :key="item.risk"
            class="info-card"
          >
            <div class="panel-head">
              <strong>{{ t(`permissions.risk.${item.risk}`) }}</strong>
              <span class="chip">{{ t(`permissions.policy.${riskDrafts[item.risk]}`) }}</span>
            </div>
            <p>{{ item.description }}</p>
            <label class="form-field">
              <span>{{ t("permissions.policyLabel") }}</span>
              <select
                v-model="riskDrafts[item.risk]"
                class="select-input"
              >
                <option
                  v-for="policy in policyOptions"
                  :key="policy"
                  :value="policy"
                >
                  {{ t(`permissions.policy.${policy}`) }}
                </option>
              </select>
            </label>
          </div>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("permissions.toolPolicies") }}</p>
            <h3>{{ t("permissions.toolPoliciesTitle") }}</h3>
          </div>
          <span class="chip">{{ toolPolicies.length }}</span>
        </div>

        <div class="agent-task-grid">
          <article
            v-for="tool in toolPolicies"
            :key="tool.toolId"
            class="info-card"
          >
            <div class="panel-head">
              <div>
                <strong>{{ tool.displayName }}</strong>
                <p class="panel-meta">{{ tool.description }}</p>
              </div>
              <span class="chip">{{ t(`permissions.risk.${tool.risk}`) }}</span>
            </div>

            <div class="tag-row">
              <span class="chip">{{ t(`permissions.policy.${tool.policy}`) }}</span>
              <span class="chip">{{ t(`permissions.source.${tool.source}`) }}</span>
              <span
                v-if="tool.desktopOnly"
                class="chip"
              >
                {{ t("permissions.desktopOnly") }}
              </span>
              <span
                v-if="tool.mobileVisible"
                class="chip"
              >
                {{ t("permissions.mobileVisible") }}
              </span>
            </div>

            <label class="form-field">
              <span>{{ t("permissions.policyLabel") }}</span>
              <select
                v-model="toolDrafts[tool.toolId]"
                class="select-input"
                :disabled="tool.source === 'locked' || savingToolId === tool.toolId"
              >
                <option
                  v-for="policy in policyOptions"
                  :key="policy"
                  :value="policy"
                >
                  {{ t(`permissions.policy.${policy}`) }}
                </option>
              </select>
            </label>

            <p class="panel-meta">
              {{ t("permissions.recommendedPolicy") }}: {{ t(`permissions.policy.${tool.recommendedPolicy}`) }}
            </p>

            <div class="action-row">
              <button
                class="secondary-button"
                :disabled="tool.source === 'locked' || savingToolId === tool.toolId || toolDrafts[tool.toolId] === tool.policy"
                @click="saveToolPolicy(tool)"
              >
                {{ savingToolId === tool.toolId ? t("common.saving") : t("permissions.saveToolPolicy") }}
              </button>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Approval center", "Approval center") }}</p>
      <h3>{{ localText("高风险动作必须留痕", "Higher-risk actions must stay traceable") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "待审批请求和审批历史用来说明：真正进入执行链的高风险动作，都有明确的来源、时间和结果记录。",
            "Pending requests and approval history show that every higher-risk action entering the execution chain has a clear source, timestamp, and outcome."
          )
        }}
      </p>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("permissions.pendingRequests") }}</p>
            <h3>{{ t("permissions.pendingRequestsTitle") }}</h3>
          </div>
          <span class="chip">{{ pendingRequestCount }}</span>
        </div>

        <div
          v-if="pendingRequestCount"
          class="chat-list"
        >
          <article
            v-for="item in pendingRequests.filter((entry) => entry.status === 'pending')"
            :key="item.requestId"
            class="chat-thread"
          >
            <div class="chat-thread-head">
              <strong>{{ item.title }}</strong>
              <span>{{ formatDateTime(item.requestedAt) }}</span>
            </div>
            <p>{{ item.summary }}</p>
            <div class="tag-row">
              <span class="chip">{{ item.targetLabel }}</span>
              <span class="chip">{{ item.actionType }}</span>
              <span class="chip">{{ t("common.pending") }}</span>
            </div>
            <div class="action-row">
              <button
                class="primary-button"
                :disabled="approvalActionId === item.requestId"
                @click="approveRequest(item)"
              >
                {{ approvalActionId === item.requestId ? t("common.working") : t("permissions.approveRequest") }}
              </button>
              <button
                class="secondary-button"
                :disabled="approvalActionId === item.requestId"
                @click="rejectRequest(item)"
              >
                {{ approvalActionId === item.requestId ? t("common.working") : t("permissions.rejectRequest") }}
              </button>
            </div>
          </article>
        </div>

        <p
          v-else
          class="empty-state"
        >
          {{ t("permissions.noPendingRequests") }}
        </p>
      </article>

      <article class="panel">
        <p class="panel-label">{{ t("permissions.deviceSnapshot") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("permissions.deviceTotal") }}</dt>
            <dd>{{ deviceSnapshot?.total ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("permissions.deviceApproved") }}</dt>
            <dd>{{ deviceSnapshot?.approved ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("permissions.devicePartial") }}</dt>
            <dd>{{ deviceSnapshot?.partial ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("permissions.devicePending") }}</dt>
            <dd>{{ deviceSnapshot?.pending ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("permissions.deviceRecent") }}</dt>
            <dd>{{ deviceSnapshot?.recent ?? 0 }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("permissions.approvalHistory") }}</p>
            <h3>{{ t("permissions.approvalHistoryTitle") }}</h3>
          </div>
          <span class="chip">{{ approvalHistory.length }}</span>
        </div>

        <div
          v-if="approvalHistory.length"
          class="chat-list"
        >
          <article
            v-for="item in approvalHistory"
            :key="item.entryId"
            class="chat-thread"
          >
            <div class="chat-thread-head">
              <strong>{{ item.title }}</strong>
              <span>{{ formatDateTime(item.timestamp) }}</span>
            </div>
            <p>{{ item.summary }}</p>
            <div class="tag-row">
              <span class="chip">{{ item.actor }}</span>
              <span class="chip">{{ t(`permissions.historyDecision.${item.decision}`) }}</span>
              <span class="chip">{{ t(`permissions.historySource.${item.source}`) }}</span>
            </div>
          </article>
        </div>

        <p
          v-else
          class="empty-state"
        >
          {{ t("permissions.noHistory") }}
        </p>
      </article>
    </section>
  </section>
</template>
