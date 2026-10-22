import { useState } from "react";
import { Sparkles, RefreshCw, Plus, X, Flame, Target, Loader2, Zap, Crosshair, BellOff, Menu } from "lucide-react";
import type { calculateStreakAndGoal } from "@/services/streak";
import { triggerAutoReplenish } from "@/services/autoReplenish";
import { useWordsStore } from "@/stores/wordsStore";
import type { GlobalToastData } from "./DashboardBanners";
import { navGroupOf, type DashboardTab } from "./shared";
import { AI_VOCAB_ENABLED } from "@/services/features";
import type { TodayWork } from "@/services/smartReview";
import { vocabDetail } from "./todayPlan";
import { useReminderSnooze } from "@/hooks/useReminderSnooze";
import { snoozeEndText } from "@/services/reminderSettings";
import { canDrawOverlays, requestOverlayPermission } from "@/services/mobileReminders";

interface DashboardHeaderProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  streakStats: ReturnType<typeof calculateStreakAndGoal>;
  dueCount: number;
  todayWork?: TodayWork;
  effectiveLevel: string;
  setGlobalToast: (toast: GlobalToastData | null) => void;
  onStartReview?: () => void;
  /** A review session is in progress (maybe kept behind another tab): the button goes back to it */
  isReviewing?: boolean;
  /** Simple mode: a small bar under the header switches between the tabs of the current sidebar entry */
  simpleMode?: boolean;
  /** Start a focus session (the last chosen length), from any tab */
  onStartFocus?: () => void;
  /** "Từ hay quên": how many words, and how many of them are due (count on its tab in simple mode) */
  forgottenCount?: number;
  forgottenDue?: number;
}

