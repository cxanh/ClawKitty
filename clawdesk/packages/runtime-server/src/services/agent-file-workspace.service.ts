import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type {
  AgentFileSearchRoot,
  AgentFileWorkspaceSearchAcceleration,
  AgentFileWorkspaceSearchQuery,
  AgentFileWorkspaceSearchResult,
  AgentFileWorkspaceSearchResultItem,
  AgentFileWorkspaceOrganizationPreview,
  AgentFileWorkspacePreviewGroup,
  AgentFileWorkspacePreviewInput,
  AgentFileWorkspacePreviewItem,
  AgentFileWorkspaceSuggestionCard,
  AgentFileWorkspaceEventView,
  AgentFileWorkspaceFromSafeActionInput,
  AgentFileWorkspaceRecord,
  AgentFileWorkspaceEventGroup,
  AgentFileWorkspacesBoardPayload,
  AgentFileWorkspaceStatusUpdateInput,
  AgentFileWorkspaceTimeGroup,
  AgentFileWorkspaceTimeView,
  AgentSafeActionRecord
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";
import { getAgentSafeAction } from "./agent-safe-action.service.js";

const execFileAsync = promisify(execFile);

class AgentFileWorkspaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentFileWorkspaceValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getFileWorkspaceFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "file-workspaces.json");
}

async function ensureFileWorkspaceDirectory() {
  await mkdir(path.dirname(getFileWorkspaceFilePath()), { recursive: true });
}

