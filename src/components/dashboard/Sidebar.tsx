import { useEffect, useState } from "react";
import {
  BookOpen,
  Sparkles,
  X,
  Sun,
  Moon,
  Laptop,
  Check,
  RotateCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Download,
  GraduationCap,
  CalendarCheck,
  MessagesSquare,
  SpellCheck,
  CircleUserRound,
  UserRound,
} from "lucide-react";
import type { calculateStreakAndGoal } from "@/services/streak";
import { getSavedTheme, setTheme, type ThemeMode } from "@/services/theme";
import { CURRENT_VERSION, useUpdateStore } from "@/services/updateService";
import { getXPState, type XPState } from "@/services/smartReview";
import { getDueGrammarLessons } from "@/services/grammarService";
import { useAuthStore } from "@/stores/authStore";
import { RankLine } from "./RankWidgets";
import Avatar from "../Avatar";
import { NAV_SECTIONS, navSectionOf, type DashboardTab, type LibraryStats, type NavSectionId } from "./shared";

interface SidebarProps {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  dueCount: number;
  streakStats: ReturnType<typeof calculateStreakAndGoal>;
  libraryStats: LibraryStats;
}

const SECTION_ICON: Record<NavSectionId, typeof BookOpen> = {
  today: CalendarCheck,
  vocab: BookOpen,
  speak: MessagesSquare,
  grammar: SpellCheck,
  me: CircleUserRound,
};

