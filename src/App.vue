<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { PageInfo } from "./types/pageInfo";
import { analyzeHeaders } from "./background/background";
import type { SecurityHeaders } from "./analyze/headers";
import { runPathAudit } from "./analyze/paths";
import type { PathFinding } from "./analyze/paths";
import { evaluateCSP } from "./analyze/csp";
import type { CspWarning } from "./analyze/csp";

const pageInfo = ref<PageInfo>({
  title: "Not detected",
  url: "No active tab URL",
  scripts: 0,
  links: 0,
  images: 0,
  technologies: [],
  findings: [],
  mixedContent: []
});

const headersInfo = ref<SecurityHeaders | null>(null);
const errorMsg = ref("");
const expandedHeader = ref<string | null>(null);
const expandedLeak = ref<number | null>(null);
const expandedMixed = ref<number | null>(null);

function toggleHeader(key: string) {
  expandedHeader.value = expandedHeader.value === key ? null : key;
}

function toggleLeak(index: number) {
  expandedLeak.value = expandedLeak.value === index ? null : index;
}

function toggleMixed(index: number) {
  expandedMixed.value = expandedMixed.value === index ? null : index;
}

const criticalCount = computed(() => {
  return pageInfo.value.findings?.filter(f => f.severity === 'critical').length || 0;
});

const warningCount = computed(() => {
  return pageInfo.value.findings?.filter(f => f.severity === 'warning').length || 0;
});

const infoCount = computed(() => {
  return pageInfo.value.findings?.filter(f => f.severity === 'info').length || 0;
});

const isHttpsPage = computed(() => {
  return pageInfo.value.url?.toLowerCase().startsWith('https:');
});

const mixedContentList = computed(() => {
  return pageInfo.value.mixedContent || [];
});

const criticalMixedCount = computed(() => {
  return mixedContentList.value.filter(item => item.type !== 'image').length;
});

const warningMixedCount = computed(() => {
  return mixedContentList.value.filter(item => item.type === 'image').length;
});

// Path Exposure Scanner State
const pathFindings = ref<PathFinding[]>([]);
const pathScanState = ref<'idle' | 'scanning' | 'done'>('idle');
const expandedPath = ref<number | null>(null);

function togglePath(index: number) {
  expandedPath.value = expandedPath.value === index ? null : index;
}

const criticalPathsCount = computed(() => {
  return pathFindings.value.filter(f => f.severity === 'critical').length;
});

const warningPathsCount = computed(() => {
  return pathFindings.value.filter(f => f.severity === 'warning').length;
});

async function scanExposedPaths() {
  if (pathScanState.value === 'scanning') return;
  
  pathScanState.value = 'scanning';
  pathFindings.value = [];
  expandedPath.value = null;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      const origin = new URL(tab.url).origin;
      const results = await runPathAudit(origin);
      pathFindings.value = results;
    }
  } catch (err) {
    console.error("Error executing path audit:", err);
  } finally {
    pathScanState.value = 'done';
  }
}

interface CookieIssue {
  title: string;
  description: string;
  type: 'error' | 'warning';
}

interface ProcessedCookie {
  name: string;
  domain: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'no_restriction' | 'lax' | 'strict' | 'unspecified';
  issues: CookieIssue[];
}

const cookiesList = ref<ProcessedCookie[]>([]);
const expandedCookie = ref<string | null>(null);

function toggleCookie(cookieKey: string) {
  expandedCookie.value = expandedCookie.value === cookieKey ? null : cookieKey;
}

