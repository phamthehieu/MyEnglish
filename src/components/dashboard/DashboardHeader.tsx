import { useState } from "react";
import { Sparkles, RefreshCw, Plus, X, Flame, Loader2, Zap, Crosshair, BellOff, UserRound } from "lucide-react";
import type { calculateStreakAndGoal } from "@/services/streak";
import { triggerAutoReplenish } from "@/services/autoReplenish";
import { useWordsStore } from "@/stores/wordsStore";
import { useAuthStore } from "@/stores/authStore";
import Avatar from "../Avatar";
import { SubTabs } from "../ui/kit";
import type { GlobalToastData } from "./DashboardBanners";
import { navSectionOf, type DashboardTab } from "./shared";
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
  /** Start a focus session (the last chosen length), from any tab */
  onStartFocus?: () => void;
  /** "Từ hay quên": how many words, and how many of them are due (count on its tab) */
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
  onStartFocus,
  forgottenCount = 0,
  forgottenDue = 0,
}: DashboardHeaderProps) {
  const loading = useWordsStore((s) => s.loading);
  const refreshWords = useWordsStore((s) => s.refreshWords);
  const accountUser = useAuthStore((s) => s.user);
  const accountName = useAuthStore((s) => s.profile?.displayName);
  const accountAvatar = useAuthStore((s) => s.profile?.avatar);
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
          title: "Chưa thêm được từ mới",
          body: res.message,
        });
      }
    } catch (err) {
      setGlobalToast({
        title: "Chưa gợi ý được từ mới",
        body: "Không kết nối được AI để gợi ý từ mới. Vào Cài đặt kiểm tra phần AI (khóa Gemini), rồi thử lại.",
      });
    } finally {
      setIsQuickReplenishing(false);
    }
  };

  // The tabs of the current section, as chips under the header (hidden while a review session is on screen)
  const section = navSectionOf(activeTab);
  const inSession = isReviewing && activeTab === "review";
  const subTabs = section.tabs.length > 1 && !inSession ? section.tabs : null;
  const countChip = (n: number, tone: "amber" | "red" | "neutral") =>
    n > 0 ? (
      <span
        className={`min-w-5 px-1.5 rounded-full text-xs font-bold text-center ${
          tone === "amber" ? "bg-amber-500 text-white" : tone === "red" ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200"
        }`}
      >
        {n}
      </span>
    ) : undefined;

  return (
    <>
    <header className="min-h-14 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:pt-2 border-b border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 px-4 md:px-6 flex items-center justify-between gap-3 shrink-0">
      {/* The section's name; on a computer the sidebar shows it, so the name is the tab's */}
      <h1 className="flex-1 min-w-0 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">{section.label}</h1>

      {/* Right Header Controls: strictly 1 row on mobile and desktop without staircase wrapping */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
        {/* Reminders snoozed (corner reminder, popup or tray): until when, and undo in one click */}
        {snooze.snoozedUntil && (
          <div
            role="status"
            title={`Nhắc học đang hoãn đến ${snoozeEndText(snooze.snoozedUntil)} (còn ${Math.max(1, Math.ceil((snooze.snoozedUntil - Date.now()) / 60_000))} phút)`}
            className="inline-flex items-center min-h-10 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 shadow-sm shrink-0"
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
              className="self-stretch min-h-10 min-w-10 justify-center inline-flex items-center gap-1 px-2 border-l border-amber-200 dark:border-amber-800/60 rounded-r-lg font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
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
          className={`hidden xl:inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shadow-sm shrink-0`}
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
          className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 px-2 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
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

        {/* One main action per tab. Words due (or a session kept behind this tab): "Ôn tập". Nothing due: a focus session.
            The Today screen has its own buttons. */}
        {onStartFocus && !isReviewing && dueCount === 0 && activeTab !== "today" && (
          <button
            onClick={onStartFocus}
            title="Phiên tập trung: học trọn vài phút, ẩn mọi thứ khác và tắt nhắc nhở"
            className="hidden sm:inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 text-sm font-semibold transition-colors shrink-0"
          >
            <Crosshair className="w-4 h-4" />
            <span>Tập trung</span>
          </button>
        )}

        {/* Quick Review Button (the Today screen has its own, single main button). During a session it only
            goes back to it: starting another one would restart from card 0 and grade cards twice. Only while
            something is due or a session waits: otherwise the focus button above is the one action. */}
        {onStartReview && activeTab !== "today" && activeTab !== "review" && (isReviewing || dueCount > 0) && (
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
            className="inline-flex items-center justify-center gap-1.5 min-h-10 px-3 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-semibold shadow-sm transition-colors shrink-0"
          >
            <Zap className="w-4 h-4" />
            <span>
              {isReviewing ? "Tiếp tục ôn" : "Ôn tập"}
              {!isReviewing && <span className="hidden sm:inline"> ngay</span>}
            </span>
            {!isReviewing && (
              <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                {dueCount}
              </span>
            )}
          </button>
        )}

        {/* Add Word Button */}
        {activeTab === "library" && (
        <button
          onClick={() => setActiveTab("capture")}
          title={AI_VOCAB_ENABLED ? "Thêm từ mới" : "Tìm một từ trong bộ Oxford để học sớm"}
          className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-10 sm:px-3 rounded-xl border border-teal-700/30 bg-white text-teal-800 hover:bg-teal-50 dark:border-teal-400/40 dark:bg-transparent dark:text-teal-300 text-sm font-semibold transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{AI_VOCAB_ENABLED ? "Thêm từ" : "Từ Oxford"}</span>
        </button>
        )}

        {/* Streak and today's goal: one chip (opens Tiến độ) */}
        <button
          onClick={() => setActiveTab("analytics")}
          title={`Chuỗi: ${streakStats.currentStreak} ngày • Hôm nay: ${streakStats.todayCount}/${streakStats.dailyGoal} câu (bấm để xem tiến độ)`}
          aria-label={`Chuỗi ${streakStats.currentStreak} ngày, hôm nay ${streakStats.todayCount} trên ${streakStats.dailyGoal} câu. Bấm để xem tiến độ`}
          className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300 text-sm font-bold shrink-0"
        >
          <Flame className="w-4 h-4" />
          <span>{streakStats.currentStreak}</span>
          <span className="hidden sm:inline font-semibold">ngày</span>
          {streakStats.goalReached && <span className="w-1.5 h-1.5 rounded-full bg-green-600" aria-hidden="true" />}
        </button>

        {/* Phones: the account (a computer has it at the bottom of the sidebar) */}
        <button
          type="button"
          onClick={() => setActiveTab("account")}
          aria-label={accountUser ? "Tài khoản" : "Đăng nhập"}
          className="md:hidden shrink-0 w-10 h-10 inline-flex items-center justify-center rounded-full bg-teal-700 text-white overflow-hidden"
        >
          {accountUser ? <Avatar id={accountAvatar} name={accountName ?? accountUser.email} size="sm" /> : <UserRound className="w-5 h-5" />}
        </button>
      </div>
    </header>
 
    {/* Android: Notice if Display over other apps permission is not yet granted */}
    {showOverlayPrompt && (
      <div className="bg-amber-500/10 border-b border-amber-500/25 px-3 md:px-6 py-2 flex items-center justify-between gap-2 text-xs shrink-0 animate-in fade-in slide-in-from-top-1 duration-200">
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 min-w-0">
          <span className="text-base shrink-0">🦉</span>
          <span className="leading-snug">
            Cần quyền <b>Xuất hiện trên cùng</b> để nhận nhắc học khi bạn dùng app khác
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              requestOverlayPermission();
              setTimeout(() => setShowOverlayPrompt(!canDrawOverlays()), 1500);
            }}
            className="min-h-10 px-3 rounded-lg bg-amber-700 hover:bg-amber-600 active:scale-95 text-white font-semibold text-xs transition whitespace-nowrap shadow-sm"
          >
            Cấp quyền
          </button>
          <button
            type="button"
            onClick={() => setShowOverlayPrompt(false)}
            aria-label="Đóng thông báo"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-amber-800 dark:text-amber-400 hover:bg-amber-500/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )}

    {/* The tabs of the current section (e.g. Ôn tập · Kho từ · Từ hay quên · Đã biết · Lộ trình) */}
    {subTabs && (
      <div className="shrink-0 border-b border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 px-4 md:px-6 py-2">
        <SubTabs
          label={section.label}
          value={activeTab}
          onChange={setActiveTab}
          items={subTabs.map((t) => ({
            id: t.tab,
            label: t.label,
            badge: t.tab === "review" ? countChip(dueCount, "amber") : t.tab === "forgotten" ? countChip(forgottenCount, forgottenDue > 0 ? "red" : "neutral") : undefined,
          }))}
        />
      </div>
    )}
    </>
  );
}
