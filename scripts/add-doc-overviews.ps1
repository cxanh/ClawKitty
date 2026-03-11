$ErrorActionPreference = "Stop"

$root = "C:\Users\ASUS\Desktop\openlaw"
$docsRoot = Join-Path $root "docs"

$summaryMap = @{
  "README.md" = @(
    "the docs entry point and reading index",
    "which folders are primary maintained docs",
    "the current product storyline",
    "where future updates should land first"
  )
  "documentation-governance.md" = @(
    "documentation ownership and maintenance rules",
    "how code changes should sync with doc changes",
    "how to avoid drift between docs and implementation",
    "which audience each doc type serves"
  )
  "clawdesk-agent-assistant-prd.md" = @(
    "product positioning, target users, and core problems",
    "main product modules and scope boundaries",
    "graduation MVP versus later-stage expansion",
    "the stable product direction"
  )
  "desktop-home-and-chat-information-architecture.md" = @(
    "the Home and Chat information architecture",
    "what the desktop landing experience should emphasize",
    "how Chat connects to tasks and activity",
    "the recommended narrative order for the main desktop flow"
  )
  "graduation-current-implementation-and-future-direction.md" = @(
    "what is already implemented for graduation",
    "which desktop abilities are demonstrable now",
    "the honest current Android status",
    "what is deferred to later development",
    "how to describe the current project state in a defense"
  )
  "graduation-design-mvp-scope.md" = @(
    "what belongs in the graduation MVP",
    "what is explicitly deferred",
    "the current delivery standard",
    "how to choose stabilization over feature expansion"
  )
  "permissions-and-approval-prd.md" = @(
    "the permission and approval product rules",
    "risk levels and policy modes",
    "which actions can run automatically and which need approval",
    "how this module should expand later"
  )
  "clawdesk-agent-runtime-technical-design.md" = @(
    "the desktop, runtime, and compatibility-layer architecture",
    "module responsibilities and boundaries",
    "how the main process, renderer, and services cooperate",
    "technical rules for future implementation"
  )
  "clawdesk-agent-api-design.md" = @(
    "the current agent-related API surface",
    "which endpoints support desktop and mobile flows",
    "the main request/response boundaries",
    "which interfaces are implemented versus deferred"
  )
  "clawdesk-agent-database-design.md" = @(
    "core storage structures and persistence strategy",
    "how tasks, activity, reminders, and permissions are stored",
    "current data boundaries",
    "how the model can evolve later"
  )
  "clawdesk-deployment-and-ops.md" = @(
    "how the app is deployed on Windows",
    "managed home and runtime directory rules",
    "what the current Android build status is",
    "the main operations checkpoints"
  )
  "clawdesk-testing-strategy.md" = @(
    "testing goals and test layers",
    "which flows need the most attention",
    "what graduation-stage testing should prioritize",
    "how testing supports beginner usability"
  )
  "graduation-mvp-acceptance-checklist.md" = @(
    "the pass/fail checklist for the graduation MVP",
    "which pages and flows must work",
    "how to verify the main desktop story",
    "which items are not graduation blockers"
  )
  "clawdesk-user-manual.md" = @(
    "how users should navigate the product",
    "what each major page is for",
    "the recommended beginner flow",
    "current boundaries and cautions"
  )
  "graduation-demo-script.md" = @(
    "the recommended defense demo order",
    "what to show on each step",
    "how to explain each page clearly",
    "fallback plans when a live dependency is unavailable"
  )
  "development-log-2026-03.md" = @(
    "round-by-round development history",
    "what changed in each step",
    "what was validated",
    "where to look when reconstructing recent progress"
  )
  "android-feature-requirements-and-modules.md" = @(
    "the Android-side feature scope",
    "how Android modules are split",
    "what belongs in early Android work",
    "how Android aligns with the desktop product direction"
  )
  "android-first-skeleton-plan.md" = @(
    "the current Android skeleton status",
    "what engineering foundations already exist",
    "the next Android implementation order",
    "which desktop abilities are not yet synced to Android"
  )
  "api-v1-spec.md" = @(
    "an earlier API design baseline",
    "the initial endpoint planning scope",
    "what still matters as historical reference",
    "which newer docs supersede it"
  )
  "browser-relay-startup-and-live-debug.md" = @(
    "how Browser Relay is started and debugged",
    "the main diagnosis steps",
    "what to check when the extension will not connect",
    "how Relay fits into the current desktop demo"
  )
  "database-schema-draft.md" = @(
    "an earlier data-structure draft",
    "historical schema planning",
    "what remains useful as reference",
    "which newer database docs supersede it"
  )
  "desktop-first-start-and-managed-home.md" = @(
    "how first start behaves on desktop",
    "how managed data home is initialized",
    "how clean machines run without OpenClaw",
    "what happens during legacy import"
  )
  "development-progress-and-tasks.md" = @(
    "the ongoing development progress log",
    "what was added in each round",
    "what was verified",
    "what the next recommended steps are"
  )
  "implementation-roadmap.md" = @(
    "the overall phase roadmap",
    "what each stage should deliver",
    "the original implementation order",
    "historical planning context"
  )
  "mobile-client-preparation.md" = @(
    "the current mobile-preparation status",
    "which mobile-facing APIs already exist",
    "what mobile still needs later",
    "why mobile does not block the desktop graduation MVP"
  )
  "mobile-home-information-architecture.md" = @(
    "what the mobile home page should show",
    "which summaries belong on mobile",
    "how mobile and desktop split responsibilities",
    "the future direction for the mobile landing view"
  )
  "mobile-pairing-and-authorization-flow.md" = @(
    "the mobile pairing and authorization flow",
    "where desktop approval fits in",
    "which permission boundaries must stay visible",
    "the right order for later mobile access work"
  )
  "mvp-runthrough-plan.md" = @(
    "how to run through the current MVP",
    "the developer verification sequence",
    "the key commands to use",
    "when to use this doc during troubleshooting"
  )
  "next-session-handoff-2026-03-09.md" = @(
    "a historical development handoff snapshot",
    "what had been completed at that point",
    "what was expected next at that time",
    "historical context only"
  )
  "openclaw-device-app-design.md" = @(
    "the earliest overall design direction",
    "the original OpenClaw-plus-device-management concept",
    "how the project started before later correction",
    "historical background for the current product direction"
  )
  "packaging-and-startup-guide.md" = @(
    "how the desktop build is packaged and launched",
    "the different build outputs",
    "the package verification path",
    "the main packaging caveats"
  )
  "pairing-center-runtime-flow.md" = @(
    "the current pairing-center runtime flow",
    "how pairing sessions, approvals, and audit connect",
    "desktop and mobile roles in the pairing chain",
    "the logic future mobile work should keep"
  )
  "product-feature-list-v1.md" = @(
    "an earlier product feature breakdown",
    "the original v1 feature scope",
    "historical planning context",
    "which later docs replaced it as the main source of truth"
  )
  "release-branding-and-signing-plan.md" = @(
    "release branding and signing direction",
    "what packaging metadata was planned",
    "which formal release steps are still incomplete",
    "how this can be reused later"
  )
  "technical-architecture-draft.md" = @(
    "an earlier architecture draft",
    "historical package and module planning",
    "how the architecture evolved",
    "what remains useful as reference"
  )
  "后续任务规划与开发方向.md" = @(
    "the longer-term development direction",
    "future work priorities",
    "which paths belong later instead of now",
    "how the project should continue after the current phase"
  )
  "开发总览与使用说明.md" = @(
    "the overall current project summary",
    "which features exist today",
    "how to use the product at a high level",
    "what current graduation-stage status should be communicated"
  )
}

