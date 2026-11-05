import type { Pattern } from "@/types/pattern";
import { recordDailyActivity } from "@/services/streak";
import { notePatternMisses } from "@/services/learningLinks";
import { getPattern } from "@/data/patterns";
import { buildListen, buildRapid, buildSubstitution, buildTilesItem, firstLetters, pickSlots, type ListenItem, type RapidItem, type SubstituteItem, type TilesItem } from "./engine";
import { allPatternStates, completeStep, recordReview, recordTime, STEPS } from "./progress";

/** What one sitting with a pattern (or a mix of patterns) is made of, and what it does to the progress when it is over */

export type Task =
  | { kind: "learn"; pattern: Pattern }
  | { kind: "listen"; pattern: Pattern; item: ListenItem }
  /** `withMeaning`: the options show their Vietnamese, the easier first round */
  | { kind: "substitute"; pattern: Pattern; item: SubstituteItem; withMeaning?: boolean }
  | { kind: "tiles"; pattern: Pattern; item: TilesItem }
  /** `letters`: the first letter of each word is shown and there is more time, the easier first round */
  | { kind: "rapid"; pattern: Pattern; item: RapidItem; letters?: string };

export type SessionKind = "ladder" | "rapid-mix";

export interface TaskResult {
  patternId: string;
  kind: Task["kind"];
  /** Right at the first try (rapid: right in time) */
  ok: boolean;
  /** Time to answer in rapid-fire, in ms */
  ms?: number;
}

/**
 * The tasks of the step after the ones the pattern has done (step 1 to 4). Each step goes from easy to hard, so what
 * was just recognised is then used: hear and pick the meaning, then fill the blank with and without the meanings shown;
 * build the sentence from its own words, then with words that do not belong; say it with its first letters shown, then
 * without. Saying a whole sentence from memory comes last.
 */
export function buildStepTasks(pattern: Pattern, step: number, random: () => number = Math.random): Task[] {
  if (step <= 1) return [{ kind: "learn", pattern }];
  const slots = pickSlots(pattern, pattern.slots.length, random);
  const slot = (i: number) => slots[i % slots.length];
  if (step === 2) {
    return [
      ...[0, 1].map((i): Task => ({ kind: "listen", pattern, item: buildListen(pattern, slot(i), random) })),
      ...[2, 3].map((i): Task => ({ kind: "substitute", pattern, item: buildSubstitution(pattern, slot(i), random), withMeaning: true })),
      ...[4, 5].map((i): Task => ({ kind: "substitute", pattern, item: buildSubstitution(pattern, slot(i), random) })),
    ];
  }
  if (step === 3) {
    return [
      ...[0, 1].map((i): Task => ({ kind: "tiles", pattern, item: buildTilesItem(pattern, slot(i), random, { decoys: false }) })),
      ...[2, 3].map((i): Task => ({ kind: "tiles", pattern, item: buildTilesItem(pattern, slot(i), random) })),
    ];
  }
  return [0, 1, 2, 3, 4].map((i): Task => {
    const item = buildRapid(pattern, slot(i), random);
    return i < 3 ? { kind: "rapid", pattern, item, letters: firstLetters(item.en) } : { kind: "rapid", pattern, item };
  });
}

/** Rapid-fire over several patterns: one question from each, in a random order */
export function buildRapidMix(patterns: Pattern[], size = 8, random: () => number = Math.random): Task[] {
  const chosen = [...patterns].sort(() => random() - 0.5).slice(0, size);
  return chosen.map((pattern) => ({ kind: "rapid", pattern, item: buildRapid(pattern, pickSlots(pattern, 1, random)[0], random) }));
}

/** Right answers a step needs: enough to show it is coming, and a step can be done again */
const PASS_SHARE = 0.6;

/** Did the sitting pass its step? (learn and tiles are finished when done, the others need PASS_SHARE right) */
export function sessionPassed(tasks: readonly Task[], results: readonly TaskResult[]): boolean {
  if (results.length === 0) return false;
  const kind = tasks[tasks.length - 1]?.kind;
  if (kind === "substitute" || kind === "rapid") return results.filter((r) => r.ok).length >= Math.ceil(results.length * PASS_SHARE);
  return true;
}

/** The right answers of a sitting count toward the daily goal (wrong ones would fill the day by trying again and again) */
function countRightAnswers(results: ReadonlyArray<{ ok: boolean }>): void {
  const right = results.filter((r) => r.ok).length;
  if (right > 0) recordDailyActivity(right);
}

/**
 * Save a round of "Dịch câu": a mastered pattern goes through its review schedule, and its right answers count as
 * activity of the day. `studied`: the round is on what the learner has learned (the stage's final challenge), so its
 * misses say the stage's grammar may be weak; a round on anything of the level, or a test to skip a stage, says nothing.
 */
export function applyTranslate(results: ReadonlyArray<{ patternId: string; ok: boolean }>, opts: { studied?: boolean } = {}): void {
  const states = allPatternStates();
  for (const r of results) if ((states[r.patternId]?.step ?? 0) >= STEPS) recordReview(r.patternId, r.ok);
  countRightAnswers(results);
  if (opts.studied) notePatternMisses(results.map((r) => ({ topic: getPattern(r.patternId)?.topic, ok: r.ok })));
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
  countRightAnswers(results);
  // Misses keep coming while learning a stage: its grammar is offered on Today
  if (kind === "ladder" && pattern) notePatternMisses(results.map((r) => ({ topic: pattern.topic, ok: r.ok })));
  return passed;
}
