import type { RuntimeHealth } from "@clawdesk/shared-types";
import { getOpenClawBrowserRelayStatus, getOpenClawOverview } from "@clawdesk/openclaw-core";

export async function getRuntimeHealth(): Promise<RuntimeHealth> {
  try {
    const [relay, overview] = await Promise.all([
      getOpenClawBrowserRelayStatus(),
      getOpenClawOverview()
    ]);

    return {
      status: "online",
      version: "0.1.0",
      uptimeSec: Math.round(process.uptime()),
      collectorStatus: "online",
      openclawCoreStatus: overview.available ? "online" : "offline",
      browserRelayStatus: relay.relayStatus
    };
  } catch {
    return {
      status: "degraded",
      version: "0.1.0",
      uptimeSec: Math.round(process.uptime()),
      collectorStatus: "online",
      openclawCoreStatus: "offline",
      browserRelayStatus: "unknown"
    };
  }
}
