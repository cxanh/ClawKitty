import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { ActivityFeedItem, ActivityFeedPayload, ActivityFeedKind } from "@clawdesk/shared-types";

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

function getActivityFilePath() {
  return path.join(getManagedHome(), "agent-assistant", "activity.json");
}

async function ensureActivityDirectory() {
  await mkdir(path.dirname(getActivityFilePath()), { recursive: true });
}

async function readActivityItems() {
  try {
    const raw = await readFile(getActivityFilePath(), "utf8");
    return JSON.parse(raw) as ActivityFeedItem[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeActivityItems(items: ActivityFeedItem[]) {
  await ensureActivityDirectory();
  await writeFile(getActivityFilePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function appendActivityItem(input: {
  kind: ActivityFeedKind;
  title: string;
  summary: string;
  actor: ActivityFeedItem["actor"];
  occurredAt?: string;
  relatedConversationId?: string | null;
  relatedTaskId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const item: ActivityFeedItem = {
    activityId: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    actor: input.actor,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    relatedConversationId: input.relatedConversationId ?? null,
    relatedTaskId: input.relatedTaskId ?? null,
    metadata: input.metadata ?? {}
  };

  const items = await readActivityItems();
  items.push(item);
  const recent = items.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)).slice(0, 200);
  await writeActivityItems(recent);
  return item;
}

export async function getActivityFeed(limit = 40): Promise<ActivityFeedPayload> {
  const items = await readActivityItems();
  const sorted = items.sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  return {
    generatedAt: new Date().toISOString(),
    total: sorted.length,
    items: sorted.slice(0, Math.max(1, limit))
  };
}

export async function getActivityFeedItem(activityId: string) {
  const items = await readActivityItems();
  return items.find((item) => item.activityId === activityId) ?? null;
}
