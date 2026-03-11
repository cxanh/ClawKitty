import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { createAgentTaskFromChat, updateAgentTaskStatus } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { sendAgentChatMessage } from "../packages/runtime-server/src/services/chat.service.ts";
import { createAgentSafeActionFromChat } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import {
  createAgentReminderPlanFromSafeAction,
  updateAgentReminderPlanStatus
} from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { createAgentStudyRoadmapFromSafeAction, updateAgentStudyRoadmapStatus } from "../packages/runtime-server/src/services/agent-study-roadmap.service.ts";
import {
  createAgentFileWorkspaceFromSafeAction,
  previewAgentFileWorkspaceOrganization,
  searchAgentFileWorkspace,
  updateAgentFileWorkspaceStatus
} from "../packages/runtime-server/src/services/agent-file-workspace.service.ts";
import { createAgentCourseScheduleEntry } from "../packages/runtime-server/src/services/agent-course-schedule.service.ts";
import { createChatToolApprovalRequest, listApprovalRequests } from "../packages/runtime-server/src/services/approval.service.ts";
import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import { getAgentTaskBoard } from "../packages/runtime-server/src/services/agent-task.service.ts";
import { getAgentSafeActionsBoard } from "../packages/runtime-server/src/services/agent-safe-action.service.ts";
import { getAgentReminderPlansBoard } from "../packages/runtime-server/src/services/agent-reminder-plan.service.ts";
import { getAgentStudyRoadmapsBoard } from "../packages/runtime-server/src/services/agent-study-roadmap.service.ts";
import { getAgentFileWorkspacesBoard } from "../packages/runtime-server/src/services/agent-file-workspace.service.ts";
import { getAgentCourseScheduleBoard } from "../packages/runtime-server/src/services/agent-course-schedule.service.ts";

function parseArgs(argv) {
  const args = {
    home: path.join(os.homedir(), "AppData", "Roaming", "ClawDesk", "openclaw-home"),
    clean: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--home" && argv[index + 1]) {
      args.home = path.resolve(argv[index + 1]);
      index += 1;
    } else if (token === "--clean") {
      args.clean = true;
    }
  }

  return args;
}

async function ensureJsonHomeShape(home) {
  const baseDirs = [
    home,
    path.join(home, "agent-assistant"),
    path.join(home, "devices"),
    path.join(home, "cron"),
    path.join(home, "cron", "runs"),
    path.join(home, "agents", "main", "agent"),
    path.join(home, "agents", "main", "sessions")
  ];
  await Promise.all(baseDirs.map((dir) => mkdir(dir, { recursive: true })));

  const files = [
    [path.join(home, "openclaw.json"), "{}"],
    [path.join(home, "devices", "paired.json"), "{}"],
    [path.join(home, "devices", "pairing-sessions.json"), "{}"],
    [path.join(home, "devices", "pending-approvals.json"), "{}"],
    [path.join(home, "devices", "pairing-audit.json"), "[]"],
    [path.join(home, "cron", "jobs.json"), JSON.stringify({ jobs: [] }, null, 2)],
    [path.join(home, "agents", "main", "agent", "auth-profiles.json"), "{}"],
    [path.join(home, "agents", "main", "sessions", "sessions.json"), "{}"]
  ];

  for (const [filePath, content] of files) {
    try {
      await readFile(filePath, "utf8");
    } catch {
      await writeFile(filePath, content, "utf8");
    }
  }
}

async function patchFileWorkspaceRoots(home, workspaceId, rootPath) {
  const filePath = path.join(home, "agent-assistant", "file-workspaces.json");
  const workspaces = JSON.parse(await readFile(filePath, "utf8"));
  const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace) {
    return;
  }

  workspace.searchRoots = [
    {
      rootId: "demo-files",
      label: "Demo Files",
      path: rootPath,
      exists: true,
      source: "custom"
    }
  ];

  await writeFile(filePath, JSON.stringify(workspaces, null, 2), "utf8");
}

