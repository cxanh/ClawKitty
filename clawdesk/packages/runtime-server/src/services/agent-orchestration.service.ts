import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { AgentChatOrchestrationMeta, AgentChatReplyMode } from "@clawdesk/shared-types";

interface RootConfig {
  auth?: {
    profiles?: Record<string, { provider?: string; mode?: string }>;
  };
  models?: {
    providers?: Record<
      string,
      {
        baseUrl?: string;
        api?: string;
        apiKey?: string;
        authHeader?: boolean;
        models?: Array<{ id?: string; name?: string }>;
      }
    >;
    model?: {
      primary?: string;
      fallbacks?: string[];
    };
  };
}

type ProviderConfig = NonNullable<NonNullable<RootConfig["models"]>["providers"]>[string];

interface DetailedAuthConfig {
  profiles?: Record<
    string,
    {
      provider?: string;
      mode?: string;
      access?: string;
      refresh?: string;
      token?: string;
      expires?: number;
    }
  >;
}

interface OrchestrationCandidate {
  providerId: string;
  modelId: string;
  baseUrl: string;
  token: string | null;
  authHeader: boolean;
}

function getManagedHome() {
  return process.env.OPENCLAW_HOME ?? path.join(os.homedir(), ".openclaw");
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function readRootConfig() {
  return readJsonFile<RootConfig>(path.join(getManagedHome(), "openclaw.json"), {});
}

async function readDetailedAuthConfig() {
  return readJsonFile<DetailedAuthConfig>(
    path.join(getManagedHome(), "agents", "main", "agent", "auth-profiles.json"),
    {}
  );
}

function buildSystemPrompt(replyMode: AgentChatReplyMode) {
  const base = [
    "You are Campus Agent, a personal agent assistant for first-year university students.",
    "Be practical, supportive, and clear.",
    "Prioritize actionable next steps, not generic motivation.",
    "Do not claim any action has already been executed unless the tool state clearly says so.",
    "Keep the reply concise and beginner-friendly."
  ];

  if (replyMode === "course-reminder") {
    base.push("Focus on timetable import, reminder timing, and low-friction reminders.");
  } else if (replyMode === "file-search") {
    base.push("Focus on search workflow, file metadata, and organization structure.");
  } else if (replyMode === "study-plan") {
    base.push("Focus on milestones, weekly planning, and review loops.");
  } else if (replyMode === "memory-reminder") {
    base.push("Focus on reminder timing, social context, and low-risk proactive suggestions.");
  }

  return base.join("\n");
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function pickConfiguredModel(providerId: string, rootConfig: RootConfig) {
  const provider = rootConfig.models?.providers?.[providerId];
  return provider?.models?.find((model) => Boolean(model.id))?.id ?? null;
}

function resolvePreferredProviderOrder(rootConfig: RootConfig) {
  const explicit: string[] = [];
  const primary = rootConfig.models?.model?.primary;
  if (primary && primary.includes("/")) {
    explicit.push(primary.split("/")[0]!);
  }

  const fallbacks = rootConfig.models?.model?.fallbacks ?? [];
  for (const item of fallbacks) {
    if (typeof item === "string" && item.includes("/")) {
      explicit.push(item.split("/")[0]!);
    }
  }

  const discovered = Object.keys(rootConfig.models?.providers ?? {});
  return [...new Set([...explicit, ...discovered])];
}

function resolveProviderToken(
  providerId: string,
  providerConfig: ProviderConfig | undefined,
  rootConfig: RootConfig,
  detailedAuthConfig: DetailedAuthConfig
) {
  if (!providerConfig) {
    return null;
  }

  const apiKeyMarker = providerConfig.apiKey ?? "";
  if (apiKeyMarker && apiKeyMarker !== "n/a" && !apiKeyMarker.endsWith("-oauth")) {
    return apiKeyMarker;
  }

  const matchingProfiles = Object.entries(rootConfig.auth?.profiles ?? {})
    .filter(([, profile]) => profile.provider === providerId)
    .map(([profileId]) => profileId);

  for (const profileId of matchingProfiles) {
    const detailed = detailedAuthConfig.profiles?.[profileId];
    if (!detailed) {
      continue;
    }

    if (typeof detailed.access === "string" && detailed.access) {
      return detailed.access;
    }

    if (typeof detailed.token === "string" && detailed.token) {
      return detailed.token;
    }
  }

  return null;
}

async function resolveCandidate(): Promise<OrchestrationCandidate | null> {
  const [rootConfig, detailedAuthConfig] = await Promise.all([readRootConfig(), readDetailedAuthConfig()]);
  const providerOrder = resolvePreferredProviderOrder(rootConfig);

  for (const providerId of providerOrder) {
    const provider = rootConfig.models?.providers?.[providerId];
    if (!provider?.baseUrl || provider.api !== "openai-completions") {
      continue;
    }

    const modelId = pickConfiguredModel(providerId, rootConfig);
    if (!modelId) {
      continue;
    }

    const token = resolveProviderToken(providerId, provider, rootConfig, detailedAuthConfig);
    if (provider.authHeader === false || token) {
      return {
        providerId,
        modelId,
        baseUrl: normalizeBaseUrl(provider.baseUrl),
        token,
        authHeader: provider.authHeader !== false
      };
    }
  }

  return null;
}

export async function generateAgentReplyViaProvider(options: {
  userMessage: string;
  replyMode: AgentChatReplyMode;
}) {
  const startedAt = Date.now();
  const candidate = await resolveCandidate();

  if (!candidate) {
    return {
      content: null,
      orchestration: {
        source: "heuristic",
        providerId: null,
        modelId: null,
        durationMs: Date.now() - startedAt,
        fallbackReason: "No compatible provider credentials are currently available."
      } satisfies AgentChatOrchestrationMeta
    };
  }

  try {
    const response = await fetch(`${candidate.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(candidate.authHeader && candidate.token ? { authorization: `Bearer ${candidate.token}` } : {})
      },
      body: JSON.stringify({
        model: candidate.modelId,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(options.replyMode)
          },
          {
            role: "user",
            content: options.userMessage
          }
        ]
      })
    });

    if (!response.ok) {
      return {
        content: null,
        orchestration: {
          source: "heuristic",
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          durationMs: Date.now() - startedAt,
          fallbackReason: `Provider request failed with HTTP ${response.status}.`
        } satisfies AgentChatOrchestrationMeta
      };
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return {
        content: null,
        orchestration: {
          source: "heuristic",
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          durationMs: Date.now() - startedAt,
          fallbackReason: "Provider returned an empty message."
        } satisfies AgentChatOrchestrationMeta
      };
    }

    return {
      content,
      orchestration: {
        source: "provider",
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        durationMs: Date.now() - startedAt,
        fallbackReason: null
      } satisfies AgentChatOrchestrationMeta
    };
  } catch (error) {
    return {
      content: null,
      orchestration: {
        source: "heuristic",
        providerId: candidate.providerId,
        modelId: candidate.modelId,
        durationMs: Date.now() - startedAt,
        fallbackReason: error instanceof Error ? error.message : "Provider request failed."
      } satisfies AgentChatOrchestrationMeta
    };
  }
}
