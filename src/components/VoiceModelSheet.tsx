import { Download, Mic, X } from "lucide-react";
import { Button } from "./ui/kit";
import {
  cancelVoiceModelDownload,
  closeVoiceModelSheet,
  megabytes,
  startVoiceModelDownload,
  useVoiceModel,
} from "@/services/voiceModel";

const ERROR_TEXT = {
  space: "Máy không đủ chỗ trống: cần khoảng 130 MB. Xóa bớt ảnh hay app không dùng rồi thử lại.",
  network: "Không tải được. Kiểm tra mạng rồi thử lại.",
  corrupt: "File tải về bị lỗi. Thử lại nhé.",
} as const;

/** The offer to download the speech recognizer (Android, once), with its progress; see services/voiceModel */
export default function VoiceModelSheet() {
  const { open, phase, received, total, error } = useVoiceModel();
  if (!open || phase === "idle") return null;

  const percent = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Tải bộ nghe giọng">
      <div className="w-full max-w-lg rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl dark:bg-zinc-900 sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
            <Mic className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 text-base font-semibold text-slate-900 dark:text-zinc-100">Tải bộ nghe giọng</div>
          <button
            type="button"
            onClick={closeVoiceModelSheet}
            aria-label={phase === "downloading" ? "Ẩn, vẫn tải tiếp" : "Đóng"}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-base text-slate-700 dark:text-zinc-300">
          {phase === "ask" && (
            <>
              <p>Để máy nghe và chấm bạn nói, app cần tải bộ nghe giọng một lần ({megabytes(total)}).</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Tải xong thì dùng được cả khi không có mạng, và giọng bạn không gửi đi đâu. Nên dùng Wi-Fi.
              </p>
            </>
          )}
          {phase === "downloading" && (
            <>
              <p>
                Đang tải… {megabytes(received)} / {megabytes(total)}
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div className="h-full rounded-full bg-teal-600 transition-[width] dark:bg-teal-400" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400">Bạn có thể ẩn bảng này và học tiếp, app vẫn tải.</p>
            </>
          )}
          {phase === "failed" && error && (
            <p className="rounded-xl bg-red-50 p-3 text-red-800 dark:bg-red-500/10 dark:text-red-200" role="alert">
              {ERROR_TEXT[error]}
            </p>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800">
          {phase === "downloading" ? (
            <Button block size="lg" variant="secondary" onClick={cancelVoiceModelDownload}>
              Dừng tải
            </Button>
          ) : (
            <>
              <Button size="lg" variant="ghost" onClick={closeVoiceModelSheet}>
                Để sau
              </Button>
              <Button block size="lg" onClick={startVoiceModelDownload}>
                <Download className="h-5 w-5" />
                {phase === "failed" ? "Thử lại" : "Tải"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
