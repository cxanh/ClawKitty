const runtimePort = Number(process.env.CLAWDESK_RUNTIME_PORT ?? 47890);
const runtimeUrl = process.env.CLAWDESK_RUNTIME_URL ?? `http://127.0.0.1:${runtimePort}`;

async function fetchJson(pathname) {
  const response = await fetch(`${runtimeUrl}${pathname}`);
  const payload = await response.json();

  if (!response.ok || !payload.success) {
    const message = payload?.error?.message ?? `HTTP ${response.status}`;
    throw new Error(`${pathname}: ${message}`);
  }

  return payload.data;
}

try {
  const [health, system, openclaw, logs] = await Promise.all([
    fetchJson("/api/v1/runtime/health"),
    fetchJson("/api/v1/system/summary"),
    fetchJson("/api/v1/openclaw/overview"),
    fetchJson("/api/v1/logs/summary")
  ]);

  console.log(JSON.stringify({
    runtimeUrl,
    runtime: health,
    system: {
      hostname: system.hostname,
      platform: system.platform,
      cpuUsagePct: system.cpu?.usagePct ?? null,
      gpuCount: Array.isArray(system.gpu) ? system.gpu.length : 0
    },
    openclaw: {
      available: openclaw.available,
      providerCount: openclaw.providerCount,
      sessionCount: openclaw.sessionCount,
      taskCount: openclaw.taskCount
    },
    logs: {
      logDir: logs.logDir,
      files: logs.files.map((file) => ({
        name: file.name,
        exists: file.exists,
        sizeBytes: file.sizeBytes
      }))
    }
  }, null, 2));
} catch (error) {
  console.error("ClawDesk runtime smoke failed.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
