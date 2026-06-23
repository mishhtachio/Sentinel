export function detectTechnologies(): string[] {
    const techs: string[] = [];

    // React detection
    const hasReactDOM = 
        document.querySelector("#root") || 
        document.querySelector("#react-root") || 
        document.querySelector("[data-reactroot]") ||
        document.querySelector("[data-react-rid]");
    
    const hasReactScripts = Array.from(document.scripts).some(script => {
        const src = script.src.toLowerCase();
        return src.includes("react") || src.includes("react-dom") || src.includes("next/static");
    });

    if (hasReactDOM || hasReactScripts) {
        techs.push("React");
    }

    // Vue detection
    const hasVueDOM = 
        document.querySelector("[data-v-app]") || 
        document.querySelector("#app[data-v-") ||
        document.querySelector("[data-server-rendered]") ||
        // Check for Vue scoped CSS attributes on body or wrapper elements
        Array.from(document.querySelectorAll('*')).slice(0, 100).some(el => {
            return Array.from(el.attributes).some(attr => attr.name.startsWith('data-v-'));
        });

    const hasVueScripts = Array.from(document.scripts).some(script => {
        const src = script.src.toLowerCase();
        return src.includes("vue") || src.includes("nuxt");
    });

    if (hasVueDOM || hasVueScripts) {
        techs.push("Vue");
    }

    // Angular / AngularJS detection
    const hasAngularDOM = 
        document.querySelector("[ng-version]") || 
        document.querySelector("app-root") || 
        document.querySelector("[ng-app]") || 
        document.querySelector("[ng-controller]") ||
        document.querySelector(".ng-binding");

    const hasAngularScripts = Array.from(document.scripts).some(script => {
        const src = script.src.toLowerCase();
        return src.includes("angular") || src.includes("ng-");
    });

    if (hasAngularDOM || hasAngularScripts) {
        techs.push("Angular");
    }

    // Next.js detection
    const hasNext = 
        document.querySelector("#__next") || 
        document.querySelector("script[id='__NEXT_DATA__']");
    if (hasNext) {
        techs.push("Next.js");
    }

    // Tailwind CSS detection
    let hasTailwind = false;
    
    // 1. Check styleSheets for Tailwind's signature --tw- variables
    try {
        for (let i = 0; i < document.styleSheets.length; i++) {
            const sheet = document.styleSheets[i];
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;
                
                // Inspect first 50 rules (enough to find Tailwind preflight variables)
                const limit = Math.min(rules.length, 50);
                for (let j = 0; j < limit; j++) {
                    const ruleText = rules[j].cssText;
                    if (ruleText.includes('--tw-') || ruleText.includes('tailwind')) {
                        hasTailwind = true;
                        break;
                    }
                }
            } catch (sheetError) {
                // Ignore SecurityError for cross-origin stylesheets
            }
            if (hasTailwind) break;
        }
    } catch (e) {
        // Outer safety
    }

    // 2. Check meta tags/styles or a subset of body elements classes as fallback
    if (!hasTailwind) {
        const inlineStyles = Array.from(document.querySelectorAll('style'));
        hasTailwind = inlineStyles.some(style => {
            const text = style.textContent || '';
            return text.includes('--tw-') || text.includes('tailwindcss');
        });
    }

    if (!hasTailwind && document.body) {
        // Fast class scan of key wrapper tags rather than traversing thousands of elements
        const bodyClass = document.body.className || '';
        const htmlClass = document.documentElement.className || '';
        const hasTailwindClasses = (c: string) => 
            c.includes('bg-') && (c.includes('text-') || c.includes('flex') || c.includes('grid') || c.includes('mx-') || c.includes('p-'));
        
        hasTailwind = hasTailwindClasses(bodyClass) || hasTailwindClasses(htmlClass);
    }

    if (hasTailwind) {
        techs.push("Tailwind");
    }

    // WordPress detection
    const hasWP = 
        document.querySelector("meta[name='generator'][content*='WordPress']") ||
        document.querySelector("link[rel='https://api.w.org/']") ||
        Array.from(document.querySelectorAll('link, script')).slice(0, 100).some(el => {
            const src = (el as any).src || (el as any).href || '';
            return src.includes('wp-content') || src.includes('wp-includes');
        });

    if (hasWP) {
        techs.push("WordPress");
    }

    return Array.from(new Set(techs));
}