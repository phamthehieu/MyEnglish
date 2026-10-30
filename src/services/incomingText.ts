/**
 * Text that comes into the app from elsewhere, for the capture sheet ("Lưu từ"):
 * - the Android app: "Share → MyEnglish", or "Lưu vào MyEnglish" in another app's menu of selected text
 *   (MainActivity keeps it until the page takes it: window.AndroidIncoming.take());
 * - the web app installed on a phone: its share target (manifest in vite.config.ts) opens it with ?text=...&title=...
 */
export const INCOMING_TEXT_EVENT = "myenglish-incoming-text";
const MAX_CHARS = 4000;

export function takeIncomingText(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromApp = (window as unknown as { AndroidIncoming?: { take(): string } }).AndroidIncoming?.take();
    if (fromApp?.trim()) return fromApp.trim().slice(0, MAX_CHARS);
  } catch {
    /* not the Android app */
  }
  const location = window.location;
  if (!location?.search) return null;
  const params = new URLSearchParams(location.search);
  if (!params.has("text") && !params.has("title")) return null;
  const shared = (params.get("text") || params.get("title") || "").trim();
  // Taken once: a reload must not open the sheet again
  window.history?.replaceState(null, "", location.pathname + location.hash);
  return shared ? shared.slice(0, MAX_CHARS) : null;
}

/** Call back with each text that comes in, now (one waiting from the start) and later; returns the way to stop */
export function onIncomingText(callback: (text: string) => void): () => void {
  const check = () => {
    const text = takeIncomingText();
    if (text) callback(text);
  };
  check();
  window.addEventListener(INCOMING_TEXT_EVENT, check);
  return () => window.removeEventListener(INCOMING_TEXT_EVENT, check);
}
