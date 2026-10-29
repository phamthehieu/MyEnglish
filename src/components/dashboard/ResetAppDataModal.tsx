import { useState, useEffect } from "react";
import { AlertTriangle, RotateCcw, Loader2, CheckCircle2, X } from "lucide-react";
import { resetAllAppData } from "@/services/appReset";
import { useAuthStore } from "@/stores/authStore";

interface ResetAppDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResetAppDataModal({ isOpen, onClose }: ResetAppDataModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetStage, setResetStage] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const signedIn = useAuthStore((state) => !!state.user);

  // Reset form states when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setConfirmed(false);
      setIsResetting(false);
      setResetStage("");
      setIsSuccess(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss (only when not resetting)
  useEffect(() => {
    if (!isOpen || isResetting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isResetting, onClose]);

  if (!isOpen) return null;

  const handleConfirmReset = async () => {
    if (!confirmed || isResetting) return;

    setIsResetting(true);
    setErrorMsg(null);

    try {
      const ok = await resetAllAppData({
        onProgress: (stage) => setResetStage(stage),
      });

      if (ok) {
        setIsSuccess(true);
        setResetStage("Đặt lại thành công! Đang khởi động lại ứng dụng...");
        setTimeout(() => {
          if (typeof window !== "undefined" && typeof window.location?.reload === "function") {
            window.location.reload();
          }
        }, 800);
      } else {
        setErrorMsg("Không thể hoàn tất việc đặt lại dữ liệu. Vui lòng thử lại sau.");
        setIsResetting(false);
      }
    } catch (err) {
      console.error("Reset data error:", err);
      setErrorMsg(`Đã xảy ra lỗi: ${err instanceof Error ? err.message : String(err)}`);
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-300 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Đặt lại toàn bộ dữ liệu ứng dụng
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Cài mới hoàn toàn và bắt đầu lại từ đầu
              </p>
            </div>
          </div>
          {!isResetting && !isSuccess && (
            <button
              onClick={onClose}
              aria-label="Đóng"
              className="w-11 h-11 -m-1 shrink-0 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Warning & Info card */}
        <div className="rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
          <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-300" />
            <span>Hành động này không thể hoàn tác! Những gì sẽ diễn ra:</span>
          </div>

          <ul className="space-y-2 pl-1">
            <li className="flex items-start gap-2">
              <span className="text-red-600 font-bold">•</span>
              <span>
                <strong>Xóa toàn bộ quá trình học:</strong> Toàn bộ từ vựng đã thêm, lịch sử ôn tập, ghi nhận lỗi sai, điểm kinh nghiệm (XP) và chuỗi ngày học liên tiếp sẽ bị xóa sạch. Nếu muốn giữ lại, hãy sao lưu dữ liệu trước.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 font-bold">•</span>
              <span>
                <strong>Nạp lại dữ liệu gốc:</strong> Tự động import lại 5.000 từ vựng Oxford (A1–C1) và trọn bộ 31 chương ngữ pháp chuẩn.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-slate-400 font-bold">•</span>
              <span>
                <strong>Trở về màn khảo sát ban đầu:</strong> Bạn sẽ được chọn lại trình độ hiện tại, thì tiếng Anh bắt đầu học (mặc định thì hiện tại đơn cho người mất gốc) và kế hoạch học mỗi ngày.
              </span>
            </li>
            {signedIn && (
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">•</span>
                <span>
                  <strong>Xóa luôn bản đồng bộ trên tài khoản:</strong> tiến trình, XP và vị trí trên bảng xếp hạng của tài khoản cũng bị xóa (nếu không, lần đồng bộ sau sẽ tải lại). Cần có mạng. Tài khoản đăng nhập vẫn được giữ.
                </span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-slate-400 font-bold">•</span>
              <span>
                <strong>Giữ lại cài đặt giao diện:</strong> Chế độ hiển thị (Sáng/Tối) và cỡ chữ vẫn được giữ nguyên.
              </span>
            </li>
          </ul>
        </div>

        {/* Status / Stage indicator while resetting */}
        {(isResetting || isSuccess) && (
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 flex items-center gap-3">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 animate-in zoom-in-50 duration-200" />
            ) : (
              <Loader2 className="w-5 h-5 text-slate-500 dark:text-zinc-400 animate-spin shrink-0" />
            )}
            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
              {resetStage || "Đang xử lý đặt lại dữ liệu..."}
            </span>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 font-medium">
            {errorMsg}
          </div>
        )}

        {/* Checkbox confirmation */}
        {!isResetting && !isSuccess && (
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-5 h-5 shrink-0 rounded border-slate-300 accent-red-600 dark:border-zinc-700"
            />
            <span className="text-sm text-slate-700 dark:text-zinc-300 font-medium leading-snug">
              Tôi hiểu rằng toàn bộ tiến độ và lịch sử học tập sẽ bị xóa vĩnh viễn, ứng dụng sẽ coi như cài mới hoàn toàn.
            </span>
          </label>
        )}

        {/* Footer buttons */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting || isSuccess}
            className="min-h-12 px-5 py-2.5 rounded-2xl border border-teal-700/30 dark:border-teal-400/40 bg-white dark:bg-transparent text-base font-semibold text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-400/10 disabled:opacity-50 transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={!confirmed || isResetting || isSuccess}
            className="min-h-12 px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đặt lại...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>Xác nhận đặt lại & Bắt đầu lại</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
