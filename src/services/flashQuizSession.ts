/**
 * The questions of the floating Flash-Quiz (Android): what the learner studied today and the words they keep
 * getting wrong, so one session revisits them instead of asking one random due word.
 * Order of priority: missed today -> "từ hay quên" (active) -> learned/reviewed today. Each word is asked once.
 */
import type { WordDetail } from "@/types/database";
import { shuffle } from "@/lib/utils";
import { getDatabase, isPlaceholderMeaning } from "./db";
import { generateMultipleChoiceQuestion, isSuspended } from "./smartReview";
import { loadForgottenWords } from "./forgottenWords";
import type { MicroQuizQuestion } from "./duoMotivation";

/** Questions handed to one reminder (the floating card asks up to this many) */
export const FLASH_QUIZ_SESSION_SIZE = 10;

interface TodayRow {
  word_id: string;
  wrong: number;
}

/** Words answered today (introductions and "Đã biết" excluded) with how many of the answers were misses */
async function loadTodayWords(now: Date): Promise<TodayRow[]> {
  const db = await getDatabase();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  return db.select<TodayRow[]>(
    `SELECT word_id, SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS wrong FROM review_logs
     WHERE timestamp >= $1 AND exercise_type != 'known' AND (is_scheduled IS NULL OR is_scheduled != 2)
     GROUP BY word_id ORDER BY MAX(timestamp) DESC`,
    [dayStart]
  );
}

function toQuestion(word: WordDetail, allWords: WordDetail[]): MicroQuizQuestion | null {
  const mcq = generateMultipleChoiceQuestion(word, allWords, "en_to_vn");
  const correct = mcq.options.find((o) => o.isCorrect);
  if (!correct) return null;
  // 3 options, as in selectMicroQuizQuestion: the floating card has room for three
  const options = shuffle([...mcq.options.filter((o) => !o.isCorrect).slice(0, 2), correct]);
  return {
    wordId: word.id,
    word: word.word,
    direction: "recognition",
    scheduled: false,
    promptTitle: word.word,
    phonetic: word.phonetic || undefined,
    partOfSpeech: word.part_of_speech || undefined,
    targetMeaning: word.meaning_vn,
    options: options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
  };
}

/** Up to `max` questions: words missed today, then forgotten words, then the rest of today's words */
export async function buildFlashQuizSession(
  allWords: WordDetail[],
  now: Date = new Date(),
  max: number = FLASH_QUIZ_SESSION_SIZE
): Promise<MicroQuizQuestion[]> {
  const byId = new Map(allWords.map((w) => [w.id, w]));
  const usable = (w: WordDetail | undefined): w is WordDetail =>
    !!w && !isPlaceholderMeaning(w.meaning_vn) && !isSuspended(w);

  const today = await loadTodayWords(now).catch(() => [] as TodayRow[]);
  const forgotten = await loadForgottenWords(allWords, now).catch(() => null);

  const ordered: WordDetail[] = [];
  const seen = new Set<string>();
  const add = (w: WordDetail | undefined) => {
    if (!usable(w) || seen.has(w.id)) return;
    seen.add(w.id);
    ordered.push(w);
  };

  today.filter((r) => r.wrong > 0).forEach((r) => add(byId.get(r.word_id)));
  forgotten?.active.forEach((e) => add(e.word));
  today.forEach((r) => add(byId.get(r.word_id)));

  const out: MicroQuizQuestion[] = [];
  for (const w of ordered) {
    if (out.length >= max) break;
    const q = toQuestion(w, allWords);
    if (q) out.push(q);
  }
  return out;
}
