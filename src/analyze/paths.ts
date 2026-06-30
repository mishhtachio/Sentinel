export interface PathRule {
  path: string;
  label: string;
  severity: 'critical' | 'warning';
  description: string;
  validate: (text: string, contentType?: string) => boolean;
}

export interface PathFinding {
  path: string;
  label: string;
  severity: 'critical' | 'warning';
  description: string;
  url: string;
}

const rules: PathRule[] = [
  {
    path: '/.env',
    label: '.env Configuration File',
    severity: 'critical',
    description: 'This file contains sensitive environment variables, typically database passwords, secret API keys, and configuration tokens. It should never be publicly accessible.',
    validate: (text: string, contentType?: string) => {
      const isHtml = (contentType && contentType.toLowerCase().includes('text/html')) || text.trim().startsWith('<!DOCTYPE') || text.includes('<html');
      if (isHtml) return false;
      
      const hasEnvKeys = /\b(DB_HOST|DB_USER|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|JWT_SECRET|API_KEY|PORT=)\b/i.test(text);
      const hasEquals = /^[A-Z0-9_]+=\S*/m.test(text);
      
      return hasEnvKeys || hasEquals;
    }
  },
  {
    path: '/.git/config',
    label: '.git Repository Configuration',
    severity: 'critical',
    description: 'This file exposes details about your Git repository, including remote URLs (which may contain credentials) and branch structures. An open .git folder can let attackers reconstruct your entire source code.',
    validate: (text: string, contentType?: string) => {
      const isHtml = (contentType && contentType.toLowerCase().includes('text/html')) || text.trim().startsWith('<!DOCTYPE') || text.includes('<html');
      if (isHtml) return false;
      
      return text.includes('[core]') || text.includes('repositoryformatversion');
    }
  },
  {
    path: '/phpinfo.php',
    label: 'PHP Info Page',
    severity: 'critical',
    description: 'Exposes php configuration details, server environment variables, and directory paths. Attackers use this information to map out target servers.',
    validate: (text: string) => {
      return text.includes('phpinfo()') || text.includes('PHP Version') || text.includes('module_php');
    }
  },
  {
    path: '/swagger-ui/index.html',
    label: 'Swagger API Documentation',
    severity: 'warning',
    description: 'Exposes interactive API documentation. In production, keeping Swagger public provides attackers with a complete map of all API routes.',
    validate: (text: string) => {
      return text.includes('swagger') || text.includes('Swagger UI') || text.includes('swagger-ui-container');
    }
  },
  {
    path: '/graphql',
    label: 'GraphQL API Endpoint',
    severity: 'warning',
    description: 'GraphQL is accessible. If introspection is enabled, anyone can query the entire database schema structure.',
    validate: (text: string) => {
      return text.includes('graphql-playground') || text.includes('GraphQL Playground') || text.includes('__schema');
    }
  },
  {
    path: '/server-status',
    label: 'Apache Server Status Page',
    severity: 'warning',
    description: 'Exposes internal Apache server statistics, CPU load, active requests, and virtual host details.',
    validate: (text: string) => {
      return text.includes('Apache Server Status') || text.includes('Server Status') || text.includes('Scoreboard:');
    }
  }
];

export async function auditPath(baseUrl: string, rule: PathRule): Promise<PathFinding | null> {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const url = `${cleanBase}${rule.path}`;
  
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 4000); // 4s timeout
    
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,text/plain,application/json'
      }
    });
    
    clearTimeout(id);
    
    if (response.status === 200) {
      const contentType = response.headers.get('Content-Type') || '';
      const text = await response.text();
      
      if (rule.validate(text, contentType)) {
        return {
          path: rule.path,
          label: rule.label,
          severity: rule.severity,
          description: rule.description,
          url
        };
      }
    }
  } catch (err) {
    // Fail silently on networking/timeout issues
  }
  
  return null;
}

export async function runPathAudit(baseUrl: string): Promise<PathFinding[]> {
  const findings: PathFinding[] = [];
  
  const promises = rules.map(rule => auditPath(baseUrl, rule));
  const results = await Promise.all(promises);
  
  for (const res of results) {
    if (res !== null) {
      findings.push(res);
    }
  }
  
  return findings;
}
