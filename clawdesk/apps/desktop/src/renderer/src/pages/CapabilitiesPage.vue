<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import type { CapabilitiesOverviewPayload, CapabilityAvailability, PermissionPolicyMode } from "@clawdesk/shared-types";

import { useI18n } from "../services/i18n";
import { getCapabilitiesOverview } from "../services/runtime-api";

const { t } = useI18n();

const loading = ref(true);
const error = ref("");
const payload = ref<CapabilitiesOverviewPayload | null>(null);

const models = computed(() => payload.value?.models ?? []);
const skills = computed(() => payload.value?.skills ?? []);
const tools = computed(() => payload.value?.tools ?? []);

function availabilityLabel(value: CapabilityAvailability) {
  return t(`capabilities.availability.${value}`);
}

function availabilityClass(value: CapabilityAvailability) {
  if (value === "available") {
    return "status-success";
  }

  if (value === "partial") {
    return "status-info";
  }

  return "";
}

function policyLabel(value: PermissionPolicyMode) {
  return t(`capabilities.policy.${value}`);
}

function policyClass(value: PermissionPolicyMode) {
  if (value === "allow") {
    return "status-success";
  }

  if (value === "deny") {
    return "status-error";
  }

  return "status-info";
}

function policySourceLabel(value: "default" | "override" | "locked") {
  return t(`capabilities.policySource.${value}`);
}

async function load() {
  loading.value = true;
  error.value = "";

  try {
    payload.value = await getCapabilitiesOverview();
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : t("common.unknownError");
    error.value = t("capabilities.failedLoad", { message });
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">{{ t("capabilities.eyebrow") }}</p>
        <h2>{{ t("capabilities.title") }}</h2>
        <p class="page-copy">{{ t("capabilities.copy") }}</p>
      </div>

      <div class="page-actions">
        <button
          class="primary-button"
          :disabled="loading"
          @click="load"
        >
          {{ loading ? t("common.refreshing") : t("capabilities.refresh") }}
        </button>
      </div>
    </header>

    <section
      v-if="error"
      class="status-banner status-error"
    >
      {{ error }}
    </section>

    <section
      class="status-banner status-info"
      v-if="!error"
    >
      {{ t("capabilities.noviceNote") }}
    </section>

    <section class="stats-grid">
      <article class="panel accent-cyan">
        <p class="panel-label">{{ t("capabilities.modelsCount") }}</p>
        <h2>{{ payload?.counts.models ?? 0 }}</h2>
      </article>

      <article class="panel accent-gold">
        <p class="panel-label">{{ t("capabilities.skillsCount") }}</p>
        <h2>{{ payload?.counts.availableSkills ?? 0 }}</h2>
      </article>

      <article class="panel accent-green">
        <p class="panel-label">{{ t("capabilities.toolsCount") }}</p>
        <h2>{{ payload?.counts.availableTools ?? 0 }}</h2>
      </article>
    </section>

    <section class="section-stack">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("capabilities.modelsTitle") }}</p>
            <h3>{{ t("capabilities.modelsCopy") }}</h3>
          </div>
        </div>

        <div
          v-if="models.length"
          class="agent-task-grid"
        >
          <article
            v-for="model in models"
            :key="model.id"
            class="info-card"
          >
            <div class="panel-head">
              <strong>{{ model.displayName }}</strong>
              <span
                class="chip"
                :class="availabilityClass(model.availability)"
              >
                {{ availabilityLabel(model.availability) }}
              </span>
            </div>
            <p>{{ t("capabilities.providerKind") }}: {{ model.apiKind ?? "--" }}</p>
            <p>{{ t("capabilities.modelCount") }}: {{ model.modelCount }}</p>
            <p class="path-cell">{{ model.baseUrl ?? "--" }}</p>
            <ul class="metric-list">
              <li
                v-for="note in model.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>
          </article>
        </div>

        <div
          v-else
          class="empty-state"
        >
          {{ t("capabilities.noModels") }}
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("capabilities.skillsTitle") }}</p>
            <h3>{{ t("capabilities.skillsCopy") }}</h3>
          </div>
        </div>

        <div class="agent-task-grid">
          <article
            v-for="skill in skills"
            :key="skill.id"
            class="info-card"
          >
            <div class="panel-head">
              <strong>{{ skill.displayName }}</strong>
              <span
                class="chip"
                :class="availabilityClass(skill.availability)"
              >
                {{ availabilityLabel(skill.availability) }}
              </span>
            </div>
            <p>{{ skill.summary }}</p>
            <p class="panel-meta">{{ skill.beginnerValue }}</p>
            <div class="tag-row">
              <span class="chip">{{ skill.category }}</span>
              <span class="chip">{{ skill.requiresApproval ? t("capabilities.requiresApproval") : t("capabilities.lowRisk") }}</span>
            </div>
            <ul class="metric-list">
              <li
                v-for="example in skill.triggerExamples"
                :key="example"
              >
                {{ example }}
              </li>
            </ul>
          </article>
        </div>
      </article>

      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="panel-label">{{ t("capabilities.toolsTitle") }}</p>
            <h3>{{ t("capabilities.toolsCopy") }}</h3>
          </div>
        </div>

        <div class="agent-task-grid">
          <article
            v-for="tool in tools"
            :key="tool.id"
            class="info-card"
          >
            <div class="panel-head">
              <strong>{{ tool.displayName }}</strong>
              <span
                class="chip"
                :class="availabilityClass(tool.availability)"
              >
                {{ availabilityLabel(tool.availability) }}
              </span>
            </div>
            <p>{{ tool.summary }}</p>
            <div class="tag-row">
              <span class="chip">{{ t(`capabilities.risk.${tool.riskLevel}`) }}</span>
              <span class="chip">{{ tool.mobileReady ? t("capabilities.mobileReady") : t("capabilities.desktopOnly") }}</span>
              <span
                class="chip"
                :class="policyClass(tool.currentPolicy)"
              >
                {{ policyLabel(tool.currentPolicy) }}
              </span>
              <span class="chip">{{ policySourceLabel(tool.policySource) }}</span>
              <span
                v-if="tool.approvalRequired"
                class="chip status-info"
              >
                {{ t("capabilities.approvalNeeded") }}
              </span>
            </div>
            <p class="panel-meta">
              {{ t("capabilities.recommendedPolicy") }}: {{ policyLabel(tool.recommendedPolicy) }}
            </p>
            <ul class="metric-list">
              <li
                v-for="note in tool.notes"
                :key="note"
              >
                {{ note }}
              </li>
            </ul>
          </article>
        </div>
      </article>
    </section>
  </section>
</template>
