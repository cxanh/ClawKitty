<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";

import type {
  ActivityFeedPayload,
  AgentChatBootstrapPayload,
  AgentTaskBoardPayload,
  CapabilitiesOverviewPayload,
  DesktopOnboardingActionCode,
  DesktopOnboardingStatusPayload,
  PermissionsOverviewPayload,
  SystemSummary
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  getActivityFeed,
  getAgentChatBootstrap,
  getAgentTaskBoard,
  getCapabilitiesOverview,
  getDesktopOnboardingStatus,
  getPermissionsOverview,
  getSystemSummary,
  openBrowserRelayExtensionFolder,
  openBrowserRelayExtensionOptions,
  runtimeBaseUrl,
  startBrowserRelayGateway
} from "../services/runtime-api";

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const busy = ref(false);
const autoRefresh = ref(true);
const error = ref("");
const actionMessage = ref("");
const onboarding = ref<DesktopOnboardingStatusPayload | null>(null);
const chatBootstrap = ref<AgentChatBootstrapPayload | null>(null);
const taskBoard = ref<AgentTaskBoardPayload | null>(null);
const activityFeed = ref<ActivityFeedPayload | null>(null);
const capabilities = ref<CapabilitiesOverviewPayload | null>(null);
const permissions = ref<PermissionsOverviewPayload | null>(null);
const systemSummary = ref<SystemSummary | null>(null);

let refreshTimer: number | null = null;

const nextStep = computed(() => {
  switch (onboarding.value?.nextActionCode) {
    case "start-gateway":
      return t("home.nextStepGateway");
    case "open-extension-folder":
      return t("home.nextStepExtensionFiles");
    case "open-extension-options":
    case "connect-extension":
      return t("home.nextStepExtension");
    case "open-settings":
      return t("home.nextStepSettings");
    default:
      return t("home.nextStepExplore");
  }
});

const completionBannerClass = computed(() => {
  switch (onboarding.value?.completionState) {
    case "relay-active":
    case "workspace-ready":
      return "status-success";
    case "relay-ready":
      return "status-info";
    default:
      return "";
  }
});

const hasRelayTargetsPreview = computed(() => (onboarding.value?.relayTargetsPreview.length ?? 0) > 0);
const pendingApprovalCount = computed(() => permissions.value?.pendingRequests.length ?? 0);
const highlightedTasks = computed(() =>
  (taskBoard.value?.tasks ?? []).filter((task) => task.status !== "done").slice(0, 4)
);
const recentActivityItems = computed(() => activityFeed.value?.items.slice(0, 5) ?? []);
const availableSkillCount = computed(() => capabilities.value?.counts.availableSkills ?? 0);
const availableToolCount = computed(() => capabilities.value?.counts.availableTools ?? 0);
const recentConversationCount = computed(() => chatBootstrap.value?.conversations.length ?? 0);

function getActionLabel(actionCode: DesktopOnboardingActionCode) {
  switch (actionCode) {
    case "start-gateway":
      return t("home.startGateway");
    case "open-extension-folder":
      return t("home.openExtensionFolder");
    case "open-extension-options":
    case "connect-extension":
      return t("home.openExtensionOptions");
    case "explore-workspace":
      return t("home.openOpenClaw");
    default:
      return t("home.openSettings");
  }
}

