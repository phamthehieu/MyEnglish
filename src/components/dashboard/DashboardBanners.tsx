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
  "-mr-1 -mt-1 shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200";

/** GLOBAL NOTIFICATION INTERACTIVE TOAST */
export function GlobalToast({ globalToast, handleOpenReview, setGlobalToast }: GlobalToastProps) {
  return (
    <div
      onClick={() => handleOpenReview(false)}
      // Phones: 12px from each side and below the status bar; wide windows: the top-right corner
      className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] inset-x-3 mx-auto max-w-sm md:inset-x-auto md:right-5 md:mx-0 md:w-full z-50 bg-white dark:bg-zinc-900 border-2 border-orange-500/80 rounded-2xl shadow-2xl p-4 flex items-start gap-3 cursor-pointer hover:scale-[1.02] hover:shadow-orange-500/20 transition-all animate-in slide-in-from-top-4 duration-300 backdrop-blur-xl"
    >
      <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
        <Flame className="w-5 h-5 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{globalToast.title}</h4>
          <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold shrink-0">Ôn ngay →</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 leading-snug">{globalToast.body}</p>
        <div className="mt-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenReview(true);
            }}
            className="w-full min-h-10 py-2 px-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Mở thẻ ôn tập ngay</span>
          </button>
        </div>
      </div>
      <button
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
    <div className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] inset-x-3 mx-auto max-w-lg z-50 bg-white dark:bg-zinc-900 border-2 border-cyan-500/90 rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-top-4 duration-300 backdrop-blur-xl">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/30">
        <Sparkles className="w-5 h-5 animate-pulse" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
          🎉 Đã thêm bài học cấp độ {autoReplenishBanner.level}
        </h4>
        <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 leading-snug">
          Bạn đang học rất chăm chỉ! App vừa tự thêm <strong>{autoReplenishBanner.words.length} từ vựng mới</strong> ({autoReplenishBanner.words.join(", ")})
          {autoReplenishBanner.grammarTopic ? ` & bài tập ngữ pháp "${autoReplenishBanner.grammarTopic}"` : ""}.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("library");
              setAutoReplenishBanner(null);
            }}
            className="flex-1 min-h-10 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Xem kho từ vựng</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("analytics");
              setAutoReplenishBanner(null);
            }}
            className="min-h-10 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors"
          >
            Xem trình độ của bạn
          </button>
        </div>
      </div>
      <button onClick={() => setAutoReplenishBanner(null)} aria-label="Đóng thông báo" className={CLOSE_BUTTON}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
