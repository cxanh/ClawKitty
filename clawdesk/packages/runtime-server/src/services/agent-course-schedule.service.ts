import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentCourseScheduleBoardPayload,
  AgentCourseScheduleEntry,
  AgentCourseScheduleEntryInput,
  AgentCourseScheduleImportInput,
  AgentCourseScheduleImportResult,
  AgentCourseWeekday
} from "@clawdesk/shared-types";

import { appendActivityItem } from "./activity.service.js";

class AgentCourseScheduleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentCourseScheduleValidationError";
  }
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getCourseScheduleFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "course-schedule.json");
}

async function ensureCourseScheduleDirectory() {
  await mkdir(path.dirname(getCourseScheduleFilePath()), { recursive: true });
}

async function readCourseScheduleEntries(): Promise<AgentCourseScheduleEntry[]> {
  try {
    const raw = await readFile(getCourseScheduleFilePath(), "utf8");
    return JSON.parse(raw) as AgentCourseScheduleEntry[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function listAgentCourseScheduleEntries() {
  return sortEntries(await readCourseScheduleEntries());
}

async function writeCourseScheduleEntries(entries: AgentCourseScheduleEntry[]) {
  await ensureCourseScheduleDirectory();
  await writeFile(getCourseScheduleFilePath(), JSON.stringify(entries, null, 2), "utf8");
}

function normalizeTime(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!/^\d{2}:\d{2}$/.test(trimmed)) {
    throw new AgentCourseScheduleValidationError(`${fieldName} must use HH:MM format.`);
  }

  return trimmed;
}

function buildWeekdayCounts(entries: AgentCourseScheduleEntry[]): AgentCourseScheduleBoardPayload["weekdayCounts"] {
  return entries.reduce<AgentCourseScheduleBoardPayload["weekdayCounts"]>(
    (counts, entry) => {
      counts[entry.weekday] += 1;
      return counts;
    },
    {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0
    }
  );
}

function sortEntries(entries: AgentCourseScheduleEntry[]) {
  return entries.sort((left, right) => {
    const weekdayOrder: AgentCourseWeekday[] = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday"
    ];

    const weekdayDelta = weekdayOrder.indexOf(left.weekday) - weekdayOrder.indexOf(right.weekday);
    if (weekdayDelta !== 0) {
      return weekdayDelta;
    }

    return left.startTime.localeCompare(right.startTime);
  });
}

function sanitizeEntryInput(input: AgentCourseScheduleEntryInput) {
  const courseName = input.courseName.trim();
  if (!courseName) {
    throw new AgentCourseScheduleValidationError("Course name is required.");
  }

  const startTime = normalizeTime(input.startTime, "Start time");
  const endTime = normalizeTime(input.endTime, "End time");
  if (endTime <= startTime) {
    throw new AgentCourseScheduleValidationError("End time must be later than start time.");
  }

  return {
    courseName,
    weekday: input.weekday,
    startTime,
    endTime,
    location: input.location?.trim() || null,
    notes: input.notes.map((item) => item.trim()).filter(Boolean),
    reminderPreset: input.reminderPreset,
    nightBeforeReminder: input.nightBeforeReminder,
    afternoonReminder: input.afternoonReminder,
    sourcePlanId: input.sourcePlanId ?? null
  };
}

function parseDelimitedLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (char === "," || char === "\t" || char === "|")) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function looksLikeHeader(cells: string[]) {
  const normalized = cells.map((cell) => normalizeHeader(cell));
  return normalized.some((cell) =>
    [
      "coursename",
      "course",
      "课程",
      "课程名",
      "weekday",
      "星期",
      "周几",
      "starttime",
      "开始时间",
      "endtime",
      "结束时间"
    ].includes(cell)
  );
}

