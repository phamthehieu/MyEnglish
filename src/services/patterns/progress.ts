import { getLocalDateString } from "@/services/streak";
import { dayAfter } from "@/services/talk/review";

/**
 * How far the learner has got with each sentence pattern, kept in localStorage.
 * A pattern climbs four steps (learn it, substitute the blank, build the sentence, answer fast); after the last step
 * it is "mastered" and comes back on a schedule (a few days apart, longer after each right answer).
 */
const KEY = "myenglish_patterns_v1";
export const PATTERNS_UPDATED_EVENT = "myenglish-patterns-updated";

/** The four steps of the ladder */
export const STEP_LABELS = ["Học mẫu câu", "Thay chỗ trống", "Ghép câu", "Hỏi đáp nhanh"] as const;
export const STEPS = STEP_LABELS.length;
/** Days until a mastered pattern is asked again, by box */
export const MASTERED_BOX_DAYS = [2, 4, 7, 15, 30];
/** An answer in rapid-fire counts as fast when given within this */
export const FAST_MS = 3500;

export interface PatternState {
  /** Steps completed, 0 to STEPS; STEPS means mastered */
  step: number;
  /** Day it is due (YYYY-MM-DD) */
  due: string;
  /** Box of the review schedule once mastered */
  box: number;
  /** Response times of the last rapid-fire answers, in ms */
  times: number[];
  lastDay: string;
}

type Store = Record<string, PatternState>;

function load(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(PATTERNS_UPDATED_EVENT));
  } catch {
    /* progress is simply not remembered */
  }
}

const fresh = (now: Date): PatternState => ({ step: 0, due: getLocalDateString(now), box: 0, times: [], lastDay: getLocalDateString(now) });

export function getPatternState(id: string): PatternState {
  return load()[id] ?? fresh(new Date());
}

export function allPatternStates(): Store {
  return load();
}

/** A step was completed: the pattern moves up one step, and the next one is due tomorrow */
export function completeStep(id: string, step: number, now: Date = new Date()): void {
  const store = load();
  const prev = store[id] ?? fresh(now);
  // Only the next step counts (doing an earlier one again changes nothing)
  if (step !== prev.step + 1) return;
  const mastered = step >= STEPS;
  store[id] = {
    ...prev,
    step,
    box: 0,
    due: mastered ? dayAfter(now, MASTERED_BOX_DAYS[0]) : dayAfter(now, 1),
    lastDay: getLocalDateString(now),
  };
  save(store);
}

/** The result of asking a mastered pattern again: right moves it to a later day, wrong sends it back to the ladder's last step */
export function recordReview(id: string, ok: boolean, now: Date = new Date()): void {
  const store = load();
  const prev = store[id];
  if (!prev || prev.step < STEPS) return;
  if (ok) {
    const box = Math.min(prev.box + 1, MASTERED_BOX_DAYS.length - 1);
    store[id] = { ...prev, box, due: dayAfter(now, MASTERED_BOX_DAYS[box]), lastDay: getLocalDateString(now) };
  } else {
    store[id] = { ...prev, step: STEPS - 1, box: 0, due: dayAfter(now, 1), lastDay: getLocalDateString(now) };
  }
  save(store);
}

/** The time of one rapid-fire answer (kept: the last ten) */
export function recordTime(id: string, ms: number, now: Date = new Date()): void {
  const store = load();
  const prev = store[id] ?? fresh(now);
  store[id] = { ...prev, times: [...prev.times, Math.round(ms)].slice(-10), lastDay: getLocalDateString(now) };
  save(store);
}

/** Average of the kept response times, or null when there are none yet */
export function averageTime(state: PatternState): number | null {
  return state.times.length > 0 ? Math.round(state.times.reduce((a, b) => a + b, 0) / state.times.length) : null;
}

/** Patterns started and due today or earlier, the most overdue first */
export function duePatterns(now: Date = new Date()): string[] {
  const today = getLocalDateString(now);
  return Object.entries(load())
    .filter(([, s]) => s.step > 0 && s.due <= today)
    .sort(([, a], [, b]) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
    .map(([id]) => id);
}

/** Patterns that went through the ladder's third step: they can be asked fast */
export function rapidPool(): string[] {
  return Object.entries(load())
    .filter(([, s]) => s.step >= 2)
    .map(([id]) => id);
}

export function masteredCount(): number {
  return Object.values(load()).filter((s) => s.step >= STEPS).length;
}
