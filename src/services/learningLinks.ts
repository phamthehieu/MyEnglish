/**
 * What ties the parts of the app together, in one place:
 *  - every practice counts: a conversation line, a shadowed sentence, a text read and a pattern answered count
 *    toward the daily goal (the streak) and earn some XP (capped per day and per kind, so no part can be farmed)
 *  - a word used counts as a review: a sentence said or written right without help recalls its words, so a word
 *    of the bank that is due is credited with Good (reviewRecorder.creditWordInContext)
 *  - a mistake is worked on elsewhere: the words of a missed sentence become weak words (flash quiz, popup), and
 *    the patterns of a stage that keep failing put that stage's grammar on Today (weakPoints.ts)
 */
import type { WordDetail } from "@/types/database";
import { getLocalDateString, recordDailyActivity } from "./streak";
import { awardXP, MATURE_STABILITY_DAYS } from "./smartReview";
import { getWordsLite } from "./db";
import { buildWordIndex } from "./reading";
import { creditWordInContext } from "./reviewRecorder";
import { noteGrammarMisses, noteWeakWords } from "./weakPoints";

export type PracticeSource = "talk" | "shadowing" | "reading" | "patterns";

/** XP for one unit of practice of each kind */
export const PRACTICE_XP: Record<PracticeSource, number> = { talk: 3, shadowing: 2, reading: 5, patterns: 2 };
/** At most this much XP a day from each kind */
export const PRACTICE_XP_CAP = 60;

const CREDIT_KEY = "myenglish_practice_credit_v1";
/** Fired with `detail: { words }` when words were credited by being used */
export const WORDS_USED_EVENT = "myenglish-words-used";

interface CreditDay {
  day: string;
  xp: Partial<Record<PracticeSource, number>>;
  /** Words credited today by being used */
  used: string[];
}

function readDay(now: Date): CreditDay {
  const day = getLocalDateString(now);
  try {
    const parsed = JSON.parse(localStorage.getItem(CREDIT_KEY) || "null");
    if (parsed && parsed.day === day) return { day, xp: parsed.xp ?? {}, used: Array.isArray(parsed.used) ? parsed.used : [] };
  } catch {
    /* a new day */
  }
  return { day, xp: {}, used: [] };
}

function writeDay(d: CreditDay): void {
  try {
    localStorage.setItem(CREDIT_KEY, JSON.stringify(d));
  } catch {
    /* not remembered */
  }
}

/**
 * One piece of practice done: `count` toward the daily goal (unless `goal` is false, for a part that counts it
 * already) and its XP, within the day's cap. Returns the XP given.
 */
export function creditPractice(source: PracticeSource, opts: { count?: number; goal?: boolean; now?: Date } = {}): number {
  const { count = 1, goal = true, now = new Date() } = opts;
  if (count <= 0) return 0;
  if (goal) recordDailyActivity(count);
  const day = readDay(now);
  const had = day.xp[source] ?? 0;
  const xp = Math.max(0, Math.min(PRACTICE_XP[source] * count, PRACTICE_XP_CAP - had));
  if (xp > 0) {
    awardXP(xp);
    day.xp[source] = had + xp;
    writeDay(day);
  }
  return xp;
}

/** Whether this kind of practice was done today (its XP of the day is above zero) */
export function practicedToday(source: PracticeSource, now: Date = new Date()): boolean {
  return (readDay(now).xp[source] ?? 0) > 0;
}

/** Words credited today by being used in a sentence */
export function wordsUsedToday(now: Date = new Date()): string[] {
  return readDay(now).used;
}

// The studied words of the bank by every form, kept a minute: a conversation checks a line every few seconds
let bank: { at: number; index: ReadonlyMap<string, WordDetail> } | null = null;
const BANK_TTL_MS = 60_000;

async function bankIndex(now: Date): Promise<ReadonlyMap<string, WordDetail>> {
  if (bank && now.getTime() - bank.at < BANK_TTL_MS) return bank.index;
  const words = await getWordsLite({ studiedOnly: true });
  bank = { at: now.getTime(), index: buildWordIndex(words).formIndex };
  return bank.index;
}

/** Forget the cached bank (tests, a reset) */
export function resetLearningLinks(): void {
  bank = null;
}

/** The studied words of the bank a sentence uses, in order, each once */
export function bankWordsIn(en: string, index: ReadonlyMap<string, WordDetail>): WordDetail[] {
  const out: WordDetail[] = [];
  const seen = new Set<string>();
  for (const raw of en.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []) {
    const word = index.get(raw.replace(/['’]s$/, ""));
    if (word && !seen.has(word.id)) {
      seen.add(word.id);
      out.push(word);
    }
  }
  return out;
}

/** At most this many words of one sentence are credited or marked weak */
const WORDS_PER_SENTENCE = 5;

/** A sentence said or written right without help: its due words are reviewed. Returns the words credited. */
export async function creditSentenceWords(en: string, now: Date = new Date()): Promise<string[]> {
  const words = bankWordsIn(en, await bankIndex(now).catch(() => new Map())).slice(0, WORDS_PER_SENTENCE);
  const credited: string[] = [];
  for (const w of words) if (await creditWordInContext(w.id, now)) credited.push(w.word);
  if (credited.length > 0) {
    const day = readDay(now);
    day.used = [...new Set([...day.used, ...credited])];
    writeDay(day);
    try {
      window.dispatchEvent(new CustomEvent(WORDS_USED_EVENT, { detail: { words: credited } }));
    } catch {
      /* no window (tests) */
    }
  }
  return credited;
}

/** A sentence missed: its words not yet in long-term memory become weak words */
export async function noteMissedSentence(en: string, now: Date = new Date()): Promise<void> {
  const words = bankWordsIn(en, await bankIndex(now).catch(() => new Map()))
    .filter((w) => (w.srs?.stability ?? 0) < MATURE_STABILITY_DAYS)
    .slice(0, 3);
  noteWeakWords(
    words.map((w) => w.id),
    now
  );
}

/**
 * One sentence answered in a conversation, a review of its lines or a pattern. A right answer counts as practice
 * (a wrong one does not: trying again and again would fill the day) and, given without help, reviews its words;
 * a wrong one marks them weak. `goal`: false where the part already counts the answer toward the daily goal.
 * Fire and forget.
 */
export function answeredSentence(
  source: PracticeSource,
  en: string,
  result: { ok: boolean; unaided: boolean; goal?: boolean },
  now: Date = new Date()
): void {
  if (!result.ok) {
    void noteMissedSentence(en, now).catch(() => {});
    return;
  }
  creditPractice(source, { goal: result.goal ?? true, now });
  if (result.unaided) void creditSentenceWords(en, now).catch(() => {});
}

/** The misses of a pattern session, by the stage (pattern topic) they belong to: the stage's grammar may be weak */
export function notePatternMisses(results: ReadonlyArray<{ topic: string | undefined; ok: boolean }>, now: Date = new Date()): void {
  const misses = new Map<string, number>();
  for (const r of results) if (!r.ok && r.topic) misses.set(r.topic, (misses.get(r.topic) ?? 0) + 1);
  for (const [topic, n] of misses) noteGrammarMisses(topic, n, now);
}