function resolveColumnIndex(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => header === alias);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function parseWeekday(value: string): AgentCourseWeekday | null {
  const normalized = value.trim().toLowerCase();
  const map: Record<string, AgentCourseWeekday> = {
    monday: "monday",
    mon: "monday",
    星期一: "monday",
    周一: "monday",
    tuesday: "tuesday",
    tue: "tuesday",
    tues: "tuesday",
    星期二: "tuesday",
    周二: "tuesday",
    wednesday: "wednesday",
    wed: "wednesday",
    星期三: "wednesday",
    周三: "wednesday",
    thursday: "thursday",
    thu: "thursday",
    thur: "thursday",
    thurs: "thursday",
    星期四: "thursday",
    周四: "thursday",
    friday: "friday",
    fri: "friday",
    星期五: "friday",
    周五: "friday",
    saturday: "saturday",
    sat: "saturday",
    星期六: "saturday",
    周六: "saturday",
    sunday: "sunday",
    sun: "sunday",
    星期日: "sunday",
    星期天: "sunday",
    周日: "sunday",
    周天: "sunday"
  };

  return map[normalized] ?? null;
}

function inferReminderPresetFromStartTime(startTime: string) {
  const hour = Number.parseInt(startTime.split(":")[0] ?? "0", 10);
  if (hour < 12) {
    return {
      reminderPreset: "morning-class" as const,
      nightBeforeReminder: true,
      afternoonReminder: false
    };
  }

  if (hour < 18) {
    return {
      reminderPreset: "afternoon-class" as const,
      nightBeforeReminder: false,
      afternoonReminder: true
    };
  }

  return {
    reminderPreset: "custom" as const,
    nightBeforeReminder: false,
    afternoonReminder: false
  };
}

