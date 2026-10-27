/**
 * The Android side of the update (UpdateBridge.kt, `window.AndroidUpdater`): download the APK inside the app and hand it
 * to Android's installer. Its answers come back as window events; see UpdateBridge.kt.
 */
interface NativeUpdater {
  canInstall(): boolean;
  openInstallSettings(): void;
  download(url: string, sha256: string): void;
  install(): void;
}

declare global {
  interface Window {
    AndroidUpdater?: NativeUpdater;
  }
}

export const nativeUpdater = (): NativeUpdater | null => (typeof window !== "undefined" ? (window.AndroidUpdater ?? null) : null);

export const UPDATE_PROGRESS_EVENT = "app-update-progress";
export const UPDATE_DOWNLOADED_EVENT = "app-update-downloaded";
export const UPDATE_ERROR_EVENT = "app-update-error";
