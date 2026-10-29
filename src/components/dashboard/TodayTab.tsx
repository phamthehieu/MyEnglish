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
import { PAGE_CONTAINER, type DashboardTab } from "./shared";
import { useAuthStore } from "@/stores/authStore";
import {
  buildTodayTasks,
  cardsLaterToday,
  chosenDailyMinutes,
  coverageGain,
  milestoneToCelebrate,
  pickNextStep,
  primaryTask,
  quickStartMode,
  readCoverageBaseline,
  readMilestoneMark,
  saveCoverageBaseline,
  saveMilestoneMark,
  type TodayTask,
  type TodayTaskInput,
} from "./todayPlan";
import TodayChecklist from "./TodayChecklist";
import DayCloseCard from "./DayCloseCard";
import { FeedbackDialog } from "./FeedbackForm";
import { isCloudConfigured } from "@/services/supabase";
import TodayRoadmapCard from "./TodayRoadmapCard";
import StudyLevelBar from "./StudyLevelBar";
import AppUpdateBanner from "./AppUpdateBanner";
import RoadmapTodayCard from "../roadmap/RoadmapTodayCard";
import { useRoadmap } from "../roadmap/useRoadmap";
import { PATTERNS } from "@/data/patterns";
import { planFlow, startFlow } from "@/services/dayFlow";
import { runTodayTask } from "./runTask";
import FocusStartCard from "./FocusStartCard";
import DailyQuestsCard from "./DailyQuestsCard";
import { FOCUS_SETTINGS_EVENT, getFocusSettings, nextReviewPeek } from "@/services/focusSession";
import { nextReviewText } from "@/services/dayClose";
import WeeklySummaryCard from "./WeeklySummaryCard";

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
  /** Words still loading: no "done" state yet */
  loading?: boolean;
  simpleMode?: boolean;
  /** Fixed clock for previews */
  now?: Date;
}

/** From this many words often forgotten due now, Today points to their own section */
const FORGOTTEN_HINT_MIN = 3;

function greeting(hour: number, name?: string | null): string {
  const base = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  const clean = name?.trim();
  return clean ? `${base}, ${clean}` : base;
}

/** Minutes for today's words: a new word costs an introduction and a quiz, about two reviews */
function todayMinutes(work: TodayWork): number {
  return minutesFor(work.reviews + work.newToday * 2);
}

