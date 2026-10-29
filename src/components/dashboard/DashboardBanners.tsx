import { Sparkles, BookOpen, X, Flame } from "lucide-react";
import type { AutoReplenishSummary } from "@/services/autoReplenish";
import type { DashboardTab } from "./shared";

export interface GlobalToastData {
  title: string;
  body: string;
  target?: string;
}

interface GlobalToastProps {
  globalToast: GlobalToastData;
  handleOpenReview: (autoStartFlashcard?: boolean) => void;
  setGlobalToast: (toast: GlobalToastData | null) => void;
}

/** Close button of a banner: a 40px target in the corner */
const CLOSE_BUTTON =
  "-mr-1 -mt-1 shrink-0 w-11 h-11 inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200";

/** GLOBAL NOTIFICATION INTERACTIVE TOAST */
export function GlobalToast({ globalToast, handleOpenReview, setGlobalToast }: GlobalToastProps) {
  return (
    <div
      onClick={() => handleOpenReview(false)}
      // Phones: 12px from each side and below the status bar; wide windows: the top-right corner
      className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] inset-x-3 mx-auto max-w-sm md:inset-x-auto md:right-5 md:mx-0 md:w-full z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 flex items-start gap-3 cursor-pointer hover:border-teal-700/40 transition-colors animate-in slide-in-from-top-4 duration-300"
    >
      <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
        <Flame className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{globalToast.title}</h4>
          <span className="text-xs text-teal-700 dark:text-teal-300 font-semibold shrink-0">Ôn ngay →</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1 leading-snug">{globalToast.body}</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReview(true);
            }}
            className="w-full min-h-11 py-2 px-3 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Mở thẻ ôn tập ngay</span>
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setGlobalToast(null);
        }}
        aria-label="Đóng thông báo"
        className={CLOSE_BUTTON}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface AutoReplenishBannerProps {
  autoReplenishBanner: AutoReplenishSummary;
  setActiveTab: (tab: DashboardTab) => void;
  setAutoReplenishBanner: (banner: AutoReplenishSummary | null) => void;
}

/** SMART AUTO-REPLENISH BANNER NOTIFICATION */
export function AutoReplenishBanner({
  autoReplenishBanner,
  setActiveTab,
  setAutoReplenishBanner,
}: AutoReplenishBannerProps) {
  return (
    <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] inset-x-3 mx-auto max-w-lg z-50 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xl p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300">
      <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-400/10 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
        <Sparkles className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          🎉 Đã thêm bài học cấp độ {autoReplenishBanner.level}
        </h4>
        <p className="text-sm text-slate-600 dark:text-zinc-300 mt-1 leading-snug">
          Bạn đang học rất chăm chỉ! App vừa tự thêm <strong>{autoReplenishBanner.words.length} từ vựng mới</strong> ({autoReplenishBanner.words.join(", ")})
          {autoReplenishBanner.grammarTopic ? ` & bài tập ngữ pháp "${autoReplenishBanner.grammarTopic}"` : ""}.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("library");
              setAutoReplenishBanner(null);
            }}
            className="flex-1 min-h-11 py-2 px-3 rounded-2xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Xem kho từ vựng</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("analytics");
              setAutoReplenishBanner(null);
            }}
            className="min-h-11 py-2 px-3 rounded-2xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 dark:hover:bg-teal-400/10 font-semibold text-sm transition-colors"
          >
            Xem trình độ của bạn
          </button>
        </div>
      </div>
      <button type="button" onClick={() => setAutoReplenishBanner(null)} aria-label="Đóng thông báo" className={CLOSE_BUTTON}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
