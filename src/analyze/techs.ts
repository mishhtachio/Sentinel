export function scanForFrontendStack(): string[] {
    const identifiedLibrariesList: string[] = [];

    //REACT
    const reactMountIds = ['root', 'react-root', 'react-app'];
    let reactDetected = false;

    //Check if any standard React container is present in the DOM
    for (const id of reactMountIds) {
        if (document.getElementById(id)) {
            reactDetected = true;
            break;
        }
    }

    if (!reactDetected) {
        const legacyReactRoot = document.querySelector('[data-reactroot]');
        if (legacyReactRoot) {
            reactDetected = true;
        }
    }

    //Check script sources for React/Next bundles
    if (!reactDetected) {
        const pageScripts = document.getElementsByTagName('script');
        for (let i = 0; i < pageScripts.length; i++) {
            const scriptSrc = pageScripts[i].src || '';
            if (scriptSrc.includes('react') || scriptSrc.includes('react-dom') || scriptSrc.includes('_next/static')) {
                reactDetected = true;
                break;
            }
        }
    }

    if (reactDetected) {
        identifiedLibrariesList.push("React");
    }

    //VUE.JS
    let isVueSite = false;
    if (document.querySelector('[data-v-app]') || document.querySelector('[data-server-rendered]')) {
        isVueSite = true;
    } else {
        //search DOM elements for scoped data-v attributes (max 100 elements to keep it fast)
        const sampleElements = document.getElementsByTagName('*');
        const limit = Math.min(sampleElements.length, 100);
        for (let i = 0; i < limit; i++) {
            const attributes = sampleElements[i].attributes;
            for (let j = 0; j < attributes.length; j++) {
                if (attributes[j].name.startsWith('data-v-')) {
                    isVueSite = true;
                    break;
                }
            }
            if (isVueSite) break;
        }
    }

    if (!isVueSite) {
        const pageScripts = document.getElementsByTagName('script');
        for (let i = 0; i < pageScripts.length; i++) {
            const src = pageScripts[i].src || '';
            if (src.includes('vue') || src.includes('nuxt')) {
                isVueSite = true;
                break;
            }
        }
    }

    if (isVueSite) {
        identifiedLibrariesList.push("Vue");
    }

    //ANGULAR
    let isAngular = false;
    if (document.querySelector('[ng-version]') || document.querySelector('app-root') || document.querySelector('[ng-app]')) {
        isAngular = true;
    } else {
        const pageScripts = document.getElementsByTagName('script');
        for (let i = 0; i < pageScripts.length; i++) {
            const src = pageScripts[i].src || '';
            if (src.includes('angular') || src.includes('ng-')) {
                isAngular = true;
                break;
            }
        }
    }

    if (isAngular) {
        identifiedLibrariesList.push("Angular");
    }

    //NEXT.JS
    const nextDataScript = document.getElementById('__NEXT_DATA__');
    const nextContainer = document.getElementById('__next');
    if (nextDataScript || nextContainer) {
        identifiedLibrariesList.push("Next.js");
    }

    //TAILWIND CSS
    let tailwindCSSDetected = false;
    try {
        const styleSheets = document.styleSheets;
        for (let i = 0; i < styleSheets.length; i++) {
            const sheet = styleSheets[i];
            try {
                const rules = sheet.cssRules || sheet.rules;
                if (!rules) continue;

                const inspectLimit = Math.min(rules.length, 60);
                for (let j = 0; j < inspectLimit; j++) {
                    const cssText = rules[j].cssText;
                    if (cssText.includes('--tw-') || cssText.includes('tailwindcss')) {
                        tailwindCSSDetected = true;
                        break;
                    }
                }
            } catch (sheetError) {
            }
            if (tailwindCSSDetected) break;
        }
    } catch (err) {
    }

    //Check if there's any style tags containing tailwind text
    if (!tailwindCSSDetected) {
        const inlineStyles = document.getElementsByTagName('style');
        for (let i = 0; i < inlineStyles.length; i++) {
            const text = inlineStyles[i].textContent || '';
            if (text.includes('--tw-') || text.includes('tailwindcss')) {
                tailwindCSSDetected = true;
                break;
            }
        }
    }

    //Look at the class name of document body
    if (!tailwindCSSDetected && document.body) {
        const bodyClass = document.body.className || '';
        const isTailwindPattern = (str: string) => {
            return str.includes('bg-') && (str.includes('text-') || str.includes('flex') || str.includes('grid'));
        };
        if (isTailwindPattern(bodyClass)) {
            tailwindCSSDetected = true;
        }
    }

    if (tailwindCSSDetected) {
        identifiedLibrariesList.push("Tailwind");
    }

    //WORDPRESS
    let wordpressSite = false;
    const generatorMeta = document.querySelector("meta[name='generator']");
    if (generatorMeta) {
        const contentVal = generatorMeta.getAttribute('content') || '';
        if (contentVal.includes('WordPress')) {
            wordpressSite = true;
        }
    }

    if (!wordpressSite) {
        const assets = document.querySelectorAll('link, script');
        const limit = Math.min(assets.length, 120);
        for (let i = 0; i < limit; i++) {
            const el = assets[i] as any;
            const sourceUrl = el.src || el.href || '';
            if (sourceUrl.includes('wp-content') || sourceUrl.includes('wp-includes')) {
                wordpressSite = true;
                break;
            }
        }
    }

    if (wordpressSite) {
        identifiedLibrariesList.push("WordPress");
    }

    return identifiedLibrariesList;
}