async function readFileWorkspaces(): Promise<AgentFileWorkspaceRecord[]> {
  try {
    const raw = await readFile(getFileWorkspaceFilePath(), "utf8");
    return (JSON.parse(raw) as AgentFileWorkspaceRecord[]).map((workspace) => ({
      ...workspace,
      sourceOrchestration: workspace.sourceOrchestration ?? null
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

const skippedDirectories = new Set([
  ".git",
  "node_modules",
  ".openclaw",
  "AppData",
  "$RECYCLE.BIN",
  "System Volume Information"
]);

type EverythingCliDetection = {
  available: boolean;
  executablePath: string | null;
  extraArgs: string[];
  note: string | null;
};

let everythingCliDetectionCache:
  | {
      detectedAt: number;
      payload: EverythingCliDetection;
    }
  | null = null;

async function writeFileWorkspaces(workspaces: AgentFileWorkspaceRecord[]) {
  await ensureFileWorkspaceDirectory();
  await writeFile(getFileWorkspaceFilePath(), JSON.stringify(workspaces, null, 2), "utf8");
}

async function pathExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseEverythingCliArgs() {
  return (process.env.CLAWDESK_EVERYTHING_CLI_ARGS ?? "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function detectEverythingCli(): Promise<EverythingCliDetection> {
  if (everythingCliDetectionCache && Date.now() - everythingCliDetectionCache.detectedAt < 60_000) {
    return everythingCliDetectionCache.payload;
  }

  const envExecutablePath = process.env.CLAWDESK_EVERYTHING_CLI_PATH?.trim() ?? "";
  const candidatePaths = [
    envExecutablePath,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, "Everything", "es.exe") : "",
    process.env["ProgramFiles(x86)"] ? path.join(process.env["ProgramFiles(x86)"], "Everything", "es.exe") : "",
    path.join(os.homedir(), "AppData", "Local", "Everything", "es.exe")
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (await pathExists(candidate)) {
      const payload = {
        available: true,
        executablePath: candidate,
        extraArgs: parseEverythingCliArgs(),
        note: candidate === envExecutablePath ? "Using configured Everything CLI path." : "Everything CLI detected."
      } satisfies EverythingCliDetection;
      everythingCliDetectionCache = {
        detectedAt: Date.now(),
        payload
      };
      return payload;
    }
  }

  const pathEntries = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
  for (const directory of pathEntries) {
    const candidate = path.join(directory, "es.exe");
    if (await pathExists(candidate)) {
      const payload = {
        available: true,
        executablePath: candidate,
        extraArgs: parseEverythingCliArgs(),
        note: "Everything CLI detected from PATH."
      } satisfies EverythingCliDetection;
      everythingCliDetectionCache = {
        detectedAt: Date.now(),
        payload
      };
      return payload;
    }
  }

  const payload = {
    available: false,
    executablePath: null,
    extraArgs: [],
    note: "Everything CLI not detected. Using the built-in scoped file search instead."
  } satisfies EverythingCliDetection;
  everythingCliDetectionCache = {
    detectedAt: Date.now(),
    payload
  };
  return payload;
}

async function buildDefaultSearchRoots() {
  const home = os.homedir();
  const candidates: Array<Pick<AgentFileSearchRoot, "label" | "path" | "source">> = [
    {
      label: "Desktop",
      path: path.join(home, "Desktop"),
      source: "desktop"
    },
    {
      label: "Documents",
      path: path.join(home, "Documents"),
      source: "documents"
    },
    {
      label: "Downloads",
      path: path.join(home, "Downloads"),
      source: "downloads"
    },
    {
      label: "OneDrive Documents",
      path: path.join(home, "OneDrive", "Documents"),
      source: "onedrive-documents"
    }
  ];

  const roots = await Promise.all(
    candidates.map(async (candidate) => ({
      rootId: crypto.randomUUID(),
      ...candidate,
      exists: await pathExists(candidate.path)
    }))
  );

  return roots.filter((root) => root.exists || root.source !== "onedrive-documents");
}

function buildTimeViews(): AgentFileWorkspaceTimeView[] {
  return [
    {
      viewId: crypto.randomUUID(),
      label: "Recent uploads",
      summary: "Start with the newest files when the user remembers roughly when the file arrived."
    },
    {
      viewId: crypto.randomUUID(),
      label: "This week",
      summary: "Useful for homework, forms, and club materials created or downloaded this week."
    },
    {
      viewId: crypto.randomUUID(),
      label: "Semester archive",
      summary: "Keep long-lived course materials and application files visible without mixing them into today view."
    }
  ];
}

function buildEventViews(): AgentFileWorkspaceEventView[] {
  return [
    {
      viewId: crypto.randomUUID(),
      label: "Course materials",
      summary: "Group files by course, assignment, and review material.",
      exampleItems: ["Calculus homework", "English presentation slides", "Lab report draft"]
    },
    {
      viewId: crypto.randomUUID(),
      label: "Applications and registration",
      summary: "Keep forms, screenshots, and PDFs for signups and school admin tasks together.",
      exampleItems: ["Club signup form", "Competition registration PDF", "Scholarship materials"]
    },
    {
      viewId: crypto.randomUUID(),
      label: "Personal admin",
      summary: "Separate certificates, bills, and identity-related files from schoolwork.",
      exampleItems: ["Student ID scan", "Dorm checklist", "Payment receipt"]
    }
  ];
}

function sortWorkspaces(workspaces: AgentFileWorkspaceRecord[]) {
  return workspaces.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildStatusCounts(workspaces: AgentFileWorkspaceRecord[]) {
  return workspaces.reduce<AgentFileWorkspacesBoardPayload["statusCounts"]>(
    (counts, workspace) => {
      counts[workspace.status] += 1;
      return counts;
    },
    {
      draft: 0,
      active: 0,
      archived: 0
    }
  );
}

function buildWorkspaceTemplate(action: AgentSafeActionRecord) {
  if (action.kind !== "file-organization-brief") {
    return null;
  }

  return {
    title: "File workspace",
    summary:
      "Turn the saved file-organization brief into a freshman-friendly workspace for finding course files, forms, and application materials.",
    status: "draft" as const,
    tags: [...new Set([...action.tags, "file-workspace"])],
    resultFields: ["path", "storedAt", "size", "eventTag"],
    plannedIntegrations: [
      "Everything local search bridge (planned)",
      "Time-first result sorting",
      "Event-first grouping for course and application materials"
    ],
    notes: [
      "This workspace is a planning artifact first; it does not move or delete files automatically.",
      "The initial goal is to make file lookup feel less intimidating for freshmen.",
      "Everything integration remains optional and can be added later without changing the UI model."
    ]
  };
}

export async function getAgentFileWorkspacesBoard(): Promise<AgentFileWorkspacesBoardPayload> {
  const workspaces = sortWorkspaces(await readFileWorkspaces());

  return {
    generatedAt: new Date().toISOString(),
    total: workspaces.length,
    statusCounts: buildStatusCounts(workspaces),
    workspaces
  };
}

export async function getAgentFileWorkspace(workspaceId: string) {
  const workspaces = await readFileWorkspaces();
  return workspaces.find((workspace) => workspace.workspaceId === workspaceId) ?? null;
}

function inferEventTag(filePath: string) {
  const normalized = filePath.toLowerCase();
  if (
    /(course|class|homework|assignment|lab|report|slides|lecture|exam|quiz|作业|课程|实验|报告|课件|讲义)/.test(normalized)
  ) {
    return "course-material" as const;
  }

  if (
    /(signup|registration|application|scholarship|competition|club|报名|注册|申请|奖学金|比赛|社团|材料|表单)/.test(normalized)
  ) {
    return "application-material" as const;
  }

  if (
    /(certificate|receipt|invoice|id|bank|payment|证件|票据|支付|身份证|学生证|收据|发票|银行)/.test(normalized)
  ) {
    return "personal-admin" as const;
  }

  return "general" as const;
}

function splitQueryTokens(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePathForCompare(filePath: string) {
  return path.resolve(filePath).replace(/\//g, "\\").toLowerCase();
}

function isPathWithinRoot(filePath: string, rootPath: string) {
  const normalizedFilePath = normalizePathForCompare(filePath);
  const normalizedRootPath = normalizePathForCompare(rootPath).replace(/[\\]+$/, "");
  return (
    normalizedFilePath === normalizedRootPath ||
    normalizedFilePath.startsWith(`${normalizedRootPath}\\`)
  );
}

function findMatchingRoot(filePath: string, roots: AgentFileSearchRoot[]) {
  return roots.find((root) => isPathWithinRoot(filePath, root.path)) ?? null;
}

function matchesTokens(filePath: string, tokens: string[]) {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = filePath.toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function buildSearchResultItem(root: AgentFileSearchRoot, filePath: string, fileStat: Awaited<ReturnType<typeof stat>>): AgentFileWorkspaceSearchResultItem {
  return {
    resultId: crypto.randomUUID(),
    rootLabel: root.label,
    path: filePath,
    fileName: path.basename(filePath),
    extension: path.extname(filePath) || null,
    sizeBytes: Number(fileStat.size),
    storedAt: fileStat.mtime.toISOString(),
    eventTag: inferEventTag(filePath)
  };
}

function buildTimeGroups(results: AgentFileWorkspaceSearchResultItem[]): AgentFileWorkspaceTimeGroup[] {
  const now = Date.now();
  const startOfWeek = new Date();
  const weekday = startOfWeek.getDay();
  const deltaToMonday = weekday === 0 ? -6 : 1 - weekday;
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() + deltaToMonday);

  const groups: AgentFileWorkspaceTimeGroup[] = [
    {
      key: "recent-7d",
      label: "Recent 7 days",
      count: 0,
      results: []
    },
    {
      key: "this-week",
      label: "Earlier this week",
      count: 0,
      results: []
    },
    {
      key: "older",
      label: "Older files",
      count: 0,
      results: []
    }
  ];

  for (const result of results) {
    const storedAt = Date.parse(result.storedAt);
    if (!Number.isNaN(storedAt) && now - storedAt <= 7 * 24 * 60 * 60 * 1000) {
      groups[0].results.push(result);
      groups[0].count += 1;
      continue;
    }

    if (!Number.isNaN(storedAt) && storedAt >= startOfWeek.getTime()) {
      groups[1].results.push(result);
      groups[1].count += 1;
      continue;
    }

    groups[2].results.push(result);
    groups[2].count += 1;
  }

  return groups.filter((group) => group.count > 0);
}

function buildEventGroups(results: AgentFileWorkspaceSearchResultItem[]): AgentFileWorkspaceEventGroup[] {
  const labels: Record<AgentFileWorkspaceSearchResultItem["eventTag"], string> = {
    "course-material": "Course materials",
    "application-material": "Applications and registration",
    "personal-admin": "Personal admin",
    general: "General"
  };

  const buckets = new Map<AgentFileWorkspaceSearchResultItem["eventTag"], AgentFileWorkspaceSearchResultItem[]>();
  for (const result of results) {
    const bucket = buckets.get(result.eventTag) ?? [];
    bucket.push(result);
    buckets.set(result.eventTag, bucket);
  }

  return Array.from(buckets.entries()).map(([key, groupedResults]) => ({
    key,
    label: labels[key],
    count: groupedResults.length,
    results: groupedResults
  }));
}

function buildSuggestionCards(
  results: AgentFileWorkspaceSearchResultItem[],
  timeGroups: AgentFileWorkspaceTimeGroup[],
  eventGroups: AgentFileWorkspaceEventGroup[]
) {
  const suggestions: AgentFileWorkspaceSuggestionCard[] = [];

  const recentGroup = timeGroups.find((group) => group.key === "recent-7d");
  const olderGroup = timeGroups.find((group) => group.key === "older");
  if (recentGroup && olderGroup) {
    suggestions.push({
      suggestionId: crypto.randomUUID(),
      kind: "time-bucket",
      title: "Separate active files from archive files",
      summary:
        "You already have a mix of recent files and older files. A simple first step is to keep current-week materials visible and move older reference files into a semester archive later.",
      confidence: "high",
      readOnly: true,
      examplePaths: [...recentGroup.results, ...olderGroup.results].slice(0, 3).map((result) => result.path)
    });
  }

  for (const group of eventGroups) {
    if (group.key === "course-material" && group.count > 0) {
      suggestions.push({
        suggestionId: crypto.randomUUID(),
        kind: "event-bucket",
        title: "Create a course materials lane",
        summary:
          "These files look like homework, lecture, or lab content. Keeping them under a course-first view will make deadline files easier to find later.",
        confidence: group.count >= 2 ? "high" : "medium",
        readOnly: true,
        examplePaths: group.results.slice(0, 3).map((result) => result.path)
      });
    }

    if (group.key === "application-material" && group.count > 0) {
      suggestions.push({
        suggestionId: crypto.randomUUID(),
        kind: "event-bucket",
        title: "Group signup and registration files together",
        summary:
          "These files look like forms, registration PDFs, or application materials. Keeping them together lowers the chance of missing a required document later.",
        confidence: group.count >= 2 ? "high" : "medium",
        readOnly: true,
        examplePaths: group.results.slice(0, 3).map((result) => result.path)
      });
    }

    if (group.key === "personal-admin" && group.count > 0) {
      suggestions.push({
        suggestionId: crypto.randomUUID(),
        kind: "review-step",
        title: "Keep personal admin files separate from study files",
        summary:
          "Certificates, receipts, and identity-related files should stay easy to locate without being mixed into homework folders.",
        confidence: "medium",
        readOnly: true,
        examplePaths: group.results.slice(0, 3).map((result) => result.path)
      });
    }
  }

  if (results.length > 0) {
    suggestions.push({
      suggestionId: crypto.randomUUID(),
      kind: "review-step",
      title: "Review the suggested grouping before any automation",
      summary:
        "This workspace is still read-only. The safest next step is to confirm the grouping logic first, then we can add semi-automatic organization later.",
      confidence: "high",
      readOnly: true,
      examplePaths: results.slice(0, 3).map((result) => result.path)
    });
  }

  return suggestions.slice(0, 4);
}

function buildSuggestedFolder(item: AgentFileWorkspaceSearchResultItem) {
  switch (item.eventTag) {
    case "course-material":
      return path.join("Course Materials", item.fileName.includes("-") ? item.fileName.split("-")[0] : "General");
    case "application-material":
      return path.join("Applications and Registration", item.fileName.toLowerCase().includes("club") ? "Clubs" : "Forms");
    case "personal-admin":
      return path.join("Personal Admin", "Important Records");
    default:
      return path.join("General Inbox", "Needs Review");
  }
}

function buildSuggestedReason(item: AgentFileWorkspaceSearchResultItem) {
  switch (item.eventTag) {
    case "course-material":
      return "This file looks like coursework or lecture material and fits a course-first folder.";
    case "application-material":
      return "This file looks like a registration, signup, or application document and should stay with related forms.";
    case "personal-admin":
      return "This file looks personal or administrative, so it should stay separate from study materials.";
    default:
      return "This file still needs a manual review lane before any future automation.";
  }
}

function buildPreviewItems(results: AgentFileWorkspaceSearchResultItem[]) {
  return results.map<AgentFileWorkspacePreviewItem>((item) => ({
    previewId: crypto.randomUUID(),
    sourcePath: item.path,
    fileName: item.fileName,
    eventTag: item.eventTag,
    suggestedFolder: buildSuggestedFolder(item),
    suggestedReason: buildSuggestedReason(item),
    confidence: item.eventTag === "general" ? "medium" : "high"
  }));
}

function buildPreviewGroups(items: AgentFileWorkspacePreviewItem[]) {
  const labels: Record<AgentFileWorkspacePreviewItem["eventTag"], string> = {
    "course-material": "Course materials lane",
    "application-material": "Applications and registration lane",
    "personal-admin": "Personal admin lane",
    general: "Manual review lane"
  };

  const buckets = new Map<AgentFileWorkspacePreviewItem["eventTag"], AgentFileWorkspacePreviewItem[]>();
  for (const item of items) {
    const current = buckets.get(item.eventTag) ?? [];
    current.push(item);
    buckets.set(item.eventTag, current);
  }

  return Array.from(buckets.entries()).map<AgentFileWorkspacePreviewGroup>(([key, groupedItems]) => ({
    key,
    label: labels[key],
    count: groupedItems.length,
    items: groupedItems
  }));
}

async function walkRootForMatches(
  root: AgentFileSearchRoot,
  tokens: string[],
  limit: number,
  excludePaths: Set<string> = new Set()
) {
  const results: AgentFileWorkspaceSearchResultItem[] = [];
  const queue = [root.path];

  while (queue.length > 0 && results.length < limit) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    let entries: Array<{
      name: string;
      isDirectory(): boolean;
      isFile(): boolean;
    }>;
    try {
      entries = await readdir(current, { withFileTypes: true, encoding: "utf8" });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (results.length >= limit) {
        break;
      }

      const nextPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (!skippedDirectories.has(entry.name)) {
          queue.push(nextPath);
        }
        continue;
      }

      if (!entry.isFile() || !matchesTokens(nextPath, tokens)) {
        continue;
      }

      if (excludePaths.has(normalizePathForCompare(nextPath))) {
        continue;
      }

      try {
        const fileStat = await stat(nextPath);
        results.push(buildSearchResultItem(root, nextPath, fileStat));
      } catch {
        continue;
      }
    }
  }

  return results;
}

async function searchRootsNative(
  roots: AgentFileSearchRoot[],
  tokens: string[],
  limit: number,
  excludePaths: Set<string> = new Set()
) {
  const resultSets = await Promise.all(
    roots.map((root) => walkRootForMatches(root, tokens, limit, excludePaths))
  );

  return resultSets
    .flat()
    .sort((left, right) => Date.parse(right.storedAt) - Date.parse(left.storedAt))
    .slice(0, limit);
}

async function searchRootsWithEverythingCli(
  roots: AgentFileSearchRoot[],
  query: string,
  limit: number
) {
  const detection = await detectEverythingCli();
  if (!detection.available || !detection.executablePath) {
    return {
      results: [] as AgentFileWorkspaceSearchResultItem[],
      acceleration: {
        provider: "native-fallback",
        available: false,
        used: false,
        executablePath: null,
        note: detection.note
      } satisfies AgentFileWorkspaceSearchAcceleration
    };
  }

  const maxCandidates = Math.min(Math.max(limit * 10, 80), 500);

  try {
    const { stdout } = await execFileAsync(
      detection.executablePath,
      [...detection.extraArgs, "-n", String(maxCandidates), query],
      {
        timeout: 2_000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      }
    );

    const seenPaths = new Set<string>();
    const results: AgentFileWorkspaceSearchResultItem[] = [];
    const lines = stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);

    for (const candidatePath of lines) {
      if (results.length >= limit) {
        break;
      }

      const normalizedPath = normalizePathForCompare(candidatePath);
      if (seenPaths.has(normalizedPath)) {
        continue;
      }

      const root = findMatchingRoot(candidatePath, roots);
      if (!root) {
        continue;
      }

      try {
        const fileStat = await stat(candidatePath);
        if (!fileStat.isFile()) {
          continue;
        }

        seenPaths.add(normalizedPath);
        results.push(buildSearchResultItem(root, candidatePath, fileStat));
      } catch {
        continue;
      }
    }

    return {
      results,
      acceleration: {
        provider: "everything-cli",
        available: true,
        used: results.length > 0,
        executablePath: detection.executablePath,
        note:
          results.length > 0
            ? "Using Everything CLI to accelerate keyword search."
            : "Everything CLI is available, but no in-scope matches were returned for this query."
      } satisfies AgentFileWorkspaceSearchAcceleration
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    return {
      results: [] as AgentFileWorkspaceSearchResultItem[],
      acceleration: {
        provider: "native-fallback",
        available: true,
        used: false,
        executablePath: detection.executablePath,
        note: `Everything CLI was detected but the query failed. Falling back to built-in search. ${detail}`
      } satisfies AgentFileWorkspaceSearchAcceleration
    };
  }
}

export async function searchAgentFileWorkspace(
  workspaceId: string,
  input: AgentFileWorkspaceSearchQuery
): Promise<AgentFileWorkspaceSearchResult | null> {
  const workspace = await getAgentFileWorkspace(workspaceId);
  if (!workspace) {
    return null;
  }

  const query = (input.query ?? "").trim();
  const limit = Math.max(1, Math.min(input.limit ?? 12, 30));
  const tokens = splitQueryTokens(query);
  const validRoots = workspace.searchRoots.filter((root) => root.exists);
  const everythingAttempt =
    query.length > 0 ? await searchRootsWithEverythingCli(validRoots, query, limit) : null;

  const everythingResults = everythingAttempt?.results ?? [];
  const nativeSupplement =
    everythingResults.length >= limit
      ? []
      : await searchRootsNative(
          validRoots,
          tokens,
          limit,
          new Set(everythingResults.map((result) => normalizePathForCompare(result.path)))
        );

  const allResults = [...everythingResults, ...nativeSupplement]
    .sort((left, right) => Date.parse(right.storedAt) - Date.parse(left.storedAt))
    .slice(0, limit);
  const timeGroups = buildTimeGroups(allResults);
  const eventGroups = buildEventGroups(allResults);

  const acceleration: AgentFileWorkspaceSearchAcceleration =
    everythingAttempt && everythingResults.length > 0 && nativeSupplement.length > 0
      ? {
          provider: "everything-cli",
          available: true,
          used: true,
          executablePath: everythingAttempt.acceleration.executablePath,
          note: "Everything CLI returned the first match set, and built-in scoped search filled the remaining results."
        }
      : everythingAttempt && everythingResults.length > 0
        ? everythingAttempt.acceleration
        : everythingAttempt
          ? everythingAttempt.acceleration
          : {
              provider: "native-fallback",
              available: false,
              used: false,
              executablePath: null,
              note:
                query.length === 0
                  ? "Built-in scoped search is used for empty queries so the user can browse local roots safely."
                  : "Built-in scoped search is active."
            };

  return {
    workspaceId,
    query,
    generatedAt: new Date().toISOString(),
    searchedRootCount: validRoots.length,
    matchedCount: allResults.length,
    returnedCount: Math.min(allResults.length, limit),
    acceleration,
    results: allResults,
    timeGroups,
    eventGroups,
    suggestions: buildSuggestionCards(allResults, timeGroups, eventGroups)
  };
}

export async function previewAgentFileWorkspaceOrganization(
  workspaceId: string,
  input: AgentFileWorkspacePreviewInput
): Promise<AgentFileWorkspaceOrganizationPreview | null> {
  const searchResult = await searchAgentFileWorkspace(workspaceId, {
    query: input.query,
    limit: input.limit ?? 12
  });
  if (!searchResult) {
    return null;
  }

  const items = buildPreviewItems(searchResult.results);
  const groups = buildPreviewGroups(items);

  await appendActivityItem({
    kind: "agent-file-workspace-preview-created",
    title: "File organization preview created",
    summary: `Prepared a read-only organization preview for ${items.length} files.`,
    actor: "agent",
    relatedConversationId: null,
    relatedTaskId: null,
    metadata: {
      workspaceId,
      query: searchResult.query,
      totalItems: items.length,
      accelerationProvider: searchResult.acceleration.provider
    }
  });

  return {
    workspaceId,
    query: searchResult.query,
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    readOnly: true,
    groups,
    items,
    note:
      "This is a read-only organization preview. It shows how ClawDesk would group files later, without moving anything yet."
  };
}

export async function createAgentFileWorkspaceFromSafeAction(input: AgentFileWorkspaceFromSafeActionInput) {
  const action = await getAgentSafeAction(input.actionId);
  if (!action) {
    return null;
  }

  const template = buildWorkspaceTemplate(action);
  if (!template) {
    throw new AgentFileWorkspaceValidationError(
      `Safe action kind ${action.kind} cannot become a file workspace yet.`
    );
  }

  const workspaces = await readFileWorkspaces();
  const existing = workspaces.find((workspace) => workspace.sourceActionId === action.actionId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const nextWorkspace: AgentFileWorkspaceRecord = {
    workspaceId: crypto.randomUUID(),
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
    searchRoots: await buildDefaultSearchRoots(),
    resultFields: template.resultFields,
    timeViews: buildTimeViews(),
    eventViews: buildEventViews(),
    plannedIntegrations: template.plannedIntegrations,
    notes: template.notes
  };

  workspaces.push(nextWorkspace);
  await writeFileWorkspaces(workspaces);
  await appendActivityItem({
    kind: "agent-file-workspace-created",
    title: "File workspace created",
    summary: `Created ${nextWorkspace.title} from safe action "${action.title}".`,
    actor: "agent",
    relatedConversationId: nextWorkspace.sourceConversationId,
    relatedTaskId: nextWorkspace.sourceTaskId,
    metadata: {
      status: nextWorkspace.status,
      sourceActionId: nextWorkspace.sourceActionId,
      sourceReplyMode: nextWorkspace.sourceReplyMode,
      sourceOrchestration: nextWorkspace.sourceOrchestration
    }
  });
  return nextWorkspace;
}

export async function updateAgentFileWorkspaceStatus(
  workspaceId: string,
  input: AgentFileWorkspaceStatusUpdateInput
) {
  const workspaces = await readFileWorkspaces();
  const workspace = workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace) {
    return null;
  }

  workspace.status = input.status;
  workspace.updatedAt = new Date().toISOString();
  await writeFileWorkspaces(workspaces);
  await appendActivityItem({
    kind: "agent-file-workspace-status-updated",
    title: "File workspace updated",
    summary: `${workspace.title} is now ${workspace.status}.`,
    actor: "user",
    relatedConversationId: workspace.sourceConversationId,
    relatedTaskId: workspace.sourceTaskId,
    metadata: {
      status: workspace.status,
      sourceActionId: workspace.sourceActionId,
      sourceReplyMode: workspace.sourceReplyMode,
      sourceOrchestration: workspace.sourceOrchestration
    }
  });
  return workspace;
}

export { AgentFileWorkspaceValidationError };

