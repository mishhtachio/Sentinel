import { scanForFrontendStack } from "../analyze/techs";
import { scanText } from "../analyze/secrets";
import type { SecretFinding } from "../analyze/secrets";
import { scanMixedContent } from "../analyze/mixedContent";

function getComments(contextNode: Node): string[] {
    const comments: string[] = [];
    const iterator = document.createNodeIterator(
        contextNode,
        NodeFilter.SHOW_COMMENT,
        null
    );
    let node;
    while ((node = iterator.nextNode())) {
        if (node.nodeValue) {
            comments.push(node.nodeValue);
        }
    }
    return comments;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_INFO") {
        const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'))
            .map(s => s.textContent || '')
            .join('\n');
        
        const bodyText = document.body ? document.body.innerText : '';
        const commentsList = getComments(document.documentElement).join('\n');

        const findings: SecretFinding[] = [];

        if (inlineScripts) {
            findings.push(...scanText(inlineScripts, "Inline Script", "all"));
        }
        if (bodyText) {
            findings.push(...scanText(bodyText, "Page Visible Text", "criticalOnly"));
        }
        if (commentsList) {
            findings.push(...scanText(commentsList, "HTML Comments", "all"));
        }

        const currentPageInfo = {
            title: document.title,
            url: window.location.href,
            scripts: document.scripts.length,
            links: document.links.length,
            images: document.images.length,
            technologies: scanForFrontendStack(),
            findings: findings,
            mixedContent: scanMixedContent(),
        };
        sendResponse(currentPageInfo);
    }
});