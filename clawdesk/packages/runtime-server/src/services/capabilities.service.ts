import type {
  CapabilitiesOverviewPayload,
  CapabilityModelInfo,
  CapabilitySkillInfo,
  CapabilityToolInfo,
  PermissionToolPolicy
} from "@clawdesk/shared-types";
import {
  getOpenClawBrowserRelayStatus,
  listOpenClawPairedDevices,
  listOpenClawProviders,
  listOpenClawTasks
} from "@clawdesk/openclaw-core";

import { isApprovalSensitivePolicy } from "./agent-approval-hints.service.js";
import { listPermissionRiskDefaults, listPermissionToolPolicies } from "./permissions.service.js";

const capabilityPolicyToolMap: Partial<Record<string, string>> = {
  "browser-relay-control": "browser-relay-control",
  "device-monitoring": "device-read",
  "task-automation": "task-write",
  "process-inspection": "process-kill",
  "local-file-search": "file-search"
};

function buildPolicyMeta(
  toolId: string,
  riskLevel: CapabilityToolInfo["riskLevel"],
  riskDefaultsMap: Map<CapabilityToolInfo["riskLevel"], CapabilityToolInfo["currentPolicy"]>,
  toolPoliciesMap: Map<string, PermissionToolPolicy>
) {
  const mappedPolicy = capabilityPolicyToolMap[toolId] ? toolPoliciesMap.get(capabilityPolicyToolMap[toolId]!) : null;
  const fallbackPolicy = riskDefaultsMap.get(riskLevel) ?? "ask";

  return {
    currentPolicy: mappedPolicy?.policy ?? fallbackPolicy,
    recommendedPolicy: mappedPolicy?.recommendedPolicy ?? fallbackPolicy,
    policySource: mappedPolicy?.source ?? "default",
    approvalRequired: mappedPolicy ? isApprovalSensitivePolicy(mappedPolicy.policy) : isApprovalSensitivePolicy(fallbackPolicy)
  };
}

