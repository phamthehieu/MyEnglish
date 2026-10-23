/**
 * How well each sound (or lesson) is mastered, from what the learner actually did: the answers of the
 * listening quizzes and the pair drills, the days they practised on, and the words they heard or said.
 * Kept in localStorage, next to the lesson progress of src/services/pronunciation.ts.
 *
 * "Mastered" is not a number of repetitions. It needs all three of: recent answers mostly right, the
 * accuracy reached on several different days (spaced practice), and most of the lesson's words met.
 */
import { persistKeyNow } from "./storageBackup";
import { getLocalDateString } from "./streak";

const MASTERY_KEY = "myenglish_pronunciation_mastery_v1";

/** Share of the recent answers that must be right */
export const MASTERY_ACCURACY = 0.8;
/** Different days on which the accuracy was reached */
export const MASTERY_MIN_DAYS = 3;
/** Answers a day needs before it counts as a day of practice */
export const MASTERY_DAY_MIN_ANSWERS = 4;
/** Share of the lesson's words that must have been heard or said */
export const MASTERY_COVERAGE = 0.8;
/** The last answers the accuracy is taken from, and how many it needs to be trusted */
const RECENT_MAX = 20;
const RECENT_MIN = 10;
const DAYS_KEPT = 45;
const WORDS_KEPT = 60;

export interface SoundMastery {
  /** Last answers, 1 = right, 0 = wrong */
  recent: number[];
  /** Local day -> [right, answered] */
  days: Record<string, [number, number]>;
  /** Distinct lowercase words heard in a quiz or said aloud */
  words: string[];
}

type MasteryStore = Record<string, SoundMastery>;

export type MasteryLevel = "new" | "learning" | "mastered";

export interface MasterySummary {
  level: MasteryLevel;
  /** 0-100; 100 only when mastered */
  percent: number;
  /** Accuracy of the recent answers, null before any answer */
  accuracy: number | null;
  answers: number;
  /** Days on which the accuracy was reached */
  goodDays: number;
  wordsMet: number;
  wordsTarget: number;
}

function load(): MasteryStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(MASTERY_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: MasteryStore): void {
  try {
    localStorage.setItem(MASTERY_KEY, JSON.stringify(store));
    persistKeyNow(MASTERY_KEY);
    window.dispatchEvent(new CustomEvent("myenglish-pronunciation-updated"));
  } catch {}
}

function entryOf(store: MasteryStore, id: string): SoundMastery {
  const e = store[id];
  return {
    recent: Array.isArray(e?.recent) ? e.recent : [],
    days: e?.days && typeof e.days === "object" ? e.days : {},
    words: Array.isArray(e?.words) ? e.words : [],
  };
}

function addWords(entry: SoundMastery, words: string[]): void {
  for (const raw of words) {
    const w = raw.trim().toLowerCase();
    if (w && !entry.words.includes(w)) entry.words.push(w);
  }
  if (entry.words.length > WORDS_KEPT) entry.words = entry.words.slice(-WORDS_KEPT);
}

/** Record answers of a quiz or drill for one or more lessons (a pair drill counts for both of its sounds) */
export function recordMasteryAnswers(lessonIds: string[], correct: number, total: number, words: string[] = [], now: Date = new Date()): void {
  if (total <= 0 || lessonIds.length === 0) return;
  const store = load();
  const day = getLocalDateString(now);
  for (const id of new Set(lessonIds)) {
    const e = entryOf(store, id);
    // Order inside one quiz is not kept: wrong answers first, so a good run ends on right answers
    const answers = [...Array(total - correct).fill(0), ...Array(correct).fill(1)];
    e.recent = [...e.recent, ...answers].slice(-RECENT_MAX);
    const prev = e.days[day] ?? [0, 0];
    e.days[day] = [prev[0] + correct, prev[1] + total];
    const keep = Object.keys(e.days).sort().slice(-DAYS_KEPT);
    e.days = Object.fromEntries(keep.map((d) => [d, e.days[d]]));
    addWords(e, words);
    store[id] = e;
  }
  save(store);
}

/** Words said aloud count toward the words met, not toward accuracy (they are self-rated) */
export function recordMasteryWords(lessonId: string, words: string[]): void {
  const store = load();
  const e = entryOf(store, lessonId);
  addWords(e, words);
  store[lessonId] = e;
  save(store);
}

export function getMastery(): MasteryStore {
  return load();
}

/** `wordCount` is how many words the lesson teaches; the target is MASTERY_COVERAGE of them */
export function summarizeMastery(entry: SoundMastery | undefined, wordCount: number): MasterySummary {
  const wordsTarget = Math.max(1, Math.ceil(wordCount * MASTERY_COVERAGE));
  if (!entry || (entry.recent.length === 0 && entry.words.length === 0)) {
    return { level: "new", percent: 0, accuracy: null, answers: 0, goodDays: 0, wordsMet: 0, wordsTarget };
  }
  const answers = entry.recent.length;
  const accuracy = answers > 0 ? entry.recent.reduce((a, b) => a + b, 0) / answers : null;
  const goodDays = Object.values(entry.days).filter(([ok, n]) => n >= MASTERY_DAY_MIN_ANSWERS && ok / n >= MASTERY_ACCURACY).length;
  const wordsMet = entry.words.length;

  // Each part is how far the learner is toward its goal, 0-1
  const accuracyPart = accuracy === null ? 0 : Math.min(1, accuracy / MASTERY_ACCURACY) * Math.min(1, answers / RECENT_MIN);
  const daysPart = Math.min(1, goodDays / MASTERY_MIN_DAYS);
  const wordsPart = Math.min(1, wordsMet / wordsTarget);
  const mastered = accuracyPart >= 1 && daysPart >= 1 && wordsPart >= 1;
  const percent = mastered ? 100 : Math.min(99, Math.round(100 * (0.5 * accuracyPart + 0.3 * daysPart + 0.2 * wordsPart)));
  return { level: mastered ? "mastered" : "learning", percent, accuracy, answers, goodDays, wordsMet, wordsTarget };
}

/** The lesson ids of the sounds of a pair, by IPA symbol (the pair drills live outside the sound lessons) */
export async function lessonIdsForSounds(symbols: string[]): Promise<string[]> {
  const { PHONEME_CHART } = await import("@/data/phonemes");
  const ids: string[] = [];
  for (const group of PHONEME_CHART) {
    for (const entry of group.entries) if (symbols.includes(entry.sym)) ids.push(entry.lessonId);
  }
  return ids;
}
