/**
 * The web app as an installed app (PWA): its service worker keeps the app and the deck for offline use
 * (vite.config.ts). Registered only in a browser; the Tauri apps update their own way.
 *
 * A new version downloads in the background and is switched to when the learner leaves the app (another app, the
 * screen off): a reload in the middle of a review would drop the session.
 */
import { registerSW } from "virtual:pwa-register";

export function startWebApp(): void {
  if (!("serviceWorker" in navigator)) return;
  let waiting = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
    },
  });
  document.addEventListener("visibilitychange", () => {
    if (waiting && document.visibilityState === "hidden") {
      waiting = false;
      void updateSW(true);
    }
  });
}
