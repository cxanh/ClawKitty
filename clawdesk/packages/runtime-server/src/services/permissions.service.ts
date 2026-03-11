import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  PermissionApprovalHistoryEntry,
  PermissionPolicyMode,
  PermissionRiskDefault,
  PermissionRiskDefaultsUpdateInput,
  PermissionRiskLevel,
  PermissionsOverviewPayload,
  PermissionToolPolicy,
  PermissionToolPolicyUpdateInput
} from "@clawdesk/shared-types";
import { listOpenClawPairingAuditEntries, listOpenClawPairedDevices } from "@clawdesk/openclaw-core";

import { listApprovalRequests } from "./approval.service.js";
import { appendActivityItem, getActivityFeed } from "./activity.service.js";

interface PermissionsConfig {
  riskDefaults?: Partial<Record<PermissionRiskLevel, PermissionPolicyMode>>;
  toolOverrides?: Record<string, PermissionPolicyMode>;
  updatedAt?: string;
}

interface ToolDefinition {
  toolId: string;
  displayName: string;
  description: string;
  risk: PermissionRiskLevel;
  recommendedPolicy: PermissionPolicyMode;
  desktopOnly: boolean;
  mobileVisible: boolean;
  fixedPolicy?: PermissionPolicyMode;
}

const defaultRiskPolicies: Record<PermissionRiskLevel, PermissionPolicyMode> = {
  low: "allow",
  medium: "ask",
  high: "desktop-approve"
};

const riskDescriptions: Record<PermissionRiskLevel, string> = {
  low: "Low-risk actions can usually run automatically without interrupting the user.",
  medium: "Medium-risk actions should usually ask first or follow the user's chosen policy.",
  high: "High-risk actions affect files, processes, or settings and should stay approval-sensitive."
};

const toolDefinitions: ToolDefinition[] = [
  {
    toolId: "device-read",
    displayName: "Device summary",
    description: "Read CPU, memory, disk, network, and device status.",
    risk: "low",
    recommendedPolicy: "allow",
    desktopOnly: false,
    mobileVisible: true
  },
  {
    toolId: "task-read",
    displayName: "Task overview",
    description: "Read Agent task cards and automation summaries.",
    risk: "low",
    recommendedPolicy: "allow",
    desktopOnly: false,
    mobileVisible: true
  },
  {
    toolId: "task-write",
    displayName: "Task changes",
    description: "Create or update task cards and lightweight task flows.",
    risk: "medium",
    recommendedPolicy: "ask",
    desktopOnly: false,
    mobileVisible: true
  },
  {
    toolId: "browser-relay-control",
    displayName: "Browser Relay control",
    description: "Open, focus, or close relay-managed browser tabs.",
    risk: "medium",
    recommendedPolicy: "desktop-approve",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "file-search",
    displayName: "File search",
    description: "Search local files and return paths, sizes, and timestamps.",
    risk: "low",
    recommendedPolicy: "allow",
    desktopOnly: false,
    mobileVisible: true
  },
  {
    toolId: "file-organize",
    displayName: "File organize",
    description: "Create folders, move files, and batch organize learning materials.",
    risk: "medium",
    recommendedPolicy: "ask",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "device-remove",
    displayName: "Device remove",
    description: "Remove a paired device from the desktop registry.",
    risk: "high",
    recommendedPolicy: "desktop-approve",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "file-delete",
    displayName: "File delete",
    description: "Delete local files or remove large groups of materials.",
    risk: "high",
    recommendedPolicy: "desktop-approve",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "process-kill",
    displayName: "Process kill",
    description: "Terminate a running process on the desktop device.",
    risk: "high",
    recommendedPolicy: "desktop-approve",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "desktop-settings-write",
    displayName: "Desktop settings write",
    description: "Modify desktop-side runtime or app settings.",
    risk: "high",
    recommendedPolicy: "desktop-approve",
    desktopOnly: true,
    mobileVisible: false
  },
  {
    toolId: "provider-credentials-read",
    displayName: "Provider credentials read",
    description: "Read provider credentials or secret-bearing auth state.",
    risk: "high",
    recommendedPolicy: "deny",
    desktopOnly: true,
    mobileVisible: false,
    fixedPolicy: "deny"
  }
];

