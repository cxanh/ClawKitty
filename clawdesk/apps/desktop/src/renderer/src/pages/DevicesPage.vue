<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";

import type {
  OpenClawPairedDeviceDetail,
  OpenClawPairedDeviceInfo,
  PairingAuditEntry,
  PairingCenterSessionPayload,
  PairingCenterStatusPayload,
  PairingPendingApproval,
  SystemSummary
} from "@clawdesk/shared-types";

import { formatBytesToGb, formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getCurrentLocale } from "../services/ui-preferences";
import {
  approvePendingApproval,
  cleanupExpiredPairingSessions,
  createPairingCenterSession,
  exportPairingAudit,
  getDeviceDetail,
  getDevices,
  getPairingCenterStatus,
  getPendingApprovals,
  getSystemSummary,
  queryPairingAudit,
  rejectPendingApproval,
  requestDeviceRemoveApproval,
  updateDeviceApprovedScopes
} from "../services/runtime-api";

const hostSummary = ref<SystemSummary | null>(null);
const devices = ref<OpenClawPairedDeviceInfo[]>([]);
const pairingCenter = ref<PairingCenterStatusPayload | null>(null);
const pairingSession = ref<PairingCenterSessionPayload | null>(null);
const pairingQrDataUrl = ref<string | null>(null);
const pairingAudit = ref<PairingAuditEntry[]>([]);
const auditMatchedEntries = ref(0);
const auditReturnedEntries = ref(0);
const auditHasMore = ref(false);
const pendingApprovals = ref<PairingPendingApproval[]>([]);
const selectedDeviceDetail = ref<OpenClawPairedDeviceDetail | null>(null);
const loading = ref(false);
const detailLoading = ref(false);
const pairingLoading = ref(false);
const approvalActionRequestId = ref<string | null>(null);
const deviceActionLoading = ref(false);
const cleanupLoading = ref(false);
const auditLoading = ref(false);
const auditExporting = ref(false);
const error = ref("");
const saveMessage = ref("");
const search = ref("");
const approvalFilter = ref<"all" | "approved" | "partial" | "pending">("all");
const lastSeenFilter = ref<"all" | "recent" | "stale" | "unknown">("all");
const platformFilter = ref("all");
const { t } = useI18n();

function localText(zh: string, en: string) {
  return getCurrentLocale() === "zh-CN" ? zh : en;
}

const pendingApprovalScopes = ref<Record<string, string[]>>({});
const auditKindFilter = ref<
  "all" | "session-created" | "session-expired" | "request-submitted" | "request-approved" | "request-rejected" | "device-scopes-updated" | "device-removed"
>("all");
const auditActorFilter = ref<"all" | "desktop" | "mobile">("all");
const auditSearch = ref("");
const auditLimit = ref(8);
const auditOffset = ref(0);

const approvedDeviceCount = computed(() =>
  devices.value.filter((device) => device.approvedScopes.length > 0).length
);
const recentDeviceCount = computed(() =>
  devices.value.filter((device) => deriveDeviceLastSeenStateFromInfo(device.lastUsedAt) === "recent").length
);
const staleDeviceCount = computed(() =>
  devices.value.filter((device) => deriveDeviceLastSeenStateFromInfo(device.lastUsedAt) === "stale").length
);
const pendingDeviceCount = computed(() =>
  devices.value.filter((device) => deriveDeviceApprovalStateFromInfo(device) === "pending").length
);
const selectedDeviceId = computed(() => selectedDeviceDetail.value?.device.deviceId ?? null);
const platformOptions = computed(() =>
  [...new Set(devices.value.map((device) => device.platform).filter((platform): platform is string => Boolean(platform)))].sort()
);
const editableApprovedScopes = ref<string[]>([]);
const filteredDevices = computed(() => {
  const keyword = search.value.trim().toLowerCase();

  return devices.value.filter((device) => {
    const approvalState = deriveDeviceApprovalStateFromInfo(device);
    const lastSeenState = deriveDeviceLastSeenStateFromInfo(device.lastUsedAt);
    const matchesSearch =
      keyword.length === 0 ||
      [
        device.deviceId,
        device.platform,
        device.clientId,
        device.clientMode,
        device.role,
        ...device.scopes,
        ...device.approvedScopes,
        ...device.tokenRoles
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(keyword));

    const matchesApproval = approvalFilter.value === "all" || approvalState === approvalFilter.value;
    const matchesLastSeen = lastSeenFilter.value === "all" || lastSeenState === lastSeenFilter.value;
    const matchesPlatform = platformFilter.value === "all" || device.platform === platformFilter.value;

    return matchesSearch && matchesApproval && matchesLastSeen && matchesPlatform;
  });
});
const deviceGuide = computed(() => [
  localText("先看上面的宿主机和设备总览，说明系统可以同时观察多台设备。", "Start with the host and device summary to show that the system can observe multiple devices at once."),
  localText("再看 Pairing Center，说明手机或其他客户端如何进入系统。", "Then move to the Pairing Center to explain how phones or other clients join the system."),
  localText("最后展示设备列表和详情，说明每台设备的权限、状态和最近活动。", "Finish with the registry and detail view to show each device's permissions, state, and recent activity.")
]);
const devicesFocus = computed(() => {
  if (devices.value.length === 0) {
    return {
      title: localText("当前重点是展示接入入口", "The current focus is the onboarding entry for devices"),
      copy: localText("还没有配对设备时，最适合展示配对中心、二维码和待审批流程。", "When no devices are paired yet, the best story is the pairing center, QR flow, and approval process.")
    };
  }

  return {
    title: localText("当前重点是多设备可见性", "The current focus is multi-device visibility"),
    copy: localText("这页最适合说明：一台桌面主机可以同时管理多个已配对设备，并保留各自的授权与状态。", "This page is the clearest place to show that one desktop host can manage multiple paired devices while keeping separate scopes and state.")
  };
});
const mobileReadyState = computed(() => Boolean(pairingCenter.value?.runtimeReady && pairingCenter.value?.relayReady));

