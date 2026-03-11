import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import {
  createAgentStudyRoadmapFromSafeAction,
  getAgentStudyRoadmapsBoard,
  updateAgentStudyRoadmapStatus
} from "../packages/runtime-server/src/services/agent-study-roadmap.service.ts";
import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";

const roadmapHome = path.join(os.tmpdir(), "clawdesk-agent-study-roadmaps-smoke");
process.env.OPENCLAW_HOME = roadmapHome;

await rm(roadmapHome, { recursive: true, force: true });

const chat = await sendAgentChatMessage({
  content: "Help me create a six-week Python study plan for a freshman who only has one hour every evening."
});
const safeAction = await createAgentSafeActionFromChat({ conversationId: chat.conversation.conversationId });
if (!safeAction) {
  throw new Error("Expected a safe action to be created before study roadmap conversion.");
}

const roadmap = await createAgentStudyRoadmapFromSafeAction({ actionId: safeAction.actionId });
if (!roadmap) {
  throw new Error("Expected a study roadmap to be created from safe action.");
}

await updateAgentStudyRoadmapStatus(roadmap.roadmapId, { status: "active" });
const board = await getAgentStudyRoadmapsBoard();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      total: board.total,
      statusCounts: board.statusCounts,
      firstStatus: board.roadmaps[0]?.status ?? null,
      firstMilestoneCount: board.roadmaps[0]?.milestones.length ?? 0,
      firstWeekCount: board.roadmaps[0]?.weeklyPlan.length ?? 0,
      latestRoadmapActivityKind:
        feed.items.find((item) => item.kind === "agent-study-roadmap-created")?.kind ?? null
    },
    null,
    2
  )
);
