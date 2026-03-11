<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";

import type {
  BrowserRelayMonitorState,
  BrowserRelayStartupGuide,
  BrowserRelayStatus,
  OpenClawAuthProfileInfo,
  OpenClawOverview,
  OpenClawProviderInfo,
  OpenClawSessionDetail,
  OpenClawSessionInfo,
  OpenClawTaskInfo
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import {
  getAuthProfiles,
  activateBrowserRelayTarget,
  closeBrowserRelayTarget,
  getBrowserRelayEvents,
  getBrowserRelayStartupGuide,
  getBrowserRelayStatus,
  getOpenClawOverview,
  getProviders,
  getSessionDetail,
  getSessions,
  getTasks,
  openBrowserRelayExtensionFolder,
  openBrowserRelayExtensionOptions,
  openBrowserRelayTarget,
  startBrowserRelayGateway
} from "../services/runtime-api";
const { t } = useI18n();

const overview = ref<OpenClawOverview | null>(null);
const relay = ref<BrowserRelayStatus | null>(null);
const relayGuide = ref<BrowserRelayStartupGuide | null>(null);
const relayEvents = ref<BrowserRelayMonitorState | null>(null);
const providers = ref<OpenClawProviderInfo[]>([]);
const authProfiles = ref<OpenClawAuthProfileInfo[]>([]);
const sessions = ref<OpenClawSessionInfo[]>([]);
const sessionDetail = ref<OpenClawSessionDetail | null>(null);
const tasks = ref<OpenClawTaskInfo[]>([]);
const loading = ref(false);
const relayActionLoading = ref(false);
const relayActionMessage = ref("");
const newRelayTargetUrl = ref("https://www.google.com");
const relayAutoRefresh = ref(false);
const error = ref("");
let relayPollHandle: number | null = null;

async function loadRelayDiagnostics() {
  const [nextRelay, nextRelayGuide, nextRelayEvents] = await Promise.all([
    getBrowserRelayStatus(),
    getBrowserRelayStartupGuide(),
    getBrowserRelayEvents(16)
  ]);

  relay.value = nextRelay;
  relayGuide.value = nextRelayGuide;
  relayEvents.value = nextRelayEvents;
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    const [nextOverview, nextProviders, nextProfiles, nextSessions, nextTasks] = await Promise.all([
      getOpenClawOverview(),
      getProviders(),
      getAuthProfiles(),
      getSessions(),
      getTasks()
    ]);

    await loadRelayDiagnostics();

    overview.value = nextOverview;
    providers.value = nextProviders;
    authProfiles.value = nextProfiles;
    sessions.value = nextSessions.slice(0, 8);
    tasks.value = nextTasks;

    if (nextSessions[0]?.sessionId) {
      sessionDetail.value = await getSessionDetail(nextSessions[0].sessionId);
    } else {
      sessionDetail.value = null;
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("openclaw.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();

  relayPollHandle = window.setInterval(() => {
    if (!relayAutoRefresh.value || relayActionLoading.value) {
      return;
    }

    void loadRelayDiagnostics().catch(() => {
      // Keep the existing UI state if a background poll fails.
    });
  }, 3000);
});

onBeforeUnmount(() => {
  if (relayPollHandle) {
    window.clearInterval(relayPollHandle);
    relayPollHandle = null;
  }
});

async function openRelayTarget() {
  relayActionLoading.value = true;
  relayActionMessage.value = "";
  error.value = "";

  try {
    const result = await openBrowserRelayTarget(newRelayTargetUrl.value);
    relayActionMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("openclaw.failedOpenTarget", { message });
  } finally {
    relayActionLoading.value = false;
  }
}

async function activateRelayTarget(targetId: string) {
  relayActionLoading.value = true;
  relayActionMessage.value = "";
  error.value = "";

  try {
    const result = await activateBrowserRelayTarget(targetId);
    relayActionMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("openclaw.failedActivateTarget", { message });
  } finally {
    relayActionLoading.value = false;
  }
}

async function closeRelayTarget(targetId: string) {
  relayActionLoading.value = true;
  relayActionMessage.value = "";
  error.value = "";

  try {
    const result = await closeBrowserRelayTarget(targetId);
    relayActionMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("openclaw.failedCloseTarget", { message });
  } finally {
    relayActionLoading.value = false;
  }
}

async function runRelayGuideAction(
  action: "start-gateway" | "open-extension-folder" | "open-extension-options"
) {
  relayActionLoading.value = true;
  relayActionMessage.value = "";
  error.value = "";

  try {
    const result =
      action === "start-gateway"
        ? await startBrowserRelayGateway()
        : action === "open-extension-options"
          ? await openBrowserRelayExtensionOptions()
        : await openBrowserRelayExtensionFolder();
    relayActionMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("openclaw.failedGuideAction", { message });
  } finally {
    relayActionLoading.value = false;
  }
}

function formatRelayGuideOverallStatus(status: BrowserRelayStartupGuide["overallStatus"] | undefined) {
  switch (status) {
    case "ready":
      return t("openclaw.relayGuideReady");
    case "missing-extension-files":
      return t("openclaw.relayGuideMissingExtension");
    case "missing-token":
      return t("openclaw.relayGuideMissingToken");
    case "gateway-offline":
      return t("openclaw.relayGuideGatewayOffline");
    case "relay-offline":
      return t("openclaw.relayGuideRelayOffline");
    case "auth-rejected":
      return t("openclaw.relayGuideAuthRejected");
    case "extension-disconnected":
      return t("openclaw.relayGuideExtensionDisconnected");
    default:
      return "--";
  }
}

function formatRelayGuideNextAction(code: BrowserRelayStartupGuide["nextActionCode"] | undefined) {
  switch (code) {
    case "install-extension-files":
      return t("openclaw.relayGuideActionInstallExtension");
    case "save-gateway-token":
      return t("openclaw.relayGuideActionSaveToken");
    case "start-gateway":
      return t("openclaw.relayGuideActionStartGateway");
    case "start-relay":
      return t("openclaw.relayGuideActionStartRelay");
    case "resave-token":
      return t("openclaw.relayGuideActionResaveToken");
    case "connect-extension":
      return t("openclaw.relayGuideActionConnectExtension");
    case "none":
      return t("openclaw.relayGuideActionNone");
    default:
      return "--";
  }
}

function formatRelayGuideStepTitle(id: BrowserRelayStartupGuide["steps"][number]["id"]) {
  switch (id) {
    case "extension-files":
      return t("openclaw.relayStepExtensionFiles");
    case "gateway-config":
      return t("openclaw.relayStepGatewayConfig");
    case "gateway-process":
      return t("openclaw.relayStepGatewayProcess");
    case "relay-process":
      return t("openclaw.relayStepRelayProcess");
    case "relay-auth":
      return t("openclaw.relayStepRelayAuth");
    case "extension-connection":
      return t("openclaw.relayStepExtensionConnection");
    default:
      return id;
  }
}

function formatRelayGuideStepStatus(status: BrowserRelayStartupGuide["steps"][number]["status"]) {
  switch (status) {
    case "complete":
      return t("openclaw.relayStepComplete");
    case "action-required":
      return t("openclaw.relayStepActionRequired");
    case "blocked":
      return t("openclaw.relayStepBlocked");
    default:
      return status;
  }
}

function getRelayReadinessState(kind: "open" | "focus" | "close" | "detach-only") {
  if (kind === "detach-only") {
    return "extension-only";
  }

  const hasTargets = (relay.value?.targetCount ?? 0) > 0;
  const connected = relay.value?.extensionConnected ?? false;
  const relayOnline = relay.value?.relayStatus === "online";
  const authConfigured = relay.value?.relayAuthStatus === "configured";

  if (kind === "open") {
    return connected && relayOnline && authConfigured ? "ready" : "needs-setup";
  }

  return connected && relayOnline && hasTargets ? "ready" : "needs-target";
}

function formatRelayReadinessState(state: "ready" | "needs-setup" | "needs-target" | "extension-only") {
  switch (state) {
    case "ready":
      return t("openclaw.relayReadinessReady");
    case "needs-setup":
      return t("openclaw.relayReadinessNeedsSetup");
    case "needs-target":
      return t("openclaw.relayReadinessNeedsTarget");
    case "extension-only":
      return t("openclaw.relayReadinessExtensionOnly");
    default:
      return "--";
  }
}

function getRelayTargetKindLabel(targetUrl: string | null | undefined) {
  if (!targetUrl) {
    return t("openclaw.relayTargetKindUnknown");
  }

  if (targetUrl.startsWith("chrome-extension://")) {
    return t("openclaw.relayTargetKindExtension");
  }

  if (targetUrl.startsWith("chrome://") || targetUrl.startsWith("edge://")) {
    return t("openclaw.relayTargetKindInternal");
  }

  return t("openclaw.relayTargetKindWeb");
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("openclaw.eyebrow") }}</p>
        <h2>{{ t("openclaw.title") }}</h2>
        <p class="page-copy">
          {{ t("openclaw.copy") }}
        </p>
      </div>

      <div class="page-actions">
        <RouterLink
          class="secondary-button action-link"
          to="/sessions"
        >
          {{ t("openclaw.openSessionsCenter") }}
        </RouterLink>
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("openclaw.refreshCompatibilityData") }}
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
      v-if="relayActionMessage"
      class="status-banner"
    >
      {{ relayActionMessage }}
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("openclaw.bridgeStatus") }}</p>
        <h2>{{ overview?.available ? t("common.ready") : t("common.missing") }}</h2>
        <p class="panel-meta">{{ t("openclaw.home") }}: {{ overview?.homePath ?? "--" }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("openclaw.providers") }}</p>
        <h2>{{ overview?.providerCount ?? 0 }}</h2>
        <p class="panel-meta">{{ t("openclaw.modelBackendsImported") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("openclaw.authProfiles") }}</p>
        <h2>{{ overview?.authProfileCount ?? 0 }}</h2>
        <p class="panel-meta">{{ t("openclaw.credentialMetadataOnly") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("openclaw.sessions") }}</p>
        <h2>{{ overview?.sessionCount ?? 0 }}</h2>
        <p class="panel-meta">{{ t("openclaw.latest") }}: {{ formatDateTime(overview?.latestSessionUpdatedAt) }}</p>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.providers") }}</p>
        <div class="info-grid">
          <article
            v-for="provider in providers"
            :key="provider.id"
            class="info-card"
          >
            <strong>{{ provider.id }}</strong>
            <p>Models: {{ provider.modelCount }}</p>
            <p>{{ provider.baseUrl ?? "--" }}</p>
          </article>
        </div>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.browserRelay") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("openclaw.status") }}</dt>
            <dd>{{ relay?.relayStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.relayPort") }}</dt>
            <dd>{{ relay?.relayPort ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.relayAuth") }}</dt>
            <dd>{{ relay?.relayAuthStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.extensionConnected") }}</dt>
            <dd>{{ relay?.extensionConnected ? t("common.yes") : t("common.no") }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.relayLatency") }}</dt>
            <dd>{{ relay?.relayVersionProbe.latencyMs ?? "--" }} ms</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.relayTargets") }}</dt>
            <dd>{{ relay?.targetCount ?? 0 }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.gatewayPort") }}</dt>
            <dd>{{ relay?.gatewayPort ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.gatewayStatus") }}</dt>
            <dd>{{ relay?.gatewayStatus ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.gatewayToken") }}</dt>
            <dd>{{ relay?.gatewayTokenConfigured ? t("openclaw.configured") : t("common.missing") }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.gatewayVersion") }}</dt>
            <dd>{{ relay?.gatewayServiceVersion ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.extensionVersion") }}</dt>
            <dd>{{ relay?.extensionVersion ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.extensionPath") }}</dt>
            <dd>{{ relay?.extensionPath ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("openclaw.relayVersion") }}</dt>
            <dd>{{ relay?.relayVersion ?? "--" }}</dd>
          </div>
        </dl>

        <div class="info-grid browser-grid">
          <article class="info-card">
            <strong>{{ t("openclaw.relayVersionProbe") }}</strong>
            <p>URL: {{ relay?.relayVersionProbe.url ?? "--" }}</p>
            <p>HTTP: {{ relay?.relayVersionProbe.statusCode ?? "--" }}</p>
            <p>Error: {{ relay?.relayVersionProbe.error ?? "none" }}</p>
          </article>

          <article class="info-card">
            <strong>{{ t("openclaw.relayTargetsProbe") }}</strong>
            <p>URL: {{ relay?.relayTargetsProbe.url ?? "--" }}</p>
            <p>HTTP: {{ relay?.relayTargetsProbe.statusCode ?? "--" }}</p>
            <p>Error: {{ relay?.relayTargetsProbe.error ?? "none" }}</p>
          </article>

          <article class="info-card">
            <strong>{{ t("openclaw.gatewayProbe") }}</strong>
            <p>Path: {{ relay?.gatewayCmdPath ?? "--" }}</p>
            <p>Latency: {{ relay?.gatewayProbe.latencyMs ?? "--" }} ms</p>
            <p>Error: {{ relay?.gatewayProbe.error ?? "none" }}</p>
          </article>

          <article class="info-card">
            <strong>{{ t("openclaw.extensionMetadata") }}</strong>
            <p>Name: {{ relay?.extensionName ?? "--" }}</p>
            <p>{{ t("openclaw.manifest") }}: {{ relay?.extensionManifestAvailable ? t("openclaw.present") : t("common.missing") }}</p>
            <p>{{ t("openclaw.optionsScript") }}: {{ relay?.optionsScriptAvailable ? t("openclaw.present") : t("common.missing") }}</p>
          </article>
        </div>

        <p class="panel-meta">{{ t("openclaw.checkedAt") }}: {{ formatDateTime(relay?.checkedAt) }}</p>
        <p class="panel-meta">
          {{ t("openclaw.relayActionsNote") }}
        </p>
      </article>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("openclaw.relayStartupGuide") }}</p>
          <h3>{{ formatRelayGuideOverallStatus(relayGuide?.overallStatus) }}</h3>
        </div>
        <span class="chip">{{ formatRelayGuideNextAction(relayGuide?.nextActionCode) }}</span>
      </div>

      <p class="panel-meta">
        {{ t("openclaw.checkedAt") }}: {{ formatDateTime(relayGuide?.generatedAt) }}
      </p>

      <div
        v-if="!relayGuide"
        class="empty-state"
      >
        {{ t("openclaw.noRelayGuide") }}
      </div>
      <div
        v-else
        class="info-grid browser-grid"
      >
        <article
          v-for="step in relayGuide.steps"
          :key="step.id"
          class="info-card"
        >
          <strong>{{ formatRelayGuideStepTitle(step.id) }}</strong>
          <p>{{ formatRelayGuideStepStatus(step.status) }}</p>
          <p>{{ step.evidence ?? "--" }}</p>
        </article>
      </div>

      <div class="action-row">
        <label class="checkbox-field">
          <input
            v-model="relayAutoRefresh"
            type="checkbox"
          />
          <span>{{ t("openclaw.autoRefreshRelay") }}</span>
        </label>
        <button
          class="secondary-button"
          :disabled="relayActionLoading"
          @click="runRelayGuideAction('open-extension-folder')"
        >
          {{ relayActionLoading ? t("common.working") : t("openclaw.openExtensionFolder") }}
        </button>
        <button
          class="secondary-button"
          :disabled="relayActionLoading"
          @click="runRelayGuideAction('open-extension-options')"
        >
          {{ relayActionLoading ? t("common.working") : t("openclaw.openExtensionOptions") }}
        </button>
        <button
          v-if="relayGuide?.nextActionCode === 'start-gateway' || relay?.gatewayStatus !== 'online'"
          class="primary-button"
          :disabled="relayActionLoading"
          @click="runRelayGuideAction('start-gateway')"
        >
          {{ relayActionLoading ? t("common.working") : t("openclaw.startGateway") }}
        </button>
      </div>
      <p class="panel-meta">
        {{ t("openclaw.relayGuideActionHint") }}
        {{ t("openclaw.autoRefreshRelayHint") }}
      </p>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("openclaw.relayActionReadiness") }}</p>
          <h3>{{ t("openclaw.relayActionReadinessTitle") }}</h3>
        </div>
        <span class="chip">{{ relay?.targetCount ?? 0 }} {{ t("openclaw.relayTargets") }}</span>
      </div>

      <div class="info-grid browser-grid">
        <article class="info-card">
          <strong>{{ t("openclaw.openRelayTab") }}</strong>
          <p>{{ formatRelayReadinessState(getRelayReadinessState('open')) }}</p>
          <p>{{ t("openclaw.relayReadinessHintOpen") }}</p>
        </article>
        <article class="info-card">
          <strong>{{ t("openclaw.focus") }}</strong>
          <p>{{ formatRelayReadinessState(getRelayReadinessState('focus')) }}</p>
          <p>{{ t("openclaw.relayReadinessHintFocus") }}</p>
        </article>
        <article class="info-card">
          <strong>{{ t("openclaw.close") }}</strong>
          <p>{{ formatRelayReadinessState(getRelayReadinessState('close')) }}</p>
          <p>{{ t("openclaw.relayReadinessHintClose") }}</p>
        </article>
        <article class="info-card">
          <strong>{{ t("openclaw.relayDetachOnly") }}</strong>
          <p>{{ formatRelayReadinessState(getRelayReadinessState('detach-only')) }}</p>
          <p>{{ t("openclaw.relayReadinessHintDetach") }}</p>
        </article>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("openclaw.relayActions") }}</p>
          <h3>{{ t("openclaw.controlRelayTargets") }}</h3>
        </div>
        <span class="chip">{{ relayActionLoading ? t("common.running") : t("common.ready") }}</span>
      </div>

      <div class="action-row">
        <input
          v-model="newRelayTargetUrl"
          class="text-input"
          type="text"
          placeholder="https://example.com"
          @keyup.enter="openRelayTarget"
        />
        <button
          class="primary-button"
          :disabled="relayActionLoading"
          @click="openRelayTarget"
        >
          {{ relayActionLoading ? t("common.working") : t("openclaw.openRelayTab") }}
        </button>
      </div>

      <p class="panel-meta">
        {{ t("openclaw.relayActionHint") }}
      </p>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.relayTargets") }}</p>
        <div
          v-if="!relay?.targets.length"
          class="empty-state"
        >
          {{ t("openclaw.noRelayTargets") }}
        </div>
        <ul
          v-else
          class="session-list compact-list"
        >
          <li
            v-for="target in relay.targets"
            :key="target.id"
            class="session-row"
          >
            <div>
              <strong>{{ target.title ?? target.id }}</strong>
              <p>{{ target.type ?? "--" }} / {{ target.url ?? "--" }}</p>
              <p class="panel-meta">{{ getRelayTargetKindLabel(target.url) }}</p>
              <div class="action-row">
                <button
                  class="secondary-button"
                  :disabled="relayActionLoading"
                  @click="activateRelayTarget(target.id)"
                >
                  {{ t("openclaw.focus") }}
                </button>
                <button
                  class="danger-button"
                  :disabled="relayActionLoading"
                  @click="closeRelayTarget(target.id)"
                >
                  {{ t("openclaw.close") }}
                </button>
              </div>
            </div>
            <div class="session-meta">
              <span>{{ target.id }}</span>
              <span>{{ target.webSocketDebuggerUrl ?? t("openclaw.noWsEndpoint") }}</span>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.relayNotes") }}</p>
        <div
          v-if="!relay?.notes.length"
          class="empty-state"
        >
          {{ t("openclaw.noRelayNotes") }}
        </div>
        <ul
          v-else
          class="metric-list"
        >
          <li
            v-for="note in relay.notes"
            :key="note"
          >
            {{ note }}
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.relayEventStream") }}</p>
        <p class="panel-meta">
          {{ t("openclaw.checkedAt") }}: {{ formatDateTime(relayEvents?.lastCheckedAt) }} / {{ t("openclaw.poll") }}: {{ relayEvents?.pollIntervalMs ?? "--" }} ms
        </p>
        <div
          v-if="!relayEvents?.events.length"
          class="empty-state"
        >
          {{ t("openclaw.noRelayEvents") }}
        </div>
        <ul
          v-else
          class="session-list compact-list"
        >
          <li
            v-for="event in relayEvents.events"
            :key="event.id"
            class="session-row"
          >
            <div>
              <strong>{{ event.kind }} / {{ event.severity }}</strong>
              <p>{{ event.summary }}</p>
            </div>
            <div class="session-meta">
              <span>{{ formatDateTime(event.timestamp) }}</span>
              <span>{{ JSON.stringify(event.details) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.authProfiles") }}</p>
        <ul class="session-list compact-list">
          <li
            v-for="profile in authProfiles"
            :key="profile.id"
            class="session-row"
          >
            <div>
              <strong>{{ profile.id }}</strong>
              <p>{{ profile.providerId }} / {{ profile.mode }}</p>
            </div>
            <div class="session-meta">
              <span>{{ t("openclaw.stored") }}: {{ profile.hasStoredCredentials ? t("common.yes") : t("common.no") }}</span>
              <span>{{ t("openclaw.lastUsed") }}: {{ formatDateTime(profile.lastUsedAt) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.latestSessionDetail") }}</p>
        <div
          v-if="!sessionDetail"
          class="empty-state"
        >
          {{ t("openclaw.noSessionDetail") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("processes.started") }}</dt>
              <dd>{{ formatDateTime(sessionDetail.startedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.cwd") }}</dt>
              <dd>{{ sessionDetail.cwd ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("openclaw.totalMessages") }}</dt>
              <dd>{{ sessionDetail.messageCount }}</dd>
            </div>
            <div>
              <dt>{{ t("openclaw.totalErrors") }}</dt>
              <dd>{{ sessionDetail.errorCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.userMessages") }}</dt>
              <dd>{{ sessionDetail.userMessageCount }}</dd>
            </div>
            <div>
              <dt>{{ t("sessions.assistantMessages") }}</dt>
              <dd>{{ sessionDetail.assistantMessageCount }}</dd>
            </div>
          </dl>
          <p class="panel-meta">{{ sessionDetail.lastError ?? t("openclaw.noRecentSessionError") }}</p>
          <RouterLink
            v-if="sessionDetail?.session.sessionId"
            class="secondary-button action-link"
            :to="{ path: '/sessions', query: { sessionId: sessionDetail.session.sessionId } }"
          >
            {{ t("openclaw.openFullSessionDetail") }}
          </RouterLink>
        </template>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("openclaw.recentSessions") }}</p>
        <ul class="session-list">
          <RouterLink
            v-for="session in sessions"
            :key="session.sessionId"
            class="session-row session-link"
            :to="{ path: '/sessions', query: { sessionId: session.sessionId } }"
          >
            <div>
              <strong>{{ session.sessionId }}</strong>
              <p>{{ session.modelProvider ?? "--" }} / {{ session.model ?? "--" }}</p>
            </div>
            <div class="session-meta">
              <span>{{ session.agentId }}</span>
              <span>{{ formatDateTime(session.updatedAt) }}</span>
            </div>
          </RouterLink>
        </ul>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("tasks.title") }}</p>
        <div
          v-if="tasks.length === 0"
          class="empty-state"
        >
          {{ t("openclaw.noLegacyTasks") }}
        </div>
        <ul
          v-else
          class="session-list compact-list"
        >
          <li
            v-for="task in tasks"
            :key="task.id"
            class="session-row"
          >
            <div>
              <strong>{{ task.name }}</strong>
              <p>{{ task.type }} / {{ task.source }}</p>
            </div>
            <div class="session-meta">
              <span>{{ t("openclaw.enabled") }}: {{ task.enabled ? t("common.yes") : t("common.no") }}</span>
              <span>{{ t("openclaw.next") }}: {{ formatDateTime(task.nextRunAt) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>
  </section>
</template>
