import { checkSentence, normalizeWord, type SentenceCheck } from "@/services/sentenceCheck";

/**
 * The two typing exercises of the Shadowing screen: dictation (hear a sentence, type all of it) and filling blanks
 * (the sentence is shown with a few words missing). Both only compare what was typed with the sentence.
 */

/** The word without the punctuation around it: "collapses," -> collapses */
export function bareWord(raw: string): string {
  return raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

export interface DictationResult {
  /** Every word is right (figures are not judged) and nothing extra was typed */
  correct: boolean;
  check: SentenceCheck;
}

/** Line up the typed words with the sentence, word by word; capitals and punctuation do not count */
export function gradeDictation(target: string, typed: string): DictationResult {
  const heard = typed
    .split(/\s+/)
    .filter((w) => normalizeWord(w) !== "")
    .map((word) => ({ word, conf: 1 }));
  const check = checkSentence(target, heard);
  const correct = check.words.every((w) => w.status === "ok" || w.status === "skip") && check.extra.length === 0;
  return { correct, check };
}

/** How many words a text has, for the "3/14" counter */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => normalizeWord(w) !== "").length;
}

/** Words too small or too common to be worth a blank */
const SKIP_FOR_BLANKS = new Set([
  "about", "after", "again", "also", "because", "been", "before", "being", "could", "does", "from", "have", "into", "just",
  "like", "more", "much", "only", "other", "over", "should", "some", "than", "that", "their", "them", "then", "there", "these",
  "they", "this", "those", "through", "very", "were", "what", "when", "where", "which", "while", "will", "with", "would", "your",
]);

/**
 * Which words of a sentence become blanks: about a quarter of them, 1 to 4, taken from the words the learner has not
 * learned yet first, then from the longer ones. The same sentence always gets the same blanks. Returns word positions.
 */
export function pickBlanks(words: string[], unlearned: (word: string) => boolean): number[] {
  const candidates = words
    .map((raw, i) => ({ i, w: bareWord(raw).toLowerCase() }))
    .filter(({ w }) => w.length >= 4 && /^[a-z']+$/.test(w) && !SKIP_FOR_BLANKS.has(w));
  if (candidates.length === 0) return [];
  const want = Math.max(1, Math.min(4, Math.round(words.length / 4), candidates.length));
  return candidates
    .map((c) => ({ ...c, score: (unlearned(words[c.i]) ? 100 : 0) + c.w.length }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, want)
    .map((c) => c.i)
    .sort((a, b) => a - b);
}

/** For each blank: is what was typed the missing word (case and spaces around it do not matter)? */
export function gradeBlanks(answers: string[], solutions: string[]): boolean[] {
  return solutions.map((solution, i) => normalizeWord(answers[i] ?? "") !== "" && normalizeWord(answers[i] ?? "") === normalizeWord(solution));
}
