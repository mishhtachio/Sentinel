export interface CspWarning {
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  directive: string;
  offendingValue?: string;
}

export function parseCSP(cspString: string): Record<string, string[]> {
  const directives: Record<string, string[]> = {};
  const parts = cspString.split(';');
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    
    const tokens = trimmed.split(/\s+/);
    const name = tokens[0].toLowerCase();
    const values = tokens.slice(1);
    directives[name] = values;
  }
  
  return directives;
}

export function evaluateCSP(cspString: string): CspWarning[] {
  const warnings: CspWarning[] = [];
  if (!cspString) return warnings;

  const directives = parseCSP(cspString);
  
  // script-src directive is the primary vector for XSS, falls back to default-src
  const scriptSrc = directives['script-src'] || directives['default-src'] || [];
  const scriptDirectiveName = directives['script-src'] ? 'script-src' : 'default-src';

  if (scriptSrc.length > 0) {
    const hasUnsafeInline = scriptSrc.includes("'unsafe-inline'");
    const hasNonce = scriptSrc.some(val => val.startsWith("'nonce-"));
    const hasHash = scriptSrc.some(val => val.startsWith("'sha256-") || val.startsWith("'sha384-") || val.startsWith("'sha512-"));
    
    // Check 1: 'unsafe-inline' without nonce or hash protection
    if (hasUnsafeInline && !hasNonce && !hasHash) {
      warnings.push({
        severity: 'critical',
        title: 'Unsafe Inline Scripting Enabled',
        description: "Your CSP allows running inline scripts ('unsafe-inline') without a nonce or cryptographic hash protection. Attackers can execute injected HTML script tags or event handlers directly.",
        directive: scriptDirectiveName,
        offendingValue: "'unsafe-inline'"
      });
    }

    // Check 2: Wildcard / broad scheme sources
    const wildcards = ['*', 'http:', 'https:', 'data:'];
    const matchingWildcards = scriptSrc.filter(val => wildcards.includes(val));
    if (matchingWildcards.length > 0) {
      warnings.push({
        severity: 'critical',
        title: 'Wildcard / Broad Script Sources Allowed',
        description: `Allowing broad sources like ${matchingWildcards.join(', ')} permits the browser to fetch and execute scripts from arbitrary external domains, bypassing domain restrictions.`,
        directive: scriptDirectiveName,
        offendingValue: matchingWildcards.join(' ')
      });
    }

    // Check 3: 'unsafe-eval'
    if (scriptSrc.includes("'unsafe-eval'")) {
      warnings.push({
        severity: 'warning',
        title: 'unsafe-eval is Enabled',
        description: "Enabling 'unsafe-eval' allows the execution of strings as code (e.g. via eval()). This helps attackers execute payload code if they find an injection vulnerability.",
        directive: scriptDirectiveName,
        offendingValue: "'unsafe-eval'"
      });
    }
  } else {
    // If neither script-src nor default-src is defined
    warnings.push({
      severity: 'critical',
      title: 'Script Execution is Unrestricted',
      description: 'Neither script-src nor default-src directives are defined in the CSP. Scripts can load and execute without restrictions.',
      directive: 'script-src'
    });
  }

  // Check 4: object-src restriction
  const objectSrc = directives['object-src'];
  const defaultSrc = directives['default-src'];
  const objectRestricted = (objectSrc && objectSrc.includes("'none'")) || (!objectSrc && defaultSrc && defaultSrc.includes("'none'"));
  if (!objectRestricted) {
    warnings.push({
      severity: 'warning',
      title: 'object-src is Missing or Weak',
      description: "Without restricting 'object-src' (ideally to 'none'), the browser can load flash, java, or other insecure embedded plugin resources.",
      directive: 'object-src',
      offendingValue: objectSrc ? objectSrc.join(' ') : 'Not defined'
    });
  }

  // Check 5: base-uri restriction
  const baseUri = directives['base-uri'];
  const baseUriRestricted = baseUri && (baseUri.includes("'none'") || baseUri.includes("'self'"));
  if (!baseUriRestricted) {
    warnings.push({
      severity: 'warning',
      title: 'base-uri is Unrestricted',
      description: "Without restricting 'base-uri', attackers can inject a <base> tag to change the document origin, redirecting relative asset links (scripts, stylesheets) to their own servers.",
      directive: 'base-uri',
      offendingValue: baseUri ? baseUri.join(' ') : 'Not defined'
    });
  }

  return warnings;
}
