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
  const t = normalizeTokens(typed).split(" ").filter(Boolean);
  let n = 0;
  while (n < t.length && n < words.length && sameWord(t[n], bare(words[n]))) n++;
  return n;
}

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
  "13": "thirteen",
  "14": "fourteen",
  "15": "fifteen",
  "16": "sixteen",
  "17": "seventeen",
  "18": "eighteen",
  "19": "nineteen",
  "20": "twenty",
  "21": "twenty one",
  "22": "twenty two",
  "23": "twenty three",
  "24": "twenty four",
  "25": "twenty five",
  "26": "twenty six",
  "27": "twenty seven",
  "28": "twenty eight",
  "29": "twenty nine",
  "30": "thirty",
  "35": "thirty five",
  "40": "forty",
  "45": "forty five",
  "50": "fifty",
  "60": "sixty",
};

/** Expand digits and clock times ("5:30" -> "five thirty", "25" -> "twenty five") before comparing */
function normalizeTokens(text: string): string {
  const withNumbers = text
    .replace(/\b(\d{1,2}):00\b/g, "$1")
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => `${NUMBER_WORDS[h] ?? h} ${NUMBER_WORDS[String(Number(m))] ?? m}`)
    .replace(/\b(\d{1,2})\b/g, (d) => NUMBER_WORDS[d] ?? d);
  return normalizeSpeech(withNumbers.replace(/-/g, " "));
}

const CONTRACTIONS: Array<[string, string]> = [
  ["i'm", "i am"],
  ["it's", "it is"],
  ["i'd", "i would"],
  ["don't", "do not"],
  ["doesn't", "does not"],
  ["didn't", "did not"],
  ["isn't", "is not"],
  ["aren't", "are not"],
  ["wasn't", "was not"],
  ["weren't", "were not"],
  ["can't", "cannot"],
  ["couldn't", "could not"],
  ["shouldn't", "should not"],
  ["wouldn't", "would not"],
  ["won't", "will not"],
  ["haven't", "have not"],
  ["hasn't", "has not"],
  ["hadn't", "had not"],
  ["let's", "let us"],
  ["that's", "that is"],
  ["what's", "what is"],
  ["where's", "where is"],
  ["who's", "who is"],
  ["how's", "how is"],
  ["there's", "there is"],
  ["here's", "here is"],
  ["name's", "name is"],
  ["he's", "he is"],
  ["she's", "she is"],
  ["you're", "you are"],
  ["we're", "we are"],
  ["they're", "they are"],
  ["i'll", "i will"],
  ["you'll", "you will"],
  ["we'll", "we will"],
  ["they'll", "they will"],
  ["he'll", "he will"],
  ["she'll", "she will"],
  ["it'll", "it will"],
  ["i've", "i have"],
  ["you've", "you have"],
  ["we've", "we have"],
  ["they've", "they have"],
];

const EQUIVALENT_PHRASES: Array<[string, string]> = [
  ["get up", "wake up"],
  ["am from", "come from"],
  ["are from", "come from"],
  ["is from", "comes from"],
  ["ok", "okay"],
  ["thanks", "thank you"],
];

/** The sentence and the same sentence with its contractions written out (or the other way round): both are right */
export function acceptedForms(en: string): string[] {
  const forms = new Set([normalizeTokens(en)]);
  for (const [short, long] of [...CONTRACTIONS, ...EQUIVALENT_PHRASES]) {
    for (const f of [...forms]) {
      if (f.includes(short)) forms.add(f.split(short).join(long));
      if (f.includes(long)) forms.add(f.split(long).join(short));
    }
  }
  return [...forms];
}

/** Optional trailing time qualifiers a learner naturally adds ("at 7 am", "at seven o'clock") */
function stripOptionalTimeSuffix(tokens: string): string {
  return tokens.replace(/\s+(?:o'clock|oclock|am|a m|pm|p m)$/, "");
}

/** Is what was typed the sentence? Contractions, digits/words, and one slip in a longer word are forgiven */
export function isTranslation(typed: string, en: string): boolean {
  const t = normalizeTokens(typed);
  if (!t) return false;
  const candidates = new Set([t, stripOptionalTimeSuffix(t)]);
  return acceptedForms(en).some((form) => {
    const want = form.split(" ");
    const wantStripped = stripOptionalTimeSuffix(form).split(" ");
    for (const cand of candidates) {
      const got = cand.split(" ");
      if (want.length === got.length && want.every((w, i) => sameWord(got[i], w))) return true;
      if (wantStripped.length === got.length && wantStripped.every((w, i) => sameWord(got[i], w))) return true;
    }
    return false;
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
