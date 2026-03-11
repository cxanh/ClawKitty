# ClawDesk

ClawDesk is the first desktop product shell built from the OpenClaw prototype. This workspace includes:

- `apps/desktop`: Electron + Vue desktop shell
- `packages/openclaw-core`: compatibility adapter for the existing OpenClaw home
- `packages/runtime-server`: local Fastify runtime
- `packages/shared-types`: shared API and DTO types

## Run

```bash
npm install
npm run doctor
npm run dev
```

The desktop shell expects the runtime server at `http://127.0.0.1:47890`.

After the runtime is up, validate the local chain with:

```bash
npm run smoke:runtime
```

## Demo seed

For defense/demo preparation, seed a stable set of example data with:

```bash
npm run demo:seed:clean
```

This prepares:

- sample conversations
- Agent task cards
- safe actions
- active reminder plans
- active study roadmaps
- active file workspaces
- course schedule entries
- pending approval requests
- recent activity items

## Package

Create an unpacked Windows app directory:

```bash
npm run package:dir
```

Create Windows installer targets:

```bash
npm run package:win
```

Current unpacked output:

```text
apps/desktop/release/0.1.0/win-unpacked/ClawDesk.exe
```

Current Windows installer outputs:

```text
apps/desktop/release/0.1.0/ClawDesk-0.1.0-x64.exe
apps/desktop/release/0.1.0/ClawDesk-0.1.0-x64-portable.exe
```

Packaged builds use the Electron executable itself to host the managed runtime child, so install-time startup no longer depends on a separate system Node.js binary.

## Packaging identity

The desktop shell now ships with a consistent Windows identity baseline:

- product name: `ClawDesk`
- app id: `com.openlaw.clawdesk`
- executable name: `ClawDesk.exe`
- uninstall display name: `ClawDesk`
- Windows AppUserModelID: `com.openlaw.clawdesk`

Brand assets currently live in:

```text
apps/desktop/build/icon.ico
apps/desktop/build/icon.png
apps/desktop/build/icon.svg
```

The next productization step is code signing and release collateral, not another round of core packaging rewrites.

## MVP priority

The current priority is to make the desktop shell reliably runnable end-to-end before expanding feature scope.

Recommended first-run path:

1. `npm install`
2. `npm run doctor`
3. `npm run dev`
4. `npm run smoke:runtime`

See the full plan here:

- [mvp-runthrough-plan.md](C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops/mvp-runthrough-plan.md)

## OpenClaw compatibility

The desktop app now uses a managed data home by default:

```text
%APPDATA%\\ClawDesk\\openclaw-home
```

On first launch:

- if no legacy data exists, ClawDesk creates an empty compatible data skeleton
- if `%USERPROFILE%\\.openclaw` exists, ClawDesk imports compatible files into the managed data home
- runtime child processes inherit the same `OPENCLAW_HOME` value from the desktop shell

The legacy compatibility source remains:

```text
%USERPROFILE%\\.openclaw
```

For development or overrides, you can still set:

```bash
set OPENCLAW_HOME=C:\\path\\to\\.openclaw
```

## Browser Relay control

The current desktop build can now:

- inspect relay and gateway status
- inspect relay targets and event history
- open a new relay-managed target
- focus an existing relay target
- close an existing relay target

Important constraints:

- relay control only works when the relay and gateway are actually online
- the browser extension must be connected before desktop actions can succeed
- pure detach without closing the tab is still extension-side only

## Task editing

The current desktop build now supports first-pass task CRUD for basic OpenClaw cron tasks:

- create
- edit
- duplicate into the editor
- delete

Current scope:

- payload kind: `systemEvent`
- schedule kinds: `every`, `cron`, `at`

## Notes

- This scaffold uses `npm workspaces` because `pnpm` is not installed in the current environment.
- The current milestone focuses on the desktop shell, runtime health checks, live system summary, OpenClaw compatibility reads, and first-pass Browser Relay control.
- `npm run doctor` checks the workspace, build artifacts, `.openclaw` home, logs directory, and runtime reachability.
- `npm run smoke:runtime` verifies the runtime, system summary, OpenClaw overview, and logs summary endpoints.
- `npm run package:dir` currently produces a verified `win-unpacked` directory build.
- `npm run package:win` currently produces verified `nsis` and `portable` Windows artifacts.

## Update: Runtime pairing flow landed

The desktop pairing center is no longer read-only.

This round added:

- pairing session creation
- pending approval listing
- desktop approve / reject actions
- mobile-side pairing request intake

New doc:

- `docs/pairing-center-runtime-flow.md`

## Update: pairing audit, QR, and mobile status

This round added:

- pairing audit persistence and API
- QR rendering for the active pairing session card
- `GET /api/v1/mobile/pairing-status`

## Update: cleanup and pairing audit query

This round added:

- expired pairing session cleanup
- pairing audit query endpoint
- pairing audit export endpoint

## Update: desktop managed data home

