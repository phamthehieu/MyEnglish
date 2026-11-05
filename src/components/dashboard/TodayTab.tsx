import { RankPanel, useRankPanelVisible } from "./RankWidgets";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bug, Check, ChevronDown, ChevronRight, Compass, Layers, Zap } from "lucide-react";
import { Button, Card, ProgressRing } from "../ui/kit";
import type { WordDetail } from "@/types/database";
import type { TodayWork } from "@/services/smartReview";
import { getUnmasteredWords, youngWordCap } from "@/services/smartReview";
import { getLocalDateString, type StreakStats } from "@/services/streak";
import { minutesFor, type ComebackStatus } from "@/services/comeback";
import { loadCoverage, type Coverage } from "@/services/coverage";
import { loadPronunciationLessons, nextPronunciationLesson, pronunciationPracticedToday } from "@/services/pronunciation";
import { isReflexPracticedToday } from "@/services/reflexChallenge";
import { getAllGrammarProgress, getDueGrammarLessons, initGrammarStorage } from "@/services/grammarService";
import { getTodayGrammarPlan } from "@/services/grammarPath";
import { countWordStatus, WORD_STATUS_LABELS } from "@/services/wordStatus";
import { AI_VOCAB_ENABLED } from "@/services/features";
import { canPinHomeWidget, pinHomeWidget } from "@/services/mobileReminders";
import { PAGE_CONTAINER, type DashboardTab } from "./shared";
import { useAuthStore } from "@/stores/authStore";
import {
  buildTodayTasks,
  cardsLaterToday,
  chosenDailyMinutes,
  coverageGain,
  pickNextStep,
  primaryTask,
  coreTasks,
  quickStartMode,
  readCoverageBaseline,
  saveCoverageBaseline,
  type TodayTask,
  type TodayTaskInput,
} from "./todayPlan";
import TodayChecklist from "./TodayChecklist";
import DayCloseCard from "./DayCloseCard";
import { FeedbackDialog } from "./FeedbackForm";
import { isCloudConfigured } from "@/services/supabase";
import StudyLevelBar from "./StudyLevelBar";
import AppUpdateBanner from "./AppUpdateBanner";
import InstallAppCard from "./InstallAppCard";
import RoadmapTodayCard from "../roadmap/RoadmapTodayCard";
import { useRoadmap } from "../roadmap/useRoadmap";
import { PATTERNS } from "@/data/patterns";
import { planFlow, startFlow } from "@/services/dayFlow";
import { runTodayTask, weakGrammarTask } from "./runTask";
import { dueLines } from "@/services/talk/review";
import { getLine } from "@/data/situations";
import { TALK_UPDATED_EVENT } from "@/services/talk/progress";
import { WEAK_POINTS_EVENT } from "@/services/weakPoints";
import { practicedToday } from "@/services/learningLinks";
import DailyQuestsCard from "./DailyQuestsCard";
import { FOCUS_SETTINGS_EVENT, getFocusSettings, nextReviewPeek } from "@/services/focusSession";
import { nextReviewText } from "@/services/dayClose";

interface TodayTabProps {
  words: WordDetail[];
  todayWork: TodayWork;
  comeback: ComebackStatus | null;
  streakStats: StreakStats;
  onStart: () => void;
  /** The 3-card mini session ("Chỉ 1 phút") */
  onQuickStart: () => void;
  /** Timed focus session (minutes) */
  onStartFocus?: (minutes: number) => void;
  onStartReflex?: () => void;
  /** Words often forgotten that are due now: a hint to review them apart from 3 on */
  forgottenDue?: number;
  setActiveTab: (tab: DashboardTab) => void;
  /** Opens a lesson of the grammar book (the grammar the learner keeps missing) */
  openGrammarLesson?: (lessonId: string) => void;
  /** Words still loading: no "done" state yet */
  loading?: boolean;
  simpleMode?: boolean;
  /** Fixed clock for previews */
  now?: Date;
}

/** From this many words often forgotten due now, Today points to their own section */
const FORGOTTEN_HINT_MIN = 3;

function greeting(hour: number, name?: string | null): string {
  const base = hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const clean = name?.trim();
  return clean ? `${base}, ${clean} 👋` : `${base} 👋`;
}

