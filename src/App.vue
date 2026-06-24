<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PageInfo } from "./types/pageInfo";
import { analyzeHeaders } from "./background/background";
import type { SecurityHeaders } from "./analyze/headers";

const pageInfo = ref<PageInfo>({
  title: "Not detected",
  url: "No active tab URL",
  scripts: 0,
  links: 0,
  images: 0,
  technologies: []
});

const headersInfo = ref<SecurityHeaders | null>(null);
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

    // 1. Fetch DOM statistics from content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
    if (response) {
      pageInfo.value = response;
    } else {
      errorMsg.value = "Unable to read page statistics.";
    }

    // 2. Fetch network headers from background MAP
    const responseHeaders = await chrome.runtime.sendMessage({ 
      type: "GET_HEADERS", 
      tabId: tab.id 
    });
    
    if (responseHeaders && responseHeaders.length > 0) {
      headersInfo.value = analyzeHeaders(responseHeaders);
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

      <!-- Security Headers Panel -->
      <div class="panel">
        <div class="flex items-center justify-between mb-1">
          <h3 class="panel-title">Security Headers</h3>
        </div>

        <div v-if="headersInfo" class="flex flex-col gap-2.5 mt-2">
          <!-- CSP -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">Content-Security-Policy</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.csp ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.csp ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- HSTS -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">Strict-Transport-Security</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.hsts ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.hsts ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- X-Frame-Options -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">X-Frame-Options</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.xFrameOptions ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.xFrameOptions ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- X-Content-Type-Options -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">X-Content-Type-Options</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.xContentTypeOptions ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.xContentTypeOptions ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- Referrer-Policy -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">Referrer-Policy</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.referrerPolicy ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.referrerPolicy ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- Permissions-Policy -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">Permissions-Policy</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="headersInfo.permissionPolicy ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ headersInfo.permissionPolicy ? 'Secure' : 'Missing' }}
            </span>
          </div>

          <!-- X-Powered-By -->
          <div class="flex items-center justify-between text-xs py-0.5">
            <span class="font-medium text-slate-300">X-Powered-By (Info Leak)</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide" :class="!headersInfo.xPoweredBy ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
              {{ !headersInfo.xPoweredBy ? 'Secure' : 'Leaking' }}
            </span>
          </div>
        </div>

        <div v-else class="text-xs text-slate-500 italic py-2 mt-1">
          No headers captured for this tab yet. Reload the page to capture network packets.
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
