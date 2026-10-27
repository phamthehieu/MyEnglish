import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CURRENT_VERSION } from "@/services/updateService";
import { dismissVersion, fetchAppUpdate, getDismissedVersion, type AppUpdateInfo } from "@/services/appUpdate";

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
/** The last look at the published file, kept while the app runs so each visit to Today does not go online again */
let lastCheck: { at: number; info: AppUpdateInfo | null } | null = null;

const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");

/**
 * Android only: a new version of the app is out. One button opens the APK's download in the browser; the learner opens
 * the downloaded file to install it over the app (their data stays). "Để sau" puts this version off.
 */
export default function AppUpdateBanner() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(lastCheck?.info ?? null);
  const [dismissed, setDismissed] = useState(getDismissedVersion);
  const [failed, setFailed] = useState(false);

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

  if (!info || dismissed === info.version) return null;

  const update = async () => {
    setFailed(false);
    try {
      await openUrl(info.apkUrl);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="bar-enter rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-3 space-y-2" role="status">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-900 dark:text-violet-200">Có bản mới {info.version}</p>
          {info.notes && <p className="text-xs text-violet-800 dark:text-violet-300 whitespace-pre-line">{info.notes}</p>}
        </div>
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
      </div>
      <button onClick={update} className="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2">
        <Download className="w-4 h-4" /> Cập nhật
      </button>
      <p className="text-[11px] text-violet-800/80 dark:text-violet-300/80">
        {failed
          ? `Không mở được trình duyệt. Hãy mở địa chỉ này để tải: ${info.apkUrl}`
          : "Tải xong, mở file vừa tải để cài đè. Dữ liệu học của bạn được giữ nguyên. Lần đầu, Android có thể hỏi cho phép cài từ trình duyệt."}
      </p>
    </div>
  );
}
