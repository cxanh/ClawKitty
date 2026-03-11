import crypto from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentChatBootstrapPayload,
  AgentChatCapabilitySnapshot,
  AgentChatConversationCreateInput,
  AgentChatConversationDetail,
  AgentChatConversationSummary,
  AgentChatMessage,
  AgentChatMessageSendInput,
  AgentChatOrchestrationMeta,
  AgentChatReplyMode,
  AgentChatSendMessageResult,
  AgentChatStarterPrompt
} from "@clawdesk/shared-types";
import {
  getOpenClawBrowserRelayStatus,
  listOpenClawPairedDevices,
  listOpenClawProviders,
  listOpenClawTasks
} from "@clawdesk/openclaw-core";

import { appendActivityItem } from "./activity.service.js";
import { buildApprovalHintsForReplyMode } from "./agent-approval-hints.service.js";
import { generateAgentReplyViaProvider } from "./agent-orchestration.service.js";

interface ConversationRecord {
  conversationId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  messages: AgentChatMessage[];
}

class AgentChatValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentChatValidationError";
  }
}

const starterPrompts: AgentChatStarterPrompt[] = [
  {
    id: "course-reminder",
    title: "课程提醒流程",
    prompt: "帮我规划课程提醒功能，需要支持前一晚提醒第二天早八课，午休后提醒下午课程。",
    scenario: "course-reminder"
  },
  {
    id: "file-search",
    title: "文件整理助手",
    prompt: "帮我设计一个文件整理与检索方案，能够快速找到某门课作业和报名材料。",
    scenario: "file-search"
  },
  {
    id: "study-plan",
    title: "学习计划生成",
    prompt: "帮我为零基础新生做一个 6 周 Python 学习计划，包含目标、里程碑和每日任务。",
    scenario: "study-plan"
  },
  {
    id: "agent-overview",
    title: "Agent 今日状态",
    prompt: "告诉我今天这个 Agent 可以做什么，目前有哪些能力、模型和工具可用。",
    scenario: "general"
  }
];

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getChatDirectory() {
  return path.join(getManagedHome(), "agent-assistant", "conversations");
}

function getConversationPath(conversationId: string) {
  return path.join(getChatDirectory(), `${conversationId}.json`);
}

async function ensureChatDirectory() {
  await mkdir(getChatDirectory(), { recursive: true });
}