This round added:

- desktop-managed runtime data home
- first-launch empty-state initialization
- one-time legacy `.openclaw` import
- session file path rewrite during import

## Update: bundled browser extension seed

This round added:

- bundled browser extension seed files under `apps/desktop/resources/openclaw-home`
- packaged `extraResources` output under `resources/seed/openclaw-home`
- first-launch seeding of relay extension files into the managed data home
- settings-page visibility for user data directory and managed data home source
## Android Skeleton

Android 第一版源码骨架已放在：
- `C:\Users\ASUS\Desktop\openlaw\android\ClawDeskAndroid`

当前环境没有 `java` / `gradle`，所以这一轮只完成了源码骨架和接口对齐，没有执行 Android 原生编译。

## Update: safe-first chat orchestration

This round added:

- provider-backed chat orchestration service under `packages/runtime-server/src/services/agent-orchestration.service.ts`
- automatic provider-first, heuristic-fallback reply flow in `Chat`
- orchestration metadata in chat responses:
  - `source`
  - `providerId`
  - `modelId`
  - `durationMs`
  - `fallbackReason`
- desktop chat UI visibility for reply source and fallback reason

This means `Chat` now stays usable on fresh machines without tokens, while still preparing for real provider-backed replies when compatible credentials exist.

## Update: Permissions page landed

This round added:

- a first-pass `Permissions` page in the desktop app
- runtime endpoints for permission overview and policy updates
- persistent permission defaults under `<OPENCLAW_HOME>/agent-assistant/permissions.json`
- activity tracking for permission policy changes

The first version focuses on:
- risk-based defaults
- per-tool policy overrides
- device permission snapshot
- approval-sensitive history

## Update: approval requests for high-risk actions

This round added:

- approval request persistence under `<OPENCLAW_HOME>/agent-assistant/approval-requests.json`
- approval request APIs for process termination and device removal
- a pending-request section in the desktop `Permissions` page
- high-risk action flow for:
  - process kill
  - device removal

These actions now create approval requests first, then execute only after desktop approval.

## 2026-03-11 - Approval-aware Agent UX
This build now connects the permissions model back into the user-facing Agent flow.
- `Capabilities` shows current policy, policy source, recommended policy, and whether a tool currently needs approval.
- `Chat` replies can surface approval hints for the next likely action path.
- `Task Center` persists those approval hints on Agent task cards.

Validation completed for this pass:
- `npm run check`
- `npm run build`
- `npx tsx scripts/smoke-chat.mjs`
- `npx tsx scripts/smoke-agent-task.mjs`
- `npx tsx scripts/smoke-capabilities.mjs`
- `npm run package:dir`

## 2026-03-11 - Pre-approval entry for Agent steps
Chat and Task Center now support direct approval-request entry for approval-sensitive Agent hints.
- New approval action type: `agent-tool-access`
- New endpoints: `/api/v1/approvals/chat-hint` and `/api/v1/approvals/agent-task-hint`
- Approved `agent-tool-access` requests are recorded as pre-approved future Agent steps, not immediate executions

Validation completed for this pass:
- `npm run check`
- `npm run build`
- `npx tsx scripts/smoke-approvals.mjs`
- `npx tsx scripts/smoke-chat.mjs`
- `npx tsx scripts/smoke-agent-task.mjs`
- `npm run package:dir`

## 2026-03-11 - Approval readability in Activity
The Activity Feed now renders approval workflows in a more novice-friendly way.
- Approval events surface action type, origin, target, decision, and outcome.
- Pre-approval for Agent steps is explicitly separated from immediate desktop execution.
- Approved/rejected approval events now keep their origin metadata so the timeline can still explain whether the request came from Chat or Task Center.

Validation completed for this pass:
- `npm run check`
- `npm run build`
- `npx tsx scripts/smoke-activity.mjs`
- `npm run package:dir`

## 2026-03-11 - First real Agent safe actions
This pass added a first batch of low-risk persisted Agent outputs.
- New kinds:
  - `course-reminder-draft`
  - `file-organization-brief`
  - `study-plan-draft`
  - `memory-item`
- New APIs:
  - `GET /api/v1/agent-safe-actions`
  - `POST /api/v1/agent-safe-actions/from-chat`
  - `POST /api/v1/agent-safe-actions/from-task`
  - `PATCH /api/v1/agent-safe-actions/:actionId/status`
- New storage:
  - `<OPENCLAW_HOME>/agent-assistant/safe-actions.json`
- UI entry points:
  - `Chat` can save a safe action from the active conversation
  - `Task Center` can save a safe action from an Agent task card
  - `Tasks` page now includes `Agent Safe Action Board`

## 2026-03-11 - Reminder plans from safe actions
This pass extends low-risk Agent outputs into the first reminder-plan layer.
- Supported conversions:
  - `course-reminder-draft -> course-reminder-plan`
  - `memory-item -> memory-reminder-plan`
