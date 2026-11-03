import { describe, it, expect, beforeEach } from "vitest";
import { freshServices, DAY_MS } from "./helpers";
import { buildTodayTasks, pickNextStep, type TodayTaskInput } from "@/components/dashboard/todayPlan";

/**
 * The links between the parts of the app (learningLinks.ts, weakPoints.ts, sentenceQuiz.ts): practice everywhere
 * counts, a word used is a word reviewed, a mistake is worked on elsewhere, Today and the phone's quiz carry it.
 */

const input = (word: string) => ({
  word,
  meaning_vn: "nghĩa của " + word,
  synonyms: [],
  antonyms: [],
  examples: [{ sentence_en: `The ${word} works.`, grammar_analysis: "S + V" }],
});

async function services() {
  const base = await freshServices();
  const links = await import("@/services/learningLinks");
  const weak = await import("@/services/weakPoints");
  const streak = await import("@/services/streak");
  return { ...base, links, weak, streak };
}

/** A word in Review whose recognition card is due (or not) */
async function reviewWord(db: Awaited<ReturnType<typeof services>>["db"], word: string, due: boolean, stability = 4): Promise<string> {
  const conn = await db.getDatabase();
  const id = await db.insertEnrichedWord(input(word));
  const at = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString();
  await conn.execute(
    `INSERT OR REPLACE INTO srs_reviews (word_id, next_review_date, stability, difficulty, reps, lapses, state, last_review, scheduled_days)
     VALUES ($1, $2, $3, 5, 3, 0, 2, $4, 4)`,
    [id, due ? at(-1) : at(5), stability, at(-5)]
  );
  return id;
}

beforeEach(() => localStorage.clear());

describe("every practice counts", () => {
  it("counts toward the daily goal and gives XP, capped per day and per kind", async () => {
    const { links, streak } = await services();
    const today = streak.getLocalDateString();
    expect(links.creditPractice("talk")).toBe(links.PRACTICE_XP.talk);
    expect(streak.getActivityLogs()[today]).toBe(1);
    let total = links.PRACTICE_XP.talk;
    for (let i = 0; i < 50; i++) total += links.creditPractice("talk");
    expect(total).toBe(links.PRACTICE_XP_CAP);
    // Another kind has its own cap
    expect(links.creditPractice("reading")).toBe(links.PRACTICE_XP.reading);
    expect(links.practicedToday("talk")).toBe(true);
    expect(links.practicedToday("shadowing")).toBe(false);
  });

  it("does not count a wrong answer toward the goal (trying again and again would fill the day)", async () => {
    const { links, streak } = await services();
    links.answeredSentence("talk", "I would like a coffee.", { ok: false, unaided: false });
    expect(streak.getActivityLogs()[streak.getLocalDateString()] ?? 0).toBe(0);
    links.answeredSentence("patterns", "I would like a coffee.", { ok: true, unaided: false, goal: false });
    expect(streak.getActivityLogs()[streak.getLocalDateString()] ?? 0).toBe(0);
    expect(links.practicedToday("patterns")).toBe(true);
  });
});

describe("a word used is a word reviewed", () => {
  it("credits the due words of a sentence said right, and leaves the others alone", async () => {
    const { db, links } = await services();
    const due = await reviewWord(db, "meeting", true);
    // Not due and well remembered (a fading one would be credited: see creditImplicitGood)
    const notDue = await reviewWord(db, "deadline", false, 60);
    const used: string[][] = [];
    window.addEventListener(links.WORDS_USED_EVENT, (e) => used.push((e as CustomEvent).detail.words));

    const credited = await links.creditSentenceWords("The meeting is before the deadline.");
    expect(credited).toEqual(["meeting"]);
    expect(used).toEqual([["meeting"]]);
    expect(links.wordsUsedToday()).toEqual(["meeting"]);
    const rows = await db.getWordsByIds([due, notDue]);
    const a = rows.find((w) => w.id === due)!;
    const b = rows.find((w) => w.id === notDue)!;
    expect(new Date(a.srs.next_review_date).getTime()).toBeGreaterThan(Date.now());
    expect(b.srs.reps).toBe(3);
    // Logged as implicit, apart from real reviews
    const conn = await db.getDatabase();
    const logs = await conn.select<Array<{ is_scheduled: number; exercise_type: string }>>(`SELECT is_scheduled, exercise_type FROM review_logs WHERE word_id = $1`, [due]);
    expect(logs).toEqual([{ is_scheduled: 2, exercise_type: "context_match" }]);
  });

  it("finds a word through its forms", async () => {
    const { db, links } = await services();
    await reviewWord(db, "meeting", true);
    const index = new Map([["meetings", { id: "x", word: "meeting" }]]) as never;
    expect(links.bankWordsIn("Two meetings today.", index).map((w) => w.word)).toEqual(["meeting"]);
  });
});

