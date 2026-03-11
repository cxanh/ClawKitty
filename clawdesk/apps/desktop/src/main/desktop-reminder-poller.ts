import { Notification } from "electron";

import { appendDesktopLog } from "./logger.js";

interface DesktopReminderPollerOptions {
  baseUrl: string;
}

export interface DesktopReminderPoller {
  start(): void;
  stop(): void;
  pollNow(): Promise<void>;
}

interface ReminderPollResponse {
  success: boolean;
  data?: {
    deliveries: Array<{
      deliveryId: string;
      notificationTitle: string;
      notificationBody: string;
      scheduledFor: string;
      planId: string;
      eventType: string;
      windowLabel: string;
    }>;
  };
}

const POLL_INTERVAL_MS = 30_000;

export function createDesktopReminderPoller(options: DesktopReminderPollerOptions): DesktopReminderPoller {
  let timer: NodeJS.Timeout | null = null;
  let isPolling = false;

  async function pollNow() {
    if (isPolling) {
      return;
    }

    isPolling = true;
    try {
      const response = await fetch(`${options.baseUrl}/api/v1/agent-reminder-deliveries/poll`, {
        method: "POST"
      });

      if (!response.ok) {
        await appendDesktopLog("warn", "reminder poll failed", {
          status: response.status
        });
        return;
      }

      const payload = (await response.json()) as ReminderPollResponse;
      const deliveries = payload.data?.deliveries ?? [];
      for (const delivery of deliveries) {
        if (Notification.isSupported()) {
          new Notification({
            title: delivery.notificationTitle,
            body: delivery.notificationBody,
            silent: false
          }).show();
        }

        await appendDesktopLog("info", "desktop reminder delivered", {
          deliveryId: delivery.deliveryId,
          planId: delivery.planId,
          eventType: delivery.eventType,
          windowLabel: delivery.windowLabel,
          scheduledFor: delivery.scheduledFor
        });
      }
    } catch (error) {
      await appendDesktopLog("warn", "reminder poll failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      isPolling = false;
    }
  }

  return {
    start() {
      if (timer) {
        return;
      }

      void pollNow();
      timer = setInterval(() => {
        void pollNow();
      }, POLL_INTERVAL_MS);
    },
    stop() {
      if (!timer) {
        return;
      }

      clearInterval(timer);
      timer = null;
    },
    pollNow
  };
}
