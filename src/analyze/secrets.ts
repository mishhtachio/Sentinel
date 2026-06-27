export interface SecretFinding {
  type: string;
  label: string;
  key: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  context: string;
  location: string;
}

export interface ScanRule {
  type: string;
  regex: RegExp;
  severity: 'critical' | 'warning' | 'info';
  label: string;
  description: string;
}

const rules: ScanRule[] = [
  {
    type: 'aws_key',
    regex: /\b(AKIA|ASCA|ASIA)[0-9A-Z]{16}\b/g,
    severity: 'critical',
    label: 'AWS Access Key ID',
    description: 'This is a private credential for Amazon Web Services. If exposed, attackers can access your cloud resources and potentially run up massive bills.'
  },
  {
    type: 'github_token',
    regex: /\b(ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z]{82})\b/g,
    severity: 'critical',
    label: 'GitHub Token',
    description: 'An authentication token for GitHub. If leaked, attackers can access, modify, or delete your repositories.'
  },
  {
    type: 'stripe_secret',
    regex: /\b(sk_(test|live)_[0-9a-zA-Z]{24,99})\b/g,
    severity: 'critical',
    label: 'Stripe Secret Key',
    description: 'A private Stripe API key. Attackers can use this to make charges, issue refunds, or access customer data.'
  },
  {
    type: 'stripe_publishable',
    regex: /\b(pk_(test|live)_[0-9a-zA-Z]{24,99})\b/g,
    severity: 'info',
    label: 'Stripe Publishable Key',
    description: 'A public Stripe key used for frontend integrations. This is safe to expose client-side, but ensure you restrict its permissions in your Stripe Dashboard.'
  },
  {
    type: 'google_api_key',
    regex: /\b(AIzaSy[0-9A-Za-z-_]{33})\b/g,
    severity: 'info',
    label: 'Google API / Maps Key',
    description: 'A public-facing Google key. While safe to expose, you must set HTTP Referrer restrictions in Google Cloud Console to prevent others from stealing and using your maps/API quota.'
  },
  {
    type: 'jwt',
    regex: /\b(eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*)\b/g,
    severity: 'warning',
    label: 'JSON Web Token (JWT)',
    description: 'A base64 encoded session token. Hardcoded JWTs in scripts might contain sensitive claims or active sessions. Ensure this is not a permanent backend token.'
  },
  {
    type: 'private_ip',
    regex: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    severity: 'warning',
    label: 'Internal IP Address',
    description: 'A private network IP (like 192.168.x.x). Safe for local development, but exposing internal network structures in production is not recommended.'
  },
  {
    type: 'email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,6}\b/g,
    severity: 'info',
    label: 'Exposed Email Address',
    description: 'An email address found in the source code or comments. Spam bots regularly scrape JS files and comments to compile spam lists.'
  }
];

export function scanText(text: string, contextName: string, scanLevel: 'all' | 'criticalOnly' = 'all'): SecretFinding[] {
  const findings: SecretFinding[] = [];
  
  for (const rule of rules) {
    if (scanLevel === 'criticalOnly' && rule.severity !== 'critical') {
      continue;
    }

    rule.regex.lastIndex = 0;
    let match;
    
    while ((match = rule.regex.exec(text)) !== null) {
      const value = match[0];
      
      // Mask value for privacy
      let masked = value;
      if (value.length > 8) {
        masked = value.slice(0, 4) + '...' + value.slice(-4);
      } else {
        masked = '***';
      }
      
      // Extract context (approx 30 chars before and after)
      const start = Math.max(0, match.index - 30);
      const end = Math.min(text.length, match.index + value.length + 30);
      const rawContext = text.slice(start, end).replace(/\s+/g, ' ');
      const cleanContext = '...' + rawContext.trim() + '...';
      
      findings.push({
        type: rule.type,
        label: rule.label,
        key: masked,
        severity: rule.severity,
        description: rule.description,
        context: cleanContext,
        location: contextName
      });
      
      // Avoid infinite loop on zero-width matches
      if (match.index === rule.regex.lastIndex) {
        rule.regex.lastIndex++;
      }
    }
  }
  
  return findings;
}
