import si from "systeminformation";

import type { RuntimeProcessInfo, RuntimeProcessKillResult } from "@clawdesk/shared-types";

interface ListProcessOptions {
  search?: string;
  sortBy?: "cpu" | "memory" | "name" | "pid";
  order?: "asc" | "desc";
  limit?: number;
}

function timestampToIso(value: string | number | undefined): string | null {
  if (typeof value === "string" && value.length > 0) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return new Date(value).toISOString();
  }

  return null;
}

function normalizeProcess(rawProcess: Record<string, unknown>): RuntimeProcessInfo {
  return {
    pid: Number(rawProcess.pid ?? 0),
    name: String(rawProcess.name ?? rawProcess.command ?? "unknown"),
    cpuPct: Number(Number(rawProcess.cpu ?? 0).toFixed(1)),
    memoryMb: Number((Number(rawProcess.memRss ?? 0) / 1024 / 1024).toFixed(1)),
    virtualMemoryMb: rawProcess.memVsz ? Number((Number(rawProcess.memVsz) / 1024 / 1024).toFixed(1)) : null,
    startedAt: timestampToIso((rawProcess as { started?: string; startedTime?: number }).started ?? (rawProcess as { startedTime?: number }).startedTime),
    path: typeof rawProcess.path === "string" ? rawProcess.path : null
  };
}

function compareProcesses(
  left: RuntimeProcessInfo,
  right: RuntimeProcessInfo,
  sortBy: NonNullable<ListProcessOptions["sortBy"]>,
  order: NonNullable<ListProcessOptions["order"]>
) {
  const factor = order === "asc" ? 1 : -1;

  switch (sortBy) {
    case "name":
      return left.name.localeCompare(right.name) * factor;
    case "pid":
      return (left.pid - right.pid) * factor;
    case "memory":
      return (left.memoryMb - right.memoryMb) * factor;
    case "cpu":
    default:
      return (left.cpuPct - right.cpuPct) * factor;
  }
}

export async function listProcesses(options: ListProcessOptions = {}): Promise<RuntimeProcessInfo[]> {
  const processData = await si.processes();
  const search = options.search?.trim().toLowerCase() ?? "";
  const sortBy = options.sortBy ?? "cpu";
  const order = options.order ?? "desc";
  const limit = options.limit && options.limit > 0 ? options.limit : 40;

  return (processData.list ?? [])
    .map((processInfo) => normalizeProcess(processInfo as unknown as Record<string, unknown>))
    .filter((processInfo) => {
      if (!search) {
        return true;
      }

      return processInfo.name.toLowerCase().includes(search);
    })
    .sort((left, right) => compareProcesses(left, right, sortBy, order))
    .slice(0, limit);
}

export async function getProcessByPid(pid: number): Promise<RuntimeProcessInfo | null> {
  const processData = await si.processes();
  const match = (processData.list ?? []).find((processInfo) => Number(processInfo.pid) === pid);

  if (!match) {
    return null;
  }

  return normalizeProcess(match as unknown as Record<string, unknown>);
}

export async function killProcessByPid(pid: number): Promise<RuntimeProcessKillResult | null> {
  const processInfo = await getProcessByPid(pid);

  if (!processInfo) {
    return null;
  }

  if (pid === process.pid || pid === process.ppid) {
    throw new Error("Refusing to terminate the current runtime process chain.");
  }

  process.kill(pid);

  return {
    pid,
    name: processInfo.name,
    status: "terminated",
    requestedAt: new Date().toISOString(),
    method: "process.kill"
  };
}