function formatDeviceApprovalState(state: OpenClawPairedDeviceDetail["approvalState"] | null) {
  if (state === "approved") {
    return t("devices.approvalApproved");
  }

  if (state === "partial") {
    return t("devices.approvalPartial");
  }

  if (state === "pending") {
    return t("devices.approvalPending");
  }

  return "--";
}

function formatDeviceLastSeenState(state: OpenClawPairedDeviceDetail["lastSeenState"] | null) {
  if (state === "recent") {
    return t("devices.lastSeenRecent");
  }

  if (state === "stale") {
    return t("devices.lastSeenStale");
  }

  if (state === "unknown") {
    return t("devices.lastSeenUnknown");
  }

  return "--";
}

function deriveDeviceApprovalStateFromInfo(device: OpenClawPairedDeviceInfo): OpenClawPairedDeviceDetail["approvalState"] {
  if (device.approvedScopes.length === 0) {
    return "pending";
  }

  return device.approvedScopes.length >= device.scopes.length ? "approved" : "partial";
}

function deriveDeviceLastSeenStateFromInfo(lastUsedAt: string | null): OpenClawPairedDeviceDetail["lastSeenState"] {
  if (!lastUsedAt) {
    return "unknown";
  }

  const ageMs = Date.now() - Date.parse(lastUsedAt);
  if (Number.isNaN(ageMs)) {
    return "unknown";
  }

  return ageMs <= 1000 * 60 * 60 * 24 * 7 ? "recent" : "stale";
}

async function copyText(value: string, successPath: string) {
  try {
    await navigator.clipboard.writeText(value);
    saveMessage.value = t(successPath, { value });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedCopy", { message });
  }
}

