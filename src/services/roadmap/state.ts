import type { RoadmapGoal, Stage } from "./stages";

/** What the learner chose and did on the path, kept in localStorage */
const KEY = "myenglish_roadmap_v1";
export const ROADMAP_EVENT = "myenglish-roadmap-updated";

export interface RoadmapState {
  /** The goal; null until the learner chose (or put it off) */
  goal: RoadmapGoal | null;
  /** Stages finished, and stages the learner already knew and skipped */
  done: string[];
  skipped: string[];
  /** Stages whose final challenge was passed, and whose conversation was played */
  tested: string[];
  conversed: string[];
  /** Stages whose words were put in the learner's word bank */
  wordsAdded: string[];
  /** Stages whose grammar tip the learner read (it opens the first day of a stage, once) */
  tipSeen: string[];
  /** The stage the learner jumped to (otherwise the first one not done) */
  focus: string | null;
}

const empty = (): RoadmapState => ({ goal: null, done: [], skipped: [], tested: [], conversed: [], wordsAdded: [], tipSeen: [], focus: null });

export function getRoadmap(): RoadmapState {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
    return parsed && typeof parsed === "object" ? { ...empty(), ...parsed } : empty();
  } catch {
    return empty();
  }
}

function save(state: RoadmapState): RoadmapState {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event(ROADMAP_EVENT));
  } catch {
    /* not remembered */
  }
  return state;
}

const add = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export function setGoal(goal: RoadmapGoal): RoadmapState {
  // A different goal reorders the stages; what was done stays done
  return save({ ...getRoadmap(), goal, focus: null });
}
export const markTested = (id: string) => save({ ...getRoadmap(), tested: add(getRoadmap().tested, id) });
export const markWordsAdded = (id: string) => save({ ...getRoadmap(), wordsAdded: add(getRoadmap().wordsAdded, id) });
export const markTipSeen = (id: string) => save({ ...getRoadmap(), tipSeen: add(getRoadmap().tipSeen, id) });
export const markConversed =(id: string) => save({ ...getRoadmap(), conversed: add(getRoadmap().conversed, id) });
export const markDone = (id: string) => save({ ...getRoadmap(), done: add(getRoadmap().done, id), focus: null });
export const skipStage = (id: string) => save({ ...getRoadmap(), skipped: add(getRoadmap().skipped, id), focus: null });
/** The learner knows a whole level already: every stage of it not finished yet counts as skipped. Returns how many. */
export function skipLevel(stages: readonly Stage[], level: string): number {
  const state = getRoadmap();
  const ids = stages.filter((s) => s.level === level && !isFinished(state, s.id)).map((s) => s.id);
  if (ids.length > 0) save({ ...state, skipped: [...state.skipped, ...ids], focus: null });
  return ids.length;
}
export const setFocus =(id: string | null) => save({ ...getRoadmap(), focus: id });

export const isFinished = (state: RoadmapState, id: string) => state.done.includes(id) || state.skipped.includes(id);

/** The stage being worked on: the one the learner jumped to, else the first not finished (undefined when all are) */
export function currentStage(stages: readonly Stage[], state: RoadmapState): Stage | undefined {
  const focused = state.focus ? stages.find((s) => s.id === state.focus && !isFinished(state, s.id)) : undefined;
  return focused ?? stages.find((s) => !isFinished(state, s.id));
}
