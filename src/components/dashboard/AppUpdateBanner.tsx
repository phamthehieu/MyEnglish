import { useEffect, useReducer, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CURRENT_VERSION } from "@/services/updateService";
import { isPhoneApp } from "@/lib/platform";
import {
  dismissVersion,
  fetchAppUpdate,
  getDismissedVersion,
  IDLE_UPDATE,
  nextUpdateState,
  type AppUpdateInfo,
} from "@/services/appUpdate";
import { nativeUpdater, UPDATE_DOWNLOADED_EVENT, UPDATE_ERROR_EVENT, UPDATE_PROGRESS_EVENT } from "@/services/androidUpdater";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** The last look at the published file, kept while the app runs so each visit to Today does not go online again */
let lastCheck: { at: number; info: AppUpdateInfo | null } | null = null;

// The Android app only: a phone browser running the web app updates by itself and has no APK to install
const isAndroid = () => isPhoneApp() && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");

/**
 * Android only: a new version of the app is out. The button downloads the APK inside the app (with its progress) and
 * hands it to Android's installer, where the learner confirms; the app is replaced and the data stays. Where the
 * native side is missing the APK's address is opened in the browser instead. "Để sau" puts this version off.
 */
export default function AppUpdateBanner() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(lastCheck?.info ?? null);
  const [dismissed, setDismissed] = useState(getDismissedVersion);
  const [ui, dispatch] = useReducer(nextUpdateState, IDLE_UPDATE);

  useEffect(() => {
    if (!isAndroid()) return;
    let alive = true;
    (async () => {
      if (!lastCheck || Date.now() - lastCheck.at > CHECK_EVERY_MS) {
        lastCheck = { at: Date.now(), info: await fetchAppUpdate(CURRENT_VERSION) };
      }
      if (alive) setInfo(lastCheck.info);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // The answers of the native download
  useEffect(() => {
    const onProgress = (e: Event) => dispatch({ type: "progress", percent: Number((e as CustomEvent<{ percent: number }>).detail?.percent ?? 0) });
    const onDownloaded = () => {
      dispatch({ type: "downloaded" });
      nativeUpdater()?.install();
    };
    const onError = (e: Event) => dispatch({ type: "error", message: String((e as CustomEvent<{ message: string }>).detail?.message ?? "Có lỗi khi cập nhật.") });
    window.addEventListener(UPDATE_PROGRESS_EVENT, onProgress);
    window.addEventListener(UPDATE_DOWNLOADED_EVENT, onDownloaded);
    window.addEventListener(UPDATE_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(UPDATE_PROGRESS_EVENT, onProgress);
      window.removeEventListener(UPDATE_DOWNLOADED_EVENT, onDownloaded);
      window.removeEventListener(UPDATE_ERROR_EVENT, onError);
    };
  }, []);

  if (!info || dismissed === info.version) return null;

  const update = async () => {
    const native = nativeUpdater();
    if (!native) {
      // No native side (not expected on a phone): the APK opens in the browser
      try {
        await openUrl(info.apkUrl);
      } catch {
        dispatch({ type: "error", message: `Không mở được trình duyệt. Hãy mở địa chỉ này để tải: ${info.apkUrl}` });
      }
      return;
    }
    if (!native.canInstall()) {
      dispatch({ type: "needs-permission" });
      native.openInstallSettings();
      return;
    }
    dispatch({ type: "start" });
    native.download(info.apkUrl, info.sha256);
  };

  const busy = ui.phase === "downloading";
  const label = ui.phase === "installing" ? "Cài lại" : ui.phase === "error" ? "Thử lại" : "Cập nhật";

  return (
    <div className="bar-enter rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-3 space-y-2" role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-200">Có bản mới {info.version}</p>
          {info.notes && <p className="text-xs text-violet-800 dark:text-violet-300 whitespace-pre-line">{info.notes}</p>}
        </div>
        {!busy && (
          <button
            onClick={() => {
              dismissVersion(info.version);
              setDismissed(info.version);
            }}
            aria-label="Để sau"
            title="Để sau"
            className="shrink-0 p-1 -mr-1 rounded-md text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {busy ? (
        <div className="space-y-1" aria-live="polite">
          <div className="h-2 rounded-full bg-violet-200 dark:bg-violet-900 overflow-hidden">
            <div className="h-full bg-violet-600 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${ui.percent}%` }} />
          </div>
          <p className="text-xs text-violet-900 dark:text-violet-200 inline-flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải bản mới {ui.percent}%
          </p>
        </div>
      ) : (
        <button onClick={update} className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> {label}
        </button>
      )}

      <p className="text-[11px] text-violet-800/80 dark:text-violet-300/80">
        {ui.phase === "permission"
          ? "Hãy bật \"Cho phép từ nguồn này\" cho MyEnglish trong màn hình vừa mở, rồi quay lại đây và bấm Cập nhật."
          : ui.phase === "installing"
            ? "Bấm Cài đặt trên màn hình của Android. Nếu bạn đã hủy, bấm Cài lại. Dữ liệu học của bạn được giữ nguyên."
            : ui.phase === "error"
              ? ui.message
              : busy
                ? "Đừng đóng app trong lúc tải."
                : "App tải bản mới rồi mở trình cài đặt của Android: bạn chỉ cần bấm Cài đặt. Dữ liệu học được giữ nguyên."}
      </p>
    </div>
  );
}
