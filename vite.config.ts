import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config.ts";
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss(), crx({ manifest })],
})