function buildImportEntryInput(cells: string[], rowNumber: number, headers: string[] | null): AgentCourseScheduleEntryInput {
  const getCell = (index: number) => (index >= 0 ? cells[index]?.trim() ?? "" : "");

  let courseName = "";
  let weekdayRaw = "";
  let startTime = "";
  let endTime = "";
  let location = "";
  let notes = "";

  if (headers) {
    courseName = getCell(resolveColumnIndex(headers, ["coursename", "course", "课程", "课程名"]));
    weekdayRaw = getCell(resolveColumnIndex(headers, ["weekday", "星期", "周几"]));
    startTime = getCell(resolveColumnIndex(headers, ["starttime", "start", "开始时间", "开始"]));
    endTime = getCell(resolveColumnIndex(headers, ["endtime", "end", "结束时间", "结束"]));
    location = getCell(resolveColumnIndex(headers, ["location", "教室", "地点", "上课地点"]));
    notes = getCell(resolveColumnIndex(headers, ["notes", "note", "备注"]));
  } else {
    [courseName = "", weekdayRaw = "", startTime = "", endTime = "", location = "", notes = ""] = cells;
  }

  const weekday = parseWeekday(weekdayRaw);
  if (!weekday) {
    throw new AgentCourseScheduleValidationError(`Row ${rowNumber}: weekday "${weekdayRaw}" is not recognized.`);
  }

  const reminderPreset = inferReminderPresetFromStartTime(startTime);

  return {
    courseName,
    weekday,
    startTime,
    endTime,
    location,
    notes: notes
      ? notes
          .split(/[;；]/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [],
    reminderPreset: reminderPreset.reminderPreset,
    nightBeforeReminder: reminderPreset.nightBeforeReminder,
    afternoonReminder: reminderPreset.afternoonReminder,
    sourcePlanId: null
  };
}

export async function getAgentCourseScheduleBoard(): Promise<AgentCourseScheduleBoardPayload> {
  const entries = await listAgentCourseScheduleEntries();

  return {
    generatedAt: new Date().toISOString(),
    total: entries.length,
    weekdayCounts: buildWeekdayCounts(entries),
    entries
  };
}

export async function createAgentCourseScheduleEntry(input: AgentCourseScheduleEntryInput) {
  const next = sanitizeEntryInput(input);
  const entries = await readCourseScheduleEntries();
  const now = new Date().toISOString();

  const entry: AgentCourseScheduleEntry = {
    entryId: crypto.randomUUID(),
    ...next,
    createdAt: now,
    updatedAt: now
  };

  entries.push(entry);
  await writeCourseScheduleEntries(entries);
  await appendActivityItem({
    kind: "agent-course-schedule-updated",
    title: "Course schedule updated",
    summary: `Added ${entry.courseName} on ${entry.weekday}.`,
    actor: "user",
    metadata: {
      action: "created",
      entryId: entry.entryId,
      courseName: entry.courseName,
      weekday: entry.weekday
    }
  });
  return entry;
}

export async function importAgentCourseSchedule(input: AgentCourseScheduleImportInput): Promise<AgentCourseScheduleImportResult> {
  const text = input.text.trim();
  if (!text) {
    throw new AgentCourseScheduleValidationError("Import text is required.");
  }

  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    throw new AgentCourseScheduleValidationError("No valid rows found in the import text.");
  }

  const firstRowCells = parseDelimitedLine(rows[0]);
  const hasHeader = looksLikeHeader(firstRowCells);
  const headers = hasHeader ? firstRowCells.map((cell) => normalizeHeader(cell)) : null;

  const entries = input.mode === "replace" ? [] : await readCourseScheduleEntries();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  const dataRows = hasHeader ? rows.slice(1) : rows;

  for (const [index, row] of dataRows.entries()) {
    const rowNumber = hasHeader ? index + 2 : index + 1;
    try {
      const cells = parseDelimitedLine(row);
      const next = sanitizeEntryInput(buildImportEntryInput(cells, rowNumber, headers));
      const existing = entries.find(
        (entry) =>
          entry.courseName.toLowerCase() === next.courseName.toLowerCase() &&
          entry.weekday === next.weekday &&
          entry.startTime === next.startTime
      );

      if (existing) {
        Object.assign(existing, next, {
          updatedAt: new Date().toISOString()
        });
        updatedCount += 1;
      } else {
        entries.push({
          entryId: crypto.randomUUID(),
          ...next,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        createdCount += 1;
      }
    } catch (error) {
      skippedCount += 1;
      errors.push(error instanceof Error ? error.message : `Row ${rowNumber}: import failed.`);
    }
  }

  await writeCourseScheduleEntries(entries);
  await appendActivityItem({
    kind: "agent-course-schedule-updated",
    title: "Course schedule imported",
    summary: `Imported timetable rows with mode=${input.mode}, created=${createdCount}, updated=${updatedCount}, skipped=${skippedCount}.`,
    actor: "user",
    metadata: {
      action: "imported",
      mode: input.mode,
      createdCount,
      updatedCount,
      skippedCount
    }
  });

  return {
    mode: input.mode,
    createdCount,
    updatedCount,
    skippedCount,
    totalRows: dataRows.length,
    errors
  };
}

export async function updateAgentCourseScheduleEntry(entryId: string, input: AgentCourseScheduleEntryInput) {
  const next = sanitizeEntryInput(input);
  const entries = await readCourseScheduleEntries();
  const entry = entries.find((item) => item.entryId === entryId);
  if (!entry) {
    return null;
  }

  Object.assign(entry, next, {
    updatedAt: new Date().toISOString()
  });
  await writeCourseScheduleEntries(entries);
  await appendActivityItem({
    kind: "agent-course-schedule-updated",
    title: "Course schedule updated",
    summary: `Updated ${entry.courseName} on ${entry.weekday}.`,
    actor: "user",
    metadata: {
      action: "updated",
      entryId: entry.entryId,
      courseName: entry.courseName,
      weekday: entry.weekday
    }
  });
  return entry;
}

export async function deleteAgentCourseScheduleEntry(entryId: string) {
  const entries = await readCourseScheduleEntries();
  const index = entries.findIndex((item) => item.entryId === entryId);
  if (index < 0) {
    return null;
  }

  const [removed] = entries.splice(index, 1);
  await writeCourseScheduleEntries(entries);
  await appendActivityItem({
    kind: "agent-course-schedule-updated",
    title: "Course schedule updated",
    summary: `Removed ${removed.courseName} from the timetable model.`,
    actor: "user",
    metadata: {
      action: "deleted",
      entryId: removed.entryId,
      courseName: removed.courseName,
      weekday: removed.weekday
    }
  });
  return removed;
}

export { AgentCourseScheduleValidationError };
