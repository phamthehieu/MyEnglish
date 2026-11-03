/**
 * What the learner keeps getting wrong outside the word sessions, so another part of the app can work on it:
 *  - words of the sentences missed in conversations and patterns: asked first in the flash quiz and in the popup's
 *    extra practice, until the word is answered right in a review (or a week has passed)
 *  - the grammar of a speaking stage whose patterns keep failing: Today offers its lesson
 * Kept in localStorage (synced as last-writer-wins, src/services/sync/keys.ts).
 */
import { getLocalDateString } from "./streak";

export const WEAK_WORDS_KEY = "myenglish_weak_words_v1";
export const WEAK_GRAMMAR_KEY = "myenglish_weak_grammar_v1";
export const WEAK_POINTS_EVENT = "myenglish-weak-points-updated";

/** A weak point older than this is let go */
export const WEAK_DAYS = 7;
/** Misses of one stage's patterns within WEAK_DAYS before its grammar is offered */
export const GRAMMAR_MISSES_TO_OFFER = 3;

interface WeakWord {
  misses: number;
  /** Day (YYYY-MM-DD) of the last miss */
  day: string;
}

interface WeakGrammar {
  misses: number;
  day: string;
  /** Day the learner opened the lesson from Today: offered again only after new misses */
  reviewedDay?: string;
}

function read<T>(key: string): Record<string, T> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function write(key: string, value: Record<string, unknown>): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(WEAK_POINTS_EVENT));
  } catch {
    /* not remembered */
  }
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const fresh = (day: string, now: Date) => daysBetween(day, getLocalDateString(now)) < WEAK_DAYS;

/** Words of a sentence the learner missed */
export function noteWeakWords(wordIds: readonly string[], now: Date = new Date()): void {
  if (wordIds.length === 0) return;
  const store = read<WeakWord>(WEAK_WORDS_KEY);
  const day = getLocalDateString(now);
  for (const id of wordIds) store[id] = { misses: (fresh(store[id]?.day ?? "1970-01-01", now) ? store[id].misses : 0) + 1, day };
  write(WEAK_WORDS_KEY, store);
}

/** A weak word answered right in a review: no longer weak */
export function clearWeakWord(wordId: string): void {
  const store = read<WeakWord>(WEAK_WORDS_KEY);
  if (!store[wordId]) return;
  delete store[wordId];
  write(WEAK_WORDS_KEY, store);
}

/** The weak words of the last week, the most missed and the most recent first */
export function weakWordIds(now: Date = new Date()): string[] {
  return Object.entries(read<WeakWord>(WEAK_WORDS_KEY))
    .filter(([, w]) => fresh(w.day, now))
    .sort(([, a], [, b]) => b.misses - a.misses || (a.day < b.day ? 1 : -1))
    .map(([id]) => id);
}

/** Misses of the patterns of a speaking stage (the pattern topic) */
export function noteGrammarMisses(stageId: string, misses: number, now: Date = new Date()): void {
  if (misses <= 0) return;
  const store = read<WeakGrammar>(WEAK_GRAMMAR_KEY);
  const prev = store[stageId];
  const day = getLocalDateString(now);
  // After a review the count starts again: the lesson is offered again only for new misses
  const kept = prev && fresh(prev.day, now) && !prev.reviewedDay ? prev.misses : 0;
  store[stageId] = { misses: kept + misses, day };
  write(WEAK_GRAMMAR_KEY, store);
}

/** The stage whose grammar is worth a review today: enough recent misses, not reviewed since; null when none */
export function weakGrammarStage(now: Date = new Date()): { stageId: string; misses: number; reviewedToday: boolean } | null {
  const today = getLocalDateString(now);
  let best: { stageId: string; misses: number; reviewedToday: boolean } | null = null;
  for (const [stageId, g] of Object.entries(read<WeakGrammar>(WEAK_GRAMMAR_KEY))) {
    if (!fresh(g.day, now) || g.misses < GRAMMAR_MISSES_TO_OFFER) continue;
    const reviewedToday = g.reviewedDay === today;
    // Reviewed on an earlier day: done (new misses since start a new entry)
    if (g.reviewedDay && !reviewedToday) continue;
    if (!best || g.misses > best.misses) best = { stageId, misses: g.misses, reviewedToday };
  }
  return best;
}

/** The learner opened the lesson of a weak stage: its misses start again from zero */
export function markGrammarReviewed(stageId: string, now: Date = new Date()): void {
  const store = read<WeakGrammar>(WEAK_GRAMMAR_KEY);
  const prev = store[stageId];
  if (!prev) return;
  const day = getLocalDateString(now);
  store[stageId] = { misses: prev.misses, day: prev.day, reviewedDay: day };
  write(WEAK_GRAMMAR_KEY, store);
}
