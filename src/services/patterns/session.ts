import type { Pattern } from "@/types/pattern";
import { recordDailyActivity } from "@/services/streak";
import { buildRapid, buildSubstitution, buildTilesItem, pickSlots, type RapidItem, type SubstituteItem, type TilesItem } from "./engine";
import { allPatternStates, completeStep, recordReview, recordTime, STEPS } from "./progress";

/** What one sitting with a pattern (or a mix of patterns) is made of, and what it does to the progress when it is over */

export type Task =
  | { kind: "learn"; pattern: Pattern }
  | { kind: "substitute"; pattern: Pattern; item: SubstituteItem }
  | { kind: "tiles"; pattern: Pattern; item: TilesItem }
  | { kind: "rapid"; pattern: Pattern; item: RapidItem };

export type SessionKind = "ladder" | "rapid-mix";

export interface TaskResult {
  patternId: string;
  kind: Task["kind"];
  /** Right at the first try (rapid: right in time) */
  ok: boolean;
  /** Time to answer in rapid-fire, in ms */
  ms?: number;
}

const COUNTS = { substitute: 5, tiles: 4, rapid: 5 } as const;

/** The tasks of the step after the ones the pattern has done (step 1 to 4) */
export function buildStepTasks(pattern: Pattern, step: number, random: () => number = Math.random): Task[] {
  if (step <= 1) return [{ kind: "learn", pattern }];
  if (step === 2) return pickSlots(pattern, COUNTS.substitute, random).map((slot) => ({ kind: "substitute", pattern, item: buildSubstitution(pattern, slot, random) }));
  if (step === 3) return pickSlots(pattern, COUNTS.tiles, random).map((slot) => ({ kind: "tiles", pattern, item: buildTilesItem(pattern, slot, random) }));
  return pickSlots(pattern, COUNTS.rapid, random).map((slot) => ({ kind: "rapid", pattern, item: buildRapid(pattern, slot, random) }));
}

/** Rapid-fire over several patterns: one question from each, in a random order */
export function buildRapidMix(patterns: Pattern[], size = 8, random: () => number = Math.random): Task[] {
  const chosen = [...patterns].sort(() => random() - 0.5).slice(0, size);
  return chosen.map((pattern) => ({ kind: "rapid", pattern, item: buildRapid(pattern, pickSlots(pattern, 1, random)[0], random) }));
}

/** Did the sitting pass its step? (learn and tiles are finished when done, the others need four right in five) */
export function sessionPassed(tasks: readonly Task[], results: readonly TaskResult[]): boolean {
  if (results.length === 0) return false;
  const kind = tasks[0]?.kind;
  if (kind === "substitute" || kind === "rapid") return results.filter((r) => r.ok).length >= Math.ceil(results.length * 0.8);
  return true;
}

/**
 * Save what happened. A ladder sitting moves its pattern up one step when passed; a rapid mix records the times and
 * sends the mastered patterns through their review schedule. Both count as activity of the day.
 */
export function applySession(kind: SessionKind, pattern: Pattern | null, step: number, tasks: readonly Task[], results: readonly TaskResult[]): boolean {
  for (const r of results) if (r.ms !== undefined) recordTime(r.patternId, r.ms);
  let passed = true;
  if (kind === "ladder" && pattern) {
    passed = sessionPassed(tasks, results);
    if (passed) completeStep(pattern.id, step);
  } else {
    const states = allPatternStates();
    for (const r of results) if ((states[r.patternId]?.step ?? 0) >= STEPS) recordReview(r.patternId, r.ok);
  }
  recordDailyActivity(Math.max(1, results.length));
  return passed;
}
