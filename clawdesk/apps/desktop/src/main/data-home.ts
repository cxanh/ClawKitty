import { access, cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type DataHomeSource = "fresh" | "legacy-import" | "existing-managed";

interface DataHomeMarker {
  version: number;
  initializedAt: string;
  source: DataHomeSource;
  legacyHome: string | null;
}

export interface ClawDeskDataHomeInfo {
  dataHome: string;
  markerPath: string;
  source: DataHomeSource;
  legacyHome: string | null;
  seededExtensionAvailable: boolean;
}

const DATA_HOME_VERSION = 1;

function getMarkerPath(dataHome: string) {
  return path.join(dataHome, ".clawdesk-home.json");
}

function getLegacyHomePath() {
  return process.env.CLAWDESK_LEGACY_OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(targetPath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(targetPath, "utf8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(targetPath: string, data: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(data, null, 2), "utf8");
}

async function ensureManagedHomeShape(dataHome: string) {
  const directories = [
    dataHome,
    path.join(dataHome, "agents", "main", "agent"),
    path.join(dataHome, "agents", "main", "sessions"),
    path.join(dataHome, "cron"),
    path.join(dataHome, "cron", "runs"),
    path.join(dataHome, "devices"),
    path.join(dataHome, "exports"),
    path.join(dataHome, "browser"),
    path.join(dataHome, "browser", "chrome-extension")
  ];

  await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));

  const defaults: Array<[string, unknown]> = [
    [path.join(dataHome, "openclaw.json"), {}],
    [path.join(dataHome, "agents", "main", "agent", "auth-profiles.json"), {}],
    [path.join(dataHome, "agents", "main", "sessions", "sessions.json"), {}],
    [path.join(dataHome, "cron", "jobs.json"), { jobs: [] }],
    [path.join(dataHome, "devices", "paired.json"), {}],
    [path.join(dataHome, "devices", "pairing-sessions.json"), {}],
    [path.join(dataHome, "devices", "pending-approvals.json"), {}],
    [path.join(dataHome, "devices", "pairing-audit.json"), []]
  ];

  for (const [targetPath, defaultValue] of defaults) {
    if (!(await pathExists(targetPath))) {
      await writeJsonFile(targetPath, defaultValue);
    }
  }
}

async function copyIfExists(sourcePath: string, targetPath: string) {
  if (!(await pathExists(sourcePath))) {
    return false;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(sourcePath, targetPath, {
    recursive: true,
    force: true
  });
  return true;
}

async function hasImportableLegacyHome(legacyHome: string) {
  if (!(await pathExists(legacyHome))) {
    return false;
  }

  const candidates = [
    path.join(legacyHome, "openclaw.json"),
    path.join(legacyHome, "agents"),
    path.join(legacyHome, "cron"),
    path.join(legacyHome, "devices"),
    path.join(legacyHome, "browser"),
    path.join(legacyHome, "gateway.cmd")
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return true;
    }
  }

  try {
    const children = await readdir(legacyHome);
    return children.length > 0;
  } catch {
    return false;
  }
}

async function rewriteImportedSessionPaths(dataHome: string, legacyHome: string) {
  const sessionsIndexPath = path.join(dataHome, "agents", "main", "sessions", "sessions.json");
  const sessionsIndex = await readJsonFile<Record<string, { sessionFile?: string }>>(sessionsIndexPath, {});
  let changed = false;

  for (const session of Object.values(sessionsIndex)) {
    if (
      typeof session.sessionFile === "string" &&
      session.sessionFile.startsWith(legacyHome)
    ) {
      session.sessionFile = path.join(dataHome, path.relative(legacyHome, session.sessionFile));
      changed = true;
    }
  }

  if (changed) {
    await writeJsonFile(sessionsIndexPath, sessionsIndex);
  }
}

async function importLegacyHome(legacyHome: string, dataHome: string) {
  const itemsToCopy: Array<[string, string]> = [
    [path.join(legacyHome, "openclaw.json"), path.join(dataHome, "openclaw.json")],
    [path.join(legacyHome, "agents"), path.join(dataHome, "agents")],
    [path.join(legacyHome, "cron"), path.join(dataHome, "cron")],
    [path.join(legacyHome, "devices"), path.join(dataHome, "devices")],
    [path.join(legacyHome, "browser"), path.join(dataHome, "browser")],
    [path.join(legacyHome, "gateway.cmd"), path.join(dataHome, "gateway.cmd")]
  ];

  for (const [sourcePath, targetPath] of itemsToCopy) {
    await copyIfExists(sourcePath, targetPath);
  }

  await rewriteImportedSessionPaths(dataHome, legacyHome);
}

function getSeedHomePath() {
  return process.env.CLAWDESK_SEED_HOME ?? null;
}

async function seedManagedHomeAssets(dataHome: string) {
  const seedHome = getSeedHomePath();
  if (!seedHome || !(await pathExists(seedHome))) {
    return false;
  }

  const seedExtensionDir = path.join(seedHome, "browser", "chrome-extension");
  const targetExtensionDir = path.join(dataHome, "browser", "chrome-extension");
  const targetManifestPath = path.join(targetExtensionDir, "manifest.json");

  if ((await pathExists(seedExtensionDir)) && !(await pathExists(targetManifestPath))) {
    await cp(seedExtensionDir, targetExtensionDir, {
      recursive: true,
      force: true
    });
  }

  return pathExists(targetManifestPath);
}

export function resolveClawDeskDataHome(userDataPath: string) {
  return path.join(userDataPath, "openclaw-home");
}

export async function initializeClawDeskDataHome(userDataPath: string): Promise<ClawDeskDataHomeInfo> {
  const dataHome = resolveClawDeskDataHome(userDataPath);
  const markerPath = getMarkerPath(dataHome);
  const legacyHome = getLegacyHomePath();
  const hadDataHome = await pathExists(dataHome);
  const existingMarker = await readJsonFile<DataHomeMarker | null>(markerPath, null);

  if (existingMarker?.version === DATA_HOME_VERSION) {
    await ensureManagedHomeShape(dataHome);
    const seededExtensionAvailable = await seedManagedHomeAssets(dataHome);
    return {
      dataHome,
      markerPath,
      source: existingMarker.source,
      legacyHome: existingMarker.legacyHome,
      seededExtensionAvailable
    };
  }

  await mkdir(dataHome, { recursive: true });

  let source: DataHomeSource = "fresh";
  let importedLegacyHome: string | null = null;

  if (dataHome !== legacyHome && (await hasImportableLegacyHome(legacyHome))) {
    await importLegacyHome(legacyHome, dataHome);
    source = "legacy-import";
    importedLegacyHome = legacyHome;
  } else if (hadDataHome) {
    source = "existing-managed";
  }

  await ensureManagedHomeShape(dataHome);
  const seededExtensionAvailable = await seedManagedHomeAssets(dataHome);

  const marker: DataHomeMarker = {
    version: DATA_HOME_VERSION,
    initializedAt: new Date().toISOString(),
    source,
    legacyHome: importedLegacyHome
  };
  await writeJsonFile(markerPath, marker);

  return {
    dataHome,
    markerPath,
    source,
    legacyHome: importedLegacyHome,
    seededExtensionAvailable
  };
}