const actionLabel = computed(() => getActionLabel(onboarding.value?.nextActionCode ?? "open-settings"));

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const nextOnboarding = await getDesktopOnboardingStatus();
    onboarding.value = nextOnboarding;

    if (nextOnboarding.isBlankWorkspace) {
      chatBootstrap.value = null;
      taskBoard.value = null;
      activityFeed.value = null;
      capabilities.value = null;
      permissions.value = null;
      systemSummary.value = null;
      return;
    }

    const [nextChatBootstrap, nextTaskBoard, nextActivityFeed, nextCapabilities, nextPermissions, nextSystemSummary] =
      await Promise.all([
        getAgentChatBootstrap(),
        getAgentTaskBoard(),
        getActivityFeed(20),
        getCapabilitiesOverview(),
        getPermissionsOverview(),
        getSystemSummary()
      ]);

    chatBootstrap.value = nextChatBootstrap;
    taskBoard.value = nextTaskBoard;
    activityFeed.value = nextActivityFeed;
    capabilities.value = nextCapabilities;
    permissions.value = nextPermissions;
    systemSummary.value = nextSystemSummary;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("home.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

async function runAction(actionCode: DesktopOnboardingActionCode) {
  busy.value = true;
  actionMessage.value = "";

  try {
    switch (actionCode) {
      case "start-gateway": {
        const result = await startBrowserRelayGateway();
        actionMessage.value = result.message;
        break;
      }
      case "open-extension-folder": {
        const result = await openBrowserRelayExtensionFolder();
        actionMessage.value = result.message;
        break;
      }
      case "open-extension-options":
      case "connect-extension": {
        const result = await openBrowserRelayExtensionOptions();
        actionMessage.value = result.message;
        break;
      }
      case "open-settings":
        await router.push("/settings");
        break;
      case "explore-workspace":
        await router.push("/openclaw");
        break;
      default:
        return;
    }

    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = message;
  } finally {
    busy.value = false;
  }
}

async function handlePrimaryAction() {
  await runAction(onboarding.value?.nextActionCode ?? "open-settings");
}

function syncRefreshTimer() {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (!autoRefresh.value) {
    return;
  }

  refreshTimer = window.setInterval(() => {
    void load();
  }, 10_000);
}

onMounted(() => {
  void load();
  syncRefreshTimer();
});

onUnmounted(() => {
  if (refreshTimer !== null) {
    window.clearInterval(refreshTimer);
  }
});
</script>

<template>
  <section
    v-if="loading"
    class="page"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("home.eyebrow") }}</p>
        <h2>{{ t("home.title") }}</h2>
        <p class="page-copy">{{ t("home.loading") }}</p>
      </div>
    </header>
  </section>

  <section
    v-else-if="onboarding?.isBlankWorkspace || !onboarding"
    class="page"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("home.eyebrow") }}</p>
        <h2>{{ t("home.welcomeTitle") }}</h2>
        <p class="page-copy">{{ t("home.welcomeCopy") }}</p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="busy"
          @click="load"
        >
          {{ t("home.refreshHome") }}
        </button>
        <RouterLink
          class="secondary-button action-link"
          to="/settings"
        >
          {{ t("home.openSettings") }}
        </RouterLink>
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

    <section
      v-if="onboarding?.completionMessage"
      class="status-banner"
      :class="completionBannerClass"
    >
      <strong>{{ t(`home.completion.${onboarding?.completionState ?? 'workspace-ready'}`) }}</strong>
      <div>{{ onboarding?.completionMessage }}</div>
      <div
        v-if="hasRelayTargetsPreview"
        class="panel-meta"
      >
        {{ t("home.relayTargetsPreview") }}:
        {{ onboarding?.relayTargetsPreview.join(" | ") }}
      </div>
    </section>

    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">{{ t("home.cleanStateLabel") }}</p>
        <h2>{{ t("home.cleanStateTitle") }}</h2>
        <p class="hero-text">{{ t("home.cleanStateCopy") }}</p>
      </div>

      <div class="hero-actions">
        <button
          class="primary-button"
          :disabled="busy"
          @click="handlePrimaryAction"
        >
          {{ actionLabel }}
        </button>
        <button
          class="secondary-button"
          :disabled="busy"
          @click="autoRefresh = !autoRefresh; syncRefreshTimer()"
        >
          {{ autoRefresh ? t("home.disableAutoRefresh") : t("home.enableAutoRefresh") }}
        </button>
      </div>
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("home.managedHome") }}</p>
        <h3>{{ onboarding?.dataHome ?? "--" }}</h3>
        <p class="panel-meta">{{ t("home.source") }}: {{ onboarding?.dataHomeSource ?? "unknown" }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("home.gatewayStatus") }}</p>
        <h2>{{ onboarding?.relay.gatewayStatus ?? "--" }}</h2>
        <p class="panel-meta">Runtime: {{ runtimeBaseUrl }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("home.relayStatus") }}</p>
        <h2>{{ onboarding?.relay.relayStatus ?? "--" }}</h2>
        <p class="panel-meta">
          {{ t("home.bundledExtension") }}:
          {{ onboarding?.bundledExtensionAvailable ? t("common.yes") : t("common.no") }}
        </p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("home.nextStep") }}</p>
        <h3>{{ nextStep }}</h3>
        <p class="panel-meta">{{ t("home.emptyCounts") }}</p>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("home.quickStart") }}</p>
        <div class="info-grid">
          <div
            v-for="step in onboarding?.steps ?? []"
            :key="step.id"
            class="info-card"
          >
            <div class="panel-head onboarding-head">
              <strong>{{ t(`home.step.${step.id}`) }}</strong>
              <span class="chip">{{ t(`home.stepStatus.${step.status}`) }}</span>
            </div>
            <p>{{ step.evidence }}</p>
            <div class="action-row">
              <button
                v-if="step.actionCode !== 'none'"
                class="secondary-button"
                :disabled="busy"
                @click="runAction(step.actionCode)"
              >
                {{ getActionLabel(step.actionCode) }}
              </button>
            </div>
          </div>
        </div>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("home.workspaceState") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("settings.providers") }}</dt>
            <dd>{{ onboarding?.counts.providers ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.authProfiles") }}</dt>
            <dd>{{ onboarding?.counts.authProfiles ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("sessions.title") }}</dt>
            <dd>{{ onboarding?.counts.sessions ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("tasks.title") }}</dt>
            <dd>{{ onboarding?.counts.tasks ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("devices.title") }}</dt>
            <dd>{{ onboarding?.counts.devices ?? 0 }}</dd>
          </div>
          <div>
            <dt>Relay Targets</dt>
            <dd>{{ onboarding?.relay.targetCount ?? 0 }}</dd>
          </div>
          <div class="kv-wide">
            <dt>{{ t("home.extensionPath") }}</dt>
            <dd>{{ onboarding?.paths.extensionPath ?? "--" }}</dd>
          </div>
          <div class="kv-wide">
            <dt>{{ t("home.extensionOptionsPath") }}</dt>
            <dd>{{ onboarding?.paths.extensionOptionsPath ?? "--" }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <div class="action-row">
      <RouterLink
        class="primary-button action-link"
        to="/chat"
      >
        {{ t("chat.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/openclaw"
      >
        {{ t("home.openOpenClaw") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/devices"
      >
        {{ t("devices.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/tasks"
      >
        {{ t("tasks.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/activity"
      >
        {{ t("activity.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/capabilities"
      >
        {{ t("capabilities.title") }}
      </RouterLink>
    </div>
  </section>

  <section
    v-else
    class="page"
  >
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("home.eyebrow") }}</p>
        <h2>{{ t("home.title") }}</h2>
        <p class="page-copy">
          Agent-first desktop overview for graduation-demo-ready daily use.
        </p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ t("common.refresh") }}
        </button>
        <button
          class="secondary-button"
          :disabled="busy"
          @click="autoRefresh = !autoRefresh; syncRefreshTimer()"
        >
          {{ autoRefresh ? t("home.disableAutoRefresh") : t("home.enableAutoRefresh") }}
        </button>
        <RouterLink
          class="secondary-button action-link"
          to="/chat"
        >
          {{ t("chat.title") }}
        </RouterLink>
      </div>
    </header>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section
      v-if="onboarding?.completionMessage"
      class="status-banner"
      :class="completionBannerClass"
    >
      <strong>{{ t(`home.completion.${onboarding?.completionState ?? 'workspace-ready'}`) }}</strong>
      <div>{{ onboarding?.completionMessage }}</div>
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("chat.title") }}</p>
        <h2>{{ recentConversationCount }}</h2>
        <p class="panel-meta">Recent conversations ready to reopen</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("tasks.title") }}</p>
        <h2>{{ taskBoard?.total ?? 0 }}</h2>
        <p class="panel-meta">{{ highlightedTasks.length }} currently need attention</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("permissions.title") }}</p>
        <h2>{{ pendingApprovalCount }}</h2>
        <p class="panel-meta">Pending approvals waiting for desktop review</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("devices.title") }}</p>
        <h2>{{ onboarding?.counts.devices ?? 0 }}</h2>
        <p class="panel-meta">{{ systemSummary?.hostname ?? "--" }} · {{ onboarding?.relay.relayStatus ?? "--" }}</p>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">Current task focus</p>
            <h3>{{ highlightedTasks.length > 0 ? "Active agent work" : "No urgent task right now" }}</h3>
          </div>
          <span class="chip">{{ highlightedTasks.length }} items</span>
        </div>
        <div
          v-if="highlightedTasks.length === 0"
          class="empty-state"
        >
          The Agent task board is calm right now. You can start a new conversation or create the next draft from Chat.
        </div>
        <div
          v-else
          class="info-grid single-column-grid"
        >
          <div
            v-for="task in highlightedTasks"
            :key="task.taskId"
            class="info-card"
          >
            <div class="panel-head">
              <div>
                <strong>{{ task.title }}</strong>
                <p class="panel-meta">{{ task.summary }}</p>
              </div>
              <span class="chip">{{ task.status }}</span>
            </div>
            <div class="tag-row">
              <span
                v-for="tag in task.tags"
                :key="`${task.taskId}-${tag}`"
                class="chip"
              >
                {{ tag }}
              </span>
            </div>
            <p class="panel-meta">Updated: {{ formatDateTime(task.updatedAt) }}</p>
          </div>
        </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("activity.title") }}</p>
            <h3>Recent agent timeline</h3>
          </div>
          <span class="chip">{{ recentActivityItems.length }} items</span>
        </div>
        <div
          v-if="recentActivityItems.length === 0"
          class="empty-state"
        >
          No recent activity yet. As soon as you chat with the Agent or save a plan, the timeline will appear here.
        </div>
        <ul
          v-else
          class="session-list"
        >
          <li
            v-for="item in recentActivityItems"
            :key="item.activityId"
            class="session-row"
          >
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.summary }}</p>
            </div>
            <div class="session-meta">
              <span>{{ item.actor }}</span>
              <span>{{ formatDateTime(item.occurredAt) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("capabilities.title") }}</p>
            <h3>Capability snapshot</h3>
          </div>
          <span class="chip">{{ capabilities?.counts.models ?? 0 }} models</span>
        </div>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("capabilities.title") }}</dt>
            <dd>{{ capabilities?.counts.availableSkills ?? 0 }} skills / {{ capabilities?.counts.availableTools ?? 0 }} tools</dd>
          </div>
          <div>
            <dt>{{ t("permissions.title") }}</dt>
            <dd>{{ pendingApprovalCount }} pending approvals</dd>
          </div>
          <div>
            <dt>Agent mode</dt>
            <dd>{{ chatBootstrap?.capabilities.agentMode ?? "--" }}</dd>
          </div>
          <div>
            <dt>Reminder mode</dt>
            <dd>{{ chatBootstrap?.capabilities.reminderMode ?? "--" }}</dd>
          </div>
          <div>
            <dt>Available skills</dt>
            <dd>{{ availableSkillCount }}</dd>
          </div>
          <div>
            <dt>Available tools</dt>
            <dd>{{ availableToolCount }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("devices.title") }}</p>
            <h3>Support console snapshot</h3>
          </div>
          <span class="chip">{{ systemSummary?.agentStatus ?? "--" }}</span>
        </div>
        <dl class="kv-grid">
          <div>
            <dt>Host</dt>
            <dd>{{ systemSummary?.hostname ?? "--" }}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{{ runtimeBaseUrl }}</dd>
          </div>
          <div>
            <dt>Relay</dt>
            <dd>{{ onboarding?.relay.relayStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>Relay targets</dt>
            <dd>{{ onboarding?.relay.targetCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.providers") }}</dt>
            <dd>{{ onboarding?.counts.providers ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("devices.title") }}</dt>
            <dd>{{ onboarding?.counts.devices ?? 0 }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <div class="action-row">
      <RouterLink
        class="primary-button action-link"
        to="/chat"
      >
        {{ t("chat.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/tasks"
      >
        {{ t("tasks.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/activity"
      >
        {{ t("activity.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/capabilities"
      >
        {{ t("capabilities.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/permissions"
      >
        {{ t("permissions.title") }}
      </RouterLink>
      <RouterLink
        class="secondary-button action-link"
        to="/devices"
      >
        {{ t("devices.title") }}
      </RouterLink>
    </div>
  </section>
</template>
