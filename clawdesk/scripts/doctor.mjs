import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const runtimePort = Number(process.env.CLAWDESK_RUNTIME_PORT ?? 47890);
const runtimeUrl = process.env.CLAWDESK_RUNTIME_URL ?? `http://127.0.0.1:${runtimePort}`;
const openclawHome = process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function probeRuntime(url) {
  try {
    const response = await fetch(`${url}/api/v1/runtime/health`);
    if (!response.ok) {
      return {
        level: "warn",
        detail: `Runtime responded with HTTP ${response.status} at ${url}.`
      };
    }

    const payload = await response.json();
    return {
      level: "pass",
      detail: `Runtime reachable at ${url} (${payload.data?.status ?? "unknown"}).`
    };
  } catch {
    return {
      level: "warn",
      detail: `Runtime is not reachable at ${url}. Start it with npm run dev or npm run start:runtime after building.`
    };
  }
}

function printCheck(level, label, detail) {
  const symbol = level === "pass" ? "[PASS]" : level === "warn" ? "[WARN]" : "[FAIL]";
  console.log(`${symbol} ${label}: ${detail}`);
}

const checks = [];

checks.push({
  label: "Node.js",
  level: process.versions.node ? "pass" : "fail",
  detail: `Detected ${process.versions.node}.`
});

checks.push({
  label: "Workspace root",
  level: (await exists(workspaceRoot)) ? "pass" : "fail",
  detail: workspaceRoot
});

const runtimeEntry = path.join(workspaceRoot, "packages", "runtime-server", "dist", "index.js");
const runtimeEntryExists = await exists(runtimeEntry);
checks.push({
  label: "Runtime build artifact",
  level: runtimeEntryExists ? "pass" : "warn",
  detail: runtimeEntryExists
    ? `Found ${runtimeEntry}.`
    : `Missing ${runtimeEntry}. Run npm run build before managed runtime start.`
});

const openclawHomeExists = await exists(openclawHome);
checks.push({
  label: "OpenClaw home",
  level: openclawHomeExists ? "pass" : "warn",
  detail: openclawHomeExists
    ? `Found ${openclawHome}.`
    : `Missing ${openclawHome}. Compatibility views will be empty until this exists.`
});

for (const relativePath of [
  ["Desktop app", "apps/desktop"],
  ["Runtime package", "packages/runtime-server"],
  ["Shared types", "packages/shared-types"]
]) {
  const [label, relPath] = relativePath;
  const fullPath = path.join(workspaceRoot, relPath);
  checks.push({
    label,
    level: (await exists(fullPath)) ? "pass" : "fail",
    detail: fullPath
  });
}

const logsDir = path.join(workspaceRoot, "logs");
const logsDirExists = await exists(logsDir);
checks.push({
  label: "Logs directory",
  level: logsDirExists ? "pass" : "warn",
  detail: logsDirExists
    ? `Found ${logsDir}.`
    : `No logs directory yet. It will be created on first runtime or desktop start.`
});

const runtimeCheck = await probeRuntime(runtimeUrl);
checks.push({
  label: "Runtime health",
  level: runtimeCheck.level,
  detail: runtimeCheck.detail
});

console.log("ClawDesk doctor");
console.log(`Workspace: ${workspaceRoot}`);
console.log(`Runtime URL: ${runtimeUrl}`);
console.log(`OpenClaw home: ${openclawHome}`);
console.log("");

for (const check of checks) {
  printCheck(check.level, check.label, check.detail);
}

console.log("");
console.log("Recommended first-run path:");
console.log("1. npm install");
console.log("2. npm run doctor");
console.log("3. npm run dev");
console.log("4. npm run smoke:runtime");

if (checks.some((check) => check.level === "fail")) {
  process.exit(1);
}
