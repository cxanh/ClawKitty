import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import {
  getPermissionsOverview,
  updatePermissionRiskDefaults,
  updatePermissionToolPolicy
} from "../packages/runtime-server/src/services/permissions.service.ts";

const permissionsHome = path.join(os.tmpdir(), "clawdesk-permissions-smoke");
process.env.OPENCLAW_HOME = permissionsHome;

await rm(permissionsHome, { recursive: true, force: true });

const initial = await getPermissionsOverview();
const updatedDefaults = await updatePermissionRiskDefaults({
  low: "allow",
  medium: "desktop-approve",
  high: "deny"
});
const updatedTool = await updatePermissionToolPolicy("task-write", { policy: "desktop-approve" });
const activity = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      initialToolCount: initial.toolPolicies.length,
      mediumPolicy: updatedDefaults.riskDefaults.find((item) => item.risk === "medium")?.policy ?? null,
      highPolicy: updatedDefaults.riskDefaults.find((item) => item.risk === "high")?.policy ?? null,
      taskWritePolicy: updatedTool?.policy ?? null,
      recentActivityKinds: activity.items.slice(0, 2).map((item) => item.kind)
    },
    null,
    2
  )
);
