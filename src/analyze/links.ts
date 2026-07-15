export interface UnsafeLink {
  text: string;
  href: string;
  element: string;
}

export function scanUnsafeLinks(): UnsafeLink[] {
  const findings: UnsafeLink[] = [];
  if (typeof document === 'undefined') {
    return findings;
  }

  const links = document.querySelectorAll('a[target="_blank"]');
  
  links.forEach(el => {
    const rel = (el.getAttribute('rel') || '').toLowerCase();
    const hasNoOpener = rel.includes('noopener') || rel.includes('noreferrer');
    
    if (!hasNoOpener) {
      const href = el.getAttribute('href') || '';
      // Exclude empty and internal anchor hashes which do not open a new page context
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        return;
      }
      
      const text = (el.textContent || '').trim();
      const displayLabel = text.length > 25 ? text.slice(0, 22) + '...' : text || 'Untitled Link';
      
      findings.push({
        text: displayLabel,
        href: href,
        element: `<a href="${href}" target="_blank">`
      });
    }
  });
  
  return findings;
}
