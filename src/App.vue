<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PageInfo } from "./types/pageInfo";

const pageInfo = ref<PageInfo>({
  title: "Not detected",
  url: "No active tab URL",
  scripts: 0,
  links: 0,
  images: 0,
  technologies: []
});

const errorMsg = ref("");

onMounted(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      errorMsg.value = "No active tab found.";
      return;
    }

    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      pageInfo.value = {
        title: tab.title || "Chrome System Page",
        url: tab.url,
        scripts: 0,
        links: 0,
        images: 0,
        technologies: []
      };
      errorMsg.value = "Cannot audit internal browser pages.";
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
    if (response) {
      pageInfo.value = response;
    } else {
      errorMsg.value = "Unable to read page statistics.";
    }
  } catch (err: any) {
    console.error("Error fetching page info:", err);
    errorMsg.value = "Please reload the tab to initialize Sentinel.";
  }
});
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="header">
      <div class="brand">
        <span class="icon-shield text-cyan-400"></span>
        <span class="brand-title">
          Sentinel
        </span>
      </div>
      <div class="badge">
        <span class="badge-ping">
          <span class="badge-ping-ring"></span>
          <span class="badge-ping-dot"></span>
        </span>
        <span class="badge-text">Auditor Active</span>
      </div>
    </header>

    <!-- Main Card -->
    <main class="flex-grow flex flex-col gap-4">
      <div class="panel">
        <div>
          <span class="panel-title">
            Website Title
          </span>
          <h2 class="panel-value">
            {{ pageInfo.title || 'Loading...' }}
          </h2>
        </div>

        <div>
          <span class="panel-title">
            URL
          </span>
          <div class="url-box">
            <span class="icon-globe text-slate-400"></span>
            <p class="url-text" :title="pageInfo.url">
              {{ pageInfo.url }}
            </p>
          </div>
        </div>
      </div>

      <!-- Statistics Panel -->
      <div class="panel">
        <h3 class="panel-title">
          Resources Scanned
        </h3>

        <div class="stat-grid">
          <!-- Scripts -->
          <div class="stat-card">
            <span class="icon-code text-cyan-400 mb-1"></span>
            <span class="stat-val">{{ pageInfo.scripts }}</span>
            <span class="stat-lbl">Scripts</span>
          </div>

          <!-- Links -->
          <div class="stat-card">
            <span class="icon-link text-blue-400 mb-1"></span>
            <span class="stat-val">{{ pageInfo.links }}</span>
            <span class="stat-lbl">Links</span>
          </div>

          <!-- Images -->
          <div class="stat-card">
            <span class="icon-image text-indigo-400 mb-1"></span>
            <span class="stat-val">{{ pageInfo.images }}</span>
            <span class="stat-lbl">Images</span>
          </div>
        </div>
      </div>

      <!-- Technologies Scanned -->
      <div class="panel">
        <h3 class="panel-title">
          Detected Technologies
        </h3>

        <div class="flex flex-wrap gap-2 mt-1">
          <span v-for="tech in pageInfo.technologies" :key="tech" class="px-2.5 py-1 rounded bg-slate-950/60 border border-slate-800 text-xs font-semibold text-cyan-400">
            {{ tech }}
          </span>
          <span v-if="!pageInfo.technologies || pageInfo.technologies.length === 0" class="text-xs text-slate-500 italic py-1">
            No frontend technologies detected
          </span>
        </div>
      </div>

      <!-- Warning Banner if error occurs -->
      <div v-if="errorMsg" class="banner-warning">
        <span class="icon-warning text-amber-300 shrink-0"></span>
        <span class="banner-text">{{ errorMsg }}</span>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <span>Version 1.0.0</span>
      <span>Secured by Sentinel</span>
    </footer>
  </div>
</template>