describe("a mistake is worked on elsewhere", () => {
  it("makes the words of a missed sentence weak, the young ones only, until answered right", async () => {
    const { db, links, weak } = await services();
    const young = await reviewWord(db, "invoice", false, 3);
    await reviewWord(db, "office", false, 60);
    await links.noteMissedSentence("Send the invoice to the office.");
    expect(weak.weakWordIds()).toEqual([young]);
    weak.clearWeakWord(young);
    expect(weak.weakWordIds()).toEqual([]);
  });

  it("lets weak words go after a week, the most missed first", async () => {
    const { weak } = await services();
    const now = new Date(2026, 10, 3);
    weak.noteWeakWords(["a"], now);
    weak.noteWeakWords(["b"], now);
    weak.noteWeakWords(["b"], now);
    expect(weak.weakWordIds(now)).toEqual(["b", "a"]);
    expect(weak.weakWordIds(new Date(2026, 10, 10))).toEqual([]);
  });

  it("offers a stage's grammar after repeated pattern misses, once until new misses", async () => {
    const { links, weak } = await services();
    const day1 = new Date(2026, 10, 3, 9);
    links.notePatternMisses([{ topic: "food-drink", ok: false }, { topic: "food-drink", ok: true }], day1);
    expect(weak.weakGrammarStage(day1)).toBeNull();
    links.notePatternMisses([{ topic: "food-drink", ok: false }, { topic: "food-drink", ok: false }], day1);
    expect(weak.weakGrammarStage(day1)).toEqual({ stageId: "food-drink", misses: 3, reviewedToday: false });
    weak.markGrammarReviewed("food-drink", day1);
    expect(weak.weakGrammarStage(day1)?.reviewedToday).toBe(true);
    const day2 = new Date(2026, 10, 4, 9);
    expect(weak.weakGrammarStage(day2)).toBeNull();
    // New misses after the review count from zero
    links.notePatternMisses([{ topic: "food-drink", ok: false }], day2);
    expect(weak.weakGrammarStage(day2)).toBeNull();
  });
});

describe("Today carries it", () => {
  const base: TodayTaskInput = {
    minutes: 10,
    vocab: { reviews: 5, newToday: 2, minutes: 4 },
    grammar: null,
    pronunciation: null,
    speaking: { title: "Lộ trình nói", detail: "", minutes: 4, done: false, onPath: true },
  };

  it("puts the missed conversation sentences right after the speaking path, and the weak grammar before the extras", () => {
    const tasks = buildTodayTasks({ ...base, talkReview: { due: 4 }, weakGrammar: { title: "Gọi đồ", misses: 3, reviewedToday: false } });
    expect(tasks.map((t) => t.id).slice(0, 4)).toEqual(["speaking", "talkReview", "vocab", "weakGrammar"]);
    const weak = tasks.find((t) => t.id === "weakGrammar");
    expect(weak?.title).toBe("Ngữ pháp hay sai: Gọi đồ");
    // Part of the day even when the minutes are used up
    expect(weak?.optional).toBeUndefined();
    expect(buildTodayTasks({ ...base, talkReview: { due: 0 } }).some((t) => t.id === "talkReview")).toBe(false);
  });

  it("offers a conversation once the day is done, when none was practised", () => {
    expect(pickNextStep({ pronunciationAvailable: true, pronunciationDone: false, simple: false, talkDone: false }).tab).toBe("talk");
    expect(pickNextStep({ pronunciationAvailable: true, pronunciationDone: false, simple: false, talkDone: true }).tab).toBe("pronunciation");
  });
});

describe("sentences in the phone's quiz", () => {
  it("asks a missed conversation sentence with two others of the conversation, and grades it on its own schedule", async () => {
    await freshServices();
    const { allSituations } = await import("@/data/situations");
    const review = await import("@/services/talk/review");
    const quiz = await import("@/services/sentenceQuiz");
    const situation = allSituations().find((s) => s.lines.length >= 3)!;
    const line = situation.lines[0];
    review.scheduleMiss(line.id);

    const [q] = quiz.buildSentenceQuestions();
    expect(q.wordId).toBe(`${quiz.TALK_QUIZ_PREFIX}${line.id}`);
    expect(q.promptTitle).toBe(`«${line.vi}»`);
    expect(q.options).toHaveLength(3);
    expect(q.options.filter((o) => o.isCorrect).map((o) => o.text)).toEqual([line.en]);

    expect(quiz.applySentenceAnswer(q.wordId, true)).toBe(true);
    expect(review.dueLines()).not.toContain(line.id);
    expect(quiz.applySentenceAnswer("some-word-id", true)).toBe(false);
  });

  it("mixes one sentence after every two words", async () => {
    const { mixQuestions } = await import("@/services/sentenceQuiz");
    const q = (id: string) => ({ wordId: id }) as never;
    expect(mixQuestions([q("w1"), q("w2"), q("w3")], [q("s1"), q("s2")], 10).map((x: { wordId: string }) => x.wordId)).toEqual(["w1", "w2", "s1", "w3", "s2"]);
    expect(mixQuestions([], [q("s1")], 10).map((x: { wordId: string }) => x.wordId)).toEqual(["s1"]);
  });
});

describe("one level for every part", () => {
  it("starts grammar at the tenses of the level chosen (C1 adds none: B2's), A1 or an empty book at the default", async () => {
    const { initialTensesIn, DEFAULT_INITIAL_TENSE_IDS } = await import("@/services/grammarPath");
    const book = [
      { id: "ch01-l01", title: "Present Simple" },
      { id: "ch02-l03", title: "Present Perfect Continuous" },
      { id: "ch03-l02", title: "Past Perfect" },
      { id: "ch04-l02", title: "Future Continuous" },
      { id: "ch04-l03", title: "Future Perfect" },
    ];
    expect(initialTensesIn("A1", book)).toEqual([...DEFAULT_INITIAL_TENSE_IDS]);
    expect(initialTensesIn("B1", book)).toEqual(["ch02-l03", "ch03-l02", "ch04-l02"]);
    expect(initialTensesIn("C1", book)).toEqual(["ch04-l03"]);
    expect(initialTensesIn("B1", [])).toEqual([...DEFAULT_INITIAL_TENSE_IDS]);
  });
});
