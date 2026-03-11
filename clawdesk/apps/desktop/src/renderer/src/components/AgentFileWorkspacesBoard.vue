<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";

import type {
  AgentFileWorkspaceOrganizationPreview,
  AgentFileWorkspaceRecord,
  AgentFileWorkspaceSearchResult,
  AgentFileWorkspacesBoardPayload
} from "@clawdesk/shared-types";

import { formatDateTime } from "../services/format";
import {
  getAgentFileWorkspacesBoard,
  previewAgentFileWorkspaceOrganization,
  searchAgentFileWorkspace,
  updateAgentFileWorkspaceStatus
} from "../services/runtime-api";

const loading = ref(true);
const savingWorkspaceId = ref("");
const error = ref("");
const message = ref("");
const board = ref<AgentFileWorkspacesBoardPayload | null>(null);
const searchQueries = reactive<Record<string, string>>({});
const searchLoadingIds = reactive<Record<string, boolean>>({});
const searchErrors = reactive<Record<string, string>>({});
const searchResults = reactive<Record<string, AgentFileWorkspaceSearchResult | null>>({});
const previewLoadingIds = reactive<Record<string, boolean>>({});
const previewErrors = reactive<Record<string, string>>({});
const previewResults = reactive<Record<string, AgentFileWorkspaceOrganizationPreview | null>>({});

const statusOptions: AgentFileWorkspaceRecord["status"][] = ["draft", "active", "archived"];

async function loadBoard() {
  loading.value = true;
  error.value = "";

  try {
    board.value = await getAgentFileWorkspacesBoard();
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Unknown error";
    error.value = `Failed to load file workspaces: ${detail}`;
  } finally {
    loading.value = false;
  }
}

async function setStatus(workspace: AgentFileWorkspaceRecord, status: AgentFileWorkspaceRecord["status"]) {
  savingWorkspaceId.value = workspace.workspaceId;
  error.value = "";
  message.value = "";

  try {
    const updated = await updateAgentFileWorkspaceStatus(workspace.workspaceId, status);
    if (board.value) {
      board.value = {
        ...board.value,
        workspaces: board.value.workspaces.map((item) =>
          item.workspaceId === updated.workspaceId ? updated : item
        )
      };
      board.value = await getAgentFileWorkspacesBoard();
    }
    message.value = `${updated.title} is now ${updated.status}.`;
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Unknown error";
    error.value = `Failed to update file workspace: ${detail}`;
  } finally {
    savingWorkspaceId.value = "";
  }
}

function eventTagLabel(eventTag: AgentFileWorkspaceSearchResult["results"][number]["eventTag"]) {
  const labels: Record<AgentFileWorkspaceSearchResult["results"][number]["eventTag"], string> = {
    "course-material": "Course material",
    "application-material": "Application material",
    "personal-admin": "Personal admin",
    general: "General"
  };

  return labels[eventTag];
}

function accelerationProviderLabel(
  provider: AgentFileWorkspaceSearchResult["acceleration"]["provider"]
) {
  return provider === "everything-cli" ? "Everything CLI" : "Built-in search";
}

async function runSearch(workspace: AgentFileWorkspaceRecord) {
  searchLoadingIds[workspace.workspaceId] = true;
  searchErrors[workspace.workspaceId] = "";

  try {
    searchResults[workspace.workspaceId] = await searchAgentFileWorkspace(
      workspace.workspaceId,
      searchQueries[workspace.workspaceId] ?? "",
      12
    );
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Unknown error";
    searchErrors[workspace.workspaceId] = `Failed to search local files: ${detail}`;
  } finally {
    searchLoadingIds[workspace.workspaceId] = false;
  }
}

async function generatePreview(workspace: AgentFileWorkspaceRecord) {
  previewLoadingIds[workspace.workspaceId] = true;
  previewErrors[workspace.workspaceId] = "";

  try {
    previewResults[workspace.workspaceId] = await previewAgentFileWorkspaceOrganization(
      workspace.workspaceId,
      searchQueries[workspace.workspaceId] ?? "",
      12
    );
  } catch (reason) {
    const detail = reason instanceof Error ? reason.message : "Unknown error";
    previewErrors[workspace.workspaceId] = `Failed to generate organization preview: ${detail}`;
  } finally {
    previewLoadingIds[workspace.workspaceId] = false;
  }
}

