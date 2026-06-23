console.log("Sentinel content script loaded");
import { detectTechnologies } from "../analyze/techs";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_INFO") {
        // Collect page metrics dynamically at the exact moment the popup requests it!
        const currentPageInfo = {
            title: document.title,
            url: window.location.href,
            scripts: document.scripts.length,
            links: document.links.length,
            images: document.images.length,
            technologies: detectTechnologies(),
        };
        sendResponse(currentPageInfo);
    }
});