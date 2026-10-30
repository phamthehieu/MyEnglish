import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import pkg from "./package.json" with { type: "json" };

const host = process.env.TAURI_DEV_HOST;

// Shadowing lessons (one chunk each, ~10 MB together) are kept offline once opened, not all at the first visit
const SHADOWING_LESSONS = fs
  .readdirSync(path.resolve(__dirname, "src/data/shadowing/lessons"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => `assets/${f.replace(/\.json$/, "")}-*.js`);

/**
 * The web app as an installable app that works offline (PWA). The service worker is registered only in a browser
 * (src/main.tsx): inside Tauri it would keep serving the old files after an app update.
 */
const pwa = VitePWA({
  injectRegister: null,
  // A new version waits until the learner leaves the app (src/services/webApp.ts), never reloads a session midway
  registerType: "prompt",
  includeAssets: ["pwa/apple-touch-icon.png"],
  manifest: {
    name: "MyEnglish: tiếng Anh mỗi ngày",
    short_name: "MyEnglish",
    description: "Học từ vựng, nói và ngữ pháp tiếng Anh mỗi ngày, vài phút một lần.",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fa",
    theme_color: "#0f766e",
    icons: [
      { src: "pwa/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "pwa/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // The app itself, the vocabulary deck and SQLite (WebAssembly): what learning needs, kept at the first visit
    globPatterns: ["**/*.{js,css,html,wasm,woff2,png,svg}"],
    globIgnores: [...SHADOWING_LESSONS, "app-icon.png", "tauri.svg", "vite.svg", "window-init.js"],
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
    navigateFallback: "/index.html",
    cleanupOutdatedCaches: true,
    // Study reminders (Web Push): showing them and opening the app on a tap
    importScripts: ["push-sw.js"],
    runtimeCaching: [
      {
        // Sound videos of the pronunciation lessons: kept once played (videos ask for byte ranges)
        urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.endsWith(".mp4"),
        handler: "CacheFirst",
        options: {
          cacheName: "media",
          rangeRequests: true,
          expiration: { maxEntries: 80 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // Anything else of the app's own not kept at install (a shadowing lesson): kept once opened
        urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/"),
        handler: "CacheFirst",
        options: {
          cacheName: "assets-on-demand",
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 120 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
});

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), pwa],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