- New APIs:
  - `GET /api/v1/agent-reminder-plans`
  - `POST /api/v1/agent-reminder-plans/from-safe-action`
  - `PATCH /api/v1/agent-reminder-plans/:planId/status`
- New storage:
  - `<OPENCLAW_HOME>/agent-assistant/reminder-plans.json`
- `Tasks` page now includes `Agent Reminder Plan Board`

## 2026-03-11 - Study roadmaps from safe actions
This pass extends the study-planning chain.
- `study-plan-draft` can now become a structured study roadmap.
- New APIs:
  - `GET /api/v1/agent-study-roadmaps`
  - `POST /api/v1/agent-study-roadmaps/from-safe-action`
  - `PATCH /api/v1/agent-study-roadmaps/:roadmapId/status`
- New storage:
  - `<OPENCLAW_HOME>/agent-assistant/study-roadmaps.json`
- `Tasks` page now includes `Agent Study Roadmap Board`

## 2026-03-11 - Memory reminder strategy enrichment
- Added strategy-aware memory reminder plans with event/relationship/importance inference.
- Desktop reminder board now renders suggestion cards for birthday, meeting, and deadline scenarios.
- Validation passed: `npm run check`, `npx tsx scripts/smoke-agent-reminder-plans.mjs`, `npm run build`, `npm run package:dir`.

## 2026-03-11 - Desktop reminder delivery chain
- Added runtime reminder delivery polling for active memory reminder plans.
- Added Electron-side desktop reminder polling and native notifications.
- Added smoke script: `npx tsx scripts/smoke-agent-reminder-deliveries.mjs`.
- Current scope intentionally excludes auto-executing course reminder plans until timetable import exists.

## 2026-03-11 - Course schedule import model
- Added `Course Schedule Board` to the Tasks page.
- Added persistent timetable CRUD endpoints and activity tracking.
- Added smoke script: `npx tsx scripts/smoke-agent-course-schedule.mjs`.
- Current scope is the timetable data model and manual entry flow; imports are the next step.

## 2026-03-11 - Timetable paste import
- Added `POST /api/v1/agent-course-schedule/import`.
- Added desktop paste-import UI with append/replace modes.
- Added smoke script: `npx tsx scripts/smoke-agent-course-schedule-import.mjs`.

## Course reminder execution
- `course-reminder-plan` now generates real desktop reminder deliveries from saved timetable entries.
- Night-before reminders default to `20:30` on the previous evening.
- Afternoon reminders default to `13:30` on the class day.
- Validation passed with `npm run smoke:agent-course-reminder-deliveries` and the standard `check/build/package:dir` flow.

## File workspace
- `file-organization-brief` can now become a dedicated file workspace board.
- The first version focuses on beginner-friendly search roots, result fields, time-first views, and event-first views.
- It does not move or delete local files automatically.
- Validation passed with `npm run smoke:agent-file-workspaces` and the standard `check/build/package:dir` flow.

## File workspace local search
- File workspaces now support a first local-search flow.
- Search runs against the workspace roots and returns file name, path, modified time, size, and event tag.
- The current version is read-only and does not move, rename, or delete files.
- Validation passed with `npm run smoke:agent-file-workspaces` and the standard `check/build/package:dir` flow.

## File workspace grouped views
- File workspace search now returns real grouped views.
- Added time groups and event groups on top of the raw search result list.
- This keeps the experience beginner-friendly before we add Everything integration.

## File workspace acceleration
- File workspace search now supports `Everything CLI` as an optional acceleration layer.
- Set `CLAWDESK_EVERYTHING_CLI_PATH` if you want to point ClawDesk at a specific `es.exe` location.
- If `Everything` is not installed, search automatically falls back to the built-in scoped search.

## File workspace suggestions
- File workspace search now returns read-only organization suggestion cards.
- Suggestions help freshmen review grouping ideas before any future semi-automatic file actions are introduced.

## File workspace preview
- File workspaces now support a read-only organization preview endpoint.
- The preview shows suggested folder lanes without moving or renaming local files.

## Home page
- The desktop Home page is now the unified Agent-first overview screen.
- It is intended for MVP demo readiness and shows:
  - recent conversations
  - current task focus
  - recent activity
  - capability snapshot
  - pending approvals
  - device/runtime support state

## Core page polish
- `Chat` now includes a clearer onboarding strip, conversation-progress summary, and suggested next-step guidance.
- `Tasks` now separates the Agent workspace from the legacy cron compatibility area for better graduation-demo readability.
- `Activity` now supports quick category filtering for Agent, approval, reminder, file, and system events.
- Validation passed with `npm run check`, `npm run build`, and `npm run package:dir`.

## Permissions and devices polish
- `Permissions` now includes clearer boundary guidance, approval-center framing, and summary signals for demo use.
- `Devices` now better explains the multi-device story, pairing center, and registry/detail relationship.
- Validation passed with `npm run check`, `npm run build`, and `npm run package:dir`.
