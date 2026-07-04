const headerCache = new Map();

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.type !== "main_frame") return;
        headerCache.set(details.tabId, details.responseHeaders || []);
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
    headerCache.delete(tabId);
});

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message.type === "GET_HEADERS") {
            const targetTabId = message.tabId || sender.tab?.id;
            sendResponse(headerCache.get(targetTabId) || []);
        }
    }
);

export function analyzeHeaders(headers: chrome.webRequest.HttpHeader[]) {
    const names = headers.map(h => h.name.toLowerCase());

    return {
        csp: names.includes("content-security-policy"),
        xFrameOptions: names.includes("x-frame-options"),
        xPoweredBy: names.includes("x-powered-by"),
        cookies: names.includes("set-cookie"),
        hsts: names.includes("strict-transport-security"),
        crossOriginResourcePolicy: names.includes("cross-origin-resource-policy"),
        xContentTypeOptions: names.includes("x-content-type-options"),
        referrerPolicy: names.includes("referrer-policy"),
        permissionPolicy: names.includes("permission-policy"),
    };
}