/** Minutes for today's words: a new word costs an introduction and a quiz, about two reviews */
function todayMinutes(work: TodayWork): number {
  return minutesFor(work.reviews + work.newToday * 2);
}

/**
 * Redesigned Mobile-First Today Screen:
 * 1. Unified Hero Overview Card (Greeting + Active Level Pill + Daily Goal Ring + 3-Metric Glass Strip)
 * 2. Primary Action Checklist (`TodayChecklist` / `DayCloseCard`)
 * 3. Balanced 2-Column Quick Utility Grid (`Luyện phản xạ` + `Ghim Widget`)
 * 4. Collapsible Quests & Leaderboard section
 */
export default function TodayTab({
  words,
  todayWork,
  comeback,
  streakStats,
  onStart,
  onQuickStart,
  onStartFocus,
  onStartReflex,
  forgottenDue = 0,
  setActiveTab,
  openGrammarLesson,
  loading = false,
  simpleMode = false,
  now: fixedNow,
}: TodayTabProps) {
  const now = fixedNow ?? new Date();
  const today = getLocalDateString(now);
  const signedIn = useAuthStore((s) => s.user != null);
  const displayName = useAuthStore((s) => s.profile?.displayName);
  const showRank = useRankPanelVisible();
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [pron, setPron] = useState<TodayTaskInput["pronunciation"]>(null);
  const [grammar, setGrammar] = useState<TodayTaskInput["grammar"]>(null);
  const [reflexDone, setReflexDone] = useState(() => isReflexPracticedToday(now));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const closeFeedback = useCallback(() => setFeedbackOpen(false), []);

  useEffect(() => {
    const onReflexUpdate = () => setReflexDone(isReflexPracticedToday(fixedNow ?? new Date()));
    window.addEventListener("myenglish-reflex-updated", onReflexUpdate);
    return () => window.removeEventListener("myenglish-reflex-updated", onReflexUpdate);
  }, [fixedNow]);

  const [focusMinutes, setFocusMinutes] = useState(() => getFocusSettings().minutes);
  useEffect(() => {
    const onChange = () => setFocusMinutes(getFocusSettings().minutes);
    window.addEventListener(FOCUS_SETTINGS_EVENT, onChange);
    return () => window.removeEventListener(FOCUS_SETTINGS_EVENT, onChange);
  }, []);

  useEffect(() => {
    loadCoverage(words).then(setCoverage).catch(() => setCoverage(null));
  }, [words]);

  useEffect(() => {
    const load = () => {
      const at = fixedNow ?? new Date();
      loadPronunciationLessons()
        .then((lessons) => {
          const next = nextPronunciationLesson(lessons);
          const doneToday = pronunciationPracticedToday(at);
          setPron(next || doneToday ? { doneToday, lessonTitle: next?.title ?? null } : null);
        })
        .catch(() => setPron(null));
      initGrammarStorage()
        .then(() => getTodayGrammarPlan(at))
        .then((plan) => {
          if (plan.pathLength === 0) return setGrammar(null);
          const day = getLocalDateString(at);
          const studiedToday =
            plan.newLessonDoneToday ||
            Object.values(getAllGrammarProgress()).some((p) => !!p.lastAttemptDate && getLocalDateString(new Date(p.lastAttemptDate)) === day);
          setGrammar({
            due: getDueGrammarLessons(at).length,
            studiedToday,
            nextTitle: plan.nextLesson && !plan.newLessonDoneToday ? plan.nextLesson.titleVn || plan.nextLesson.title : null,
            relearnTitle: plan.relearn ? plan.relearn.titleVn || plan.relearn.title : null,
          });
        })
        .catch(() => setGrammar(null));
    };
    load();
    window.addEventListener("myenglish-pronunciation-updated", load);
    window.addEventListener("myenglish-grammar-updated", load);
    return () => {
      window.removeEventListener("myenglish-pronunciation-updated", load);
      window.removeEventListener("myenglish-grammar-updated", load);
    };
  }, [streakStats.todayCount, fixedNow]);

  const status = useMemo(() => countWordStatus(words), [words]);
  const hasStudied = useMemo(() => words.some((w) => (w.srs?.reps ?? 0) > 0 || (w.srs?.state ?? 0) > 0), [words]);
  const unmasteredCount = useMemo(() => getUnmasteredWords(words).length, [words]);
  const laterToday = useMemo(() => cardsLaterToday(words, now), [words, todayWork.total]);
  const nextReview = useMemo(() => nextReviewPeek(words, now), [words, todayWork.total]);

  const [baseline, setBaseline] = useState(readCoverageBaseline);
  useEffect(() => {
    if (!coverage || loading || baseline) return;
    const first = { percent: coverage.percent, day: today };
    saveCoverageBaseline(first);
    setBaseline(first);
  }, [coverage, loading, baseline, today]);
  const gain = coverage ? coverageGain(coverage.percent, baseline) : null;

  const inComeback = !!comeback && !comeback.caughtUp;
  const [linksTick, setLinksTick] = useState(0);
  useEffect(() => {
    const bump = () => setLinksTick((t) => t + 1);
    window.addEventListener(TALK_UPDATED_EVENT, bump);
    window.addEventListener(WEAK_POINTS_EVENT, bump);
    return () => {
      window.removeEventListener(TALK_UPDATED_EVENT, bump);
      window.removeEventListener(WEAK_POINTS_EVENT, bump);
    };
  }, []);

  const talkDue = useMemo(() => dueLines(now).filter((id) => !!getLine(id)).length, [linksTick, today]);
  const weak = useMemo(() => weakGrammarTask(now), [linksTick, today]);
  const path = useRoadmap();
  const speaking: TodayTaskInput["speaking"] = !PATTERNS.length
    ? null
    : path.road.goal === null
      ? { title: "Chọn mục tiêu cho lộ trình nói", detail: "Du lịch, đi làm, đời sống hay kết bạn", minutes: 1, done: false }
      : path.current && path.plan
        ? {
            title: `Lộ trình nói: ${path.current.title}`,
            detail:
              path.plan.tasks.length > 0
                ? `Chặng ${path.stages.indexOf(path.current) + 1}/${path.stages.length} · ${path.plan.tasks.length} phần hôm nay`
                : "Xong phần hôm nay, phần tiếp theo vào ngày mai",
            minutes: path.plan.tasks.length > 0 ? path.plan.minutes : 0,
            done: path.plan.tasks.length === 0,
            onPath: true,
          }
        : null;
  const tasks = buildTodayTasks({
    speaking,
    talkReview: { due: talkDue },
    weakGrammar: weak,
    minutes: chosenDailyMinutes(streakStats.dailyGoal),
    vocab: {
      reviews: todayWork.reviews,
      newToday: todayWork.newToday,
      minutes: todayMinutes(todayWork),
      comebackDay: inComeback ? comeback.dayNumber : null,
    },
    grammar,
    pronunciation: pron,
    reflex: onStartReflex ? { doneToday: reflexDone } : null,
  });
  const primary = primaryTask(tasks);
  const empty = !loading && todayWork.total === 0 && !hasStudied;
  const quickMode = quickStartMode({
    goalReached: streakStats.goalReached,
    todayCount: streakStats.todayCount,
    hour: now.getHours(),
    canStudy: todayWork.total > 0 || hasStudied,
  });

  const runDeps = { setActiveTab, startWords: onStart, startReflex: onStartReflex, openGrammarLesson };
  const run = (task: TodayTask) => runTodayTask(task.id, runDeps);
  const startFlowNow = () => {
    const queue = planFlow(coreTasks(tasks));
    if (startFlow(queue)) runTodayTask(queue[0], runDeps);
  };
  const isCapped = unmasteredCount >= youngWordCap();
  const more = {
    label: inComeback ? "Ôn thêm thẻ tồn" : isCapped ? `Ôn từ đang học (${unmasteredCount})` : "Học thêm từ mới",
    onClick: onStart,
  };
  const pathLabel = AI_VOCAB_ENABLED ? "Thêm từ bằng AI" : "Bộ từ theo cấp độ";

  const showQuests = !loading && !empty;
  const twoColumns = showQuests || showRank || !!onStartReflex;
  const [moreOpen, setMoreOpen] = useState(false);
  const [showWidgetPin, setShowWidgetPin] = useState(() => canPinHomeWidget());
  const moreClass = moreOpen ? "" : "hidden min-[1000px]:block";

  return (
    <div className={PAGE_CONTAINER}>
      <div className="space-y-4">
        {/* 1. Unified Hero Overview Card (Greeting + Level Selector + Daily Goal Ring + 3 Key Metrics) */}
        <section
          aria-label="Tổng quan hôm nay"
          className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-[#2B1B64] via-[#1E1B4B] to-[#0F172A] p-4 text-white shadow-lg sm:p-6"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 left-1/4 h-40 w-40 rounded-full bg-teal-500/15 blur-3xl" />

          <div className="relative space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-medium text-indigo-200/85 first-letter:uppercase">
                  {now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <h2 className="text-xl font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                  {greeting(now.getHours(), signedIn ? displayName : null)}
                </h2>
                {!loading && (
                  <div className="pt-0.5">
                    <StudyLevelBar variant="hero-pill" />
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("analytics")}
                title="Mục tiêu hôm nay (bấm để xem tiến độ)"
                className="flex shrink-0 items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 py-2 pl-2 pr-3.5 text-left backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <ProgressRing value={streakStats.goalPercentage} size={38} stroke={4} done={streakStats.goalReached}>
                  {streakStats.goalReached ? (
                    <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                  ) : (
                    <span className="text-[10px] font-extrabold text-teal-300">{streakStats.goalPercentage}%</span>
                  )}
                </ProgressRing>
                <span className="leading-tight">
                  <span className="block text-sm font-extrabold text-white">
                    {streakStats.todayCount}/{streakStats.dailyGoal} câu
                  </span>
                  <span className="block text-[11px] text-indigo-200">Mục tiêu ngày</span>
                </span>
              </button>
            </div>

            {!loading && !empty && (
              <div className="grid grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/10 py-2.5 text-center backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="px-2 transition-opacity hover:opacity-85"
                >
                  <div className="font-mono text-lg font-extrabold text-teal-300 sm:text-xl">{status.rememberedLong}</div>
                  <div className="text-[11px] text-indigo-100/85">từ {WORD_STATUS_LABELS.remembered_long.toLowerCase()}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("library")}
                  className="px-2 transition-opacity hover:opacity-85"
                >
                  <div className="font-mono text-lg font-extrabold text-white sm:text-xl">{status.learning}</div>
                  <div className="text-[11px] text-indigo-100/85">từ {WORD_STATUS_LABELS.learning.toLowerCase()}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("analytics")}
                  title={gain && baseline ? `Tăng từ ngày ${baseline.day.split("-").slice(1).reverse().map(Number).join("/")}` : "Số từ bạn đã nhận ra trong văn bản giao tiếp & công việc thực tế"}
                  className="px-2 transition-opacity hover:opacity-85"
                >
                  <div className="font-mono text-lg font-extrabold text-amber-300 sm:text-xl">
                    {gain ? `${gain.from}%→${gain.to}%` : coverage ? `~${coverage.percent}%` : "…"}
                  </div>
                  <div className="text-[11px] text-indigo-100/85">hiểu văn bản</div>
                </button>
              </div>
            )}
          </div>
        </section>

        <div className={twoColumns ? "grid gap-4 items-start min-[1000px]:grid-cols-[minmax(0,1fr)_320px]" : "max-w-3xl mx-auto space-y-4"}>
          <div className="min-w-0 space-y-4">
            {!loading && <AppUpdateBanner />}
            {!loading && <InstallAppCard />}

            {/* 2. Primary Action Checklist */}
            {loading ? (
              <div className="h-72 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse" />
            ) : empty ? (
              <Card className="space-y-3">
                <p className="text-lg font-bold text-slate-900 dark:text-white">Chưa có từ nào để học</p>
                <p className="text-slate-600 dark:text-zinc-300">
                  {AI_VOCAB_ENABLED
                    ? `Mở "${pathLabel}" để thêm vài từ đầu tiên.`
                    : `Mở "${pathLabel}" và chọn cấp độ (ví dụ A1): mỗi ngày app chọn các bộ từ thông dụng nhất để bạn lấy lại gốc từng bước.`}
                </p>
                <Button size="lg" block autoFocus onClick={() => setActiveTab("capture")}>
                  <Layers className="h-5 w-5" /> Mở {pathLabel}
                </Button>
              </Card>
            ) : primary ? (
              <TodayChecklist
                tasks={tasks}
                primary={primary}
                heading={inComeback ? `Kế hoạch quay lại · ngày ${comeback.dayNumber}` : "Nhiệm vụ học hôm nay"}
                onRun={run}
                onStartFlow={startFlowNow}
                quickMode={quickMode}
                onQuickStart={onQuickStart}
                streak={streakStats.currentStreak}
                onFocus={onStartFocus ? () => onStartFocus(focusMinutes) : undefined}
                focusMinutes={focusMinutes}
                goalReached={streakStats.goalReached}
                nextReviewLine={nextReviewText(nextReview, now)}
              />
            ) : (
              <DayCloseCard
                streakStats={streakStats}
                laterToday={laterToday}
                hour={now.getHours()}
                nextStep={pickNextStep({
                  pronunciationAvailable: !!pron,
                  pronunciationDone: !!pron?.doneToday,
                  simple: simpleMode,
                  talkDone: practicedToday("talk", now),
                })}
                onNextStep={(step) => setActiveTab(step.tab)}
                onQuickStart={onQuickStart}
                more={streakStats.todayCount > 0 ? more : null}
                nextReview={nextReview}
                dueNow={todayWork.reviews}
                now={fixedNow}
                onFeedback={isCloudConfigured() ? () => setFeedbackOpen(true) : undefined}
              />
            )}

            {!loading && forgottenDue >= FORGOTTEN_HINT_MIN && (
              <button
                onClick={() => setActiveTab("forgotten")}
                className="w-full min-h-14 flex items-center gap-3 px-3.5 py-3 md:px-4 rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-zinc-900 text-left text-slate-800 dark:text-zinc-100 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  <Bug className="h-5 w-5" />
                </span>
                <span className="flex-1 text-sm">
                  <b>{forgottenDue} từ hay quên</b> đang chờ. Ôn riêng nhóm này để nhớ chắc hơn?
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            )}

            {/* 3. Quick Utility Grid (Reflex Challenge & Home Screen Widget) */}
            {(onStartReflex || showWidgetPin) && (
              <div className={`grid gap-3 ${onStartReflex && showWidgetPin ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                {onStartReflex && (
                  <Card className="flex items-center gap-3 p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                      <Zap className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">Phản xạ nhanh</span>
                      <span className="block text-xs text-slate-500 dark:text-zinc-400">Ôn tốc độ · +80 XP</span>
                    </span>
                    <Button size="sm" variant="secondary" onClick={onStartReflex}>
                      Chơi
                    </Button>
                  </Card>
                )}

                {showWidgetPin && (
                  <Card className="flex items-center gap-3 p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                      <Layers className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">Widget màn hình</span>
                      <span className="block text-xs text-slate-500 dark:text-zinc-400">Tự đổi từ mỗi 4 phút</span>
                    </span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        if (pinHomeWidget()) setShowWidgetPin(false);
                      }}
                    >
                      Ghim
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {!loading && empty && <RoadmapTodayCard setActiveTab={setActiveTab} showStart />}
          </div>

          {/* 4. Secondary Quests & Weekly Rank */}
          {(showQuests || showRank) && (
            <>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="min-[1000px]:hidden w-full min-w-0 min-h-12 flex items-center gap-3 px-3.5 md:px-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-slate-700 dark:text-zinc-200"
              >
                <Compass className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {moreOpen ? "Thu gọn nhiệm vụ thưởng & xếp hạng" : "Xem thêm: Nhiệm vụ thưởng XP & Đua top tuần"}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              <aside className={`min-w-0 space-y-4 ${moreClass} min-[1000px]:col-start-2 min-[1000px]:row-start-1`}>
                {showQuests && (
                  <DailyQuestsCard
                    words={words}
                    newToday={todayWork.newToday}
                    dailyGoal={streakStats.dailyGoal}
                    hasStudied={hasStudied}
                    freezesAvailable={streakStats.freezesAvailable}
                    refreshKey={streakStats.todayCount}
                    onStartReview={onStart}
                    onStartFocus={onStartFocus ? () => onStartFocus(focusMinutes) : undefined}
                    onStartReflex={onStartReflex}
                    setActiveTab={setActiveTab}
                    now={fixedNow}
                  />
                )}
                {showRank && <RankPanel onNavigate={setActiveTab} />}
              </aside>
            </>
          )}
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={closeFeedback} />
    </div>
  );
}