async function loadDeviceDetail(deviceId: string) {
  detailLoading.value = true;
  error.value = "";

  try {
    selectedDeviceDetail.value = await getDeviceDetail(deviceId);
    editableApprovedScopes.value = [...selectedDeviceDetail.value.device.approvedScopes];
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedDetail", { message });
  } finally {
    detailLoading.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    const [nextSummary, nextDevices, nextPairingCenter, nextPendingApprovals, nextPairingAudit] = await Promise.all([
      getSystemSummary(),
      getDevices(),
      getPairingCenterStatus(),
      getPendingApprovals(),
      queryPairingAudit({
        kind: auditKindFilter.value,
        actor: auditActorFilter.value,
        search: auditSearch.value,
        limit: auditLimit.value,
        offset: auditOffset.value
      })
    ]);
    hostSummary.value = nextSummary;
    devices.value = nextDevices;
    pairingCenter.value = nextPairingCenter;
    pendingApprovals.value = nextPendingApprovals;
    pairingAudit.value = nextPairingAudit.entries;
    auditMatchedEntries.value = nextPairingAudit.matchedEntries;
    auditReturnedEntries.value = nextPairingAudit.returnedEntries;
    auditHasMore.value = nextPairingAudit.hasMore;
    pendingApprovalScopes.value = Object.fromEntries(
      nextPendingApprovals.map((approval) => [approval.requestId, [...approval.requestedScopes]])
    );

    if (selectedDeviceDetail.value) {
      const stillExists = nextDevices.find((device) => device.deviceId === selectedDeviceId.value);
      if (stillExists) {
        await loadDeviceDetail(stillExists.deviceId);
      } else {
        selectedDeviceDetail.value = null;
        editableApprovedScopes.value = [];
      }
    } else if (nextDevices[0]) {
      await loadDeviceDetail(nextDevices[0].deviceId);
    }
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

async function loadPairingAudit() {
  auditLoading.value = true;
  error.value = "";

  try {
    const result = await queryPairingAudit({
      kind: auditKindFilter.value,
      actor: auditActorFilter.value,
      search: auditSearch.value,
      limit: auditLimit.value,
      offset: auditOffset.value
    });
    pairingAudit.value = result.entries;
    auditMatchedEntries.value = result.matchedEntries;
    auditReturnedEntries.value = result.returnedEntries;
    auditHasMore.value = result.hasMore;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedPairingAuditQuery", { message });
  } finally {
    auditLoading.value = false;
  }
}

async function runAuditQuery() {
  auditOffset.value = 0;
  await loadPairingAudit();
}

async function nextAuditPage() {
  if (!auditHasMore.value) {
    return;
  }

  auditOffset.value += auditLimit.value;
  await loadPairingAudit();
}

async function previousAuditPage() {
  if (auditOffset.value === 0) {
    return;
  }

  auditOffset.value = Math.max(0, auditOffset.value - auditLimit.value);
  await loadPairingAudit();
}

function toggleApprovedScope(scope: string) {
  if (editableApprovedScopes.value.includes(scope)) {
    editableApprovedScopes.value = editableApprovedScopes.value.filter((item) => item !== scope);
    return;
  }

  editableApprovedScopes.value = [...editableApprovedScopes.value, scope];
}

function togglePendingApprovalScope(requestId: string, scope: string) {
  const currentScopes = pendingApprovalScopes.value[requestId] ?? [];

  if (currentScopes.includes(scope)) {
    pendingApprovalScopes.value = {
      ...pendingApprovalScopes.value,
      [requestId]: currentScopes.filter((item) => item !== scope)
    };
    return;
  }

  pendingApprovalScopes.value = {
    ...pendingApprovalScopes.value,
    [requestId]: [...currentScopes, scope]
  };
}

async function generatePairingSession() {
  pairingLoading.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    pairingSession.value = await createPairingCenterSession();
    saveMessage.value = t("devices.pairingSessionCreated");
    pendingApprovals.value = await getPendingApprovals();
    await loadPairingAudit();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedPairingSession", { message });
  } finally {
    pairingLoading.value = false;
  }
}

async function cleanupExpiredSessions() {
  cleanupLoading.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    const result = await cleanupExpiredPairingSessions();
    saveMessage.value = result.message;
    pairingSession.value = null;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedCleanupSessions", { message });
  } finally {
    cleanupLoading.value = false;
  }
}

async function exportAudit() {
  auditExporting.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    const result = await exportPairingAudit({
      kind: auditKindFilter.value,
      actor: auditActorFilter.value,
      search: auditSearch.value
    });
    saveMessage.value = t("devices.pairingAuditExported", { path: result.outputPath });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedPairingAuditExport", { message });
  } finally {
    auditExporting.value = false;
  }
}

async function copyPairingValue(value: string, successPath: string) {
  await copyText(value, successPath);
}

async function approveRequest(requestId: string, requestedScopes: string[]) {
  approvalActionRequestId.value = requestId;
  error.value = "";
  saveMessage.value = "";

  try {
    const selectedScopes = pendingApprovalScopes.value[requestId] ?? requestedScopes;
    const result = await approvePendingApproval(requestId, selectedScopes);
    saveMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedApproveRequest", { message });
  } finally {
    approvalActionRequestId.value = null;
  }
}

async function rejectRequest(requestId: string) {
  approvalActionRequestId.value = requestId;
  error.value = "";
  saveMessage.value = "";

  try {
    const result = await rejectPendingApproval(requestId, "Rejected from desktop pairing center.");
    saveMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedRejectRequest", { message });
  } finally {
    approvalActionRequestId.value = null;
  }
}

async function saveDeviceApprovedScopes() {
  if (!selectedDeviceDetail.value) {
    return;
  }

  deviceActionLoading.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    const result = await updateDeviceApprovedScopes(selectedDeviceDetail.value.device.deviceId, editableApprovedScopes.value);
    saveMessage.value = result.message;
    await load();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedUpdateScopes", { message });
  } finally {
    deviceActionLoading.value = false;
  }
}

async function revokeAllScopes() {
  editableApprovedScopes.value = [];
  await saveDeviceApprovedScopes();
}

async function removeSelectedDevice() {
  if (!selectedDeviceDetail.value) {
    return;
  }

  deviceActionLoading.value = true;
  error.value = "";
  saveMessage.value = "";

  try {
    const result = await requestDeviceRemoveApproval(selectedDeviceDetail.value.device.deviceId);
    saveMessage.value = result.message;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("devices.failedRemoveDevice", { message });
  } finally {
    deviceActionLoading.value = false;
  }
}

