import { getCurrentLocale } from "./ui-preferences";

export function formatBytesToGb(bytes: number) {
  return new Intl.NumberFormat(getCurrentLocale(), {
    maximumFractionDigits: 1
  }).format(bytes / 1024 / 1024 / 1024);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString(getCurrentLocale());
}

export function formatDurationMs(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }

  const locale = getCurrentLocale();
  const isZh = locale === "zh-CN";

  if (value < 1000) {
    return `${value} ${isZh ? "毫秒" : "ms"}`;
  }

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} ${isZh ? "秒" : "s"}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = Math.round(seconds % 60);
  return isZh ? `${minutes}分 ${remainSeconds}秒` : `${minutes}m ${remainSeconds}s`;
}