export class PermissionsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionsValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getPermissionsConfigPath() {
  return path.join(getManagedHome(), "agent-assistant", "permissions.json");
}

async function ensurePermissionsDirectory() {
  await mkdir(path.dirname(getPermissionsConfigPath()), { recursive: true });
}

async function readPermissionsConfig(): Promise<PermissionsConfig> {
  try {
    const raw = await readFile(getPermissionsConfigPath(), "utf8");
    return JSON.parse(raw) as PermissionsConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writePermissionsConfig(config: PermissionsConfig) {
  await ensurePermissionsDirectory();
  await writeFile(getPermissionsConfigPath(), JSON.stringify(config, null, 2), "utf8");
}

function isPolicyMode(value: unknown): value is PermissionPolicyMode {
  return value === "allow" || value === "ask" || value === "desktop-approve" || value === "deny";
}

function resolveRiskDefaults(config: PermissionsConfig): PermissionRiskDefault[] {
  return (["low", "medium", "high"] as PermissionRiskLevel[]).map((risk) => ({
    risk,
    policy: config.riskDefaults?.[risk] ?? defaultRiskPolicies[risk],
    description: riskDescriptions[risk]
  }));
}

function resolveToolPolicies(config: PermissionsConfig): PermissionToolPolicy[] {
  const riskMap = Object.fromEntries(resolveRiskDefaults(config).map((item) => [item.risk, item.policy])) as Record<
    PermissionRiskLevel,
    PermissionPolicyMode
  >;

  return toolDefinitions.map((tool) => {
    const override = config.toolOverrides?.[tool.toolId];
    const effectivePolicy = tool.fixedPolicy ?? (isPolicyMode(override) ? override : riskMap[tool.risk] ?? tool.recommendedPolicy);
    const source: PermissionToolPolicy["source"] = tool.fixedPolicy
      ? "locked"
      : isPolicyMode(override)
        ? "override"
        : "default";

    return {
      toolId: tool.toolId,
      displayName: tool.displayName,
      description: tool.description,
      risk: tool.risk,
      policy: effectivePolicy,
      recommendedPolicy: tool.recommendedPolicy,
      source,
      desktopOnly: tool.desktopOnly,
      mobileVisible: tool.mobileVisible
    };
  });
}

export async function listPermissionRiskDefaults() {
  const config = await readPermissionsConfig();
  return resolveRiskDefaults(config);
}

export async function listPermissionToolPolicies() {
  const config = await readPermissionsConfig();
  return resolveToolPolicies(config);
}

function mapPairingDecision(kind: string): PermissionApprovalHistoryEntry["decision"] | null {
  switch (kind) {
    case "request-approved":
      return "approved";
    case "request-rejected":
    case "session-expired":
      return "rejected";
    case "device-scopes-updated":
      return "updated";
    case "device-removed":
      return "revoked";
    default:
      return null;
  }
}

async function buildApprovalHistory(): Promise<PermissionApprovalHistoryEntry[]> {
  const [pairingAudit, activity] = await Promise.all([listOpenClawPairingAuditEntries(12), getActivityFeed(24)]);

  const auditEntries = pairingAudit
    .map<PermissionApprovalHistoryEntry | null>((entry) => {
      const decision = mapPairingDecision(entry.kind);
      if (!decision) {
        return null;
      }

      return {
        entryId: entry.id,
        source: "pairing-audit",
        timestamp: entry.timestamp,
        title: entry.kind.replace(/-/g, " "),
        summary: entry.summary,
        actor: entry.actor,
        decision
      };
    })
    .filter((entry): entry is PermissionApprovalHistoryEntry => Boolean(entry));

  const policyEntries = activity.items
    .filter(
      (item) =>
        item.kind === "permission-policy-updated" ||
        item.kind === "permission-tool-policy-updated" ||
        item.kind === "approval-request-approved" ||
        item.kind === "approval-request-rejected"
    )
    .map<PermissionApprovalHistoryEntry>((item) => ({
      entryId: item.activityId,
      source: "policy-activity",
      timestamp: item.occurredAt,
      title: item.title,
      summary: item.summary,
      actor: item.actor,
      decision:
        item.kind === "approval-request-approved"
          ? "approved"
          : item.kind === "approval-request-rejected"
            ? "rejected"
            : "updated"
    }));

  return [...auditEntries, ...policyEntries]
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
    .slice(0, 20);
}

export async function getPermissionsOverview(): Promise<PermissionsOverviewPayload> {
  const [config, devices, pendingRequests, approvalHistory] = await Promise.all([
    readPermissionsConfig(),
    listOpenClawPairedDevices(),
    listApprovalRequests(20),
    buildApprovalHistory()
  ]);

  return {
    generatedAt: new Date().toISOString(),
    riskDefaults: resolveRiskDefaults(config),
    toolPolicies: resolveToolPolicies(config),
    deviceSnapshot: {
      total: devices.length,
      approved: devices.filter((device) => device.approvedScopes.length >= device.scopes.length && device.scopes.length > 0).length,
      partial: devices.filter(
        (device) => device.approvedScopes.length > 0 && device.approvedScopes.length < device.scopes.length
      ).length,
      pending: devices.filter((device) => device.approvedScopes.length === 0).length,
      recent: devices.filter((device) => {
        if (!device.lastUsedAt) {
          return false;
        }
        const ageMs = Date.now() - Date.parse(device.lastUsedAt);
        return !Number.isNaN(ageMs) && ageMs <= 1000 * 60 * 60 * 24 * 7;
      }).length
    },
    pendingRequests,
    approvalHistory
  };
}

export async function updatePermissionRiskDefaults(input: PermissionRiskDefaultsUpdateInput) {
  const nextValues = {
    low: input.low,
    medium: input.medium,
    high: input.high
  };

  for (const [risk, policy] of Object.entries(nextValues)) {
    if (policy !== undefined && !isPolicyMode(policy)) {
      throw new PermissionsValidationError(`Invalid policy for ${risk}.`);
    }
  }

  const config = await readPermissionsConfig();
  config.riskDefaults = {
    low: nextValues.low ?? config.riskDefaults?.low ?? defaultRiskPolicies.low,
    medium: nextValues.medium ?? config.riskDefaults?.medium ?? defaultRiskPolicies.medium,
    high: nextValues.high ?? config.riskDefaults?.high ?? defaultRiskPolicies.high
  };
  config.updatedAt = new Date().toISOString();
  await writePermissionsConfig(config);

  await appendActivityItem({
    kind: "permission-policy-updated",
    title: "Permission defaults updated",
    summary: `Updated default permission policies for low, medium, or high risk actions.`,
    actor: "user",
    metadata: {
      riskDefaults: config.riskDefaults
    }
  });

  return getPermissionsOverview();
}

export async function updatePermissionToolPolicy(toolId: string, input: PermissionToolPolicyUpdateInput) {
  if (!isPolicyMode(input.policy)) {
    throw new PermissionsValidationError("Invalid tool policy.");
  }

  const definition = toolDefinitions.find((item) => item.toolId === toolId);
  if (!definition) {
    return null;
  }

  if (definition.fixedPolicy) {
    throw new PermissionsValidationError(`${toolId} is locked and cannot be changed.`);
  }

  const config = await readPermissionsConfig();
  config.toolOverrides = {
    ...(config.toolOverrides ?? {}),
    [toolId]: input.policy
  };
  config.updatedAt = new Date().toISOString();
  await writePermissionsConfig(config);

  await appendActivityItem({
    kind: "permission-tool-policy-updated",
    title: "Tool permission updated",
    summary: `Updated the policy for ${definition.displayName} to ${input.policy}.`,
    actor: "user",
    metadata: {
      toolId,
      policy: input.policy,
      risk: definition.risk
    }
  });

  const overview = await getPermissionsOverview();
  return overview.toolPolicies.find((item) => item.toolId === toolId) ?? null;
}
