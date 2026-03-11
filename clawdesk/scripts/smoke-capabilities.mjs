import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getCapabilitiesOverview } from "../packages/runtime-server/src/services/capabilities.service.ts";

const capabilitiesHome = path.join(os.tmpdir(), "clawdesk-capabilities-smoke");
process.env.OPENCLAW_HOME = capabilitiesHome;

await rm(capabilitiesHome, { recursive: true, force: true });

const payload = await getCapabilitiesOverview();

console.log(
  JSON.stringify(
    {
      modelCount: payload.counts.models,
      availableSkills: payload.counts.availableSkills,
      availableTools: payload.counts.availableTools,
      firstSkill: payload.skills[0]?.id ?? null,
      firstTool: payload.tools[0]?.id ?? null,
      firstToolPolicy: payload.tools[0]?.currentPolicy ?? null,
      firstToolPolicySource: payload.tools[0]?.policySource ?? null,
      firstToolApprovalRequired: payload.tools[0]?.approvalRequired ?? null
    },
    null,
    2
  )
);
