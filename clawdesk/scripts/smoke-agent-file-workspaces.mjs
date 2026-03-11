import os from "node:os";
import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import {
  createAgentFileWorkspaceFromSafeAction,
  getAgentFileWorkspacesBoard,
  previewAgentFileWorkspaceOrganization,
  searchAgentFileWorkspace,
  updateAgentFileWorkspaceStatus
} from "../packages/runtime-server/src/services/agent-file-workspace.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const workspaceHome = path.join(os.tmpdir(), "clawdesk-agent-file-workspaces-smoke");
process.env.OPENCLAW_HOME = workspaceHome;

await rm(workspaceHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content:
    "Help me organize my freshman files. I need a workspace that can find homework documents and signup materials, and show file path, saved time, and size."
});
const safeAction = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!safeAction) {
  throw new Error("Expected a safe action to be created before file workspace conversion.");
}

const workspace = await createAgentFileWorkspaceFromSafeAction({ actionId: safeAction.actionId });
if (!workspace) {
  throw new Error("Expected a file workspace to be created from safe action.");
}

const fixtureRoot = path.join(workspaceHome, "fixture-files");
await mkdir(fixtureRoot, { recursive: true });
await writeFile(path.join(fixtureRoot, "Calculus-homework-week1.pdf"), "fixture", "utf8");
await writeFile(path.join(fixtureRoot, "club-signup-materials.docx"), "fixture", "utf8");

const fakeEverythingScriptPath = path.join(workspaceHome, "fake-everything-cli.mjs");
await writeFile(
  fakeEverythingScriptPath,
  [
    "const root = process.env.CLAWDESK_FAKE_EVERYTHING_ROOT;",
    "if (!root) { process.exit(1); }",
    "console.log(`${root}\\\\Calculus-homework-week1.pdf`);",
    "console.log(`${root}\\\\club-signup-materials.docx`);"
  ].join("\n"),
  "utf8"
);
process.env.CLAWDESK_EVERYTHING_CLI_PATH = process.execPath;
process.env.CLAWDESK_EVERYTHING_CLI_ARGS = fakeEverythingScriptPath;
process.env.CLAWDESK_FAKE_EVERYTHING_ROOT = fixtureRoot;

const workspaceFilePath = path.join(workspaceHome, "agent-assistant", "file-workspaces.json");
const workspaces = JSON.parse(await readFile(workspaceFilePath, "utf8"));
workspaces[0].searchRoots = [
  {
    rootId: "fixture-root",
    label: "Fixture root",
    path: fixtureRoot,
    exists: true,
    source: "custom"
  }
];
await writeFile(workspaceFilePath, JSON.stringify(workspaces, null, 2), "utf8");

await updateAgentFileWorkspaceStatus(workspace.workspaceId, { status: "active" });
const board = await getAgentFileWorkspacesBoard();
const search = await searchAgentFileWorkspace(workspace.workspaceId, {
  query: "homework",
  limit: 12
});
const preview = await previewAgentFileWorkspaceOrganization(workspace.workspaceId, {
  query: "homework",
  limit: 12
});
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      total: board.total,
      firstStatus: board.workspaces[0]?.status ?? null,
      firstResultFieldCount: board.workspaces[0]?.resultFields.length ?? 0,
      firstSearchRootCount: board.workspaces[0]?.searchRoots.length ?? 0,
      searchReturnedCount: search?.returnedCount ?? 0,
      firstSearchFileName: search?.results[0]?.fileName ?? null,
      searchAccelerationProvider: search?.acceleration.provider ?? null,
      searchAccelerationUsed: search?.acceleration.used ?? false,
      suggestionCount: search?.suggestions.length ?? 0,
      firstSuggestionTitle: search?.suggestions[0]?.title ?? null,
      previewItemCount: preview?.totalItems ?? 0,
      firstPreviewFolder: preview?.items[0]?.suggestedFolder ?? null,
      firstTimeGroupLabel: search?.timeGroups[0]?.label ?? null,
      firstEventGroupLabel: search?.eventGroups[0]?.label ?? null,
      eventGroupCount: search?.eventGroups.length ?? 0,
      latestWorkspaceActivityKind:
        feed.items.find((item) => item.kind === "agent-file-workspace-preview-created")?.kind ??
        feed.items.find((item) => item.kind === "agent-file-workspace-created")?.kind ??
        null
    },
    null,
    2
  )
);