/** The five sections: a sidebar on a computer (logo + update badge, sections, stats, account & theme), a tab bar on a phone */
export default function Sidebar({ activeTab, setActiveTab, dueCount, streakStats, libraryStats }: SidebarProps) {
  const [grammarDueCount, setGrammarDueCount] = useState<number>(0);
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(getSavedTheme);
  const [xpState, setXpState] = useState<XPState>(getXPState);
  const accountUser = useAuthStore((s) => s.user);
  const accountName = useAuthStore((s) => s.profile?.displayName);
  const accountAvatar = useAuthStore((s) => s.profile?.avatar);
  const syncStatus = useAuthStore((s) => s.sync.status);

  // Only the fields shown here: the rest of the store (the update handle, release notes) changing re-renders nothing
  const updateStatus = useUpdateStore((s) => s.status);
  const newVersion = useUpdateStore((s) => s.newVersion);
  const downloadProgress = useUpdateStore((s) => s.downloadProgress);
  const updateDismissed = useUpdateStore((s) => s.dismissed);
  const downloadAndInstall = useUpdateStore((s) => s.downloadAndInstall);
  const restartApp = useUpdateStore((s) => s.restartApp);
  const dismissUpdate = useUpdateStore((s) => s.dismiss);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const errorMessage = useUpdateStore((s) => s.errorMessage);

  const handleThemeChange = (mode: ThemeMode) => {
    setCurrentTheme(mode);
    setTheme(mode);
  };

  useEffect(() => {
    const onXPUpdate = () => setXpState(getXPState());
    window.addEventListener("myenglish-xp-updated", onXPUpdate);
    return () => window.removeEventListener("myenglish-xp-updated", onXPUpdate);
  }, []);

  useEffect(() => {
    const updateDue = () => {
      setGrammarDueCount(getDueGrammarLessons().length);
    };
    updateDue();
    window.addEventListener("myenglish-grammar-updated", updateDue);
    return () => window.removeEventListener("myenglish-grammar-updated", updateDue);
  }, []);

  useEffect(() => {
    const onThemeChanged = (e: Event) => {
      const custom = e as CustomEvent<{ mode: ThemeMode }>;
      if (custom.detail?.mode) {
        setCurrentTheme(custom.detail.mode);
      }
    };
    window.addEventListener("myenglish-theme-changed", onThemeChanged);
    return () => window.removeEventListener("myenglish-theme-changed", onThemeChanged);
  }, []);

  // What waits in a section: the cards due (Từ vựng), the grammar lessons due (Ngữ pháp)
  const waiting: Partial<Record<NavSectionId, number>> = { vocab: dueCount, grammar: grammarDueCount };
  const sections = NAV_SECTIONS.map((s) => ({ ...s, icon: SECTION_ICON[s.id], count: waiting[s.id] ?? 0, active: navSectionOf(activeTab).id === s.id }));

  // While the keyboard is up for a text box it covers the bottom of the screen: the tab bar steps aside to leave room.
  // Both are needed: closing the keyboard (Back, or swiping it down) leaves the box focused, and the bar must come back.
  const [boxFocused, setBoxFocused] = useState(false);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const typing = boxFocused && keyboardUp;
  useEffect(() => {
    let timer: number | undefined;
    const isBox = (t: EventTarget | null) => t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "range"].includes(t.type));
    const onIn = (e: FocusEvent) => {
      window.clearTimeout(timer);
      if (isBox(e.target)) setBoxFocused(true);
    };
    // A short wait: moving from one box to the next must not bring the bar back for a moment
    const onOut = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBoxFocused(false), 150);
    };
    // On Android the app shell says when the keyboard opens or closes (MainActivity: edge to edge, the page does not
    // shrink). Elsewhere the keyboard shrinks the visible height: compare with the tallest height seen at this width
    // (a turn of the phone starts over).
    // The page above the keyboard just got shorter: bring the box being typed in back into sight
    const onIme = (e: Event) => {
      const up = Number((e as CustomEvent).detail) > 80;
      setKeyboardUp(up);
      // index.css drops the room kept for this bar while the keyboard is up
      document.documentElement.toggleAttribute("data-keyboard", up);
      if (up && isBox(document.activeElement)) {
        const box = document.activeElement as HTMLElement;
        window.requestAnimationFrame(() => box.scrollIntoView({ block: "center", behavior: "smooth" }));
      }
    };
    window.addEventListener("myenglish-ime", onIme);
    const view = window.visualViewport;
    const height = () => view?.height ?? window.innerHeight;
    let width = window.innerWidth;
    let tallest = height();
    const onResize = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        tallest = height();
      }
      tallest = Math.max(tallest, height());
      setKeyboardUp(height() < tallest * 0.8);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    (view ?? window).addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      window.removeEventListener("myenglish-ime", onIme);
      (view ?? window).removeEventListener("resize", onResize);
    };
  }, []);

  const goalText =
    streakStats.goalReached && streakStats.dueRemaining === 0 && streakStats.todayCount < streakStats.dailyGoal
      ? "Đã ôn hết ✓"
      : `${streakStats.todayCount}/${streakStats.dailyGoal} câu`;

  return (
    <>
    <aside className="hidden md:flex min-h-0 w-64 border-r border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/50 flex-col shrink-0 select-none">
      {/* Logo & App title (always visible) */}
      <div className="px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-teal-700 flex items-center justify-center shadow-sm text-white font-bold">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                MyEnglish
              </h1>

              {/* Interactive Version Badge / Check Update Button */}
              {updateStatus === "checking" ? (
                <span
                  title="Đang kiểm tra..."
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 shrink-0"
                >
                  <RotateCw className="w-2.5 h-2.5 animate-spin" />
                  <span>Đang kiểm tra...</span>
                </span>
              ) : updateStatus === "up-to-date" ? (
                <span
                  title={`Bản mới nhất (v${CURRENT_VERSION})`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300/80 dark:border-emerald-700/80 text-emerald-600 dark:text-emerald-400 shrink-0 animate-in fade-in zoom-in-95 duration-200"
                >
                  <Check className="w-2.5 h-2.5" />
                  <span>Bản mới nhất</span>
                </span>
              ) : updateStatus === "error" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    checkForUpdates(true);
                  }}
                  title={errorMessage || "Lỗi kiểm tra"}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shrink-0 cursor-pointer"
                >
                  <AlertCircle className="w-2.5 h-2.5" />
                  <span>Lỗi kiểm tra</span>
                </button>
              ) : updateStatus === "available" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadAndInstall();
                  }}
                  title={`Đã có bản cập nhật mới: v${newVersion}`}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-600 text-white shadow-sm shadow-cyan-600/30 hover:bg-cyan-700 transition-all shrink-0 cursor-pointer animate-pulse [animation-iteration-count:3]"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>v{newVersion}</span>
                </button>
              ) : updateStatus === "downloading" ? (
                <span
                  title={`Đang tải... ${downloadProgress}%`}
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 shrink-0"
                >
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  <span>{downloadProgress}%</span>
                </span>
              ) : updateStatus === "downloaded" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    restartApp();
                  }}
                  title="Khởi động lại ngay để hoàn tất cập nhật"
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 hover:bg-emerald-700 transition-all shrink-0 cursor-pointer"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Khởi động lại</span>
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    checkForUpdates(true);
                  }}
                  title={`Kiểm tra bản cập nhật (v${CURRENT_VERSION})`}
                  className="group/badge inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200/60 dark:border-cyan-800/60 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/60 hover:border-cyan-300/80 dark:hover:border-cyan-700/80 active:scale-95 transition-all shrink-0 cursor-pointer"
                >
                  <span>v{CURRENT_VERSION}</span>
                  <RotateCw className="w-2.5 h-2.5 opacity-50 group-hover/badge:opacity-100 group-hover/badge:rotate-180 transition-all duration-300" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">Tiếng Anh mỗi ngày</p>
          </div>
        </div>
      </div>

      {/* Navigation + stats: scrolls when the window is short, so nothing below is ever cut off */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 space-y-3">
        {/* In-App Auto-Update Widget */}
        {!updateDismissed &&
          (updateStatus === "available" ||
            updateStatus === "downloading" ||
            updateStatus === "downloaded" ||
            updateStatus === "error") && (
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-indigo-500/5 dark:from-cyan-950/70 dark:via-blue-950/60 dark:to-zinc-900 border border-cyan-500/20 dark:border-cyan-500/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-zinc-100 min-w-0">
                  {updateStatus === "downloaded" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : updateStatus === "downloading" ? (
                    <Loader2 className="w-4 h-4 text-cyan-500 animate-spin shrink-0" />
                  ) : updateStatus === "error" ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />
                  )}
                  <span className="truncate">
                    {updateStatus === "downloaded"
                      ? "Đã cập nhật xong!"
                      : updateStatus === "downloading"
                        ? `Đang tải... ${downloadProgress}%`
                        : updateStatus === "error"
                          ? (errorMessage || "Lỗi cập nhật")
                          : `Đã có bản cập nhật mới: v${newVersion}`}
                  </span>
                </div>
                <button
                  onClick={dismissUpdate}
                  className="-m-2 w-10 h-10 inline-flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="Ẩn thông báo này"
                  aria-label="Ẩn thông báo cập nhật"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {updateStatus === "downloading" && (
                <div className="w-full bg-slate-200/80 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-cyan-600 dark:bg-cyan-500 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              )}

              {updateStatus === "available" && (
                <button
                  onClick={downloadAndInstall}
                  className="w-full py-1.5 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 active:scale-[0.98] text-white text-xs font-semibold shadow-sm shadow-cyan-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Cập nhật ngay</span>
                </button>
              )}

              {updateStatus === "downloaded" && (
                <button
                  onClick={restartApp}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Khởi động lại</span>
                </button>
              )}

              {updateStatus === "error" && (
                <button
                  onClick={downloadAndInstall}
                  className="w-full py-1 px-2 rounded-lg bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-xs text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  Thử lại
                </button>
              )}
            </div>
          )}

        {/* The five sections; a section opens its first tab */}
        <nav className="space-y-1">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.tabs[0].tab)}
                aria-current={s.active ? "page" : undefined}
                className={`w-full min-h-12 flex items-center justify-between px-3 rounded-xl text-[15px] font-semibold transition-colors ${
                  s.active
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-400/10 dark:text-teal-300"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800/50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  {s.label}
                </span>
                {s.count > 0 && (
                  <span className="min-w-6 px-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-xs font-bold text-center">
                    {s.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Compact stats: streak + today's goal, then the two word tiers (click: Tiến độ) */}
        <button
          type="button"
          onClick={() => setActiveTab("analytics")}
          title={`${streakStats.todayCount > 0 ? "Hôm nay đã giữ chuỗi ✓" : "Hôm nay chưa học: chỉ cần 1 câu là giữ được chuỗi"}${
            streakStats.freezesAvailable > 0
              ? ` • ${streakStats.freezesAvailable} lượt đóng băng chuỗi: nếu lỡ 1 ngày, chuỗi vẫn được giữ`
              : ""
          } • Bấm để xem tiến độ`}
          className="w-full text-left rounded-xl border border-slate-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-800/50 px-3 py-2.5 space-y-1.5 shadow-sm transition-colors"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-mono font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
              🔥 {streakStats.currentStreak} ngày
              {streakStats.todayCount > 0 && <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓</span>}
              {streakStats.freezesAvailable > 0 && (
                <span className="ml-1 text-sky-600 dark:text-sky-400">🧊{streakStats.freezesAvailable}</span>
              )}
            </span>
            <span
              className={`font-mono whitespace-nowrap ${streakStats.goalReached ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-600 dark:text-zinc-300"}`}
            >
              {goalText}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${streakStats.goalReached ? "bg-emerald-500" : "bg-cyan-500"}`}
              style={{ width: `${streakStats.goalPercentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-zinc-400">
            <span className="truncate">
              Đang học <span className="font-semibold text-slate-800 dark:text-zinc-200">{libraryStats.learningCount}</span>
              {" · "}
              Nhớ lâu <span className="font-semibold text-emerald-600 dark:text-emerald-400">{libraryStats.rememberedLongCount}</span>
            </span>
            <span className="shrink-0 font-mono text-amber-700 dark:text-amber-300" title={`${xpState.rank} • ${xpState.totalXP} điểm XP`}>
              {xpState.rankEmoji} Cấp {xpState.level}
            </span>
          </div>
        </button>

        {/* Weekly XP rank: one line under the streak (signed-in learners) */}
        <RankLine onOpen={() => setActiveTab("leaderboard")} />
      </div>

      {/* Account and theme on one row (always visible) */}
      <div className="p-3 border-t border-slate-200 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-900/30 flex items-center gap-2 shrink-0">
        {/* Account: sign-in, sync, leaderboard */}
        <button
          onClick={() => setActiveTab("account")}
          aria-current={activeTab === "account" ? "page" : undefined}
          title={accountUser ? `Đã đăng nhập: ${accountUser.email}` : "Đăng nhập để đồng bộ tiến trình và đua XP"}
          className={`min-w-0 flex-1 min-h-11 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border transition-colors text-left shadow-sm ${
            activeTab === "account"
              ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-700 dark:text-cyan-400"
              : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-800 dark:text-zinc-200"
          }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {accountUser ? (
              <Avatar id={accountAvatar} name={accountName ?? accountUser.email} size="sm" />
            ) : (
              <UserRound className="w-4 h-4 shrink-0" />
            )}
            <span className="text-xs font-medium truncate">
              {accountUser ? (accountName ?? accountUser.email) : "Đăng nhập"}
            </span>
          </span>
          {accountUser && (
            <span
              className={`shrink-0 w-2 h-2 rounded-full ${
                syncStatus === "error" ? "bg-rose-500" : syncStatus === "syncing" ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
              }`}
              title={syncStatus === "error" ? "Đồng bộ lỗi" : syncStatus === "syncing" ? "Đang đồng bộ" : "Đã đồng bộ"}
            />
          )}
        </button>

        {/* Theme: three icons (the names are in the tooltips) */}
        <div role="group" aria-label="Giao diện" className="shrink-0 flex items-center bg-slate-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-slate-200 dark:border-zinc-800/80">
          {(
            [
              { mode: "light", title: "Giao diện sáng", icon: Sun, on: "bg-white text-amber-600 border border-slate-200 shadow-sm" },
              { mode: "dark", title: "Giao diện tối", icon: Moon, on: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm" },
              {
                mode: "system",
                title: "Theo cài đặt của máy",
                icon: Laptop,
                on: "bg-white dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-indigo-500/40 shadow-sm",
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.mode}
                type="button"
                onClick={() => handleThemeChange(t.mode)}
                title={t.title}
                aria-label={t.title}
                aria-pressed={currentTheme === t.mode}
                className={`w-10 h-10 md:w-8 md:h-8 inline-flex items-center justify-center rounded-md transition-all ${currentTheme === t.mode
                  ? t.on
                  : "border border-transparent text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                  }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      </div>
    </aside>

    {/* Phones: bottom tab bar */}
    <nav
      aria-label="Điều hướng chính"
      className={`md:hidden fixed bottom-0 inset-x-0 z-30 flex transition-transform duration-200 ease-out motion-reduce:transition-none ${typing ? "translate-y-full pointer-events-none" : "translate-y-0"} border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pb-[env(safe-area-inset-bottom)] select-none`}
    >
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveTab(s.tabs[0].tab)}
            aria-current={s.active ? "page" : undefined}
            className={`flex-1 min-w-0 min-h-16 flex flex-col items-center justify-center gap-1 py-2 text-xs font-semibold active:bg-slate-100 dark:active:bg-zinc-800 ${
              s.active ? "text-teal-700 dark:text-teal-300" : "text-slate-500 dark:text-zinc-400"
            }`}
          >
            <span className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-colors ${s.active ? "bg-teal-50 dark:bg-teal-400/10" : ""}`}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={s.active ? 2.25 : 2} />
              {s.count > 0 && (
                <span className="absolute -top-1 right-1 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold leading-5 text-center">
                  {s.count > 99 ? "99+" : s.count}
                </span>
              )}
            </span>
            <span className="max-w-full px-0.5 text-[11.5px] leading-tight whitespace-nowrap">{s.shortLabel ?? s.label}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
}
