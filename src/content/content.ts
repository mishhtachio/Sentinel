console.log("Sentinel content script loaded")

const pageInfo = {
    title: document.title,
    url: window.location.href,
    scripts: document.scripts.length,
    links: document.links.length,
    images: document.images.length,
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_INFO") {
        sendResponse(pageInfo);
    }
});