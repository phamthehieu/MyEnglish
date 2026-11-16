import { AUTOSTART_KEY } from "../patterns/PatternsTab";
import { markGrammarReviewed, SHOW_TIP_EVENT, SHOW_TIP_KEY, weakGrammarStage } from "@/services/weakPoints";
import { tipForStage } from "@/data/grammarTips";
import { TASK_TAB, type TodayTaskId } from "./todayPlan";
import type { DashboardTab } from "./shared";

/** The talk tab opens the review of missed sentences at once when this is set (sessionStorage) */
export const TALK_REVIEW_AUTOSTART_KEY = "myenglish_talk_review_autostart";

/** The grammar tab starts the day's grammar at once when this is set: the reviews due, else the lesson to learn */
export const GRAMMAR_AUTOSTART_KEY = "myenglish_grammar_autostart";
/** The pronunciation tab opens its next lesson at once when this is set */
export const PRONUNCIATION_AUTOSTART_KEY = "myenglish_pronunciation_autostart";

/** Asks the tab about to open to start its work of the day at once (read and cleared by the tab) */
function autostart(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* the learner presses the button in the tab instead */
  }
}

/** Whether a tab was asked to start at once; the mark is cleared by the read */
export function takeAutostart(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

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
    // The day's work starts at once; without a goal the tab asks for it first, then starts
    autostart(AUTOSTART_KEY);
    deps.setActiveTab("patterns");
  } else if (id === "talkReview") {
    autostart(TALK_REVIEW_AUTOSTART_KEY);
    deps.setActiveTab("talk");
  } else if (id === "weakGrammar") {
    const weak = weakGrammarTask();
    if (weak) markGrammarReviewed(weak.stageId);
    if (weak?.lessonId && deps.openGrammarLesson) deps.openGrammarLesson(weak.lessonId);
    else {
      // No lesson of the book explains it: the tab opens with the stage's own tip, not on a list to search
      try {
        if (weak) sessionStorage.setItem(SHOW_TIP_KEY, weak.stageId);
      } catch {
        /* the tab opens without it */
      }
      deps.setActiveTab("grammar");
      window.dispatchEvent(new Event(SHOW_TIP_EVENT));
    }
  } else if (id === "vocab") deps.startWords();
  else if (id === "reflex") {
    if (deps.startReflex) deps.startReflex();
    else deps.setActiveTab("leaderboard");
  } else {
    // Grammar and pronunciation open on the lesson of the day, not on a list to search
    autostart(id === "grammar" ? GRAMMAR_AUTOSTART_KEY : PRONUNCIATION_AUTOSTART_KEY);
    deps.setActiveTab(TASK_TAB[id]);
  }
}