/** Top App Bar: search, reminder snooze chip, streak indicator, view toggle, refresh, auto-replenish, focus, review, add word */
export default function DashboardHeader({
  activeTab,
  setActiveTab,
  streakStats,
  dueCount,
  todayWork,
  effectiveLevel,
  setGlobalToast,
  onStartReview,
  isReviewing = false,
  simpleMode = false,
  onStartFocus,
  forgottenCount = 0,
  forgottenDue = 0,
}: DashboardHeaderProps) {
  const loading = useWordsStore((s) => s.loading);
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const [isQuickReplenishing, setIsQuickReplenishing] = useState(false);
  const snooze = useReminderSnooze();
  const isMobile = typeof window !== "undefined" && !!(window as any).AndroidReminders;
  const [showOverlayPrompt, setShowOverlayPrompt] = useState(() => isMobile && !canDrawOverlays());

  const handleQuickReplenish = async () => {
    if (isQuickReplenishing) return;
    setIsQuickReplenishing(true);
    try {
      const res = await triggerAutoReplenish(useWordsStore.getState().words, true);
      if (res.success) {
        refreshWords();
      } else {
        setGlobalToast({
          title: "Thông báo sinh bài học AI",
          body: res.message,
        });
      }
    } catch (err) {
      setGlobalToast({
        title: "Lỗi kết nối Gemini CLI",
        body: "Không thể gọi Gemini CLI để sinh bài học mới. Vui lòng kiểm tra lại CLI binary.",
      });
    } finally {
      setIsQuickReplenishing(false);
    }
  };

  // Simple mode groups several tabs under one sidebar entry: their bar is hidden during a session on screen
  const group = simpleMode ? navGroupOf(activeTab) : null;
  const subTabs = group && group.tabs.length > 1 && !(isReviewing && activeTab === "review") ? group.tabs : null;

  return (
    <>
    <header className="min-h-14 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:pt-2 border-b border-slate-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/40 px-3 md:px-6 flex items-center justify-between gap-3 shrink-0 backdrop-blur-md">
      {/* Phones: opens the sidebar drawer */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("myenglish-toggle-nav"))}
        aria-label="Mở menu"
        className="md:hidden shrink-0 p-2 -ml-1 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Center: Streak & Daily Goal Indicator */}
      <div className="flex-1 min-w-0 flex items-center">
        <button
          onClick={() => setActiveTab("analytics")}
          title={`Chuỗi: ${streakStats.currentStreak} ngày • Hôm nay: ${streakStats.todayCount}/${streakStats.dailyGoal} câu (bấm để xem tiến độ)`}
          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-xs transition-colors shadow-sm shrink-0"
        >
          <div className="flex items-center gap-1 font-mono font-bold text-orange-600 dark:text-orange-400">
            <Flame className="w-3.5 h-3.5" />
            <span>{streakStats.currentStreak}</span>
          </div>
          <div className="w-[1px] h-3 bg-slate-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-zinc-300">
            <Target className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span>
              {streakStats.todayCount}/{streakStats.dailyGoal}
            </span>
            {streakStats.goalReached && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            )}
          </div>
        </button>
      </div>

      {/* Right Header Controls: strictly 1 row on mobile and desktop without staircase wrapping */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
        {/* Reminders snoozed (corner reminder, popup or tray): until when, and undo in one click */}
        {snooze.snoozedUntil && (
          <div
            role="status"
            title={`Nhắc học đang hoãn đến ${snoozeEndText(snooze.snoozedUntil)} (còn ${Math.max(1, Math.ceil((snooze.snoozedUntil - Date.now()) / 60_000))} phút)`}
            className="inline-flex items-center rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 shadow-sm shrink-0"
          >
            <span className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1">
              <BellOff className="w-3.5 h-3.5 shrink-0" />
              <span className={activeTab === "library" ? "hidden 2xl:inline" : "hidden lg:inline"}>Hoãn nhắc đến</span>
              <span className="font-mono font-semibold">{snoozeEndText(snooze.snoozedUntil)}</span>
            </span>
            <button
              type="button"
              onClick={snooze.cancel}
              title="Hủy hoãn: nhắc học lại như bình thường"
              aria-label="Hủy hoãn nhắc học"
              className="self-stretch inline-flex items-center gap-1 px-2 border-l border-amber-200 dark:border-amber-800/60 rounded-r-lg font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
            >
              <X className="w-3 h-3" />
              <span className={activeTab === "library" ? "hidden 2xl:inline" : "hidden md:inline"}>Hủy hoãn</span>
            </button>
          </div>
        )}

        {/* Refresh: only over the word list (words refresh on their own; it gives its room up in a narrow window) */}
        {activeTab === "library" && (
        <button
          onClick={() => refreshWords({ showLoading: true })}
          disabled={loading}
          title="Tải lại danh sách từ"
          className={`hidden xl:inline-flex p-1.5 rounded-lg border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shadow-sm shrink-0`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""}`} />
        </button>
        )}

        {/* Quick Auto-Replenish Button (needs the AI CLI: word library and capture only) */}
        {AI_VOCAB_ENABLED && (activeTab === "library" || activeTab === "capture") && (
        <button
          onClick={handleQuickReplenish}
          disabled={isQuickReplenishing}
          title={`Tự động sinh 3 từ vựng & bài tập ngữ pháp chuẩn cấp độ ${effectiveLevel}`}
          className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
        >
          {isQuickReplenishing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Đang sinh...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              <span className="hidden sm:inline">Gợi ý 3 từ (AI)</span>
            </>
          )}
        </button>
        )}

        {/* Focus session from any tab (the Today screen has its own focus card) */}
        {onStartFocus && !isReviewing && activeTab !== "today" && (
          <button
            onClick={onStartFocus}
            title="Phiên tập trung: học trọn vài phút, ẩn mọi thứ khác và tắt nhắc nhở"
            className="inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-sm shadow-violet-600/30 transition-all active:scale-95 shrink-0"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tập trung</span>
          </button>
        )}

        {/* Quick Review Button (the Today screen has its own, single main button). During a session it only
            goes back to it: starting another one would restart from card 0 and grade cards twice. */}
        {onStartReview && activeTab !== "today" && !(isReviewing && activeTab === "review") && (
          <button
            onClick={isReviewing ? () => setActiveTab("review") : onStartReview}
            title={
              isReviewing
                ? "Quay lại buổi học đang làm dở"
                : dueCount > 0
                  ? todayWork
                    ? `Học nhanh ${dueCount} thẻ (${vocabDetail(todayWork.reviews, todayWork.newToday)})`
                    : `Học nhanh ${dueCount} thẻ`
                  : "Bắt đầu buổi ôn tập nhanh (Flashcards & Bài tập)"
            }
            className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 shrink-0"
          >
            <Zap className="w-3.5 h-3.5 fill-white text-white" />
            <span className="hidden sm:inline">{isReviewing ? "Tiếp tục ôn" : "Ôn tập ngay"}</span>
            {isReviewing ? null : dueCount > 0 ? (
              <span className="text-[10px] bg-black/25 text-white px-1.5 py-0.5 rounded font-mono font-bold leading-none">
                {dueCount}
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
            )}
          </button>
        )}

        {/* Add Word Button */}
        {activeTab === "library" && (
        <button
          onClick={() => setActiveTab("capture")}
          title={AI_VOCAB_ENABLED ? "Thêm từ mới" : "Tìm một từ trong bộ Oxford để học sớm"}
          className="inline-flex items-center justify-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-sm transition-all shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{AI_VOCAB_ENABLED ? "Thêm từ" : "Từ Oxford"}</span>
        </button>
        )}
      </div>
    </header>
 
    {/* Android: Notice if Display over other apps permission is not yet granted */}
    {showOverlayPrompt && (
      <div className="bg-amber-500/10 border-b border-amber-500/25 px-3 md:px-6 py-2 flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 min-w-0">
          <span className="text-base shrink-0">🦉</span>
          <span className="truncate">
            Cần quyền <b>Xuất hiện trên cùng</b> để nhận popup nhắc khi dùng app khác
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              requestOverlayPermission();
              setTimeout(() => setShowOverlayPrompt(!canDrawOverlays()), 1500);
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-medium text-[11px] transition whitespace-nowrap shadow-sm"
          >
            Cấp quyền
          </button>
          <button
            type="button"
            onClick={() => setShowOverlayPrompt(false)}
            aria-label="Đóng thông báo"
            className="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )}

    {/* Simple mode: the tabs of the current sidebar entry (e.g. Ôn tập · Từ đã học · Lộ trình từ vựng) */}
    {group && subTabs && (
      <div className="h-10 shrink-0 border-b border-slate-200 dark:border-zinc-800/80 bg-white/60 dark:bg-zinc-900/30 px-3 md:px-6 flex items-center overflow-x-auto scrollbar-none gap-2">
        <div
          role="tablist"
          aria-label={group.label}
          className="inline-flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800 shrink-0"
        >
          {subTabs.map((t) => {
            const selected = t.tab === activeTab;
            return (
              <button
                key={t.tab}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(t.tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${selected
                  ? "bg-white dark:bg-zinc-800 text-cyan-700 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-transparent"
                  : "border border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                  }`}
              >
                <span>{t.label}</span>
                {t.tab === "review" && dueCount > 0 && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400">
                    {dueCount}
                  </span>
                )}
                {t.tab === "forgotten" && forgottenCount > 0 && (
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 rounded-full ${
                      forgottenDue > 0
                        ? "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400"
                        : "bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    {forgottenCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    )}
    </>
  );
}
