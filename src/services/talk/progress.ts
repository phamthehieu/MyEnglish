import type { Situation } from "@/types/situation";
import { getLocalDateString } from "@/services/streak";

/**
 * Progress of "Trò chuyện tình huống", kept in localStorage (like the pronunciation lessons). Only what the
 * learner said aloud counts for a line; picking an answer in a conversation does not.
 */

const KEY = "myenglish_talk_v1";
export const TALK_UPDATED_EVENT = "myenglish-talk-updated";

export interface LineProgress {
  tries: number;
  /** Times the machine heard the line */
  ok: number;
  /** Times the line was built from tiles or typed correctly */
  built?: number;
  /** Last sentence the machine heard, when it was not the line */
  lastHeard?: string;
  lastDay?: string;
}

export interface SituationProgress {
  /** Conversations finished */
  runs: number;
  lastRunDay?: string;
  /** Share of the turns answered right at the first try in the last run (0 to 1), and in the run before it */
  lastScore?: number;
  prevScore?: number;
  /** Best stars (1 to 3) earned in challenge mode */
  bestStars?: number;
}

interface Store {
  lines: Record<string, LineProgress>;
  situations: Record<string, SituationProgress>;
}

function load(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      lines: parsed && typeof parsed.lines === "object" && parsed.lines ? parsed.lines : {},
      situations: parsed && typeof parsed.situations === "object" && parsed.situations ? parsed.situations : {},
    };
  } catch {
    return { lines: {}, situations: {} };
  }
}

function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
    window.dispatchEvent(new Event(TALK_UPDATED_EVENT));
  } catch {
    /* progress is simply not remembered */
  }
}

export function getLineProgress(lineId: string): LineProgress {
  return load().lines[lineId] ?? { tries: 0, ok: 0 };
}

export function getSituationProgress(situationId: string): SituationProgress {
  return load().situations[situationId] ?? { runs: 0 };
}

/** One spoken try of a line; `heard` is what the machine heard when that was not the line */
export function recordLineTry(lineId: string, ok: boolean, heard?: string, now: Date = new Date()): void {
  const store = load();
  const prev = store.lines[lineId] ?? { tries: 0, ok: 0 };
  store.lines[lineId] = {
    ...prev,
    tries: prev.tries + 1,
    ok: prev.ok + (ok ? 1 : 0),
    lastHeard: ok ? undefined : heard ?? prev.lastHeard,
    lastDay: getLocalDateString(now),
  };
  save(store);
}

/** A line built from tiles or typed correctly (not counted as "said" in the situation's summary) */
export function recordLineBuilt(lineId: string, now: Date = new Date()): void {
  const store = load();
  const prev = store.lines[lineId] ?? { tries: 0, ok: 0 };
  store.lines[lineId] = { ...prev, built: (prev.built ?? 0) + 1, lastDay: getLocalDateString(now) };
  save(store);
}

/** How well the learner knows a line: times it was got right in any way */
export function seenCount(lineId: string): number {
  const p = load().lines[lineId];
  return p ? p.ok + (p.built ?? 0) : 0;
}

/** A conversation played to its end */
export function recordRun(situationId: string, now: Date = new Date(), result?: { score: number; stars?: number }): void {
  const store = load();
  const prev = store.situations[situationId] ?? { runs: 0 };
  store.situations[situationId] = {
    ...prev,
    runs: prev.runs + 1,
    lastRunDay: getLocalDateString(now),
    ...(result
      ? {
          prevScore: prev.lastScore,
          lastScore: result.score,
          ...(result.stars ? { bestStars: Math.max(prev.bestStars ?? 0, result.stars) } : {}),
        }
      : {}),
  };
  save(store);
}

/** Stars for a challenge run by the share of turns answered right at the first try */
export function starsFor(score: number): 1 | 2 | 3 {
  return score >= 0.9 ? 3 : score >= 0.6 ? 2 : 1;
}

export type SituationStatus = "new" | "learning" | "done";

export interface SituationSummary {
  status: SituationStatus;
  /** Lines said aloud and heard at least once */
  linesSaid: number;
  totalLines: number;
  runs: number;
}

/** "done" = every line was heard when spoken and the conversation was played to its end at least once */
export function summarize(situation: Situation): SituationSummary {
  const store = load();
  const linesSaid = situation.lines.filter((l) => (store.lines[l.id]?.ok ?? 0) > 0).length;
  const runs = store.situations[situation.id]?.runs ?? 0;
  const tried = situation.lines.some((l) => (store.lines[l.id]?.tries ?? 0) + (store.lines[l.id]?.built ?? 0) > 0);
  const status: SituationStatus =
    linesSaid === situation.lines.length && runs > 0 ? "done" : tried || runs > 0 ? "learning" : "new";
  return { status, linesSaid, totalLines: situation.lines.length, runs };
}

// ---- How the learner prefers to answer ----

const LEVEL_KEY = "myenglish_talk_level_v1";
const LEVELS = ["auto", "choose", "tiles", "say", "type"] as const;

export function getTalkLevel(): (typeof LEVELS)[number] {
  try {
    const v = localStorage.getItem(LEVEL_KEY);
    return (LEVELS as readonly string[]).includes(v ?? "") ? (v as (typeof LEVELS)[number]) : "auto";
  } catch {
    return "auto";
  }
}

export function setTalkLevel(level: (typeof LEVELS)[number]): void {
  try {
    localStorage.setItem(LEVEL_KEY, level);
  } catch {
    /* the choice is simply not remembered */
  }
}
