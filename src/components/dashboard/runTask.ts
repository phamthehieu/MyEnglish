import { AUTOSTART_KEY } from "../patterns/PatternsTab";
import { getRoadmap } from "@/services/roadmap/state";
import { markGrammarReviewed, weakGrammarStage } from "@/services/weakPoints";
import { tipForStage } from "@/data/grammarTips";
import { TASK_TAB, type TodayTaskId } from "./todayPlan";
import type { DashboardTab } from "./shared";

/** The talk tab opens the review of missed sentences at once when this is set (sessionStorage) */
export const TALK_REVIEW_AUTOSTART_KEY = "myenglish_talk_review_autostart";

/** What opening each thing of the day needs from the dashboard */
export interface RunDeps {
  setActiveTab: (tab: DashboardTab) => void;
  /** Starts the words session */
  startWords: () => void;
  /** Opens the reflex challenge (without it the leaderboard tab is shown) */
  startReflex?: () => void;
  /** Opens a lesson of the grammar book (without it the grammar tab is shown) */
  openGrammarLesson?: (lessonId: string) => void;
}

/** The stage whose grammar keeps failing, with its tip's title and the book lesson that explains it; null when none */
export function weakGrammarTask(now: Date = new Date()): { stageId: string; title: string; lessonId: string | null; misses: number; reviewedToday: boolean } | null {
  const weak = weakGrammarStage(now);
  if (!weak) return null;
  const tip = tipForStage(weak.stageId);
  if (!tip) return null;
  return { stageId: weak.stageId, title: tip.title, lessonId: tip.lessons[0]?.id ?? null, misses: weak.misses, reviewedToday: weak.reviewedToday };
}

/** Opens a thing of the day: the same from the list on Today and from the flow bar */
export function runTodayTask(id: TodayTaskId, deps: RunDeps): void {
  if (id === "speaking") {
    // With a goal chosen the day's work starts at once; without one the tab asks for the goal first
    try {
      if (getRoadmap().goal !== null) sessionStorage.setItem(AUTOSTART_KEY, "1");
    } catch {
      /* the learner presses the button in the tab instead */
    }
    deps.setActiveTab("patterns");
  } else if (id === "talkReview") {
    try {
      sessionStorage.setItem(TALK_REVIEW_AUTOSTART_KEY, "1");
    } catch {
      /* the learner presses "Ôn lại" in the tab instead */
    }
    deps.setActiveTab("talk");
  } else if (id === "weakGrammar") {
    const weak = weakGrammarTask();
    if (weak) markGrammarReviewed(weak.stageId);
    if (weak?.lessonId && deps.openGrammarLesson) deps.openGrammarLesson(weak.lessonId);
    else deps.setActiveTab("grammar");
  } else if (id === "vocab") deps.startWords();
  else if (id === "reflex") {
    if (deps.startReflex) deps.startReflex();
    else deps.setActiveTab("leaderboard");
  } else deps.setActiveTab(TASK_TAB[id]);
}