function auditCookie(cookie: chrome.cookies.Cookie): ProcessedCookie {
  const issues: CookieIssue[] = [];
  
  if (!cookie.httpOnly) {
    issues.push({
      title: "Missing HttpOnly flag",
      description: "This badge lacks a lock. JavaScript can access it, which means if someone runs a script on your page (XSS attack), they can copy this cookie and steal your user's login session.",
      type: "error"
    });
  }
  
  if (!cookie.secure) {
    issues.push({
      title: "Missing Secure flag",
      description: "This badge is being sent over plain HTTP. Anyone watching your internet traffic (like on public Wi-Fi) can see it.",
      type: "error"
    });
  }
  
  if (cookie.sameSite === 'no_restriction') {
    issues.push({
      title: "SameSite is None",
      description: "This badge is shared with other websites. Other sites can abuse this to make requests on behalf of your user (CSRF attack).",
      type: "warning"
    });
  } else if (cookie.sameSite === 'unspecified') {
    issues.push({
      title: "SameSite is Unspecified",
      description: "The cookie doesn't declare SameSite. Browsers default to Lax, but declaring Lax or Strict explicitly makes your security behavior predictable.",
      type: "warning"
    });
  }
  
  return {
    name: cookie.name,
    domain: cookie.domain,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    issues
  };
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

const cspWarnings = ref<CspWarning[]>([]);

function getHeaderStatus(h: typeof headerDetails[0]): 'Secure' | 'Weak' | 'Missing' | 'Leaking' {
  if (!headersInfo.value) return 'Missing';
  
  const isPresent = h.invertStatus ? !headersInfo.value[h.key] : headersInfo.value[h.key];
  if (!isPresent) {
    return h.invertStatus ? 'Leaking' : 'Missing';
  }
  
  if (h.key === 'csp' && cspWarnings.value.length > 0) {
    return 'Weak';
  }
  
  return 'Secure';
}

function getHeaderStatusClass(h: typeof headerDetails[0]): string {
  const status = getHeaderStatus(h);
  if (status === 'Secure') {
    return 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
  } else if (status === 'Weak') {
    return 'bg-amber-950/60 text-amber-400 border border-amber-800/40';
  } else {
    return 'bg-rose-950/60 text-rose-400 border border-rose-800/40';
  }
}

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
        url: tab.url || "",
        scripts: 0,
        links: 0,
        images: 0,
        technologies: [],
        findings: [],
        mixedContent: []
      };
      errorMsg.value = "Cannot audit internal browser pages.";
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_INFO" });
      if (response) {
        pageInfo.value = response;
      } else {
        errorMsg.value = "Unable to read page statistics.";
      }
    } catch (msgErr) {
      console.warn("Content script communication failed:", msgErr);
      errorMsg.value = "Page loaded before installation. Refresh this tab to scan DOM scripts & secrets.";
      
      // Setup fallback basic info so the UI remains populated
      pageInfo.value = {
        title: tab.title || "Active Page",
        url: tab.url || "",
        scripts: 0,
        links: 0,
        images: 0,
        technologies: [],
        findings: [],
        mixedContent: []
      };
    }

    const responseHeaders = await chrome.runtime.sendMessage({ 
      type: "GET_HEADERS", 
      tabId: tab.id 
    });
    
    if (responseHeaders && responseHeaders.length > 0) {
      headersInfo.value = analyzeHeaders(responseHeaders);
      
      const cspHeader = responseHeaders.find((h: any) => h.name.toLowerCase() === 'content-security-policy');
      if (cspHeader && cspHeader.value) {
        cspWarnings.value = evaluateCSP(cspHeader.value);
      } else {
        cspWarnings.value = [];
      }
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.cookies && tab.url) {
        const cookies = await chrome.cookies.getAll({ url: tab.url });
        cookiesList.value = cookies.map(auditCookie);
      }
    } catch (cookieErr) {
      console.error("Error querying cookies:", cookieErr);
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
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide border"
                    :class="getHeaderStatusClass(h)">
                {{ getHeaderStatus(h) }}
              </span>
            </div>
            <div v-if="expandedHeader === h.key" class="px-2.5 pb-2.5 pt-0.5 flex flex-col gap-2">
              <p class="text-[11px] text-slate-400 leading-relaxed">{{ h.explain }}</p>
              
              <!-- CSP Warnings details nested -->
              <div v-if="h.key === 'csp' && cspWarnings.length > 0" class="flex flex-col gap-1.5 mt-1 border-t border-slate-900/60 pt-2">
                <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">CSP Analysis Findings:</span>
                <div v-for="(warn, wIdx) in cspWarnings" :key="wIdx" 
                     class="flex gap-1.5 items-start p-2 rounded border text-[10px] leading-normal"
                     :class="warn.severity === 'critical' ? 'border-rose-900/30 bg-rose-950/20' : 'border-amber-900/30 bg-amber-950/20'">
                  <span class="font-bold shrink-0 leading-none mt-0.5" 
                        :class="warn.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'">⚠</span>
                  <div class="flex-grow">
                    <h4 class="text-[9px] font-bold uppercase tracking-wider" 
                        :class="warn.severity === 'critical' ? 'text-rose-300' : 'text-amber-300'">
                      {{ warn.title }}
                    </h4>
                    <p class="text-slate-400 mt-0.5">{{ warn.description }}</p>
                    <div class="mt-1 font-mono text-[9px] text-slate-500">
                      Directive: <code class="bg-slate-950 px-1 py-0.5 rounded text-slate-400">{{ warn.directive }}</code>
                      <span v-if="warn.offendingValue">
                         | Value: <code class="bg-slate-950 px-1 py-0.5 rounded text-rose-300/85">{{ warn.offendingValue }}</code>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-xs text-slate-500 italic py-2 mt-1">
          No headers captured for this tab yet. Reload the page to capture network packets.
        </div>
      </div>

      <!-- Cookie Security Audit Panel -->
      <div class="panel">
        <div class="flex items-center justify-between">
          <h3 class="panel-title mb-0">Cookie Security Audit</h3>
          <span v-if="cookiesList.length > 0" class="text-[9px] bg-slate-950/80 border border-slate-800/80 text-cyan-400 px-2 py-0.5 rounded font-mono font-semibold">
            {{ cookiesList.length }} Cookies
          </span>
        </div>

        <div v-if="cookiesList.length > 0" class="flex flex-col gap-1.5 mt-1 max-h-[180px] overflow-y-auto pr-1">
          <div v-for="(cookie, index) in cookiesList" :key="cookie.domain + ':' + cookie.name + ':' + index" 
               class="rounded-lg border border-slate-800/40 overflow-hidden transition-all duration-200 shrink-0"
               :class="[
                 expandedCookie === (cookie.domain + ':' + cookie.name + ':' + index) ? 'bg-slate-950/60' : 'hover:bg-slate-950/30',
                 cookie.issues.length > 0 ? 'border-amber-950/30' : ''
               ]">
            <!-- Header click target -->
            <div class="flex flex-col py-2 px-2.5 cursor-pointer select-none"
                 @click="toggleCookie(cookie.domain + ':' + cookie.name + ':' + index)">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[9px] text-slate-500 transition-transform duration-200" :class="expandedCookie === (cookie.domain + ':' + cookie.name + ':' + index) ? 'rotate-90' : ''">▶</span>
                  <span class="font-mono text-[10px] font-semibold text-slate-300 truncate" :title="cookie.name">{{ cookie.name }}</span>
                </div>
                <!-- Warning Dot Indicator -->
                <span v-if="cookie.issues.length > 0" 
                      class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" 
                      title="Has security recommendations"></span>
              </div>
              
              <!-- Cookie Flags Badges -->
              <div class="flex flex-wrap gap-1 mt-1.5 pl-3">
                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide"
                      :class="cookie.httpOnly ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30' : 'bg-rose-950/60 text-rose-400 border border-rose-800/30'">
                  {{ cookie.httpOnly ? 'HttpOnly' : 'No HttpOnly' }}
                </span>
                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide"
                      :class="cookie.secure ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30' : 'bg-rose-950/60 text-rose-400 border border-rose-800/30'">
                  {{ cookie.secure ? 'Secure' : 'Insecure' }}
                </span>
                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide"
                      :class="cookie.sameSite === 'strict' || cookie.sameSite === 'lax' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/30' : 'bg-amber-950/60 text-amber-400 border border-amber-800/30'">
                  SameSite: {{ cookie.sameSite === 'no_restriction' ? 'None' : (cookie.sameSite === 'unspecified' ? 'Unset' : cookie.sameSite) }}
                </span>
              </div>
            </div>

            <!-- Expandable Explanations -->
            <div v-if="expandedCookie === (cookie.domain + ':' + cookie.name + ':' + index)" class="px-2.5 pb-2.5 pt-1.5 border-t border-slate-900/60 bg-slate-950/40">
              <div class="text-[9px] text-slate-500 mb-2 font-mono truncate" :title="cookie.domain">
                Domain: {{ cookie.domain }}
              </div>
              
              <!-- List of issues for this cookie -->
              <div v-if="cookie.issues.length > 0" class="flex flex-col gap-1.5">
                <div v-for="issue in cookie.issues" :key="issue.title" 
                     class="flex gap-1.5 items-start p-2 rounded border"
                     :class="issue.type === 'error' ? 'border-rose-900/30 bg-rose-950/20' : 'border-amber-900/30 bg-amber-950/20'">
                  <span class="text-[10px] font-bold shrink-0 leading-none mt-0.5" 
                        :class="issue.type === 'error' ? 'text-rose-400' : 'text-amber-400'">⚠</span>
                  <div class="flex-grow">
                    <h4 class="text-[9px] font-bold uppercase tracking-wider" 
                        :class="issue.type === 'error' ? 'text-rose-300' : 'text-amber-300'">{{ issue.title }}</h4>
                    <p class="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{{ issue.description }}</p>
                  </div>
                </div>
              </div>
              <!-- All flags are correct -->
              <div v-else class="flex items-center gap-1.5 p-2 rounded border border-emerald-900/30 bg-emerald-950/20 text-emerald-400">
                <span class="text-[10px] font-bold">✔</span>
                <span class="text-[10px] font-medium leading-tight">All security flags active! This cookie is well protected.</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-xs text-slate-500 italic py-2 mt-1">
          No cookies found for this site.
        </div>
      </div>

      <!-- Source Leak Scanner Panel -->
      <div class="panel">
        <div class="flex items-center justify-between">
          <h3 class="panel-title mb-0">Source Leak Scanner</h3>
          
          <div class="flex gap-1">
            <span v-if="criticalCount > 0" class="text-[8px] bg-rose-950/60 text-rose-400 border border-rose-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              {{ criticalCount }} Critical
            </span>
            <span v-if="warningCount > 0" class="text-[8px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              {{ warningCount }} Warn
            </span>
            <span v-if="infoCount > 0" class="text-[8px] bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              {{ infoCount }} Info
            </span>
            <span v-if="!pageInfo.findings || pageInfo.findings.length === 0" class="text-[8px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              Clean
            </span>
          </div>
        </div>

        <div v-if="pageInfo.findings && pageInfo.findings.length > 0" class="flex flex-col gap-1.5 mt-1 max-h-[200px] overflow-y-auto pr-1">
          <div v-for="(finding, index) in pageInfo.findings" :key="index"
               class="rounded-lg border border-slate-800/40 overflow-hidden transition-all duration-200 shrink-0"
               :class="[
                 expandedLeak === index ? 'bg-slate-950/60' : 'hover:bg-slate-950/30',
                 finding.severity === 'critical' ? 'border-rose-950/30' : (finding.severity === 'warning' ? 'border-amber-950/30' : '')
               ]">
            <!-- Header click target -->
            <div class="flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer select-none"
                 @click="toggleLeak(index)">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-[9px] text-slate-500 transition-transform duration-200" :class="expandedLeak === index ? 'rotate-90' : ''">▶</span>
                <span class="font-medium text-slate-300 truncate text-[11px]">{{ finding.label }}</span>
                <span class="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">{{ finding.key }}</span>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border"
                    :class="finding.severity === 'critical' ? 'bg-rose-950/60 text-rose-400 border-rose-800/40' : 
                            (finding.severity === 'warning' ? 'bg-amber-950/60 text-amber-400 border-amber-800/40' : 
                                                              'bg-slate-900/60 text-slate-300 border-slate-800/40')">
                {{ finding.severity }}
              </span>
            </div>

            <!-- Expanded Details -->
            <div v-if="expandedLeak === index" class="px-2.5 pb-2.5 pt-1.5 border-t border-slate-900/60 bg-slate-950/40 text-[10px] flex flex-col gap-2">
              <div class="flex flex-col gap-1 font-mono text-[9px] text-slate-500">
                <span>Location: {{ finding.location }}</span>
                <span>Value: {{ finding.key }}</span>
              </div>
              
              <div class="flex flex-col gap-1">
                <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Context Snippet:</span>
                <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800/60 font-mono text-[10px] text-rose-300/80 break-all select-all">
                  {{ finding.context }}
                </div>
              </div>

              <div class="flex flex-col gap-0.5 leading-relaxed text-slate-400">
                <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Explanation & Fix:</span>
                <p>{{ finding.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center gap-1.5 p-2 rounded border border-emerald-900/30 bg-emerald-950/10 text-emerald-400 text-xs">
          <span class="font-bold">✔</span>
          <span class="font-medium leading-normal">No exposed credentials, AWS keys, Stripe tokens, private IPs, or emails leaked in public source scripts or comments.</span>
        </div>
      </div>

      <!-- Mixed Content Scanner Panel -->
      <div class="panel">
        <div class="flex items-center justify-between">
          <h3 class="panel-title mb-0">Mixed Content Scanner</h3>
          
          <div v-if="isHttpsPage" class="flex gap-1">
            <span v-if="criticalMixedCount > 0" class="text-[8px] bg-rose-950/60 text-rose-400 border border-rose-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide animate-pulse">
              {{ criticalMixedCount }} Blocked
            </span>
            <span v-if="warningMixedCount > 0" class="text-[8px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              {{ warningMixedCount }} Warning
            </span>
            <span v-if="mixedContentList.length === 0" class="text-[8px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              Secure
            </span>
          </div>
          <div v-else>
            <span class="text-[8px] bg-slate-900/60 text-slate-400 border border-slate-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              N/A (HTTP)
            </span>
          </div>
        </div>

        <div v-if="!isHttpsPage" class="text-xs text-slate-400 leading-normal p-2 rounded border border-slate-800 bg-slate-950/20">
          Mixed Content rules do not apply because this website is running over insecure HTTP. All resources are already unencrypted.
        </div>

        <div v-else-if="mixedContentList.length > 0" class="flex flex-col gap-1.5 mt-2">
          <div v-for="(item, index) in mixedContentList" :key="index"
               class="rounded-lg border border-slate-800/40 overflow-hidden transition-all duration-200 shrink-0"
               :class="[
                 expandedMixed === index ? 'bg-slate-950/60' : 'hover:bg-slate-950/30',
                 item.type !== 'image' ? 'border-rose-950/30' : 'border-amber-950/30'
               ]">
            <!-- Header Click Target -->
            <div class="flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer select-none"
                 @click="toggleMixed(index)">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="text-[9px] text-slate-500 transition-transform duration-200" :class="expandedMixed === index ? 'rotate-90' : ''">▶</span>
                <span class="font-medium text-slate-300 capitalize text-[11px]">{{ item.type }}</span>
                <span class="font-mono text-[9px] text-slate-500 truncate max-w-[200px]" :title="item.url">{{ item.url }}</span>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wide border shrink-0"
                    :class="item.type !== 'image' ? 'bg-rose-950/60 text-rose-400 border-rose-800/40' : 'bg-amber-950/60 text-amber-400 border-amber-800/40'">
                {{ item.type !== 'image' ? 'Blocked' : 'Warning' }}
              </span>
            </div>

            <!-- Expanded Details -->
            <div v-if="expandedMixed === index" class="px-2.5 pb-2.5 pt-1.5 border-t border-slate-900/60 bg-slate-950/40 text-[10px] flex flex-col gap-2">
              <div class="flex flex-col gap-1">
                <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">HTML Markup:</span>
                <div class="p-1.5 rounded bg-slate-950/90 border border-slate-800/60 font-mono text-[10px] text-rose-300/85 break-all select-all">
                  {{ item.element }}
                </div>
              </div>

              <div class="flex flex-col gap-0.5 leading-relaxed text-slate-400">
                <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Browser Security Behavior:</span>
                <p v-if="item.type !== 'image'">
                  Modern browsers block insecure scripts, styles, and iframe elements (Active Mixed Content) entirely when loaded on HTTPS pages. Update this resource to use a secure <code>https://</code> URL.
                </p>
                <p v-else>
                  Browsers will load insecure HTTP images on HTTPS pages, but they degrade the address bar security lock icon (triggering "Not Secure" markers). Update this image source to use a secure <code>https://</code> URL.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex items-center gap-1.5 p-2 rounded border border-emerald-900/30 bg-emerald-950/10 text-emerald-400 text-xs">
          <span class="font-bold">✔</span>
          <span class="font-medium leading-normal">All resources are secure. No insecure mixed content (HTTP assets) detected on this HTTPS website.</span>
        </div>
      </div>

      <!-- Path Exposure Scanner Panel -->
      <div class="panel">
        <div class="flex items-center justify-between">
          <h3 class="panel-title mb-0">Path Exposure Scanner</h3>
          
          <div v-if="pathScanState === 'done'" class="flex gap-1">
            <span v-if="criticalPathsCount > 0" class="text-[8px] bg-rose-950/60 text-rose-400 border border-rose-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide animate-pulse">
              {{ criticalPathsCount }} Critical
            </span>
            <span v-if="warningPathsCount > 0" class="text-[8px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              {{ warningPathsCount }} Warn
            </span>
            <span v-if="pathFindings.length === 0" class="text-[8px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.5 rounded font-mono font-bold tracking-wide">
              Secure
            </span>
          </div>
        </div>

        <!-- IDLE STATE -->
        <div v-if="pathScanState === 'idle'" class="flex flex-col gap-2.5">
          <p class="text-[11px] text-slate-400 leading-relaxed">
            Check if this website exposes sensitive backend configurations, API documentation, or source code histories (e.g. <code>.env</code>, <code>.git</code>).
          </p>
          <button @click="scanExposedPaths" 
                  class="w-full py-2 px-3 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/35 text-cyan-400 font-semibold text-xs tracking-wider transition-all duration-200 cursor-pointer text-center">
            Scan Exposed Paths
          </button>
        </div>

        <!-- SCANNING STATE -->
        <div v-else-if="pathScanState === 'scanning'" class="flex flex-col items-center justify-center py-4 gap-2">
          <div class="flex items-center gap-1.5 text-xs text-slate-400 font-medium animate-pulse">
            <span class="w-2.5 h-2.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0"></span>
            Probing paths for exposed secrets...
          </div>
        </div>

        <!-- DONE STATE -->
        <div v-else-if="pathScanState === 'done'" class="flex flex-col gap-2.5">
          <div v-if="pathFindings.length > 0" class="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1">
            <div v-for="(finding, index) in pathFindings" :key="index"
                 class="rounded-lg border border-slate-800/40 overflow-hidden transition-all duration-200 shrink-0"
                 :class="[
                   expandedPath === index ? 'bg-slate-950/60' : 'hover:bg-slate-950/30',
                   finding.severity === 'critical' ? 'border-rose-950/30' : 'border-amber-950/30'
                 ]">
              <!-- Header click target -->
              <div class="flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer select-none"
                   @click="togglePath(index)">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-[9px] text-slate-500 transition-transform duration-200" :class="expandedPath === index ? 'rotate-90' : ''">▶</span>
                  <span class="font-medium text-slate-300 truncate text-[11px]">{{ finding.label }}</span>
                  <span class="font-mono text-[9px] text-slate-500 truncate">{{ finding.path }}</span>
                </div>
                <span class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase border shrink-0"
                      :class="finding.severity === 'critical' ? 'bg-rose-950/60 text-rose-400 border-rose-800/40' : 
                                                                'bg-amber-950/60 text-amber-400 border-amber-800/40'">
                  {{ finding.severity }}
                </span>
              </div>

              <!-- Expanded Details -->
              <div v-if="expandedPath === index" class="px-2.5 pb-2.5 pt-1.5 border-t border-slate-900/60 bg-slate-950/40 text-[10px] flex flex-col gap-2">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Leaking File URL:</span>
                  <a :href="finding.url" target="_blank" class="text-cyan-400 hover:underline break-all font-mono text-[9px]">
                    {{ finding.url }} ↗
                  </a>
                </div>

                <div class="flex flex-col gap-0.5 leading-relaxed text-slate-400">
                  <span class="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Vulnerability Details:</span>
                  <p>{{ finding.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- All common paths secure -->
          <div v-else class="flex items-start gap-2 p-2.5 rounded border border-emerald-900/30 bg-emerald-950/10 text-emerald-400 text-xs">
            <span class="font-bold shrink-0">✔</span>
            <span class="font-medium leading-relaxed">All common files and directory paths checked are protected. Verified that <code>.env</code>, <code>.git</code>, and configuration pages are not exposed.</span>
          </div>

          <!-- Re-scan button -->
          <button @click="scanExposedPaths" 
                  class="w-full py-1.5 px-3 rounded-lg bg-slate-950/40 hover:bg-slate-900/50 border border-slate-800/50 text-slate-400 font-medium text-[11px] tracking-wide transition-all duration-200 cursor-pointer text-center">
            Run Scan Again
          </button>
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
