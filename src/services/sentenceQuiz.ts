/**
 * Sentences in the phone's flash quiz, beside the words: a conversation sentence missed earlier and due for review,
 * or a mastered pattern due again. The Vietnamese is shown, the learner picks the English among three sentences.
 * The floating card (FloatingNudgeActivity.kt) shows any question of this shape and sends back only its id and
 * whether it was right: the id's prefix says which schedule the answer goes to (applySentenceAnswer).
 */
import { shuffle } from "@/lib/utils";
import { allSituations } from "@/data/situations";
import { getPattern } from "@/data/patterns";
import { fillPattern } from "@/types/pattern";
import { dueLines, recordReview as recordLineReview } from "./talk/review";
import { duePatterns, getPatternState, recordReview as recordPatternReview, STEPS } from "./patterns/progress";
import { answeredSentence } from "./learningLinks";
import type { MicroQuizQuestion } from "./duoMotivation";

export const TALK_QUIZ_PREFIX = "talk:";
export const PATTERN_QUIZ_PREFIX = "pattern:";
/** At most this many sentences in one flash quiz */
export const SENTENCE_QUESTIONS_MAX = 3;

function question(id: string, vi: string, en: string, others: string[]): MicroQuizQuestion | null {
  const wrong = shuffle([...new Set(others.filter((o) => o.trim() && o !== en))]).slice(0, 2);
  if (wrong.length < 2) return null;
  const options = shuffle([
    { id: "c", text: en, isCorrect: true },
    ...wrong.map((text, i) => ({ id: `w${i}`, text, isCorrect: false })),
  ]);
  // "word" is what the card's speaker button reads: the English sentence
  return { wordId: id, word: en, direction: "production", scheduled: false, promptTitle: `«${vi}»`, targetMeaning: en, options };
}

/** Conversation sentences due for review, then mastered patterns due again, `max` at most */
export function buildSentenceQuestions(now: Date = new Date(), max: number = SENTENCE_QUESTIONS_MAX): MicroQuizQuestion[] {
  const out: MicroQuizQuestion[] = [];
  const situations = allSituations();
  for (const lineId of dueLines(now)) {
    if (out.length >= max) return out;
    const situation = situations.find((s) => s.lines.some((l) => l.id === lineId));
    const line = situation?.lines.find((l) => l.id === lineId);
    if (!situation || !line) continue;
    // The other sentences of the same conversation: as plausible as the right one
    const q = question(`${TALK_QUIZ_PREFIX}${lineId}`, line.vi, line.en, situation.lines.map((l) => l.en));
    if (q) out.push(q);
  }
  for (const patternId of duePatterns(now)) {
    if (out.length >= max) break;
    const pattern = getPattern(patternId);
    if (!pattern || getPatternState(patternId).step < STEPS || pattern.slots.length < 3) continue;
    // The same pattern with its other slots: the learner must read the Vietnamese to tell them apart
    const [slot, ...rest] = shuffle(pattern.slots);
    const filled = fillPattern(pattern, slot);
    const q = question(`${PATTERN_QUIZ_PREFIX}${patternId}`, filled.vi, filled.en, rest.map((s) => fillPattern(pattern, s).en));
    if (q) out.push(q);
  }
  return out;
}

/** Words first, a sentence after every two of them, the rest of the sentences at the end */
export function mixQuestions(words: MicroQuizQuestion[], sentences: MicroQuizQuestion[], max: number): MicroQuizQuestion[] {
  const out: MicroQuizQuestion[] = [];
  const left = [...sentences];
  words.forEach((w, i) => {
    out.push(w);
    if (i % 2 === 1 && left.length > 0) out.push(left.shift()!);
  });
  return [...out, ...left].slice(0, max);
}

/**
 * An answer from the floating card: a sentence goes to its own schedule (and counts as practice; picked among
 * three, it is not a recall of its words). False when the id is a word's (the caller grades it as a word).
 */
export function applySentenceAnswer(id: string, ok: boolean, now: Date = new Date()): boolean {
  if (id.startsWith(TALK_QUIZ_PREFIX)) {
    const lineId = id.slice(TALK_QUIZ_PREFIX.length);
    recordLineReview(lineId, ok, now);
    const line = allSituations().flatMap((s) => s.lines).find((l) => l.id === lineId);
    if (line) answeredSentence("talk", line.en, { ok, unaided: false }, now);
    return true;
  }
  if (id.startsWith(PATTERN_QUIZ_PREFIX)) {
    const patternId = id.slice(PATTERN_QUIZ_PREFIX.length);
    // Picked among three in a few seconds: a right answer moves the schedule, a mis-tap is not held against it
    if (ok) recordPatternReview(patternId, ok, now);
    const pattern = getPattern(patternId);
    if (pattern) answeredSentence("patterns", pattern.frame_en, { ok, unaided: false }, now);
    return true;
  }
  return false;
}
