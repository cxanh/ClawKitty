import os from "node:os";
import path from "node:path";
import { rm } from "node:fs/promises";

import { getActivityFeed } from "../packages/runtime-server/src/services/activity.service.ts";
import {
  getAgentCourseScheduleBoard,
  importAgentCourseSchedule
} from "../packages/runtime-server/src/services/agent-course-schedule.service.ts";

const importHome = path.join(os.tmpdir(), "clawdesk-agent-course-schedule-import-smoke");
process.env.OPENCLAW_HOME = importHome;

await rm(importHome, { recursive: true, force: true });

const appendResult = await importAgentCourseSchedule({
  mode: "append",
  text: [
    "courseName,weekday,startTime,endTime,location,notes",
    "Advanced Mathematics,Monday,08:00,09:35,Building A-201,Bring workbook;Morning self-study",
    "College English,Wednesday,13:30,15:05,Building B-102,Afternoon class"
  ].join("\n")
});

const replaceResult = await importAgentCourseSchedule({
  mode: "replace",
  text: [
    "courseName,weekday,startTime,endTime,location,notes",
    "Physics Lab,Friday,10:00,11:35,Science Center-301,Bring lab coat"
  ].join("\n")
});

const board = await getAgentCourseScheduleBoard();
const feed = await getActivityFeed(10);

console.log(
  JSON.stringify(
    {
      appendCreated: appendResult.createdCount,
      replaceCreated: replaceResult.createdCount,
      totalAfterReplace: board.total,
      firstCourseName: board.entries[0]?.courseName ?? null,
      firstWeekday: board.entries[0]?.weekday ?? null,
      latestActivityKind: feed.items[0]?.kind ?? null
    },
    null,
    2
  )
);
