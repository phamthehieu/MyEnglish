/**
 * Update notice for the Android app. A phone cannot update itself like the desktop app does, so the app reads a small
 * file (published by scripts/publish-app-update.mjs on the "app-update" branch of the repo), and when it names a
 * newer version it offers the learner the APK to download. Android installs it over the old app and keeps the data,
 * as long as it is signed with the same key and its version is higher.
 */
export const APP_UPDATE_URL = "https://raw.githubusercontent.com/phamthehieu/MyEnglish/app-update/app-update.json";

export interface AppUpdateInfo {
  /** "0.3.6" */
  version: string;
  /** Where the APK is downloaded from (https) */
  apkUrl: string;
  /** What is new, a line or two */
  notes: string;
}

const VERSION = /^\d+\.\d+\.\d+$/;

/** Negative when a is older than b, 0 when equal, positive when newer ("0.3.10" is newer than "0.3.9") */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The file's content as an update, or null when it is not a valid one */
export function parseUpdateManifest(raw: unknown): AppUpdateInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "string" || !VERSION.test(o.version)) return null;
  if (typeof o.apkUrl !== "string") return null;
  try {
    if (new URL(o.apkUrl).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return { version: o.version, apkUrl: o.apkUrl, notes: typeof o.notes === "string" ? o.notes.trim().slice(0, 400) : "" };
}

/** The update to offer: the file names a version newer than the one running (null otherwise) */
export function pickUpdate(current: string, manifest: unknown): AppUpdateInfo | null {
  const info = parseUpdateManifest(manifest);
  return info && VERSION.test(current) && compareVersions(info.version, current) > 0 ? info : null;
}

/** Reads the published file and returns the update to offer; null when there is none, or when it cannot be read (offline) */
export async function fetchAppUpdate(current: string, fetchImpl: typeof fetch = fetch, url: string = APP_UPDATE_URL): Promise<AppUpdateInfo | null> {
  try {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) return null;
    return pickUpdate(current, await res.json());
  } catch {
    return null;
  }
}

// ─── What the learner answered ───────────────────────────────────────────────

const DISMISSED_KEY = "myenglish_app_update_dismissed_v1";

/** The version whose notice the learner put off ("Để sau"); a newer version is offered again */
export function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

export function dismissVersion(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    /* the notice shows again next time */
  }
}
