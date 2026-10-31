/**
 * The web app as an installed app (PWA): its service worker keeps the app and the deck for offline use
 * (vite.config.ts). Registered only in a browser; the Tauri apps update their own way.
 *
 * A new version downloads in the background and is switched to when the learner leaves the app (another app, the
 * screen off): a reload in the middle of a review would drop the session. The study data is written first: the
 * reload would otherwise cut that write short.
 */
import { registerSW } from "virtual:pwa-register";
import { flushDatabase } from "./db";

export function startWebApp(): void {
  if (!("serviceWorker" in navigator)) return;
  let waiting = false;
  let applying = false;
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      waiting = true;
    },
  });
  document.addEventListener("visibilitychange", () => {
    if (!waiting || applying || document.visibilityState !== "hidden") return;
    applying = true;
    void (async () => {
      try {
        await flushDatabase();
        // The learner came back while it was being written: not now
        if (document.visibilityState !== "hidden") return;
        waiting = false;
        await updateSW(true);
      } catch {
        // Not written: no reload now, the next time the learner leaves tries again
      } finally {
        applying = false;
      }
    })();
  });
}

/**
 * Ask the browser to keep the study data: without it Safari deletes a site's storage after 7 days without a visit,
 * and Chrome may when the disk is low. Asked at the first tap (Firefox shows the question to the learner then).
 */
export function askToKeepStorage(): void {
  const storage = navigator.storage;
  if (!storage?.persist || !storage.persisted) return;
  const ask = () => {
    void storage
      .persisted()
      .then((kept) => (kept ? true : storage.persist()))
      .catch(() => false);
  };
  document.addEventListener("pointerdown", ask, { once: true, capture: true });
}