async function readConversationRecord(conversationId: string) {
  try {
    const raw = await readFile(getConversationPath(conversationId), "utf8");
    return JSON.parse(raw) as ConversationRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeConversationRecord(record: ConversationRecord) {
  await ensureChatDirectory();
  await writeFile(getConversationPath(record.conversationId), JSON.stringify(record, null, 2), "utf8");
}

function detectLanguage(content: string) {
  return /[\u4e00-\u9fff]/u.test(content) ? "zh-CN" : "en-US";
}

function truncateTitle(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "New agent chat";
  }

  return normalized.length > 38 ? `${normalized.slice(0, 38)}...` : normalized;
}

function matchesCourseReminderIntent(content: string, lower: string) {
  const hasCourseReminderPhrase = /课程提醒|课表|上课|早八|早课|下午课|晚课/u.test(content);
  const hasCourseConcept = /课程|课程表|课/u.test(content) || /course|class|schedule/.test(lower);
  const hasReminderConcept = /提醒|通知|记得|别忘|前一晚|午休后/u.test(content) || /remind|notification|remember/.test(lower);

  return hasCourseReminderPhrase || (hasCourseConcept && hasReminderConcept);
}

function matchesFileSearchIntent(content: string, lower: string) {
  return /文件|作业|材料|目录|搜索|查找|检索/u.test(content) || /file|folder|material|search|find|everything/.test(lower);
}

function matchesStudyPlanIntent(content: string, lower: string) {
  return /学习|编程|语言|计划|思维导图/u.test(content) || /study|learn|plan|roadmap|python|java/.test(lower);
}

function matchesMemoryReminderIntent(content: string, lower: string) {
  return /生日|会议|备忘|截止|ddl|纪念日/u.test(content) || /birthday|meeting|memo|deadline|ddl|anniversary/.test(lower);
}

function inferTags(content: string) {
  const tags = new Set<string>();
  const lower = content.toLowerCase();

  if (matchesCourseReminderIntent(content, lower)) {
    tags.add("course-reminder");
  }

  if (matchesFileSearchIntent(content, lower)) {
    tags.add("file-search");
  }

  if (matchesStudyPlanIntent(content, lower)) {
    tags.add("study-plan");
  }

  if (matchesMemoryReminderIntent(content, lower)) {
    tags.add("memory-reminder");
  }

  if (tags.size === 0) {
    tags.add("general");
  }

  return [...tags];
}

function toSummary(record: ConversationRecord): AgentChatConversationSummary {
  const latestMessage = [...record.messages].reverse().find((message) => message.role === "assistant" || message.role === "user");

  return {
    conversationId: record.conversationId,
    title: record.title,
    preview: latestMessage?.content.slice(0, 120) ?? "No messages yet.",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    messageCount: record.messages.length,
    tags: record.tags
  };
}

function toDetail(record: ConversationRecord): AgentChatConversationDetail {
  return {
    ...toSummary(record),
    messages: record.messages
  };
}

function createMessage(
  role: "user" | "assistant",
  content: string,
  replyMode?: AgentChatReplyMode,
  orchestration?: AgentChatOrchestrationMeta,
  approvalHints: AgentChatMessage["approvalHints"] = []
): AgentChatMessage {
  return {
    messageId: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    replyMode,
    orchestration,
    approvalHints
  };
}

function createWelcomeMessage(language: "zh-CN" | "en-US") {
  if (language === "zh-CN") {
    return createMessage(
      "assistant",
      [
        "我是你的个人 Agent 助手，目前可以先陪你完成三类事情：课程提醒、文件整理、学习计划。",
        "你可以直接告诉我：",
        "1. 你想提醒什么课或什么日程",
        "2. 你想找什么文件或材料",
        "3. 你想学什么，以及希望多久入门"
      ].join("\n"),
      "welcome"
    );
  }

  return createMessage(
    "assistant",
    [
      "I am your primary Agent assistant.",
      "For the first version, I can already help you shape three workflows: course reminders, file organization, and study planning.",
      "Tell me what you want to remember, find, or learn next."
    ].join("\n"),
    "welcome"
  );
}

function buildResponse(content: string) {
  const language = detectLanguage(content);
  const lower = content.toLowerCase();

  if (matchesFileSearchIntent(content, lower)) {
    return {
      replyMode: "file-search" as const,
      suggestedActions:
        language === "zh-CN"
          ? ["规划文件分类规则", "接入本地检索能力", "整理课程材料入口"]
          : ["Define file rules", "Integrate local search", "Organize course-material entry"],
      content:
        language === "zh-CN"
          ? [
              "这类需求很适合做成“文件管理大功能”。",
              "我建议第一阶段先支持三件事：",
              "1. 通过关键词快速判断文件是否存在。",
              "2. 返回目录、存入时间、大小等基本信息。",
              "3. 按课程和事件相关性做二次分类。",
              "",
              "后续我们可以把 Everything / EverythingToolbar 作为候选扩展接进去，让本地文件检索速度更稳。"
            ].join("\n")
          : [
              "This fits a larger file-management feature well.",
              "For phase one, we should support fast existence checks, file path + size + stored time, and grouping by course or event relevance.",
              "Later we can evaluate Everything-based local search integration for faster lookup."
            ].join("\n")
    };
  }

  if (matchesStudyPlanIntent(content, lower)) {
    return {
      replyMode: "study-plan" as const,
      suggestedActions:
        language === "zh-CN"
          ? ["生成 6 周学习计划", "拆分里程碑", "设计复盘提醒"]
          : ["Generate 6-week plan", "Break into milestones", "Add review reminders"],
      content:
        language === "zh-CN"
          ? [
              "学习计划这块，Agent 很适合做“目标拆解 + 节奏提醒”。",
              "我建议输出物至少包括：",
              "1. 学习目标和完成标准。",
              "2. 按周拆分的里程碑。",
              "3. 每天或每次学习前该做什么。",
              "4. 每周复盘和补漏提醒。",
              "",
              "如果你告诉我想学什么语言、每天能投入多久，我下一步就能先给你一个可执行的计划框架。"
            ].join("\n")
          : [
              "This is a great fit for the Agent: break a goal into milestones, daily actions, and review reminders.",
              "If you tell me which language you want to learn and how much time you have each day, I can draft the first plan shape."
            ].join("\n")
    };
  }

  if (matchesMemoryReminderIntent(content, lower)) {
    return {
      replyMode: "memory-reminder" as const,
      suggestedActions:
        language === "zh-CN"
          ? ["记录备忘事件", "设置主动提醒", "补充祝福和礼物建议"]
          : ["Save memory item", "Set proactive reminder", "Add gift/message suggestions"],
      content:
        language === "zh-CN"
          ? [
              "这正是“适度主动提醒”最有价值的地方。",
              "对会议、生日、截止时间这类事件，我们可以区分重要程度和亲疏关系，然后决定提醒频率、推荐礼物和祝福语风格。",
              "",
              "后续在权限策略里，我们还可以让用户决定：只提醒、不自动执行，还是在低风险场景下自动创建待办。"
            ].join("\n")
          : [
              "This is where light proactive reminders shine.",
              "For meetings, birthdays, and deadlines, we can vary reminder timing and suggestion style based on importance and relationship strength."
            ].join("\n")
    };
  }

  if (matchesCourseReminderIntent(content, lower)) {
    return {
      replyMode: "course-reminder" as const,
      suggestedActions:
        language === "zh-CN"
          ? ["整理课表导入模板", "设置前一晚提醒", "设置午休后提醒"]
          : ["Prepare course-import template", "Set night-before reminder", "Set afternoon reminder"],
      content:
        language === "zh-CN"
          ? [
              "可以，我们可以先把“课程提醒”做成一个对新生很友好的流程：",
              "1. 先导入课表，至少包含周几、开始时间、课程名、地点。",
              "2. 默认提供两段提醒：前一晚提醒第二天早课；午休后提醒下午课程。",
              "3. 后续再把提醒同步到手机端和桌面组件。",
              "",
              "如果你愿意，下一步可以直接把课表整理成“周几 / 时间 / 课程 / 地点”发给我，我会先帮你变成导入模板。"
            ].join("\n")
          : [
              "We can turn course reminders into a beginner-friendly workflow:",
              "1. Import a timetable with weekday, start time, course name, and location.",
              "2. Default reminder windows: the night before morning classes, and after lunch for afternoon classes.",
              "3. Later we can sync the same reminders to mobile and widgets."
            ].join("\n")
    };
  }

  return {
    replyMode: "general" as const,
    suggestedActions:
      language === "zh-CN"
        ? ["聊课程提醒", "聊文件整理", "聊学习计划"]
        : ["Course reminders", "File organization", "Study plan"],
    content:
      language === "zh-CN"
        ? [
            "收到。当前这版桌面 Agent 已经开始围绕新生场景收口。",
            "你可以继续直接告诉我：",
            "1. 你想提醒什么事情",
            "2. 你想找什么文件",
            "3. 你想安排什么学习计划",
            "",
            "我会先按产品和任务视角帮你拆解，后面再把这些能力继续落到真正的自动执行链路里。"
          ].join("\n")
        : [
            "Got it. The current Agent direction is centered on student workflows.",
            "You can tell me what you want to remember, find, or plan, and I will help break it into a usable flow first."
          ].join("\n")
  };
}

async function readAllConversations() {
  await ensureChatDirectory();
  const files = await readdir(getChatDirectory(), { withFileTypes: true });
  const records = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const raw = await readFile(path.join(getChatDirectory(), entry.name), "utf8");
        return JSON.parse(raw) as ConversationRecord;
      })
  );

  return records.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export async function getAgentChatBootstrap(): Promise<AgentChatBootstrapPayload> {
  const [conversations, providers, tasks, devices, relay] = await Promise.all([
    readAllConversations(),
    listOpenClawProviders(),
    listOpenClawTasks(),
    listOpenClawPairedDevices(),
    getOpenClawBrowserRelayStatus()
  ]);

  const capabilities: AgentChatCapabilitySnapshot = {
    agentMode: "single-primary-agent",
    reminderMode: "light-proactive",
    providerCount: providers.length,
    taskCount: tasks.length,
    deviceCount: 1,
    pairedDeviceCount: devices.length,
    supportsMobilePairing: true,
    supportsBrowserRelay: relay.relayStatus === "online" || relay.gatewayStatus === "online"
  };

  return {
    generatedAt: new Date().toISOString(),
    agentDisplayName: "Campus Agent",
    capabilities,
    starterPrompts,
    conversations: conversations.map(toSummary)
  };
}

