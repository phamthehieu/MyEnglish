import { fillPattern, type Pattern, type PatternSlot } from "@/types/pattern";
import { editDistance, normalizeSpeech } from "@/services/talk/engine";
import { getPatternState } from "./progress";

/** "Dịch câu": the Vietnamese sentence is shown, the learner writes (or says) it in English against the clock */

/** How much of the English sentence is shown as a help */
export type HintLevel = "full" | "count" | "none";

export interface TranslateItem {
  pattern: Pattern;
  slot: PatternSlot;
  vi: string;
  en: string;
  /** The words of the English sentence as written ("I'm", "Vietnam.") */
  words: string[];
  hint: HintLevel;
}

export const wordsOfSentence = (en: string): string[] => en.trim().split(/\s+/).filter(Boolean);

/** A pattern that is new gets the full skeleton, one that is getting known only the number of words, a known one nothing */
export function hintFor(step: number): HintLevel {
  return step <= 1 ? "full" : step <= 3 ? "count" : "none";
}

/** `size` sentences, each from a different pattern while there are enough of them, with a random word in the blank */
export function buildTranslateRound(
  patterns: readonly Pattern[],
  size = 10,
  random: () => number = Math.random,
  stepOf: (id: string) => number = (id) => getPatternState(id).step
): TranslateItem[] {
  if (patterns.length === 0) return [];
  const order = [...patterns].sort(() => random() - 0.5);
  const items: TranslateItem[] = [];
  for (let i = 0; i < size; i++) {
    const pattern = order[i % order.length];
    const slot = pattern.slots[Math.floor(random() * pattern.slots.length)];
    const filled = fillPattern(pattern, slot);
    items.push({ pattern, slot, vi: filled.vi, en: filled.en, words: wordsOfSentence(filled.en), hint: hintFor(stepOf(pattern.id)) });
  }
  return items;
}

const bare = (word: string) => normalizeSpeech(word);

/** The same word, allowing one slip in a word of five letters or more */
function sameWord(typed: string, expected: string): boolean {
  return typed === expected || (expected.length >= 5 && editDistance(typed, expected) <= 1);
}

/** How many words from the start of the sentence the typed text has right: these light up as the learner types */
export function matchedWords(typed: string, words: readonly string[]): number {
  const t = normalizeSpeech(typed).split(" ").filter(Boolean);
  let n = 0;
  while (n < t.length && n < words.length && sameWord(t[n], bare(words[n]))) n++;
  return n;
}

const CONTRACTIONS: Array<[string, string]> = [
  ["i'm", "i am"],
  ["it's", "it is"],
  ["i'd", "i would"],
  ["don't", "do not"],
  ["doesn't", "does not"],
  ["isn't", "is not"],
  ["can't", "cannot"],
  ["let's", "let us"],
  ["that's", "that is"],
  ["what's", "what is"],
  ["where's", "where is"],
  ["he's", "he is"],
  ["she's", "she is"],
  ["you're", "you are"],
  ["we're", "we are"],
  ["they're", "they are"],
];

/** The sentence and the same sentence with its contractions written out (or the other way round): both are right */
export function acceptedForms(en: string): string[] {
  const forms = new Set([normalizeSpeech(en)]);
  for (const [short, long] of CONTRACTIONS) {
    for (const f of [...forms]) {
      if (f.includes(short)) forms.add(f.split(short).join(long));
      if (f.includes(long)) forms.add(f.split(long).join(short));
    }
  }
  return [...forms];
}

/** Is what was typed the sentence? Contractions either way and one slip in a longer word are forgiven */
export function isTranslation(typed: string, en: string): boolean {
  const t = normalizeSpeech(typed);
  if (!t) return false;
  return acceptedForms(en).some((form) => {
    const want = form.split(" ");
    const got = t.split(" ");
    return want.length === got.length && want.every((w, i) => sameWord(got[i], w));
  });
}

/** Time for one sentence: more words, more time (typing is slow on a phone) */
export const limitFor = (wordCount: number): number => 10000 + 2500 * wordCount;

/**
 * Points: a right answer is worth 100, less 25 for each help and 12 for each wrong try, never less than 20,
 * plus a bonus for a quick one.
 */
export function pointsFor(ok: boolean, hints: number, mistakes: number, ms: number, limitMs: number): number {
  if (!ok) return 0;
  const base = Math.max(20, 100 - 25 * hints - 12 * mistakes);
  const bonus = ms < limitMs * 0.4 ? 20 : ms < limitMs * 0.7 ? 10 : 0;
  return base + bonus;
}

export interface TranslateResult {
  patternId: string;
  vi: string;
  en: string;
  ok: boolean;
  ms: number;
  hints: number;
  points: number;
}
