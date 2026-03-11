import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import {
  createAgentCourseScheduleEntry,
  deleteAgentCourseScheduleEntry,
  getAgentCourseScheduleBoard,
  updateAgentCourseScheduleEntry
} from "../packages/runtime-server/src/services/agent-course-schedule.service.ts";
import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";

const courseScheduleHome = path.join(os.tmpdir(), "clawdesk-agent-course-schedule-smoke");
process.env.OPENCLAW_HOME = courseScheduleHome;

await rm(courseScheduleHome, { recursive: true, force: true });

const created = await createAgentCourseScheduleEntry({
  courseName: "Advanced Mathematics",
  weekday: "monday",
  startTime: "08:00",
  endTime: "09:35",
  location: "Teaching Building A-201",
  notes: ["Self-study before class", "Bring workbook"],
  reminderPreset: "morning-class",
  nightBeforeReminder: true,
  afternoonReminder: false,
  sourcePlanId: null
});

await updateAgentCourseScheduleEntry(created.entryId, {
  courseName: "Advanced Mathematics",
  weekday: "monday",
  startTime: "08:00",
  endTime: "09:40",
  location: "Teaching Building A-201",
  notes: ["Self-study before class", "Bring workbook"],
  reminderPreset: "morning-class",
  nightBeforeReminder: true,
  afternoonReminder: false,
  sourcePlanId: null
});

const boardAfterUpdate = await getAgentCourseScheduleBoard();
await deleteAgentCourseScheduleEntry(created.entryId);
const boardAfterDelete = await getAgentCourseScheduleBoard();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      totalAfterUpdate: boardAfterUpdate.total,
      mondayCountAfterUpdate: boardAfterUpdate.weekdayCounts.monday,
      updatedEndTime: boardAfterUpdate.entries[0]?.endTime ?? null,
      totalAfterDelete: boardAfterDelete.total,
      latestActivityKind: feed.items[0]?.kind ?? null
    },
    null,
    2
  )
);