export async function getCapabilitiesOverview(): Promise<CapabilitiesOverviewPayload> {
  const [providers, tasks, devices, relay, riskDefaults, toolPolicies] = await Promise.all([
    listOpenClawProviders(),
    listOpenClawTasks(),
    listOpenClawPairedDevices(),
    getOpenClawBrowserRelayStatus(),
    listPermissionRiskDefaults(),
    listPermissionToolPolicies()
  ]);

  const riskDefaultsMap = new Map(riskDefaults.map((item) => [item.risk, item.policy]));
  const toolPoliciesMap = new Map(toolPolicies.map((item) => [item.toolId, item]));

  const models: CapabilityModelInfo[] = providers.map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
    providerId: provider.id,
    apiKind: provider.apiKind,
    baseUrl: provider.baseUrl,
    modelCount: provider.modelCount,
    availability: provider.modelCount > 0 ? "available" : "partial",
    notes: [
      provider.baseUrl ? `Base URL: ${provider.baseUrl}` : "Base URL not configured.",
      provider.apiKind ? `API kind: ${provider.apiKind}` : "API kind not declared."
    ]
  }));

  const skills: CapabilitySkillInfo[] = [
    {
      id: "course-reminder",
      displayName: "Course reminders",
      category: "awareness",
      availability: "available",
      summary: "Turn class schedules into night-before and afternoon reminders.",
      beginnerValue: "Great for freshmen who are still building stable class routines.",
      triggerExamples: ["Remind me about tomorrow's 8am class", "Help me import my weekly timetable"],
      requiresApproval: false
    },
    {
      id: "file-organization",
      displayName: "File organization",
      category: "organization",
      availability: "partial",
      summary: "Plan file lookup and organization workflows for homework and materials.",
      beginnerValue: "Helps students stop losing assignments and sign-up materials.",
      triggerExamples: ["Help me find last week's assignment", "Plan a file organization system"],
      requiresApproval: false
    },
    {
      id: "study-planning",
      displayName: "Study planning",
      category: "study",
      availability: "available",
      summary: "Break a new subject or language into milestones, weekly goals, and review loops.",
      beginnerValue: "Useful when a student wants structure without already knowing how to learn the topic.",
      triggerExamples: ["Make me a 6-week Python plan", "Help me learn C from zero"],
      requiresApproval: false
    },
    {
      id: "memory-reminders",
      displayName: "Memory reminders",
      category: "planning",
      availability: "available",
      summary: "Track birthdays, meetings, and personal reminders with light proactive suggestions.",
      beginnerValue: "Helps students remember important people and events without building a full system alone.",
      triggerExamples: ["Remind me about Friday's meeting", "Help me remember my roommate's birthday"],
      requiresApproval: false
    },
    {
      id: "capability-explainer",
      displayName: "Capability explainer",
      category: "awareness",
      availability: "available",
      summary: "Explain which models, tools, and device functions are currently usable.",
      beginnerValue: "Reduces confusion by showing what the Agent can and cannot do right now.",
      triggerExamples: ["What can you do now?", "Which tools are currently available?"],
      requiresApproval: false
    }
  ];

  const tools: CapabilityToolInfo[] = [
    {
      id: "browser-relay-control",
      displayName: "Browser Relay control",
      availability: relay.relayStatus === "online" && relay.extensionConnected ? "available" : relay.relayStatus === "online" ? "partial" : "planned",
      summary: "Open, focus, and close browser tabs through the relay bridge.",
      riskLevel: "medium",
      mobileReady: false,
      ...buildPolicyMeta("browser-relay-control", "medium", riskDefaultsMap, toolPoliciesMap),
      notes: [
        `Relay status: ${relay.relayStatus}`,
        `Extension connected: ${relay.extensionConnected}`,
        "Detach without closing is still extension-side only."
      ]
    },
    {
      id: "device-monitoring",
      displayName: "Device monitoring",
      availability: "available",
      summary: "Show runtime health, paired devices, and device management controls.",
      riskLevel: "low",
      mobileReady: true,
      ...buildPolicyMeta("device-monitoring", "low", riskDefaultsMap, toolPoliciesMap),
      notes: [`Paired devices currently known: ${devices.length}`]
    },
    {
      id: "task-automation",
      displayName: "Task automation",
      availability: "available",
      summary: "Create and manage lower-level automation tasks plus higher-level Agent task cards.",
      riskLevel: "medium",
      mobileReady: false,
      ...buildPolicyMeta("task-automation", "medium", riskDefaultsMap, toolPoliciesMap),
      notes: [`Automation tasks currently defined: ${tasks.length}`]
    },
    {
      id: "process-inspection",
      displayName: "Process inspection",
      availability: "available",
      summary: "Inspect local processes and terminate them from the desktop control plane.",
      riskLevel: "high",
      mobileReady: false,
      ...buildPolicyMeta("process-inspection", "high", riskDefaultsMap, toolPoliciesMap),
      notes: ["High-risk actions should remain approval-gated."]
    },
    {
      id: "log-and-activity",
      displayName: "Logs and activity",
      availability: "available",
      summary: "Review structured logs and a user-readable Agent activity timeline.",
      riskLevel: "low",
      mobileReady: true,
      ...buildPolicyMeta("log-and-activity", "low", riskDefaultsMap, toolPoliciesMap),
      notes: ["Activity Feed is user-facing. Logs remain the deeper troubleshooting layer."]
    },
    {
      id: "local-file-search",
      displayName: "Local file search integration",
      availability: "planned",
      summary: "Future local file search integration for assignment and material lookup.",
      riskLevel: "medium",
      mobileReady: true,
      ...buildPolicyMeta("local-file-search", "medium", riskDefaultsMap, toolPoliciesMap),
      notes: ["Everything-based integration is a candidate path for Windows."]
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    counts: {
      models: models.length,
      availableSkills: skills.filter((item) => item.availability === "available").length,
      availableTools: tools.filter((item) => item.availability === "available").length
    },
    models,
    skills,
    tools
  };
}

export async function listCapabilityModels() {
  const payload = await getCapabilitiesOverview();
  return payload.models;
}

export async function listCapabilitySkills() {
  const payload = await getCapabilitiesOverview();
  return payload.skills;
}

export async function listCapabilityTools() {
  const payload = await getCapabilitiesOverview();
  return payload.tools;
}