function Get-SummaryBullets([string]$path) {
  $name = Split-Path $path -Leaf
  if ($summaryMap.ContainsKey($name)) {
    return $summaryMap[$name]
  }

  $directory = Split-Path $path -Parent
  if ($directory -like "*\01-prd") {
    return @("product-level goals and boundaries", "the main module or feature this document covers", "what matters most in the current phase", "how later work should build on it")
  }
  if ($directory -like "*\02-technical-design") {
    return @("core technical architecture", "module responsibilities", "current implementation boundaries", "technical rules for future changes")
  }
  if ($directory -like "*\03-api") {
    return @("API scope and boundaries", "key request and response structures", "which clients depend on these endpoints", "how future endpoints should stay consistent")
  }
  if ($directory -like "*\04-database") {
    return @("main storage structures", "current persistence boundaries", "compatibility concerns", "later expansion directions")
  }
  if ($directory -like "*\05-deployment-ops") {
    return @("deployment and run strategy", "current delivery outputs", "operations checks", "what to verify on a clean machine")
  }
  if ($directory -like "*\06-testing") {
    return @("testing goals", "important verification paths", "acceptance criteria", "when to use this test document")
  }
  if ($directory -like "*\07-user-guide") {
    return @("user-facing guidance", "who should read this document", "how to use or present the feature", "important limits or cautions")
  }
  if ($directory -like "*\08-development-log") {
    return @("development history", "what changed in each round", "what was validated", "how to recover context quickly")
  }

  return @("the main goal of this document", "the most important content to look at first", "where it fits in the wider docs system", "when to come back to it")
}

$files = Get-ChildItem -Path $docsRoot -Recurse -Filter *.md | Select-Object -ExpandProperty FullName
$files += (Get-ChildItem -Path $root -Filter *.md -File | Select-Object -ExpandProperty FullName)

foreach ($file in $files) {
  $content = [System.IO.File]::ReadAllText($file)
  if ($content -match "## 文档速览") {
    continue
  }

  $bullets = Get-SummaryBullets $file
  $overview = "## 文档速览`r`n`r`n这份文档专门说明：`r`n" + (($bullets | ForEach-Object { "- $_" }) -join "`r`n") + "`r`n`r`n"

  if ($content.StartsWith("# ")) {
    $splitIndex = $content.IndexOf("`n")
    if ($splitIndex -ge 0) {
      $newContent = $content.Substring(0, $splitIndex + 1) + "`r`n" + $overview + $content.Substring($splitIndex + 1)
    } else {
      $newContent = $content + "`r`n`r`n" + $overview
    }
  } else {
    $newContent = $overview + $content
  }

  Set-Content -Path $file -Value $newContent -Encoding UTF8
}

Write-Output "Added overview sections to markdown docs."
