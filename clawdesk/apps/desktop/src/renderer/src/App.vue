<script setup lang="ts">
import { RouterLink, RouterView } from "vue-router";

import { useI18n } from "./services/i18n";
import { useUiPreferences, type AppLocale, type AppTheme } from "./services/ui-preferences";

const { t } = useI18n();
const { uiPreferences, setLocale, setTheme } = useUiPreferences();

const navigation = [
  { to: "/", labelKey: "nav.dashboard" },
  { to: "/chat", labelKey: "nav.chat" },
  { to: "/activity", labelKey: "nav.activity" },
  { to: "/capabilities", labelKey: "nav.capabilities" },
  { to: "/permissions", labelKey: "nav.permissions" },
  { to: "/openclaw", labelKey: "nav.openclaw" },
  { to: "/sessions", labelKey: "nav.sessions" },
  { to: "/devices", labelKey: "nav.devices" },
  { to: "/tasks", labelKey: "nav.tasks" },
  { to: "/processes", labelKey: "nav.processes" },
  { to: "/settings", labelKey: "nav.settings" },
  { to: "/logs", labelKey: "nav.logs" }
];

const localeOptions: Array<{ value: AppLocale; labelKey: string }> = [
  { value: "zh-CN", labelKey: "common.zhCN" },
  { value: "en-US", labelKey: "common.enUS" }
];

const themeOptions: Array<{ value: AppTheme; labelKey: string }> = [
  { value: "dark", labelKey: "common.dark" },
  { value: "light", labelKey: "common.light" }
];

function handleLocaleChange(event: Event) {
  setLocale((event.target as HTMLSelectElement).value as AppLocale);
}

function handleThemeChange(event: Event) {
  setTheme((event.target as HTMLSelectElement).value as AppTheme);
}
</script>

<template>
  <main class="app-frame">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <p class="eyebrow">{{ t("app.eyebrow") }}</p>
        <h1>{{ t("app.title") }}</h1>
        <p class="sidebar-copy">
          {{ t("app.copy") }}
        </p>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-link"
        >
          {{ t(item.labelKey) }}
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <div class="sidebar-controls">
          <label class="form-field">
            <span>{{ t("app.language") }}</span>
            <select
              :value="uiPreferences.locale"
              class="select-input footer-select"
              @change="handleLocaleChange"
            >
              <option
                v-for="option in localeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>

          <label class="form-field">
            <span>{{ t("app.theme") }}</span>
            <select
              :value="uiPreferences.theme"
              class="select-input footer-select"
              @change="handleThemeChange"
            >
              <option
                v-for="option in themeOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ t(option.labelKey) }}
              </option>
            </select>
          </label>
        </div>

        <p>{{ t("app.workspace") }}: `clawdesk`</p>
        <p>{{ t("app.target") }}: {{ t("app.targetValue") }}</p>
      </div>
    </aside>

    <section class="page-shell">
      <RouterView />
    </section>
  </main>
</template>
