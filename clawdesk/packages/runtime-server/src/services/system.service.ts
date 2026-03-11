import os from "node:os";

import si from "systeminformation";

import type { DiskSummary, GpuSummary, SystemSummary } from "@clawdesk/shared-types";

function round(value: number | null | undefined, digits = 1): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return Number(value.toFixed(digits));
}

function toGpuSummary(rawController: Record<string, unknown>): GpuSummary {
  return {
    name: String(rawController.model ?? rawController.vendor ?? "Unknown GPU"),
    usagePct: round(Number(rawController.utilizationGpu ?? rawController.utilization ?? NaN)),
    memoryUsedMb: round(Number(rawController.memoryUsed ?? rawController.vramUsed ?? NaN), 0),
    memoryTotalMb: round(Number(rawController.memoryTotal ?? rawController.vram ?? NaN), 0),
    temperatureC: round(Number(rawController.temperatureGpu ?? rawController.temperature ?? NaN), 0)
  };
}

function toDiskSummary(rawDisk: Record<string, unknown>): DiskSummary {
  return {
    mount: String(rawDisk.mount ?? rawDisk.fs ?? "unknown"),
    usedPct: round(Number(rawDisk.use ?? NaN)) ?? 0,
    sizeBytes: Number(rawDisk.size ?? 0),
    availableBytes: Number(rawDisk.available ?? 0)
  };
}

export async function getSystemSummary(): Promise<SystemSummary> {
  const [load, memory, uptime, graphics, disks, networkStats, temperature] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.time(),
    si.graphics(),
    si.fsSize(),
    si.networkStats(),
    si.cpuTemperature()
  ]);

  const gpu = (graphics.controllers ?? [])
    .map((controller) => toGpuSummary(controller as unknown as Record<string, unknown>))
    .filter((controller) => controller.name.length > 0);

  const disk = (disks ?? []).map((item) => toDiskSummary(item as unknown as Record<string, unknown>));
  const primaryNetwork = networkStats[0];

  return {
    deviceId: os.hostname().toLowerCase(),
    hostname: os.hostname(),
    platform: process.platform,
    runtimeStatus: "online",
    agentStatus: "planned",
    lastHeartbeatAt: new Date().toISOString(),
    uptimeSec: Math.round(uptime.uptime),
    cpu: {
      usagePct: round(load.currentLoad) ?? 0,
      temperatureC: round(temperature.main, 0)
    },
    memory: {
      usedBytes: memory.used,
      totalBytes: memory.total
    },
    gpu,
    disk,
    network: {
      rxBytesPerSec: Math.round(primaryNetwork?.rx_sec ?? 0),
      txBytesPerSec: Math.round(primaryNetwork?.tx_sec ?? 0)
    }
  };
}
