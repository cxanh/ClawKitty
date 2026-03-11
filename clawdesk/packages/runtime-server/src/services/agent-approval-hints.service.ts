import type { AgentApprovalHint, AgentChatReplyMode, PermissionPolicyMode, PermissionToolPolicy } from "@clawdesk/shared-types";

import { listPermissionToolPolicies } from "./permissions.service.js";

const replyModeToolMap: Record<AgentChatReplyMode, string[]> = {
  welcome: [],
  general: ["task-write", "browser-relay-control"],
  "course-reminder": ["task-write"],
  "file-search": ["file-organize", "file-delete"],
  "study-plan": ["task-write"],
  "memory-reminder": ["task-write"]
};

function buildPolicySummary(tool: PermissionToolPolicy) {
  switch (tool.policy) {
    case "allow":
      return `${tool.displayName} can run automatically under the current policy.`;
    case "ask":
      return `${tool.displayName} will ask before the Agent applies changes.`;
    case "desktop-approve":
      return `${tool.displayName} needs desktop approval before it runs.`;
    case "deny":
      return `${tool.displayName} is blocked right now in Permissions.`;
    default:
      return `${tool.displayName} follows the current workspace policy.`;
  }
}

function shouldSurfacePolicy(tool: PermissionToolPolicy) {
  return tool.policy !== "allow";
}

function toHint(tool: PermissionToolPolicy): AgentApprovalHint {
  return {
    toolId: tool.toolId,
    toolDisplayName: tool.displayName,
    risk: tool.risk,
    policy: tool.policy,
    summary: buildPolicySummary(tool)
  };
}

export function isApprovalSensitivePolicy(policy: PermissionPolicyMode) {
  return policy === "ask" || policy === "desktop-approve";
}

export async function buildApprovalHintsForReplyMode(replyMode: AgentChatReplyMode): Promise<AgentApprovalHint[]> {
  const toolIds = replyModeToolMap[replyMode] ?? [];
  if (!toolIds.length) {
    return [];
  }

  const policies = await listPermissionToolPolicies();
  const policyMap = new Map(policies.map((tool) => [tool.toolId, tool]));

  return toolIds
    .map((toolId) => policyMap.get(toolId) ?? null)
    .filter((tool): tool is PermissionToolPolicy => Boolean(tool))
    .filter(shouldSurfacePolicy)
    .map(toHint);
}
