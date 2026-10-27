import { AUTOSTART_KEY } from "../patterns/PatternsTab";
import { getRoadmap } from "@/services/roadmap/state";
import { TASK_TAB, type TodayTaskId } from "./todayPlan";
import type { DashboardTab } from "./shared";

/** What opening each thing of the day needs from the dashboard */
export interface RunDeps {
  setActiveTab: (tab: DashboardTab) => void;
  /** Starts the words session */
  startWords: () => void;
  /** Opens the reflex challenge (without it the leaderboard tab is shown) */
  startReflex?: () => void;
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
  } else if (id === "vocab") deps.startWords();
  else if (id === "reflex") {
    if (deps.startReflex) deps.startReflex();
    else deps.setActiveTab("leaderboard");
  } else deps.setActiveTab(TASK_TAB[id]);
}