export async function listAgentChatConversations(): Promise<AgentChatConversationSummary[]> {
  const conversations = await readAllConversations();
  return conversations.map(toSummary);
}

export async function getAgentChatConversationDetail(conversationId: string) {
  const record = await readConversationRecord(conversationId);
  return record ? toDetail(record) : null;
}

export async function createAgentChatConversation(input: AgentChatConversationCreateInput = {}) {
  const now = new Date().toISOString();
  const title = input.title?.trim() || "New agent chat";
  const language = detectLanguage(title);
  const record: ConversationRecord = {
    conversationId: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    tags: ["general"],
    messages: [createWelcomeMessage(language)]
  };

  await writeConversationRecord(record);
  await appendActivityItem({
    kind: "chat-conversation-created",
    title: "New Agent conversation created",
    summary: `Started a fresh conversation: ${record.title}`,
    actor: "user",
    relatedConversationId: record.conversationId,
    metadata: {
      title: record.title
    }
  });
  return toDetail(record);
}

export async function sendAgentChatMessage(input: AgentChatMessageSendInput): Promise<AgentChatSendMessageResult> {
  const content = input.content?.trim();
  if (!content) {
    throw new AgentChatValidationError("Message content is required.");
  }

  let record: ConversationRecord | null = null;
  let createdConversation = false;

  if (input.conversationId) {
    record = await readConversationRecord(input.conversationId);
  }

  if (!record) {
    const now = new Date().toISOString();
    record = {
      conversationId: crypto.randomUUID(),
      title: truncateTitle(content),
      createdAt: now,
      updatedAt: now,
      tags: inferTags(content),
      messages: []
    };
    createdConversation = true;
  }

  const userMessage = createMessage("user", content);
  const heuristicResponse = buildResponse(content);
  const providerAttempt = await generateAgentReplyViaProvider({
    userMessage: content,
    replyMode: heuristicResponse.replyMode
  });
  const approvalHints = await buildApprovalHintsForReplyMode(heuristicResponse.replyMode);
  const assistantMessage = createMessage(
    "assistant",
    providerAttempt.content ?? heuristicResponse.content,
    heuristicResponse.replyMode,
    providerAttempt.orchestration,
    approvalHints
  );

  record.messages.push(userMessage, assistantMessage);
  record.updatedAt = assistantMessage.createdAt;
  record.title = record.messages.filter((message) => message.role === "user")[0]?.content
    ? truncateTitle(record.messages.filter((message) => message.role === "user")[0]!.content)
    : record.title;
  record.tags = [...new Set([...record.tags, ...inferTags(content)])];

  await writeConversationRecord(record);
  await appendActivityItem({
    kind: "chat-message-sent",
    title: "Agent conversation updated",
    summary: createdConversation
      ? `Started a new conversation from chat and received a ${heuristicResponse.replyMode} reply.`
      : `Sent a new message and received a ${heuristicResponse.replyMode} reply.`,
    actor: "agent",
    relatedConversationId: record.conversationId,
    metadata: {
      createdConversation,
      replyMode: heuristicResponse.replyMode,
      suggestedActions: heuristicResponse.suggestedActions,
      orchestration: providerAttempt.orchestration,
      approvalHints
    }
  });

  return {
    createdConversation,
    conversation: toDetail(record),
    replyMode: heuristicResponse.replyMode,
    suggestedActions: heuristicResponse.suggestedActions,
    orchestration: providerAttempt.orchestration,
    approvalHints
  };
}

export { AgentChatValidationError };