onMounted(() => {
  void loadBoard();
});
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <div>
        <p class="panel-label">FILE WORKSPACE</p>
        <h3>Agent File Workspace Board</h3>
      </div>

      <button
        class="secondary-button"
        :disabled="loading"
        @click="loadBoard"
      >
        {{ loading ? "Refreshing..." : "Refresh file workspace" }}
      </button>
    </div>

    <p class="panel-meta">
      Turn saved file-organization briefs into a beginner-friendly workspace model before we connect real local search
      and file grouping.
    </p>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section
      v-if="message"
      class="status-banner status-info"
    >
      {{ message }}
    </section>

    <div class="stats-grid compact-stats">
      <article class="panel accent-cyan compact-panel">
        <p class="panel-label">Total</p>
        <h3>{{ board?.total ?? 0 }}</h3>
      </article>
      <article class="panel accent-gold compact-panel">
        <p class="panel-label">Draft</p>
        <h3>{{ board?.statusCounts.draft ?? 0 }}</h3>
      </article>
      <article class="panel accent-green compact-panel">
        <p class="panel-label">Active</p>
        <h3>{{ board?.statusCounts.active ?? 0 }}</h3>
      </article>
      <article class="panel accent-rose compact-panel">
        <p class="panel-label">Archived</p>
        <h3>{{ board?.statusCounts.archived ?? 0 }}</h3>
      </article>
    </div>

    <div
      v-if="!board?.workspaces.length"
      class="empty-state"
    >
      No file workspace has been created yet. Start from a file-organization brief in the safe action board.
    </div>

    <div
      v-else
      class="agent-task-grid"
    >
      <article
        v-for="workspace in board.workspaces"
        :key="workspace.workspaceId"
        class="info-card"
      >
        <div class="panel-head">
          <div>
            <strong>{{ workspace.title }}</strong>
            <p class="panel-meta">{{ workspace.summary }}</p>
          </div>
          <span class="chip">{{ workspace.status }}</span>
        </div>

        <div class="tag-row">
          <span
            v-for="tag in workspace.tags"
            :key="`${workspace.workspaceId}-${tag}`"
            class="chip"
          >
            {{ tag }}
          </span>
        </div>

        <div class="section-stack">
          <div>
            <p class="panel-label">Local search</p>
            <div class="action-row">
              <input
                v-model="searchQueries[workspace.workspaceId]"
                class="text-input text-input-block"
                placeholder="Search homework, signup, PDF, course name..."
                @keyup.enter="runSearch(workspace)"
              >
              <button
                class="secondary-button"
                :disabled="searchLoadingIds[workspace.workspaceId]"
                @click="runSearch(workspace)"
              >
                {{ searchLoadingIds[workspace.workspaceId] ? "Searching..." : "Search local files" }}
              </button>
              <button
                class="secondary-button"
                :disabled="previewLoadingIds[workspace.workspaceId]"
                @click="generatePreview(workspace)"
              >
                {{ previewLoadingIds[workspace.workspaceId] ? "Preparing..." : "Preview organization" }}
              </button>
            </div>
            <p class="panel-meta">
              Read-only local search across the current workspace roots. Everything acceleration is optional, and the built-in scoped search remains the safety fallback.
            </p>
            <section
              v-if="searchErrors[workspace.workspaceId]"
              class="status-banner status-error"
            >
              {{ searchErrors[workspace.workspaceId] }}
            </section>
            <section
              v-if="previewErrors[workspace.workspaceId]"
              class="status-banner status-error"
            >
              {{ previewErrors[workspace.workspaceId] }}
            </section>
            <div
              v-if="searchResults[workspace.workspaceId]"
              class="section-stack"
            >
              <p class="panel-meta">
                {{ searchResults[workspace.workspaceId]!.returnedCount }} / {{ searchResults[workspace.workspaceId]!.matchedCount }}
                matches across {{ searchResults[workspace.workspaceId]!.searchedRootCount }} roots
              </p>
              <p class="panel-meta">
                Search backend: {{ accelerationProviderLabel(searchResults[workspace.workspaceId]!.acceleration.provider) }}
                <span v-if="searchResults[workspace.workspaceId]!.acceleration.used"> · accelerated</span>
                <span v-else> · fallback</span>
              </p>
              <p
                v-if="searchResults[workspace.workspaceId]!.acceleration.note"
                class="panel-meta"
              >
                {{ searchResults[workspace.workspaceId]!.acceleration.note }}
              </p>
              <div
                v-if="searchResults[workspace.workspaceId]!.results.length === 0"
                class="empty-state"
              >
                No local files matched the current query.
              </div>
              <div
                v-else
                class="info-grid single-column-grid"
              >
                <div
                  v-for="result in searchResults[workspace.workspaceId]!.results"
                  :key="result.resultId"
                  class="info-card"
                >
                  <strong>{{ result.fileName }}</strong>
                  <p class="panel-meta">{{ result.path }}</p>
                  <div class="tag-row">
                    <span class="chip">{{ result.rootLabel }}</span>
                    <span class="chip">{{ eventTagLabel(result.eventTag) }}</span>
                    <span class="chip">{{ result.extension ?? "no extension" }}</span>
                  </div>
                  <p class="panel-meta">Saved: {{ formatDateTime(result.storedAt) }}</p>
                  <p class="panel-meta">Size: {{ result.sizeBytes }} bytes</p>
                </div>
              </div>

              <div v-if="searchResults[workspace.workspaceId]!.suggestions.length > 0">
                <p class="panel-label">Organization suggestions</p>
                <div class="info-grid single-column-grid">
                  <div
                    v-for="suggestion in searchResults[workspace.workspaceId]!.suggestions"
                    :key="suggestion.suggestionId"
                    class="info-card"
                  >
                    <strong>{{ suggestion.title }}</strong>
                    <p>{{ suggestion.summary }}</p>
                    <div class="tag-row">
                      <span class="chip">{{ suggestion.kind }}</span>
                      <span class="chip">{{ suggestion.confidence }}</span>
                      <span class="chip">read-only</span>
                    </div>
                    <ul class="metric-list">
                      <li
                        v-for="examplePath in suggestion.examplePaths"
                        :key="examplePath"
                      >
                        {{ examplePath }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div class="section-stack">
                <div>
                  <p class="panel-label">Time-first grouped view</p>
                  <div class="info-grid single-column-grid">
                    <div
                      v-for="group in searchResults[workspace.workspaceId]!.timeGroups"
                      :key="group.key"
                      class="info-card"
                    >
                      <strong>{{ group.label }}</strong>
                      <p class="panel-meta">{{ group.count }} files</p>
                      <ul class="metric-list">
                        <li
                          v-for="result in group.results"
                          :key="result.resultId"
                        >
                          {{ result.fileName }} · {{ formatDateTime(result.storedAt) }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div>
                  <p class="panel-label">Event-first grouped view</p>
                  <div class="info-grid single-column-grid">
                    <div
                      v-for="group in searchResults[workspace.workspaceId]!.eventGroups"
                      :key="group.key"
                      class="info-card"
                    >
                      <strong>{{ group.label }}</strong>
                      <p class="panel-meta">{{ group.count }} files</p>
                      <ul class="metric-list">
                        <li
                          v-for="result in group.results"
                          :key="result.resultId"
                        >
                          {{ result.fileName }} · {{ result.rootLabel }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="previewResults[workspace.workspaceId]"
              class="section-stack"
            >
              <p class="panel-label">Organization preview</p>
              <p class="panel-meta">{{ previewResults[workspace.workspaceId]!.note }}</p>
              <p class="panel-meta">
                {{ previewResults[workspace.workspaceId]!.totalItems }} items · read-only preview
              </p>
              <div class="info-grid single-column-grid">
                <div
                  v-for="group in previewResults[workspace.workspaceId]!.groups"
                  :key="group.key"
                  class="info-card"
                >
                  <strong>{{ group.label }}</strong>
                  <p class="panel-meta">{{ group.count }} files</p>
                  <ul class="metric-list">
                    <li
                      v-for="item in group.items"
                      :key="item.previewId"
                    >
                      {{ item.fileName }} 路 {{ item.suggestedFolder }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">Search roots</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="root in workspace.searchRoots"
                :key="root.rootId"
                class="info-card"
              >
                <strong>{{ root.label }}</strong>
                <p class="panel-meta">{{ root.path }}</p>
                <p>{{ root.exists ? "available" : "missing" }} · {{ root.source }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">Result fields</p>
            <div class="tag-row">
              <span
                v-for="field in workspace.resultFields"
                :key="field"
                class="chip"
              >
                {{ field }}
              </span>
            </div>
          </div>

          <div>
            <p class="panel-label">Time-first views</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="view in workspace.timeViews"
                :key="view.viewId"
                class="info-card"
              >
                <strong>{{ view.label }}</strong>
                <p>{{ view.summary }}</p>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">Event-first views</p>
            <div class="info-grid single-column-grid">
              <div
                v-for="view in workspace.eventViews"
                :key="view.viewId"
                class="info-card"
              >
                <strong>{{ view.label }}</strong>
                <p>{{ view.summary }}</p>
                <ul class="metric-list">
                  <li
                    v-for="example in view.exampleItems"
                    :key="example"
                  >
                    {{ example }}
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <p class="panel-label">Planned integrations</p>
            <ul class="metric-list">
              <li
                v-for="item in workspace.plannedIntegrations"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </div>

          <div>
            <p class="panel-label">Notes</p>
            <ul class="metric-list">
              <li
                v-for="note in workspace.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>
          </div>
        </div>

        <p class="panel-meta">Source action: {{ workspace.sourceActionId }}</p>
        <p class="panel-meta">Updated: {{ formatDateTime(workspace.updatedAt) }}</p>

        <div class="action-row">
          <button
            v-for="status in statusOptions"
            :key="`${workspace.workspaceId}-${status}`"
            class="secondary-button"
            :disabled="savingWorkspaceId === workspace.workspaceId || status === workspace.status"
            @click="setStatus(workspace, status)"
          >
            {{ status }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
