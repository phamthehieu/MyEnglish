/**
 * Where the app runs, and what it can do there. The same code ships as the Android app, the desktop app (both Tauri)
 * and a web app in a browser; a screen asks here instead of testing `window.AndroidXXX` or the user agent itself.
 */
export type PlatformKind = "android" | "ios" | "desktop" | "web";

const MOBILE_UA = /Android|iPhone|iPad|iPod/i;

function mobileUserAgent(): boolean {
  return typeof navigator !== "undefined" && MOBILE_UA.test(navigator.userAgent || "");
}

/** Running inside the Tauri shell (desktop or phone app), not in a plain browser */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** The phone app (the Android or iOS build of Tauri): not a phone's browser */
export function isPhoneApp(): boolean {
  return isTauri() && mobileUserAgent();
}

/** The desktop app (Windows, macOS): its own windows, tray, popup reminders */
export function isDesktopApp(): boolean {
  return isTauri() && !mobileUserAgent();
}

/** A browser: no Tauri, no native bridges */
export function isWeb(): boolean {
  return !isTauri();
}

/** Used with a finger rather than a mouse and keyboard (the phone app, or any phone or tablet browser): for hints only */
export function isTouchDevice(): boolean {
  if (mobileUserAgent()) return true;
  try {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function platformKind(): PlatformKind {
  if (!isTauri()) return "web";
  if (!mobileUserAgent()) return "desktop";
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "ios" : "android";
}

/**
 * What this platform offers. A screen hides what is missing, or says it is not there yet, instead of failing.
 * Things that run in Rust (Tauri commands) are missing from the web app until it gets its own way to do them.
 */
export const features = {
  /** AI (Gemini key or AI CLI): the calls are made by the Rust side */
  ai: (): boolean => isTauri(),
  /** The Gemini / Claude command-line tools on this computer */
  aiCli: (): boolean => isDesktopApp(),
  /** Speech recognition: Vosk in the Android app (window.AndroidASR), the browser's own in the web app */
  speechRecognition: (): boolean =>
    typeof window !== "undefined" &&
    ("AndroidASR" in window || (isWeb() && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window))),
  /** Hearing one's own recording again (the Android app keeps it; the browser's recognition does not) */
  playbackOwnVoice: (): boolean => typeof window !== "undefined" && "AndroidASR" in window,
  /** Study reminders: Android notifications and floating card, or the desktop's corner card and popup */
  reminders: (): boolean => isTauri(),
  /** Start with the computer */
  autostart: (): boolean => isDesktopApp(),
  /** Fitting the review scheduler to the learner's history (compute_fsrs_parameters, in Rust) */
  schedulerOptimizer: (): boolean => isTauri(),
};