onMounted(() => {
  void load();
});

watch(
  () => pairingSession.value?.qrText,
  async (qrText) => {
    if (!qrText) {
      pairingQrDataUrl.value = null;
      return;
    }

    try {
      pairingQrDataUrl.value = await QRCode.toDataURL(qrText, {
        margin: 1,
        width: 220,
        color: {
          dark: "#10243f",
          light: "#f7f5ef"
        }
      });
    } catch {
      pairingQrDataUrl.value = null;
    }
  },
  { immediate: true }
);
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("devices.eyebrow") }}</p>
        <h2>{{ t("devices.title") }}</h2>
        <p class="page-copy">
          {{ t("devices.copy") }}
        </p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("devices.refreshDevices") }}
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
      v-if="saveMessage"
      class="status-banner"
    >
      {{ saveMessage }}
    </section>

    <section class="info-grid">
      <article class="info-card">
        <strong>{{ localText("本页怎么讲", "How to present this page") }}</strong>
        <ul class="metric-list compact-list">
          <li
            v-for="step in deviceGuide"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </article>

      <article class="info-card">
        <strong>{{ localText("当前重点", "Current focus") }}</strong>
        <p>{{ devicesFocus.title }}</p>
        <p class="panel-meta">{{ devicesFocus.copy }}</p>
      </article>

      <article class="info-card">
        <strong>{{ localText("设备能力摘要", "Device support summary") }}</strong>
        <div class="tag-row">
          <span class="chip">{{ localText("总设备", "Total devices") }} · {{ devices.length }}</span>
          <span class="chip">{{ localText("最近活跃", "Recent") }} · {{ recentDeviceCount }}</span>
          <span class="chip">{{ localText("待审批", "Pending") }} · {{ pendingDeviceCount }}</span>
          <span class="chip">{{ localText("移动端就绪", "Mobile ready") }} · {{ mobileReadyState ? localText("是", "Yes") : localText("否", "No") }}</span>
        </div>
        <p class="panel-meta">
          {{ localText("这一组数据适合拿来说明“设备管理面板”是保留模块，并且已经支持多设备叙事。", "This snapshot is useful for explaining that the Devices panel is retained and already supports a multi-device story.") }}
        </p>
      </article>
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("devices.host") }}</p>
        <h2>{{ hostSummary?.hostname ?? "--" }}</h2>
        <p class="panel-meta">{{ hostSummary?.platform ?? "--" }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("devices.pairedDevices") }}</p>
        <h2>{{ devices.length }}</h2>
        <p class="panel-meta">{{ t("devices.importedFromLegacy") }}</p>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("devices.approvedDevices") }}</p>
        <h2>{{ approvedDeviceCount }}</h2>
        <p class="panel-meta">{{ t("devices.withApprovedScopes") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("devices.lastHeartbeat") }}</p>
        <h2>{{ formatDateTime(hostSummary?.lastHeartbeatAt) }}</h2>
        <p class="panel-meta">{{ t("devices.currentRuntime") }}</p>
      </article>

      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("devices.recentDevices") }}</p>
        <h2>{{ recentDeviceCount }}</h2>
        <p class="panel-meta">{{ t("devices.lastSeenRecent") }}</p>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("devices.staleDevices") }}</p>
        <h2>{{ staleDeviceCount }}</h2>
        <p class="panel-meta">{{ t("devices.lastSeenStale") }}</p>
      </article>

      <article class="panel accent-rose">
        <p class="panel-label">{{ t("devices.pendingDevices") }}</p>
        <h2>{{ pendingDeviceCount }}</h2>
        <p class="panel-meta">{{ t("devices.approvalPending") }}</p>
      </article>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Host and pairing", "Host and pairing") }}</p>
      <h3>{{ localText("先说明入口，再说明设备状态", "Explain the entry path before the device states") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "这部分先展示桌面主机当前状态，再展示配对中心和待审批流程。这样更容易说明移动端或其他设备是如何安全接入系统的。",
            "This section starts with the desktop host state and then moves into the pairing center and pending approvals. It makes the onboarding story easier to explain."
          )
        }}
      </p>
    </section>

    <section class="panel">
      <p class="panel-label">{{ t("devices.hostRuntimeDetail") }}</p>
      <dl class="kv-grid">
        <div>
          <dt>{{ t("devices.deviceId") }}</dt>
          <dd>{{ hostSummary?.deviceId ?? "--" }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.platform") }}</dt>
          <dd>{{ hostSummary?.platform ?? "--" }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.cpuUsage") }}</dt>
          <dd>{{ hostSummary?.cpu.usagePct ?? "--" }}%</dd>
        </div>
        <div>
          <dt>{{ t("devices.memoryUsage") }}</dt>
          <dd>{{ formatBytesToGb(hostSummary?.memory.usedBytes ?? 0) }} / {{ formatBytesToGb(hostSummary?.memory.totalBytes ?? 0) }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.networkRx") }}</dt>
          <dd>{{ hostSummary?.network.rxBytesPerSec ?? 0 }} B/s</dd>
        </div>
        <div>
          <dt>{{ t("devices.networkTx") }}</dt>
          <dd>{{ hostSummary?.network.txBytesPerSec ?? 0 }} B/s</dd>
        </div>
      </dl>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("devices.pairingCenter") }}</p>
          <h3>{{ pairingCenter?.approvalMode ?? "--" }}</h3>
        </div>
        <span class="chip">{{ pairingCenter?.supportedClients.join(" / ") ?? "--" }}</span>
      </div>

      <div class="action-row">
        <button
          class="primary-button"
          :disabled="pairingLoading"
          @click="void generatePairingSession()"
        >
          {{ pairingLoading ? t("common.working") : t("devices.generatePairingSession") }}
        </button>
        <button
          class="secondary-button"
          :disabled="!pairingSession"
          @click="void copyPairingValue(pairingSession?.token ?? '', 'devices.copiedPairingToken')"
        >
          {{ t("devices.copyPairingToken") }}
        </button>
        <button
          class="secondary-button"
          :disabled="!pairingSession"
          @click="void copyPairingValue(pairingSession?.pairingUri ?? '', 'devices.copiedPairingUri')"
        >
          {{ t("devices.copyPairingUri") }}
        </button>
        <button
          class="secondary-button"
          :disabled="cleanupLoading"
          @click="void cleanupExpiredSessions()"
        >
          {{ cleanupLoading ? t("common.working") : t("devices.cleanupExpiredSessions") }}
        </button>
      </div>

      <p class="panel-meta">
        {{
          localText(
            "当前配对中心负责生成配对会话、待审批请求和审计记录，是移动端接入的统一入口。",
            "The current pairing center is the unified entry point for pairing sessions, approval requests, and pairing audit records."
          )
        }}
      </p>

      <dl class="kv-grid">
        <div>
          <dt>{{ t("devices.pairingTransport") }}</dt>
          <dd>{{ pairingCenter?.transport ?? "--" }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.runtimeReady") }}</dt>
          <dd>{{ pairingCenter?.runtimeReady ? t("common.yes") : t("common.no") }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.relayReady") }}</dt>
          <dd>{{ pairingCenter?.relayReady ? t("common.yes") : t("common.no") }}</dd>
        </div>
        <div>
          <dt>{{ t("devices.mobileReady") }}</dt>
          <dd>
            {{
              pairingCenter?.runtimeReady && pairingCenter?.relayReady
                ? t("devices.mobileReadyYes")
                : t("devices.mobileReadyNo")
            }}
          </dd>
        </div>
      </dl>

      <div class="info-grid browser-grid">
        <article class="info-card">
          <strong>{{ t("devices.defaultScopes") }}</strong>
          <p>{{ pairingCenter?.defaultScopes.join(", ") || "--" }}</p>
        </article>
        <article class="info-card">
          <strong>{{ t("devices.plannedWriteScopes") }}</strong>
          <p>{{ pairingCenter?.plannedWriteScopes.join(", ") || "--" }}</p>
        </article>
        <article class="info-card">
          <strong>{{ t("devices.restrictedActions") }}</strong>
          <p>{{ pairingCenter?.restrictedActions.join(", ") || "--" }}</p>
        </article>
      </div>

      <div
        v-if="pairingSession"
        class="section-stack"
      >
        <div class="info-card">
          <strong>{{ t("devices.activePairingSession") }}</strong>
          <div
            v-if="pairingQrDataUrl"
            class="pairing-qr-wrap"
          >
            <img
              class="pairing-qr-image"
              :src="pairingQrDataUrl"
              :alt="t('devices.pairingQrCode')"
            />
          </div>
          <p>{{ pairingSession.sessionId }}</p>
          <p>{{ t("devices.pairingToken") }}: {{ pairingSession.token }}</p>
          <p>{{ t("devices.pairingUri") }}: {{ pairingSession.pairingUri }}</p>
          <p>{{ t("devices.expiresAt") }}: {{ formatDateTime(pairingSession.expiresAt) }}</p>
        </div>
      </div>

      <div
        v-if="pairingCenter?.nextSteps.length"
        class="section-stack"
      >
        <div>
          <p class="panel-label">{{ t("devices.nextSteps") }}</p>
          <ol class="metric-list">
            <li
              v-for="step in pairingCenter.nextSteps"
              :key="step"
            >
              {{ step }}
            </li>
          </ol>
        </div>
      </div>

      <div class="section-stack">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("devices.pendingApprovals") }}</p>
            <h3>{{ pendingApprovals.length }}</h3>
          </div>
          <span class="chip">{{ t("devices.approvalPending") }}</span>
        </div>

        <div
          v-if="pendingApprovals.length === 0"
          class="empty-state"
        >
          {{ t("devices.noPendingApprovals") }}
        </div>

        <div
          v-else
          class="section-stack"
        >
          <article
            v-for="approval in pendingApprovals"
            :key="approval.requestId"
            class="info-card"
          >
            <strong>{{ approval.deviceName }}</strong>
            <p>{{ approval.clientType }} / {{ approval.suggestedDeviceId }}</p>
            <p>{{ t("devices.requestedScopes") }}: {{ approval.requestedScopes.join(", ") }}</p>
            <p>{{ t("devices.expiresAt") }}: {{ formatDateTime(approval.expiresAt) }}</p>
            <div class="section-stack">
              <div>
                <p class="panel-label">{{ t("devices.pendingApprovalScopeEditor") }}</p>
                <div class="action-row">
                  <button
                    v-for="scope in approval.requestedScopes"
                    :key="scope"
                    class="chip-button"
                    :class="{ 'chip-button-active': (pendingApprovalScopes[approval.requestId] ?? []).includes(scope) }"
                    @click="togglePendingApprovalScope(approval.requestId, scope)"
                  >
                    {{ scope }}
                  </button>
                </div>
              </div>
            </div>
            <div class="action-row">
              <button
                class="secondary-button"
                :disabled="approvalActionRequestId === approval.requestId || (pendingApprovalScopes[approval.requestId] ?? []).length === 0"
                @click="void approveRequest(approval.requestId, approval.requestedScopes)"
              >
                {{ approvalActionRequestId === approval.requestId ? t("common.working") : t("devices.approveRequest") }}
              </button>
              <button
                class="secondary-button danger-button"
                :disabled="approvalActionRequestId === approval.requestId"
                @click="void rejectRequest(approval.requestId)"
              >
                {{ t("devices.rejectRequest") }}
              </button>
            </div>
          </article>
        </div>
      </div>

      <div class="section-stack">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("devices.pairingAudit") }}</p>
            <h3>{{ pairingAudit.length }}</h3>
          </div>
          <span class="chip">{{ t("devices.recentEvents") }}</span>
        </div>

        <div class="action-row">
          <select
            v-model="auditKindFilter"
            class="text-input"
          >
            <option value="all">{{ t("devices.allAuditKinds") }}</option>
            <option value="session-created">session-created</option>
            <option value="session-expired">session-expired</option>
            <option value="request-submitted">request-submitted</option>
            <option value="request-approved">request-approved</option>
            <option value="request-rejected">request-rejected</option>
            <option value="device-scopes-updated">device-scopes-updated</option>
            <option value="device-removed">device-removed</option>
          </select>
          <select
            v-model="auditActorFilter"
            class="text-input"
          >
            <option value="all">{{ t("devices.allAuditActors") }}</option>
            <option value="desktop">desktop</option>
            <option value="mobile">mobile</option>
          </select>
          <input
            v-model="auditSearch"
            class="text-input"
            type="text"
            :placeholder="t('devices.auditSearchPlaceholder')"
          />
          <button
            class="secondary-button"
            :disabled="auditLoading"
            @click="void runAuditQuery()"
          >
            {{ auditLoading ? t("common.searching") : t("common.runQuery") }}
          </button>
          <button
            class="secondary-button"
            :disabled="auditExporting"
            @click="void exportAudit()"
          >
            {{ auditExporting ? t("common.exporting") : t("devices.exportPairingAudit") }}
          </button>
        </div>

        <div class="action-row">
          <span class="chip">
            {{ t("devices.auditResultSummary", { returned: auditReturnedEntries, matched: auditMatchedEntries }) }}
          </span>
          <span class="chip">
            {{ t("devices.auditPagination", { start: auditMatchedEntries === 0 ? 0 : auditOffset + 1, end: auditOffset + auditReturnedEntries }) }}
          </span>
          <button
            class="secondary-button"
            :disabled="auditLoading || auditOffset === 0"
            @click="void previousAuditPage()"
          >
            {{ t("devices.previousAuditPage") }}
          </button>
          <button
            class="secondary-button"
            :disabled="auditLoading || !auditHasMore"
            @click="void nextAuditPage()"
          >
            {{ t("devices.nextAuditPage") }}
          </button>
        </div>

        <div
          v-if="pairingAudit.length === 0"
          class="empty-state"
        >
          {{ t("devices.noPairingAudit") }}
        </div>

        <div
          v-else
          class="section-stack"
        >
          <article
            v-for="entry in pairingAudit"
            :key="entry.id"
            class="info-card"
          >
            <strong>{{ entry.summary }}</strong>
            <p>{{ entry.kind }} / {{ entry.actor }}</p>
            <p>{{ formatDateTime(entry.timestamp) }}</p>
            <p v-if="entry.deviceId">{{ t("devices.deviceId") }}: {{ entry.deviceId }}</p>
            <p v-if="entry.requestId">Request: {{ entry.requestId }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section-intro">
      <p class="eyebrow">{{ localText("Device registry", "Device registry") }}</p>
      <h3>{{ localText("每台设备都有单独状态和授权", "Each device keeps its own state and scopes") }}</h3>
      <p class="page-copy">
        {{
          localText(
            "设备列表和详情用来说明：系统不是只有“能不能连上”，而是会持续记录每台设备的批准范围、最近活动和配对审计。",
            "The registry and detail area show that the system does more than simply connect devices. It keeps separate approved scopes, recent activity, and audit state for each one."
          )
        }}
      </p>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
      <div class="panel-head">
        <div>
          <p class="panel-label">{{ t("devices.registry") }}</p>
          <h3>{{ t("devices.visibleDevices", { count: filteredDevices.length }) }}</h3>
        </div>
        <span class="chip">{{ filteredDevices.length }}</span>
      </div>
      <div class="action-row">
        <input
          v-model="search"
          class="text-input"
          type="text"
          :placeholder="t('devices.searchPlaceholder')"
        />
        <select
          v-model="approvalFilter"
          class="text-input"
        >
          <option value="all">
            {{ t("devices.allApprovalStates") }}
          </option>
          <option value="approved">
            {{ t("devices.approvalApproved") }}
          </option>
          <option value="partial">
            {{ t("devices.approvalPartial") }}
          </option>
          <option value="pending">
            {{ t("devices.approvalPending") }}
          </option>
        </select>
        <select
          v-model="lastSeenFilter"
          class="text-input"
        >
          <option value="all">
            {{ t("devices.allLastSeenStates") }}
          </option>
          <option value="recent">
            {{ t("devices.lastSeenRecent") }}
          </option>
          <option value="stale">
            {{ t("devices.lastSeenStale") }}
          </option>
          <option value="unknown">
            {{ t("devices.lastSeenUnknown") }}
          </option>
        </select>
        <select
          v-model="platformFilter"
          class="text-input"
        >
          <option value="all">
            {{ t("devices.allPlatforms") }}
          </option>
          <option
            v-for="platform in platformOptions"
            :key="platform"
            :value="platform"
          >
            {{ platform }}
          </option>
        </select>
      </div>
      <div
        v-if="devices.length === 0"
        class="empty-state"
      >
        {{ t("devices.noPairedDevices") }}
      </div>
      <div
        v-else-if="filteredDevices.length === 0"
        class="empty-state"
      >
        {{ t("devices.noMatchedDevices") }}
      </div>
      <div
        v-else
        class="table-wrap"
      >
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t("devices.deviceId") }}</th>
              <th>{{ t("devices.platform") }}</th>
              <th>{{ t("devices.client") }}</th>
              <th>{{ t("devices.mode") }}</th>
              <th>{{ t("devices.role") }}</th>
              <th>{{ t("devices.approvalState") }}</th>
              <th>{{ t("devices.lastSeenState") }}</th>
              <th>{{ t("devices.approvedScopes") }}</th>
              <th>{{ t("devices.lastUsed") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="device in filteredDevices"
              :key="device.deviceId"
              class="click-row"
              :class="{ 'active-row': device.deviceId === selectedDeviceId }"
              @click="void loadDeviceDetail(device.deviceId)"
            >
              <td class="path-cell">{{ device.deviceId }}</td>
              <td>{{ device.platform ?? "--" }}</td>
              <td>{{ device.clientId ?? "--" }}</td>
              <td>{{ device.clientMode ?? "--" }}</td>
              <td>{{ device.role ?? "--" }}</td>
              <td>{{ formatDeviceApprovalState(deriveDeviceApprovalStateFromInfo(device)) }}</td>
              <td>{{ formatDeviceLastSeenState(deriveDeviceLastSeenStateFromInfo(device.lastUsedAt)) }}</td>
              <td>{{ device.approvedScopes.join(", ") || "--" }}</td>
              <td>{{ formatDateTime(device.lastUsedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("devices.selectedDevice") }}</p>
            <h3>{{ selectedDeviceDetail?.device.deviceId ?? t("devices.noDeviceSelected") }}</h3>
          </div>
          <span class="chip">{{ detailLoading ? t("common.loading") : t("common.current") }}</span>
        </div>

        <div
          v-if="!selectedDeviceDetail"
          class="empty-state"
        >
          {{ t("devices.selectDevice") }}
        </div>
        <template v-else>
          <dl class="kv-grid">
            <div>
              <dt>{{ t("devices.platform") }}</dt>
              <dd>{{ selectedDeviceDetail.device.platform ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.client") }}</dt>
              <dd>{{ selectedDeviceDetail.device.clientId ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.mode") }}</dt>
              <dd>{{ selectedDeviceDetail.device.clientMode ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.role") }}</dt>
              <dd>{{ selectedDeviceDetail.device.role ?? "--" }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.approvalState") }}</dt>
              <dd>{{ formatDeviceApprovalState(selectedDeviceDetail.approvalState) }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.lastSeenState") }}</dt>
              <dd>{{ formatDeviceLastSeenState(selectedDeviceDetail.lastSeenState) }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.scopeCount") }}</dt>
              <dd>{{ selectedDeviceDetail.scopeCount }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.approvedScopeCount") }}</dt>
              <dd>{{ selectedDeviceDetail.approvedScopeCount }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.createdAt") }}</dt>
              <dd>{{ formatDateTime(selectedDeviceDetail.device.createdAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.approvedAt") }}</dt>
              <dd>{{ formatDateTime(selectedDeviceDetail.device.approvedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.lastUsed") }}</dt>
              <dd>{{ formatDateTime(selectedDeviceDetail.device.lastUsedAt) }}</dd>
            </div>
            <div>
              <dt>{{ t("devices.tokenRoles") }}</dt>
              <dd>{{ selectedDeviceDetail.device.tokenRoles.join(", ") || "--" }}</dd>
            </div>
          </dl>

          <div class="info-grid browser-grid">
            <article class="info-card">
              <strong>{{ t("devices.requestedScopes") }}</strong>
              <div
                v-if="selectedDeviceDetail.device.scopes.length > 0"
                class="action-row"
              >
                <span
                  v-for="scope in selectedDeviceDetail.device.scopes"
                  :key="scope"
                  class="chip"
                >
                  {{ scope }}
                </span>
              </div>
              <p v-else>--</p>
            </article>

            <article class="info-card">
              <strong>{{ t("devices.approvedScopes") }}</strong>
              <div
                v-if="selectedDeviceDetail.device.approvedScopes.length > 0"
                class="action-row"
              >
                <span
                  v-for="scope in selectedDeviceDetail.device.approvedScopes"
                  :key="scope"
                  class="chip"
                >
                  {{ scope }}
                </span>
              </div>
              <p v-else>--</p>
            </article>
          </div>

          <div class="info-card">
            <strong>{{ t("devices.scopeApprovalEditor") }}</strong>
            <div
              v-if="selectedDeviceDetail.device.scopes.length > 0"
              class="action-row"
            >
              <button
                v-for="scope in selectedDeviceDetail.device.scopes"
                :key="scope"
                class="chip-button"
                :class="{ 'chip-button-active': editableApprovedScopes.includes(scope) }"
                @click="toggleApprovedScope(scope)"
              >
                {{ scope }}
              </button>
            </div>
            <p v-else>--</p>
          </div>

          <div class="action-row">
            <button
              class="secondary-button"
              @click="void copyText(selectedDeviceDetail.device.deviceId, 'devices.copiedDeviceId')"
            >
              {{ t("devices.copyDeviceId") }}
            </button>
            <button
              class="secondary-button"
              :disabled="!selectedDeviceDetail.device.clientId"
              @click="void copyText(selectedDeviceDetail.device.clientId ?? '', 'devices.copiedClientId')"
            >
              {{ t("devices.copyClientId") }}
            </button>
            <button
              class="secondary-button"
              :disabled="deviceActionLoading"
              @click="void saveDeviceApprovedScopes()"
            >
              {{ deviceActionLoading ? t("common.working") : t("devices.saveApprovedScopes") }}
            </button>
            <button
              class="secondary-button"
              :disabled="deviceActionLoading"
              @click="void revokeAllScopes()"
            >
              {{ t("devices.revokeAllScopes") }}
            </button>
            <button
              class="danger-button"
              :disabled="deviceActionLoading"
              @click="void removeSelectedDevice()"
            >
              {{ t("devices.removeDevice") }}
            </button>
          </div>

          <div
            v-if="selectedDeviceDetail.notes.length"
            class="section-stack"
          >
            <div>
              <p class="panel-label">{{ t("devices.deviceNotes") }}</p>
              <ul class="metric-list">
                <li
                  v-for="note in selectedDeviceDetail.notes"
                  :key="note"
                >
                  {{ note }}
                </li>
              </ul>
            </div>
          </div>
        </template>
      </article>
    </section>
  </section>
</template>