async function createDemoFiles(rootPath) {
  const files = [
    ["Course Materials/Calculus/Calculus-homework-week1.pdf", "Demo homework file"],
    ["Applications and Registration/Clubs/Club-registration-form.docx", "Demo registration form"],
    ["Personal Admin/Dormitory/dormitory-fee-receipt.pdf", "Demo receipt"],
    ["Course Materials/Python/python-week2-notes.md", "Demo study notes"]
  ];

  for (const [relativePath, content] of files) {
    const target = path.join(rootPath, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
}

async function readSafeActionsFile(home) {
  const filePath = path.join(home, "agent-assistant", "safe-actions.json");
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return [];
  }
}

async function writeSafeActionsFile(home, actions) {
  const filePath = path.join(home, "agent-assistant", "safe-actions.json");
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(actions, null, 2), "utf8");
}

async function ensureManualSafeAction(home, input) {
  const actions = await readSafeActionsFile(home);
  const existing = actions.find((item) => item.kind === input.kind);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextAction = {
    actionId: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    sourceConversationId: null,
    sourceTaskId: null,
    sourceReplyMode: input.sourceReplyMode,
    sourceOrchestration: {
      source: "heuristic",
      providerId: null,
      modelId: null,
      durationMs: 0,
      fallbackReason: "Demo seed created a deterministic record."
    },
    sourceExcerpt: input.sourceExcerpt,
    approvalHints: [],
    status: input.status,
    createdAt: now,
    updatedAt: now,
    tags: input.tags,
    details: input.details,
    nextSteps: input.nextSteps
  };

  actions.push(nextAction);
  await writeSafeActionsFile(home, actions);
  return nextAction;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  process.env.OPENCLAW_HOME = args.home;

  if (args.clean) {
    await rm(path.join(args.home, "agent-assistant"), { recursive: true, force: true });
    await rm(path.join(args.home, "demo-files"), { recursive: true, force: true });
  }

  await ensureJsonHomeShape(args.home);

  const demoFilesRoot = path.join(args.home, "demo-files");
  await createDemoFiles(demoFilesRoot);

  const courseChat = await sendAgentChatMessage({
    content: "Help me set up reminder ideas for an 8 a.m. calculus class and an afternoon lab tomorrow."
  });
  const fileChat = await sendAgentChatMessage({
    content: "Help me find and organize my course homework files, PDFs, and club registration materials on this computer."
  });
  const studyChat = await sendAgentChatMessage({
    content: "Create a four-week Python study plan for a freshman with milestones and weekly goals."
  });
  const memoryChat = await sendAgentChatMessage({
    content: "My close friend's birthday is in three days. Remind me and suggest a gift and greeting."
  });

  const task = await createAgentTaskFromChat({ conversationId: studyChat.conversation.conversationId });
  if (task) {
    await updateAgentTaskStatus(task.taskId, { status: "ready" });
  }

  const createdActions = [];
  createdActions.push(await createAgentSafeActionFromChat({ conversationId: courseChat.conversation.conversationId }));
  createdActions.push(await createAgentSafeActionFromChat({ conversationId: fileChat.conversation.conversationId }));
  createdActions.push(await createAgentSafeActionFromChat({ conversationId: studyChat.conversation.conversationId }));
  createdActions.push(await createAgentSafeActionFromChat({ conversationId: memoryChat.conversation.conversationId }));

  const validActions = createdActions.filter(Boolean);

  const courseAction = validActions.find((item) => item.kind === "course-reminder-draft") ?? null;
  let fileAction = validActions.find((item) => item.kind === "file-organization-brief") ?? null;
  const studyAction = validActions.find((item) => item.kind === "study-plan-draft") ?? null;
  let memoryAction = validActions.find((item) => item.kind === "memory-item") ?? null;

  if (!fileAction) {
    fileAction = await ensureManualSafeAction(args.home, {
      kind: "file-organization-brief",
      title: "File organization brief",
      summary: "Prepared a deterministic file workspace brief for defense and Android walkthrough.",
      sourceReplyMode: "file-search",
      sourceExcerpt: "Organize course homework and club registration materials on this computer.",
      status: "ready",
      tags: ["file-search", "organization", "demo-seed"],
      details: [
        "Return path, stored time, and size as default fields.",
        "Keep course materials and registration materials as top-level categories."
      ],
      nextSteps: [
        "Open the file workspace board.",
        "Run a demo search.",
        "Generate a read-only organization preview."
      ]
    });
  }

  if (!memoryAction) {
    memoryAction = await ensureManualSafeAction(args.home, {
      kind: "memory-item",
      title: "Memory item saved",
      summary: "Saved a deterministic reminder item for birthday follow-up demonstration.",
      sourceReplyMode: "memory-reminder",
      sourceExcerpt: "My close friend's birthday is in three days. Suggest a gift and greeting.",
      status: "saved",
      tags: ["memory", "reminder", "demo-seed"],
      details: [
        "Capture event date and importance.",
        "Prepare a gift suggestion and greeting suggestion."
      ],
      nextSteps: [
        "Create a reminder plan from the item.",
        "Review suggestions in the reminder board."
      ]
    });
  }

  let reminderPlan = memoryAction
    ? await createAgentReminderPlanFromSafeAction({ actionId: memoryAction.actionId })
    : null;
  if (reminderPlan) {
    reminderPlan = await updateAgentReminderPlanStatus(reminderPlan.planId, { status: "active" });
  }
  const studyRoadmap = studyAction
    ? await createAgentStudyRoadmapFromSafeAction({ actionId: studyAction.actionId })
    : null;
  if (studyRoadmap) {
    await updateAgentStudyRoadmapStatus(studyRoadmap.roadmapId, { status: "active" });
  }

  let fileWorkspace = fileAction
    ? await createAgentFileWorkspaceFromSafeAction({ actionId: fileAction.actionId })
    : null;

  let fileSearchResult = null;
  let filePreviewResult = null;
  if (fileWorkspace) {
    fileWorkspace = await updateAgentFileWorkspaceStatus(fileWorkspace.workspaceId, { status: "active" });
    await patchFileWorkspaceRoots(args.home, fileWorkspace.workspaceId, demoFilesRoot);
    fileSearchResult = await searchAgentFileWorkspace(fileWorkspace.workspaceId, {
      query: "registration",
      limit: 8
    });
    filePreviewResult = await previewAgentFileWorkspaceOrganization(fileWorkspace.workspaceId, {
      query: "club",
      limit: 8
    });
  }

  await createAgentCourseScheduleEntry({
    courseName: "Advanced Mathematics",
    weekday: "monday",
    startTime: "08:00",
    endTime: "09:40",
    location: "Teaching Building A-201",
    notes: ["Bring workbook", "Self-study before class"],
    reminderPreset: "morning-class",
    nightBeforeReminder: true,
    afternoonReminder: false,
    sourcePlanId: courseAction?.actionId ?? null
  });

  await createAgentCourseScheduleEntry({
    courseName: "Physics Lab",
    weekday: "monday",
    startTime: "14:00",
    endTime: "15:40",
    location: "Lab Center B-104",
    notes: ["Bring safety gloves"],
    reminderPreset: "afternoon-class",
    nightBeforeReminder: false,
    afternoonReminder: true,
    sourcePlanId: courseAction?.actionId ?? null
  });

  const firstChatHintToolId = fileChat.approvalHints[0]?.toolId ?? courseChat.approvalHints[0]?.toolId ?? null;
  let approvalRequest = null;
  if (firstChatHintToolId) {
    approvalRequest = await createChatToolApprovalRequest(fileChat.conversation.conversationId, firstChatHintToolId);
  }

  const summary = {
    home: args.home,
    clean: args.clean,
    chatsCreated: 4,
    taskBoard: await getAgentTaskBoard(),
    safeActionsBoard: await getAgentSafeActionsBoard(),
    reminderPlansBoard: await getAgentReminderPlansBoard(),
    studyRoadmapsBoard: await getAgentStudyRoadmapsBoard(),
    fileWorkspacesBoard: await getAgentFileWorkspacesBoard(),
    courseScheduleBoard: await getAgentCourseScheduleBoard(),
    approvalRequests: await listApprovalRequests(10),
    activity: await getActivityFeed(12),
    reminderPlanId: reminderPlan?.planId ?? null,
    studyRoadmapId: studyRoadmap?.roadmapId ?? null,
    fileWorkspaceId: fileWorkspace?.workspaceId ?? null,
    approvalCreated: approvalRequest?.created ?? false,
    fileSearchMatchedCount: fileSearchResult?.matchedCount ?? 0,
    filePreviewItemCount: filePreviewResult?.totalItems ?? 0,
    createdActionKinds: (await readSafeActionsFile(args.home)).map((item) => item.kind)
  };

  console.log(JSON.stringify(summary, null, 2));
}

await main();
