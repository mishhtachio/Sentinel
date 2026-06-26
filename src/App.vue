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
const expandedHeader = ref<string | null>(null);

function toggleHeader(key: string) {
  expandedHeader.value = expandedHeader.value === key ? null : key;
}

const headerDetails: { key: keyof SecurityHeaders; label: string; invertStatus?: boolean; explain: string }[] = [
  {
    key: 'csp',
    label: 'Content-Security-Policy',
    explain: 'Controls which scripts, styles, and resources can load on your page. Without it, attackers can inject malicious code (XSS attacks) into your site.'
  },
  {
    key: 'hsts',
    label: 'Strict-Transport-Security',
    explain: 'Forces browsers to always use HTTPS when visiting your site. Without it, users could be tricked into connecting over insecure HTTP, exposing their data.'
  },
  {
    key: 'xFrameOptions',
    label: 'X-Frame-Options',
    explain: 'Prevents your site from being embedded in iframes on other websites. Without it, attackers can overlay invisible frames to trick users into clicking things they didn\'t intend to (clickjacking).'
  },
  {
    key: 'xContentTypeOptions',
    label: 'X-Content-Type-Options',
    explain: 'Stops browsers from guessing the file type of your resources. Without it, a browser might execute a text file as JavaScript if an attacker names it cleverly.'
  },
  {
    key: 'referrerPolicy',
    label: 'Referrer-Policy',
    explain: 'Controls how much URL information is shared when users click links on your site. Without it, sensitive paths and query parameters could leak to third-party sites.'
  },
  {
    key: 'permissionPolicy',
    label: 'Permissions-Policy',
    explain: 'Restricts which browser features (camera, microphone, geolocation) your site and embedded content can access. Without it, third-party scripts could silently use these features.'
  },
  {
    key: 'xPoweredBy',
    label: 'X-Powered-By',
    invertStatus: true,
    explain: 'This header exposes what server technology you\'re running (Express, PHP, etc). Attackers use this to find known vulnerabilities for your exact stack. It should be removed.'
  }
];

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
        <h3 class="panel-title">Security Headers</h3>

        <div v-if="headersInfo" class="flex flex-col gap-1 mt-2">
          <div v-for="h in headerDetails" :key="h.key" 
               class="rounded-lg border border-slate-800/40 overflow-hidden transition-all duration-200"
               :class="expandedHeader === h.key ? 'bg-slate-950/60' : 'hover:bg-slate-950/30'">
            <div class="flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer select-none"
                 @click="toggleHeader(h.key)">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] transition-transform duration-200" :class="expandedHeader === h.key ? 'rotate-90' : ''">▶</span>
                <span class="font-medium text-slate-300">{{ h.label }}</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide"
                    :class="(h.invertStatus ? !headersInfo[h.key] : headersInfo[h.key]) 
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' 
                      : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'">
                {{ (h.invertStatus ? !headersInfo[h.key] : headersInfo[h.key]) ? 'Secure' : (h.invertStatus ? 'Leaking' : 'Missing') }}
              </span>
            </div>
            <div v-if="expandedHeader === h.key" class="px-2.5 pb-2.5 pt-0.5">
              <p class="text-[11px] text-slate-400 leading-relaxed">{{ h.explain }}</p>
            </div>
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
