import { getLocalDateString } from "@/services/streak";
import { STEPS, type PatternState } from "@/services/patterns/progress";
import { MINUTES, type Stage } from "./stages";
import type { RoadmapState } from "./state";

/** The work of one day on the path: what to do, in order, to fit the minutes the learner chose */

export type DayTask =
  /** Patterns of earlier stages that are due: a short rapid-fire */
  | { kind: "review"; patternIds: string[]; minutes: number }
  /** One pattern: the steps of its ladder to do now (learn and substitute go together, the rest alone) */
  | { kind: "step"; patternId: string; steps: number[]; minutes: number }
  /** The final challenge of the stage */
  | { kind: "test"; stageId: string; minutes: number }
  /** The conversation of the stage */
  | { kind: "conversation"; stageId: string; situationId: string; minutes: number };

export interface DayPlan {
  tasks: DayTask[];
  minutes: number;
  /** Nothing is ready today: the next steps of the stage come tomorrow */
  waiting: boolean;
  /** Every pattern is learned and the final challenge passed: the stage can be marked done */
  complete: boolean;
}

/** The final challenge needs this many right answers in ten */
export const TEST_PASS = 6;
/** The test that skips a stage the learner already knows needs this many */
export const SKIP_PASS = 8;
/** At most this many new patterns are opened in a day, and this many are asked again for review */
const MAX_NEW = 2;
const MAX_REVIEW = 4;
const stepMinutes = (step: number) => (step === 2 ? MINUTES.substitute : step === 3 ? MINUTES.tiles : MINUTES.rapid);

const fresh = (day: string): PatternState => ({ step: 0, due: day, box: 0, times: [], lastDay: "" });

export function buildDayPlan(
  stage: Stage,
  roadmap: RoadmapState,
  states: Record<string, PatternState>,
  dueReview: readonly string[],
  budgetMinutes: number,
  now: Date = new Date()
): DayPlan {
  const today = getLocalDateString(now);
  const stateOf = (id: string) => states[id] ?? fresh(today);
  const inStage = new Set(stage.patterns.map((p) => p.id));

  const units: DayTask[] = [];
  const review = dueReview.filter((id) => !inStage.has(id)).slice(0, MAX_REVIEW);
  if (review.length > 0) units.push({ kind: "review", patternIds: review, minutes: Math.min(3, Math.ceil(review.length * 0.75)) });

  // Patterns already started whose next step is ready: the furthest along first, so patterns get finished
  const ready = stage.patterns
    .map((p) => ({ p, s: stateOf(p.id) }))
    .filter(({ s }) => s.step >= 1 && s.step < STEPS && (s.due <= today || (s.step === 1 && s.lastDay === today)))
    .sort((a, b) => b.s.step - a.s.step);
  for (const { p, s } of ready) units.push({ kind: "step", patternId: p.id, steps: [s.step + 1], minutes: stepMinutes(s.step + 1) });

  // New patterns: learn it and substitute in the blank on the same day
  const fresher = stage.patterns.filter((p) => stateOf(p.id).step === 0).slice(0, MAX_NEW);
  for (const p of fresher) units.push({ kind: "step", patternId: p.id, steps: [1, 2], minutes: MINUTES.learn + MINUTES.substitute });

  const allMastered = stage.patterns.every((p) => stateOf(p.id).step >= STEPS);
  const tested = roadmap.tested.includes(stage.id);
  if (allMastered && !tested) units.push({ kind: "test", stageId: stage.id, minutes: MINUTES.test });
  if (allMastered && tested && stage.conversationId && !roadmap.conversed.includes(stage.id)) {
    units.push({ kind: "conversation", stageId: stage.id, situationId: stage.conversationId, minutes: MINUTES.conversation });
  }

  const tasks: DayTask[] = [];
  let used = 0;
  for (const unit of units) {
    // The first unit is always taken, even if it is longer than the day
    if (tasks.length > 0 && used + unit.minutes > budgetMinutes) continue;
    tasks.push(unit);
    used += unit.minutes;
  }

  const conversationDone = !stage.conversationId || roadmap.conversed.includes(stage.id);
  const complete = allMastered && tested && conversationDone;
  return { tasks, minutes: Math.round(used), waiting: tasks.length === 0 && !complete, complete };
}
