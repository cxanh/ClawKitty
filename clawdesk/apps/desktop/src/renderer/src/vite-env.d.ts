/// <reference types="vite/client" />

import type { DesktopBridge } from "@clawdesk/shared-types";

declare global {
  interface Window {
    clawdesk: DesktopBridge;
  }
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

export {};
