/** Phone / tablet app (the Android or iOS build of Tauri), as opposed to the desktop window. */
export function isMobilePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

/** Running inside the Tauri shell (desktop or Android app), not in a plain browser */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
