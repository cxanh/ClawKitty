import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentSafeActionRecord,
  AgentStudyRoadmapFromSafeActionInput,
  AgentStudyRoadmapRecord,
  AgentStudyRoadmapsBoardPayload,
  AgentStudyRoadmapStatusUpdateInput
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { getAgentSafeAction } from "./agent-safe-action.service.js";

class AgentStudyRoadmapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentStudyRoadmapValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getStudyRoadmapFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "study-roadmaps.json");
}

async function ensureStudyRoadmapDirectory() {
  await mkdir(path.dirname(getStudyRoadmapFilePath()), { recursive: true });
}

async function readStudyRoadmaps(): Promise<AgentStudyRoadmapRecord[]> {
  try {
    const raw = await readFile(getStudyRoadmapFilePath(), "utf8");
    return (JSON.parse(raw) as AgentStudyRoadmapRecord[]).map((roadmap): AgentStudyRoadmapRecord => ({
      ...roadmap,
      sourceOrchestration: roadmap.sourceOrchestration ?? null
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeStudyRoadmaps(roadmaps: AgentStudyRoadmapRecord[]) {
  await ensureStudyRoadmapDirectory();
  await writeFile(getStudyRoadmapFilePath(), JSON.stringify(roadmaps, null, 2), "utf8");
}

function buildStatusCounts(roadmaps: AgentStudyRoadmapRecord[]) {
  return roadmaps.reduce<AgentStudyRoadmapsBoardPayload["statusCounts"]>(
    (counts, roadmap) => {
      counts[roadmap.status] += 1;
      return counts;
    },
    {
      draft: 0,
      active: 0,
      completed: 0
    }
  );
}

function sortRoadmaps(roadmaps: AgentStudyRoadmapRecord[]) {
  return roadmaps.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildStudyRoadmapTemplate(action: AgentSafeActionRecord) {
  if (action.kind !== "study-plan-draft") {
    return null;
  }

  return {
    title: "Study roadmap",
    summary:
      "Turn the saved study-plan draft into a milestone-based roadmap that a freshman can actually follow week by week.",
    status: "draft" as const,
    tags: [...new Set([...action.tags, "study-roadmap"])],
    goalSummary: [
      "Clarify the target skill or language and the desired outcome.",
      "Break the plan into weekly milestones with a gentle progression.",
      "Keep review and catch-up windows visible, not hidden."
    ],
    milestones: [
      {
        milestoneId: crypto.randomUUID(),
        title: "Week 1-2 foundation",
        summary: "Get comfortable with syntax, core concepts, and a tiny working project.",
        targetWeek: "Week 2"
      },
      {
        milestoneId: crypto.randomUUID(),
        title: "Week 3-4 applied practice",
        summary: "Solve small problems and start building confidence through repetition.",
        targetWeek: "Week 4"
      },
      {
        milestoneId: crypto.randomUUID(),
        title: "Week 5-6 consolidation",
        summary: "Finish a small project and review gaps before moving on.",
        targetWeek: "Week 6"
      }
    ],
    weeklyPlan: [
      {
        weekId: crypto.randomUUID(),
        label: "Week 1",
        focus: "Understand the learning goal and set up the environment",
        tasks: [
          "Confirm what language or topic to learn",
          "Install tools and verify the first small example",
          "Write down a realistic daily study budget"
        ],
        reviewCheckpoint: "Can you explain what you are learning and why it matters?"
      },
      {
        weekId: crypto.randomUUID(),
        label: "Week 2",
        focus: "Build fluency with the basics",
        tasks: [
          "Practice syntax and small exercises",
          "Repeat the concepts you keep forgetting",
          "Summarize the first two weeks in your own words"
        ],
        reviewCheckpoint: "Can you complete a small task without copying every step?"
      },
      {
        weekId: crypto.randomUUID(),
        label: "Week 3-4",
        focus: "Start applying the skill to mini-projects",
        tasks: [
          "Pick one or two focused mini-projects",
          "Break each mini-project into small deliverables",
          "Keep one weekly catch-up slot"
        ],
        reviewCheckpoint: "Which concepts still slow you down and need a revisit?"
      },
      {
        weekId: crypto.randomUUID(),
        label: "Week 5-6",
        focus: "Consolidate and prepare for the next level",
        tasks: [
          "Finish a small but complete project",
          "Review mistakes and recurring blockers",
          "Define the next study phase"
        ],
        reviewCheckpoint: "What can you now build or explain that you could not do at week 1?"
      }
    ],
    deliveryChannels: ["desktop", "mobile-planned"] as const,
    notes: [
      "This is a planning artifact, not yet a live reminder schedule.",
      "Later we can connect roadmap checkpoints to reminders and Agent task cards."
    ]
  };
}

export async function getAgentStudyRoadmapsBoard(): Promise<AgentStudyRoadmapsBoardPayload> {
  const roadmaps = sortRoadmaps(await readStudyRoadmaps());

  return {
    generatedAt: new Date().toISOString(),
    total: roadmaps.length,
    statusCounts: buildStatusCounts(roadmaps),
    roadmaps
  };
}

export async function createAgentStudyRoadmapFromSafeAction(input: AgentStudyRoadmapFromSafeActionInput) {
  const action = await getAgentSafeAction(input.actionId);
  if (!action) {
    return null;
  }

  const template = buildStudyRoadmapTemplate(action);
  if (!template) {
    throw new AgentStudyRoadmapValidationError(
      `Safe action kind ${action.kind} cannot become a study roadmap yet.`
    );
  }

  const roadmaps = await readStudyRoadmaps();
  const existing = roadmaps.find((roadmap) => roadmap.sourceActionId === action.actionId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextRoadmap: AgentStudyRoadmapRecord = {
    roadmapId: crypto.randomUUID(),
    title: template.title,
    summary: template.summary,
    sourceActionId: action.actionId,
    sourceConversationId: action.sourceConversationId,
    sourceTaskId: action.sourceTaskId,
    sourceReplyMode: action.sourceReplyMode,
    sourceOrchestration: action.sourceOrchestration ?? null,
    status: template.status,
    createdAt: now,
    updatedAt: now,
    tags: template.tags,
    goalSummary: template.goalSummary,
    milestones: template.milestones,
    weeklyPlan: template.weeklyPlan,
    deliveryChannels: [...template.deliveryChannels],
    notes: template.notes
  };

  roadmaps.push(nextRoadmap);
  await writeStudyRoadmaps(roadmaps);
  await appendActivityItem({
    kind: "agent-study-roadmap-created",
    title: "Study roadmap created",
    summary: `Created ${nextRoadmap.title} from safe action "${action.title}".`,
    actor: "agent",
    relatedConversationId: nextRoadmap.sourceConversationId,
    relatedTaskId: nextRoadmap.sourceTaskId,
    metadata: {
      status: nextRoadmap.status,
      sourceActionId: nextRoadmap.sourceActionId,
      sourceReplyMode: nextRoadmap.sourceReplyMode,
      sourceOrchestration: nextRoadmap.sourceOrchestration
    }
  });
  return nextRoadmap;
}

export async function updateAgentStudyRoadmapStatus(roadmapId: string, input: AgentStudyRoadmapStatusUpdateInput) {
  const roadmaps = await readStudyRoadmaps();
  const roadmap = roadmaps.find((item) => item.roadmapId === roadmapId);
  if (!roadmap) {
    return null;
  }

  roadmap.status = input.status;
  roadmap.updatedAt = new Date().toISOString();
  await writeStudyRoadmaps(roadmaps);
  await appendActivityItem({
    kind: "agent-study-roadmap-status-updated",
    title: "Study roadmap updated",
    summary: `${roadmap.title} is now ${roadmap.status}.`,
    actor: "user",
    relatedConversationId: roadmap.sourceConversationId,
    relatedTaskId: roadmap.sourceTaskId,
    metadata: {
      status: roadmap.status,
      sourceActionId: roadmap.sourceActionId,
      sourceReplyMode: roadmap.sourceReplyMode,
      sourceOrchestration: roadmap.sourceOrchestration
    }
  });
  return roadmap;
}

export { AgentStudyRoadmapValidationError };
