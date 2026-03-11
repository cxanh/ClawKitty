<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type {
  OpenClawAuthProfileInfo,
  OpenClawOverview,
  OpenClawPairedDeviceInfo,
  OpenClawProviderInfo
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import { useI18n } from "../services/i18n";
import { getAuthProfiles, getDevices, getOpenClawOverview, getProviders, runtimeBaseUrl } from "../services/runtime-api";
import { useUiPreferences, type AppLocale, type AppTheme } from "../services/ui-preferences";

const appVersion = window.clawdesk?.appVersion ?? "0.1.0";
const desktopPlatform = window.clawdesk?.platform ?? "unknown";
const userDataDir = window.clawdesk?.userDataDir ?? "--";
const dataHome = window.clawdesk?.dataHome ?? "--";
const dataHomeSource = window.clawdesk?.dataHomeSource ?? "unknown";
const legacyHome = window.clawdesk?.legacyHome ?? "--";
const bundledExtensionAvailable = window.clawdesk?.bundledExtensionAvailable ?? false;
const { t } = useI18n();
const { uiPreferences, setLocale, setTheme } = useUiPreferences();

const overview = ref<OpenClawOverview | null>(null);
const providers = ref<OpenClawProviderInfo[]>([]);
const authProfiles = ref<OpenClawAuthProfileInfo[]>([]);
const devices = ref<OpenClawPairedDeviceInfo[]>([]);
const error = ref("");

const localeOptions = computed<Array<{ value: AppLocale; label: string }>>(() => [
  { value: "zh-CN", label: t("common.zhCN") },
  { value: "en-US", label: t("common.enUS") }
]);

const themeOptions = computed<Array<{ value: AppTheme; label: string }>>(() => [
  { value: "dark", label: t("common.dark") },
  { value: "light", label: t("common.light") }
]);

function handleLocaleChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as AppLocale);
}

function handleThemeChange(event: Event) {
  setTheme((event.target as HTMLSelectElement).value as AppTheme);
}

async function load() {
  error.value = "";

  try {
    const [nextOverview, nextProviders, nextAuthProfiles, nextDevices] = await Promise.all([
      getOpenClawOverview(),
      getProviders(),
      getAuthProfiles(),
      getDevices()
    ]);

    overview.value = nextOverview;
    providers.value = nextProviders;
    authProfiles.value = nextAuthProfiles;
    devices.value = nextDevices;
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("settings.failedLoad", { message });
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
        <p class="eyebrow">{{ t("settings.eyebrow") }}</p>
        <h2>{{ t("settings.title") }}</h2>
        <p class="page-copy">
          {{ t("settings.copy") }}
        </p>
      </div>
    </header>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("settings.appearance") }}</p>
            <h3>{{ t("settings.appearanceTitle") }}</h3>
          </div>
        </div>
        <p class="panel-meta">{{ t("settings.appearanceCopy") }}</p>

        <div class="form-grid">
          <label class="form-field">
            <span>{{ t("app.language") }}</span>
            <select
              :value="uiPreferences.locale"
              class="text-input text-input-block"
              @change="handleLocaleChange"
            >
              <option
                v-for="option in localeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span>{{ t("app.theme") }}</span>
            <select
              :value="uiPreferences.theme"
              class="text-input text-input-block"
              @change="handleThemeChange"
            >
              <option
                v-for="option in themeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <dl class="kv-grid">
          <div>
            <dt>{{ t("common.currentLanguage") }}</dt>
            <dd>{{ uiPreferences.locale === "zh-CN" ? t("common.zhCN") : t("common.enUS") }}</dd>
          </div>
          <div>
            <dt>{{ t("common.currentTheme") }}</dt>
            <dd>{{ uiPreferences.theme === "dark" ? t("common.dark") : t("common.light") }}</dd>
          </div>
        </dl>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("settings.runtimeTarget") }}</p>
        <dl class="kv-grid">
          <div>
            <dt>{{ t("settings.runtimeUrl") }}</dt>
            <dd>{{ runtimeBaseUrl }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.desktopVersion") }}</dt>
            <dd>{{ appVersion }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.platform") }}</dt>
            <dd>{{ desktopPlatform }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.openclawHome") }}</dt>
            <dd>{{ overview?.homePath ?? "--" }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.userDataDir") }}</dt>
            <dd>{{ userDataDir }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.managedDataHome") }}</dt>
            <dd>{{ dataHome }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.dataHomeSource") }}</dt>
            <dd>{{ dataHomeSource }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.legacyImportSource") }}</dt>
            <dd>{{ legacyHome }}</dd>
          </div>
          <div>
            <dt>{{ t("settings.bundledRelayExtension") }}</dt>
            <dd>{{ bundledExtensionAvailable ? t("common.yes") : t("common.no") }}</dd>
          </div>
        </dl>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("settings.providers") }}</p>
        <ul class="metric-list">
          <li
            v-for="provider in providers"
            :key="provider.id"
          >
            {{ provider.id }} | models: {{ provider.modelCount }} | {{ provider.baseUrl ?? "--" }}
          </li>
        </ul>
      </article>
    </section>

    <section class="detail-grid compatibility-grid">
      <article class="panel wide">
        <p class="panel-label">{{ t("settings.authProfiles") }}</p>
        <ul class="session-list">
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
              <span>{{ t("settings.stored") }}: {{ profile.hasStoredCredentials ? t("common.yes") : t("common.no") }}</span>
              <span>{{ t("settings.lastUsed") }}: {{ formatDateTime(profile.lastUsedAt) }}</span>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel wide">
        <p class="panel-label">{{ t("settings.pairedDevices") }}</p>
        <ul class="session-list">
          <li
            v-for="device in devices"
            :key="device.deviceId"
            class="session-row"
          >
            <div>
              <strong>{{ device.deviceId }}</strong>
              <p>{{ device.platform ?? "unknown" }} / {{ device.clientId ?? "unknown client" }}</p>
            </div>
            <div class="session-meta">
              <span>{{ t("settings.role") }}: {{ device.role ?? "--" }}</span>
              <span>{{ t("settings.lastUsed") }}: {{ formatDateTime(device.lastUsedAt) }}</span>
            </div>
          </li>
        </ul>
      </article>
    </section>
  </section>
</template>
