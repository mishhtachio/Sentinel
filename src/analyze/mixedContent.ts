export interface MixedContentItem {
  type: 'script' | 'stylesheet' | 'image' | 'iframe';
  url: string;
  element: string;
}

export function scanMixedContent(): MixedContentItem[] {
  const findings: MixedContentItem[] = [];
  
  // Mixed content rules only apply if the main document is served over HTTPS
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return findings;
  }
  
  // Helper to extract element outer HTML placeholder safely
  const getTagDescription = (el: Element, attr: string): string => {
    const tagName = el.tagName.toLowerCase();
    const val = el.getAttribute(attr) || '';
    return `<${tagName} ${attr}="${val}">`;
  };

  // 1. Scan scripts
  const scripts = document.querySelectorAll('script[src]');
  scripts.forEach(el => {
    const src = el.getAttribute('src') || '';
    if (src.startsWith('http://')) {
      findings.push({
        type: 'script',
        url: src,
        element: getTagDescription(el, 'src')
      });
    }
  });
  
  // 2. Scan stylesheets
  const styles = document.querySelectorAll('link[rel="stylesheet"][href]');
  styles.forEach(el => {
    const href = el.getAttribute('href') || '';
    if (href.startsWith('http://')) {
      findings.push({
        type: 'stylesheet',
        url: href,
        element: getTagDescription(el, 'href')
      });
    }
  });
  
  // 3. Scan iframes
  const iframes = document.querySelectorAll('iframe[src]');
  iframes.forEach(el => {
    const src = el.getAttribute('src') || '';
    if (src.startsWith('http://')) {
      findings.push({
        type: 'iframe',
        url: src,
        element: getTagDescription(el, 'src')
      });
    }
  });
  
  // 4. Scan images
  const images = document.querySelectorAll('img[src]');
  images.forEach(el => {
    const src = el.getAttribute('src') || '';
    if (src.startsWith('http://')) {
      findings.push({
        type: 'image',
        url: src,
        element: getTagDescription(el, 'src')
      });
    }
  });
  
  return findings;
}
