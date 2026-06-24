export function scanForFrontendStack(): string[] {
    const list: string[] = [];

    //React detection
    if (document.querySelector('#root, #react-root, #react-app, [data-reactroot], script[src*="react"], script[src*="react-dom"], script[src*="_next/static"]')) {
        list.push("React");
    }

    //Vue detection
    const isVue = !!document.querySelector('[data-v-app], [data-server-rendered], script[src*="vue"], script[src*="nuxt"]') ||
        Array.from(document.querySelectorAll('*')).slice(0, 100).some(el =>
            Array.from(el.attributes).some(attr => attr.name.startsWith('data-v-'))
        );
    if (isVue) {
        list.push("Vue");
    }

    //Angular detection
    if (document.querySelector('[ng-version], app-root, [ng-app], script[src*="angular"], script[src*="ng-"]')) {
        list.push("Angular");
    }

    //Next.js detection
    if (document.querySelector('#__NEXT_DATA__, #__next')) {
        list.push("Next.js");
    }

    //Tailwind detection
    let isTailwind = Array.from(document.querySelectorAll('style')).some(s => s.textContent?.includes('--tw-') || s.textContent?.includes('tailwindcss'));
    if (!isTailwind) {
        try {
            isTailwind = Array.from(document.styleSheets).some(sheet => {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    return rules && Array.from(rules).slice(0, 30).some(r => r.cssText.includes('--tw-') || r.cssText.includes('tailwind'));
                } catch {
                    return false; // CORS block
                }
            });
        } catch { }
    }
    if (!isTailwind && document.body) {
        const bodyClass = document.body.className || '';
        const htmlClass = document.documentElement.className || '';
        const checkClass = (c: string) => c.includes('bg-') && (c.includes('text-') || c.includes('flex') || c.includes('grid'));
        isTailwind = checkClass(bodyClass) || checkClass(htmlClass);
    }
    if (isTailwind) {
        list.push("Tailwind");
    }

    //WordPress detection
    if (document.querySelector("meta[name='generator'][content*='WordPress'], link[href*='wp-content'], link[href*='wp-includes'], script[src*='wp-content'], script[src*='wp-includes']")) {
        list.push("WordPress");
    }

    return list;
}