import type { PageInfo } from "../types/pageInfo";
import type { CspWarning } from "./csp";
import type { PathFinding } from "./paths";

export interface ReportCookie {
  name: string;
  domain: string;
  issues: { title: string; description: string; type: string }[];
}

export function generateMarkdownReport(
  pageInfo: PageInfo,
  headersInfo: Record<string, boolean> | null,
  cspWarnings: CspWarning[],
  cookiesList: ReportCookie[],
  pathFindings: PathFinding[]
): string {
  const dateStr = new Date().toLocaleString();
  let md = `# Sentinel Security Audit Report\n\n`;
  
  md += `## General Information\n`;
  md += `- **Page Title:** ${pageInfo.title || 'Not Detected'}\n`;
  md += `- **Page URL:** ${pageInfo.url || 'Not Detected'}\n`;
  md += `- **Scan Date:** ${dateStr}\n`;
  md += `- **Detected Technologies:** ${pageInfo.technologies.length > 0 ? pageInfo.technologies.join(', ') : 'None'}\n`;
  md += `- **Resource Counts:** Scripts: ${pageInfo.scripts} | Links: ${pageInfo.links} | Images: ${pageInfo.images}\n\n`;

  // 1. Security Headers
  md += `## 1. HTTP Security Headers\n`;
  if (headersInfo) {
    md += `| Header | Status | Risk / Description |\n`;
    md += `| :--- | :--- | :--- |\n`;
    
    const headerDefs = [
      { key: 'csp', label: 'Content-Security-Policy', desc: 'Prevents XSS attacks by restricting allowed scripts/resources.' },
      { key: 'hsts', label: 'Strict-Transport-Security', desc: 'Forces browser to connect securely via HTTPS.' },
      { key: 'xFrameOptions', label: 'X-Frame-Options', desc: 'Prevents Clickjacking attacks by restricting framing.' },
      { key: 'xContentTypeOptions', label: 'X-ContentType-Options', desc: 'Prevents MIME-sniffing vulnerabilities.' },
      { key: 'referrerPolicy', label: 'Referrer-Policy', desc: 'Controls referrer leakage details.' },
      { key: 'permissionPolicy', label: 'Permissions-Policy', desc: 'Restricts active hardware and browser API permissions.' },
      { key: 'xPoweredBy', label: 'X-Powered-By', desc: 'Exposes backend technology stack names.', invert: true }
    ];

    headerDefs.forEach(h => {
      const isPresent = h.invert ? !headersInfo[h.key] : headersInfo[h.key];
      let status = isPresent ? '✅ Secure' : '❌ Missing';
      if (h.key === 'csp' && headersInfo.csp) {
        status = cspWarnings.length > 0 ? '⚠️ Weak Config' : '✅ Secure';
      } else if (h.key === 'xPoweredBy' && !isPresent) {
        status = '⚠️ Leaking stack';
      }
      md += `| ${h.label} | ${status} | ${h.desc} |\n`;
    });
    md += `\n`;
    
    if (cspWarnings.length > 0) {
      md += `### CSP Strength Warnings\n`;
      cspWarnings.forEach(warn => {
        md += `- **[${warn.severity.toUpperCase()}] ${warn.title}:** ${warn.description}\n`;
        md += `  - *Directive:* \`${warn.directive}\`${warn.offendingValue ? ` | *Value:* \`${warn.offendingValue}\`` : ''}\n`;
      });
      md += `\n`;
    }
  } else {
    md += `*No headers analyzed for this tab.*\n\n`;
  }

  // 2. Cookie Security Audit
  md += `## 2. Cookie Security Audit\n`;
  const cookiesWithIssues = cookiesList.filter(c => c.issues.length > 0);
  if (cookiesList.length === 0) {
    md += `*No cookies found for this site.*\n\n`;
  } else if (cookiesWithIssues.length === 0) {
    md += `✅ **All cookies secure.** ${cookiesList.length} cookies audited and no security flag configurations are missing.\n\n`;
  } else {
    md += `Found issues in ${cookiesWithIssues.length} of ${cookiesList.length} cookies:\n\n`;
    cookiesWithIssues.forEach(cookie => {
      md += `### Cookie: \`${cookie.name}\` (Domain: \`${cookie.domain}\`)\n`;
      cookie.issues.forEach(issue => {
        md += `- **[${issue.type.toUpperCase()}] ${issue.title}:** ${issue.description}\n`;
      });
      md += `\n`;
    });
  }

  // 3. Source Leaks
  md += `## 3. Source Leak Scanner\n`;
  const leaks = pageInfo.findings || [];
  if (leaks.length === 0) {
    md += `✅ **No credentials or secret key leaks found in DOM inline scripts, comments, or visible text.**\n\n`;
  } else {
    md += `⚠️ Found **${leaks.length}** potentially exposed credentials/keys in webpage source:\n\n`;
    md += `| Severity | Finding Label | Masked Value | Location | Context snippet |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
    leaks.forEach(leak => {
      md += `| ${leak.severity.toUpperCase()} | ${leak.label} | \`${leak.key}\` | ${leak.location} | \`${leak.context}\` |\n`;
    });
    md += `\n`;
  }

  // 4. Mixed Content
  md += `## 4. Insecure Mixed Content Scanner\n`;
  const mixed = pageInfo.mixedContent || [];
  const isHttps = pageInfo.url?.toLowerCase().startsWith('https:');
  
  if (!isHttps) {
    md += `*Audit N/A: Website is loaded over plain HTTP, so resource encryption rules do not apply.*\n\n`;
  } else if (mixed.length === 0) {
    md += `✅ **No insecure mixed content resources found.** All active assets are served over secure HTTPS.\n\n`;
  } else {
    md += `⚠️ Found **${mixed.length}** unencrypted resources loaded on this HTTPS website:\n\n`;
    md += `| Asset Type | Target URL | Insecure Element HTML |\n`;
    md += `| :--- | :--- | :--- |\n`;
    mixed.forEach(item => {
      md += `| ${item.type.toUpperCase()} | ${item.url} | \`${item.element}\` |\n`;
    });
    md += `\n`;
  }

  // 5. Link Security Auditor
  md += `## 5. Link Security Auditor (Tabnabbing check)\n`;
  const unsafeLinks = pageInfo.unsafeLinks || [];
  if (unsafeLinks.length === 0) {
    md += `✅ **All links secure.** No target="_blank" anchors are vulnerable to tabnabbing window hijacks.\n\n`;
  } else {
    md += `⚠️ Found **${unsafeLinks.length}** links vulnerable to tabnabbing hijackings (missing rel="noopener"):\n\n`;
    md += `| Link Text | Destination URL | Element HTML |\n`;
    md += `| :--- | :--- | :--- |\n`;
    unsafeLinks.forEach(link => {
      md += `| ${link.text} | ${link.href} | \`${link.element}\` |\n`;
    });
    md += `\n`;
  }

  // 6. Exposed Paths Scanner
  md += `## 6. On-Demand Exposed Paths Scanner\n`;
  if (pathFindings.length === 0) {
    md += `*Scanner not run or no exposed paths detected. Run "Scan Exposed Paths" in Sentinel to audit backend exposures.*\n\n`;
  } else {
    md += `Found **${pathFindings.length}** exposed configuration or diagnostic paths:\n\n`;
    pathFindings.forEach(f => {
      md += `- **[${f.severity.toUpperCase()}] ${f.label}**: Exists at [${f.path}](${f.url})\n`;
      md += `  - *Risk:* ${f.description}\n`;
    });
    md += `\n`;
  }

  md += `---\n*Report generated automatically by Sentinel Shield Developer extension.*`;
  return md;
}
