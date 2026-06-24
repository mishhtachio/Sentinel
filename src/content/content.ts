import { scanForFrontendStack } from "../analyze/techs";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_INFO") {
        const currentPageInfo = {
            title: document.title,
            url: window.location.href,
            scripts: document.scripts.length,
            links: document.links.length,
            images: document.images.length,
            technologies: scanForFrontendStack(),
        };
        sendResponse(currentPageInfo);
    }
});