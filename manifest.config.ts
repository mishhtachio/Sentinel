import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "Sentinel",
    version: "1.0.0",
    description: "Browser Security Auditor",

    action: {
        default_popup: "index.html",
    },

    background: {
        service_worker: "src/background/background.ts",
    },

    permissions: ["tabs", "webRequest", "cookies"],

    host_permissions: ["<all_urls>"],

    content_scripts: [
        {
            matches: ["<all_urls>"],
            js: ["src/content/content.ts"],
        },
    ],
});