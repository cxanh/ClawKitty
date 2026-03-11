import {
  getOpenClawBrowserRelayStatus,
  getOpenClawOverview,
  listOpenClawPairedDevices,
  listOpenClawTasks
} from "@clawdesk/openclaw-core";
import type {
  DesktopOnboardingActionCode,
  DesktopOnboardingStatusPayload,
  DesktopOnboardingStep
} from "@clawdesk/shared-types";

function buildStep(
  id: DesktopOnboardingStep["id"],
  status: DesktopOnboardingStep["status"],
  evidence: string,
  actionCode: DesktopOnboardingActionCode = "none"
): DesktopOnboardingStep {
  return {
    id,
    status,
    evidence,
    actionCode
  };
}

export async function getDesktopOnboardingStatus(): Promise<DesktopOnboardingStatusPayload> {
  const [overview, relay, devices, tasks] = await Promise.all([
    getOpenClawOverview(),
    getOpenClawBrowserRelayStatus(),
    listOpenClawPairedDevices(),
    listOpenClawTasks()
  ]);

  const counts = {
    providers: overview.providerCount,
    authProfiles: overview.authProfileCount,
    sessions: overview.sessionCount,
    tasks: overview.taskCount,
    devices: devices.length
  };

  const isBlankWorkspace =
    counts.providers === 0 &&
    counts.authProfiles === 0 &&
    counts.sessions === 0 &&
    counts.tasks === 0 &&
    counts.devices === 0;

  const steps: DesktopOnboardingStep[] = [
    buildStep("managed-home", "complete", process.env.OPENCLAW_HOME ?? overview.homePath, "open-settings"),
    buildStep("runtime", "complete", "Local runtime is online.", "open-settings"),
    buildStep(
      "gateway",
      relay.gatewayStatus === "online" ? "complete" : "action-required",
      relay.gatewayStatus === "online"
        ? `Gateway online on port ${relay.gatewayPort ?? relay.relayPort}.`
        : "Gateway is not online yet.",
      "start-gateway"
    ),
    buildStep(
      "extension-files",
      relay.extensionAvailable ? "complete" : "action-required",
      relay.extensionAvailable ? relay.extensionPath : "Bundled extension files are missing.",
      "open-extension-folder"
    ),
    buildStep(
      "extension-connection",
      relay.extensionConnected ? "complete" : "action-required",
      relay.extensionConnected ? "Browser extension is connected." : "Open Chrome and click the relay extension once.",
      "open-extension-options"
    ),
    buildStep(
      "workspace",
      isBlankWorkspace ? "action-required" : "complete",
      isBlankWorkspace ? "Workspace is still empty." : "Workspace already has imported or newly-created data.",
      isBlankWorkspace ? "open-settings" : "explore-workspace"
    )
  ];

  let nextActionCode: DesktopOnboardingStatusPayload["nextActionCode"] = "explore-workspace";
  let completionState: DesktopOnboardingStatusPayload["completionState"] = "workspace-ready";
  let completionMessage = "Workspace is ready to explore.";

  if (relay.gatewayStatus !== "online") {
    nextActionCode = "start-gateway";
    completionState = "waiting-gateway";
    completionMessage = "Gateway still needs to come online before browser relay can be used.";
  } else if (!relay.extensionAvailable) {
    nextActionCode = "open-extension-folder";
    completionState = "waiting-extension-files";
    completionMessage = "Bundled extension files still need to be loaded into Chrome.";
  } else if (!relay.extensionConnected) {
    nextActionCode = "open-extension-options";
    completionState = "waiting-extension-connect";
    completionMessage = "Extension files are present. Open the extension and connect it to the relay.";
  } else if (relay.targetCount > 0) {
    completionState = "relay-active";
    completionMessage = `Relay is active and currently sees ${relay.targetCount} target(s).`;
  } else if (relay.extensionConnected) {
    completionState = "relay-ready";
    completionMessage = "Extension is connected. Open a regular browser tab to create the first relay target.";
  } else if (isBlankWorkspace) {
    nextActionCode = "open-settings";
    completionState = "workspace-ready";
    completionMessage = "Runtime is ready. The workspace is still blank and ready for first-time setup.";
  }

  return {
    generatedAt: new Date().toISOString(),
    dataHome: process.env.OPENCLAW_HOME ?? overview.homePath,
    dataHomeSource:
      process.env.CLAWDESK_DATA_HOME_SOURCE === "fresh" ||
      process.env.CLAWDESK_DATA_HOME_SOURCE === "legacy-import" ||
      process.env.CLAWDESK_DATA_HOME_SOURCE === "existing-managed"
        ? process.env.CLAWDESK_DATA_HOME_SOURCE
        : "unknown",
    legacyHome: process.env.CLAWDESK_LEGACY_IMPORTED_HOME || null,
    bundledExtensionAvailable: process.env.CLAWDESK_BUNDLED_EXTENSION_AVAILABLE === "1",
    isBlankWorkspace,
    counts,
    relay: {
      gatewayStatus: relay.gatewayStatus,
      relayStatus: relay.relayStatus,
      extensionConnected: relay.extensionConnected,
      targetCount: relay.targetCount,
      extensionAvailable: relay.extensionAvailable
    },
    paths: {
      extensionPath: relay.extensionPath,
      extensionOptionsPath: relay.optionsPath
    },
    completionState,
    completionMessage,
    relayTargetsPreview: relay.targets
      .slice(0, 3)
      .map((target) => target.title || target.url || target.id),
    nextActionCode,
    steps
  };
}