/**
 * The opening screen, built to show as much as fits without scrolling. Top: the greeting and three compact numbers
 * (streak, words learnt in the sidebar's two tiers, how much of a real IT text the learner recognises). Then, on
 * wide windows, two columns: today as a short list (words, one grammar lesson, one pronunciation lesson, sized by
 * the minutes chosen at onboarding) with one main button, or the day close once everything is done, plus the
 * focus card; on the right the daily quests and the weekly race. Below the list: the Oxford path and last week's
 * summary on the first day of a new week.
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
  loading = false,
  simpleMode = false,
  now: fixedNow,
}: TodayTabProps) {
  const now = fixedNow ?? new Date();
  const today = getLocalDateString(now);
  // Signed in: the account's display name in the greeting (none while signed out, or before the profile loads)
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

  // Length of a focus session, as last chosen on the focus card
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

  // The same two tiers as the sidebar and the word library (U9)
  const status = useMemo(() => countWordStatus(words), [words]);
  const hasStudied = useMemo(() => words.some((w) => (w.srs?.reps ?? 0) > 0 || (w.srs?.state ?? 0) > 0), [words]);
  const unmasteredCount = useMemo(() => getUnmasteredWords(words).length, [words]);
  const laterToday = useMemo(() => cardsLaterToday(words, now), [words, todayWork.total]);
  const nextReview = useMemo(() => nextReviewPeek(words, now), [words, todayWork.total]);

  // A "Nhớ lâu" milestone, celebrated once (the line stays for the day it is reached)
  const milestone = useMemo(() => milestoneToCelebrate(status.rememberedLong, readMilestoneMark(), today), [status.rememberedLong, today]);
  useEffect(() => {
    if (milestone.next) saveMilestoneMark(milestone.next);
  }, [milestone.next]);

  // Coverage: the first measure is kept to show the gain later ("46% → 52%")
  const [baseline, setBaseline] = useState(readCoverageBaseline);
  useEffect(() => {
    if (!coverage || loading || baseline) return;
    const first = { percent: coverage.percent, day: today };
    saveCoverageBaseline(first);
    setBaseline(first);
  }, [coverage, loading, baseline, today]);
  const gain = coverage ? coverageGain(coverage.percent, baseline) : null;

  const inComeback = !!comeback && !comeback.caughtUp;
  // The speaking path is the first thing of the list: where the learner is on it and what is left of today's part
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
          }
        : null;
  const tasks = buildTodayTasks({
    speaking,
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
  // Nothing to do and nothing ever studied: no "done", but where words come from (U6)
  const empty = !loading && todayWork.total === 0 && !hasStudied;
  const quickMode = quickStartMode({
    goalReached: streakStats.goalReached,
    todayCount: streakStats.todayCount,
    hour: now.getHours(),
    canStudy: todayWork.total > 0 || hasStudied,
  });

  const runDeps = { setActiveTab, startWords: onStart, startReflex: onStartReflex };
  const run = (task: TodayTask) => runTodayTask(task.id, runDeps);
  // The main button, when several things are left: all of them one after the other (the bar on every tab goes on)
  const startFlowNow = () => {
    const queue = planFlow(tasks);
    if (startFlow(queue)) runTodayTask(queue[0], runDeps);
  };
  const isCapped = unmasteredCount >= youngWordCap();
  const more = {
    // While a comeback plan runs, "more" is the backlog, not new words (P12)
    label: inComeback ? "Ôn thêm thẻ tồn" : isCapped ? `Ôn từ đang học (${unmasteredCount})` : "Học thêm từ mới",
    onClick: onStart,
  };
  const pathLabel = AI_VOCAB_ENABLED ? "Thêm từ bằng AI" : "Lộ trình từ vựng";

  const showQuests = !loading && !empty;
  const twoColumns = showQuests || showRank || !!onStartReflex;
  // Closed on a phone until "Xem thêm" is pressed; always shown on wide windows
  const [moreOpen, setMoreOpen] = useState(false);
  const moreClass = moreOpen ? "" : "hidden min-[1000px]:block";

  return (
    <div className={PAGE_CONTAINER}>
      <div className="space-y-4">
        {/* The greeting, and the day's goal as a ring */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-snug text-slate-900 dark:text-white">
              {greeting(now.getHours(), signedIn ? displayName : null)}
            </h2>
            <p className="text-sm text-slate-500 first-letter:uppercase dark:text-zinc-400">
              {now.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            title="Mục tiêu hôm nay (bấm để xem tiến độ)"
            className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white py-2 pl-2 pr-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <ProgressRing value={streakStats.goalPercentage} size={48} stroke={5} done={streakStats.goalReached}>
              {streakStats.goalReached ? (
                <Check className="h-5 w-5 text-green-600" strokeWidth={3} />
              ) : (
                <span className="text-xs font-bold text-teal-800 dark:text-teal-300">{Math.round(streakStats.goalPercentage)}%</span>
              )}
            </ProgressRing>
            <span className="text-left">
              <span className="block text-sm font-bold text-slate-900 dark:text-white">
                {streakStats.todayCount}/{streakStats.dailyGoal} câu
              </span>
              <span className="block text-xs text-slate-500 dark:text-zinc-400">Mục tiêu ngày</span>
            </span>
          </button>
        </div>

        {/*
          Wide windows: today's plan on the left, quests (and the weekly race) on the right, both in view without
          scrolling. Narrow: one column with only the day's plan and the level; the rest behind "Xem thêm".
        */}
        <div className={twoColumns ? "grid gap-4 items-start min-[1000px]:grid-cols-[minmax(0,1fr)_320px] min-[1000px]:grid-rows-[auto_1fr]" : "max-w-3xl mx-auto space-y-4"}>
          <div className="min-w-0 space-y-4">
            {/* A new version of the app (Android) */}
            {!loading && <AppUpdateBanner />}

            {/* The one thing to do now */}
            {loading ? (
              <div className="h-80 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse" />
            ) : empty ? (
              <Card className="space-y-3">
                <p className="text-lg font-bold text-slate-900 dark:text-white">Chưa có từ nào để học</p>
                <p className="text-slate-600 dark:text-zinc-300">
                  {AI_VOCAB_ENABLED
                    ? `Mở "${pathLabel}" để thêm vài từ đầu tiên.`
                    : `Mở "${pathLabel}" và chọn cấp độ (ví dụ A1): mỗi ngày app lấy vài từ trong bộ Oxford cho bạn, từ IT trước.`}
                </p>
                <Button size="lg" block autoFocus onClick={() => setActiveTab("capture")}>
                  <Layers className="h-5 w-5" /> Mở {pathLabel}
                </Button>
              </Card>
            ) : primary ? (
              <TodayChecklist
                tasks={tasks}
                primary={primary}
                heading={inComeback ? `Kế hoạch quay lại · ngày ${comeback.dayNumber}` : "Hôm nay của bạn"}
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
                nextStep={pickNextStep({ pronunciationAvailable: !!pron, pronunciationDone: !!pron?.doneToday, simple: simpleMode })}
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
                className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-2xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-zinc-900 text-left text-slate-800 dark:text-zinc-100 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                  <Bug className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <b>{forgottenDue} từ hay quên</b> đang chờ. Ôn riêng nhóm này để nhớ chắc hơn?
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
              </button>
            )}

            {/* The learner's levels, with the way to change them */}
            {!loading && <StudyLevelBar />}

            {/* No list yet: the speaking path with its own start button */}
            {!loading && empty && <RoadmapTodayCard setActiveTab={setActiveTab} showStart />}
          </div>

          {/* Phones: everything that is not today's main action sits behind one row; wide windows show it all */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="min-[1000px]:hidden w-full min-w-0 min-h-14 flex items-center gap-3 px-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-slate-700 dark:text-zinc-200"
          >
            <Compass className="h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
            <span className="min-w-0 flex-1 truncate font-medium">{moreOpen ? "Thu gọn" : "Xem thêm: nhiệm vụ, xếp hạng tuần, lộ trình từ vựng"}</span>
            <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>

          {twoColumns && (
            <aside className={`min-w-0 space-y-4 ${moreClass} min-[1000px]:col-start-2 min-[1000px]:row-start-1 min-[1000px]:row-span-2`}>
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

              {/* The reflex challenge, one quiet card */}
              {onStartReflex && (
                <Card className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                    <Zap className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-slate-900 dark:text-white">Luyện phản xạ</span>
                    <span className="block text-sm text-slate-500 dark:text-zinc-400">Trả lời nhanh các từ đã học, +80 XP</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={onStartReflex}>
                    Bắt đầu
                  </Button>
                </Card>
              )}
            </aside>
          )}

          <div className={`min-w-0 space-y-4 ${moreClass} ${twoColumns ? "min-[1000px]:col-start-1 min-[1000px]:row-start-2" : ""}`}>
            {/* The learner's words in numbers (they used to sit on top of the screen) */}
            {!loading && !empty && (
              <Card className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{status.rememberedLong}</div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400">từ {WORD_STATUS_LABELS.remembered_long.toLowerCase()}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{status.learning}</div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400">từ {WORD_STATUS_LABELS.learning.toLowerCase()}</div>
                </div>
                <div title={gain && baseline ? `Tăng từ ngày ${baseline.day.split("-").slice(1).reverse().map(Number).join("/")}` : "Số từ bạn đã nhận ra trong một tài liệu IT"}>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {gain ? `${gain.from}% → ${gain.to}%` : coverage ? `~${coverage.percent}%` : "…"}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400">hiểu tài liệu IT</div>
                </div>
              </Card>
            )}
            {!loading && !empty && onStartFocus && (todayWork.total > 0 || hasStudied) && (
              <FocusStartCard onStart={onStartFocus} due={todayWork.total} shortcut quiet />
            )}
            {!loading && !empty && <RoadmapTodayCard setActiveTab={setActiveTab} showStart={false} />}
            <TodayRoadmapCard simple={simpleMode} milestone={milestone.show} onOpenPath={() => setActiveTab("capture")} />
            <WeeklySummaryCard simple={simpleMode} now={fixedNow} />
          </div>
        </div>
      </div>
      <FeedbackDialog open={feedbackOpen} onClose={closeFeedback} />
    </div>
  );
}
