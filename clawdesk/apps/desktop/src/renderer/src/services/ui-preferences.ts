import { reactive } from "vue";

export type AppLocale = "zh-CN" | "en-US";
export type AppTheme = "dark" | "light";

const localeStorageKey = "clawdesk.locale";
const themeStorageKey = "clawdesk.theme";

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function readStoredLocale(): AppLocale {
  if (!canUseDom()) {
    return "zh-CN";
  }

  const stored = window.localStorage.getItem(localeStorageKey);
  return stored === "en-US" ? "en-US" : "zh-CN";
}

function readStoredTheme(): AppTheme {
  if (!canUseDom()) {
    return "dark";
  }

  const stored = window.localStorage.getItem(themeStorageKey);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export const uiPreferences = reactive({
  locale: readStoredLocale() as AppLocale,
  theme: readStoredTheme() as AppTheme
});

function applyLocale(locale: AppLocale) {
  if (!canUseDom()) {
    return;
  }

  document.documentElement.lang = locale;
}

function applyTheme(theme: AppTheme) {
  if (!canUseDom()) {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function initializeUiPreferences() {
  applyLocale(uiPreferences.locale);
  applyTheme(uiPreferences.theme);
}

export function setLocale(locale: AppLocale) {
  uiPreferences.locale = locale;

  if (canUseDom()) {
    window.localStorage.setItem(localeStorageKey, locale);
  }

  applyLocale(locale);
}

export function setTheme(theme: AppTheme) {
  uiPreferences.theme = theme;

  if (canUseDom()) {
    window.localStorage.setItem(themeStorageKey, theme);
  }

  applyTheme(theme);
}

export function getCurrentLocale() {
  return uiPreferences.locale;
}

export function useUiPreferences() {
  return {
    uiPreferences,
    setLocale,
    setTheme
  };
}
