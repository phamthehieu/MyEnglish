import { describe, it, expect, vi, beforeEach } from "vitest";
import { matchTyped, fullForm, normalizeSpeech } from "@/services/talk/engine";
import { isTranslation, limitFor } from "@/services/patterns/translate";
import { gradeBlanks, gradeDictation } from "@/services/shadowingPractice";
import { fillPattern } from "@/types/pattern";
import { freshServices } from "./helpers";

/** A right answer is graded right wherever it is typed, a help or a machine's doubt is not a wrong answer */

const line = (en: string) => ({ id: "l", en, vi: "", accept: [] });

describe("contractions either way are the same answer", () => {
  it.each([
    ["I'm from Vietnam.", "I am from Vietnam"],
    ["I've lived here since last year.", "i have lived here since last year"],
    ["I'll call you.", "I will call you"],
    ["There's a bank near here.", "there is a bank near here"],
    ["We can't go.", "we cannot go"],
    ["We can't go.", "we can not go"],
    ["He didn't come.", "he did not come"],
    ["I won't go.", "I will not go"],
    ["Let's go.", "let us go"],
    ["I am happy.", "I’m happy"],
  ])("%s = %s", (en, typed) => {
    expect(matchTyped(typed, [line(en)])).not.toBeNull();
    expect(isTranslation(typed, en)).toBe(true);
  });

  it("does not take a possessive for a contraction, or a wrong word for the right one", () => {
    expect(fullForm(normalizeSpeech("Anna's bag"))).toBe("anna's bag");
    expect(isTranslation("I am from Japan", "I'm from Vietnam")).toBe(false);
  });

  it("forgives them in dictation and blanks, but not a wrong letter: spelling is what those train", () => {
    expect(gradeDictation("I'm from Vietnam.", "I am from Vietnam").correct).toBe(true);
    expect(gradeDictation("Don't worry.", "dont worry").correct).toBe(true);
    expect(gradeDictation("It's well-known.", "its well known").correct).toBe(false); // "its" is another word
    expect(gradeDictation("We recieved it.", "We received it").correct).toBe(false);
    expect(gradeBlanks(["dont", "I am"], ["don't", "I'm"])).toEqual([true, true]);
    expect(gradeBlanks(["cemetery"], ["cemetry"])).toEqual([false]);
  });

  it("leaves time to read, recall and type a sentence on a phone", () => {
    expect(limitFor(5)).toBe(35000);
  });
});

describe("the easy exercises", () => {
  it("offer the meaning among others of the pattern, and the first letters of a sentence", async () => {
    const { buildListen, firstLetters } = await import("@/services/patterns/engine");
    const { PATTERNS } = await import("@/data/patterns");
    for (const p of PATTERNS) {
      const item = buildListen(p, p.slots[0]);
      expect(item.options, p.id).toContain(item.answer);
      expect(new Set(item.options).size, p.id).toBe(item.options.length);
      expect(item.options.length, p.id).toBeGreaterThanOrEqual(2);
    }
    expect(firstLetters("My name is Anna.")).toBe("M_ n___ i_ A___.");
    expect(firstLetters("I'm fine.")).toBe("I'm f___.");
  });
});

describe("the Vietnamese of a filled pattern", () => {
  it("starts with a capital when the frame starts with the blank", () => {
    expect(fillPattern({ frame_en: "How about ___?", frame_vi: "___ thì sao?" }, { en: "this Saturday", vi: "thứ Bảy này" }).vi).toBe("Thứ Bảy này thì sao?");
    expect(fillPattern({ frame_en: "My name is ___.", frame_vi: "Tên tôi là ___." }, { en: "Anna", vi: "Anna" }).vi).toBe("Tên tôi là Anna.");
  });
});

describe("a session's credit", () => {
  beforeEach(() => localStorage.clear());

  it("counts only right answers toward the goal, and a test to skip says nothing of weak grammar", async () => {
    await freshServices();
    const session = await import("@/services/patterns/session");
    const streak = await import("@/services/streak");
    const weak = await import("@/services/weakPoints");
    const { PATTERNS } = await import("@/data/patterns");
    const p = PATTERNS[0];
    const results = [{ patternId: p.id, ok: true }, { patternId: p.id, ok: false }, { patternId: p.id, ok: false }, { patternId: p.id, ok: false }];
    session.applyTranslate(results);
    expect(streak.getActivityLogs()[streak.getLocalDateString()]).toBe(1);
    expect(weak.weakGrammarStage()).toBeNull();
    session.applyTranslate(results, { studied: true });
    expect(weak.weakGrammarStage()?.stageId).toBe(p.topic);
  });
});

describe("the path", () => {
  beforeEach(() => localStorage.clear());

  it("opens at most two new patterns a day, however many sessions", async () => {
    await freshServices();
    const { buildDayPlan } = await import("@/services/roadmap/plan");
    const { buildStages } = await import("@/services/roadmap/stages");
    const { PATTERNS } = await import("@/data/patterns");
    const stage = buildStages(PATTERNS.filter((p) => p.level === "A1"), "all").find((s) => s.patterns.length >= 4)!;
    const day = new Date(2026, 0, 10, 9);
    const road = { goal: "all", done: [], skipped: [], tested: [], conversed: [], wordsAdded: [], tipSeen: [], focus: null } as never;
    const started = (id: string) => ({ [id]: { step: 2, due: "2026-01-11", box: 0, times: [], lastDay: "2026-01-10" } });
    const states = { ...started(stage.patterns[0].id), ...started(stage.patterns[1].id) };
    const plan = buildDayPlan(stage, road, states, [], 25, day);
    expect(plan.tasks).toEqual([]);
    expect(buildDayPlan(stage, road, states, [], 25, new Date(2026, 0, 11, 9)).tasks.length).toBeGreaterThan(0);
  });
});

describe("the grammar book", () => {
  it("has no key of another exercise, and a learner's installed book gets the corrections", async () => {
    vi.resetModules();
    const db = await import("@/services/db");
    const conn = await db.getDatabase();
    const book = await import("@/services/grammarBook");
    await book.clearGrammarBook();
    await book.ensureGrammarBookSeeded();
    const itemOf = async (setId: string, n: number) => {
      const chapters = await book.getAllBookChapters();
      return chapters.flatMap((c) => c.practiceGroups ?? []).flatMap((g) => g.items).find((it) => it.setId === setId && it.n === n);
    };
    const right = await itemOf("ch20-s02", 1);
    expect(right?.answers).toEqual([["to accept"]]);

    // A book seeded before the corrections, with an exercise the learner added
    const rows = await conn.select<Array<{ id: string; data: string }>>(`SELECT id, data FROM grammar_book_items WHERE chapter_id = 'ch20'`);
    const row = rows.find((r) => JSON.parse(r.data).setId === "ch20-s02" && JSON.parse(r.data).n === 1)!;
    await conn.execute(`UPDATE grammar_book_items SET data = $1 WHERE id = $2`, [JSON.stringify({ ...JSON.parse(row.data), answers: [["five and two - sevenths"]] }), row.id]);
    await conn.execute(`INSERT INTO grammar_book_items (id, chapter_id, ord, data) VALUES ('mine-1', 'ch20', 9999, $1)`, [JSON.stringify({ ...JSON.parse(row.data), id: "mine-1", setId: "mine", n: 1, prompt: "My own" })]);
    await conn.execute(`DELETE FROM app_kv WHERE key = 'grammar_book_revision'`);
    await book.ensureGrammarBookSeeded();
    book.clearBookCache?.();
    expect((await itemOf("ch20-s02", 1))?.answers).toEqual([["to accept"]]);
    const chapters = await book.getAllBookChapters();
    expect(chapters.flatMap((c) => c.practiceGroups ?? []).flatMap((g) => g.items).some((it) => it.prompt === "My own")).toBe(true);
    // Once: a second start changes nothing
    await conn.execute(`UPDATE grammar_book_items SET data = $1 WHERE id = $2`, [JSON.stringify({ ...JSON.parse(row.data), answers: [["changed by a later import"]] }), row.id]);
    await book.ensureGrammarBookSeeded();
    book.clearBookCache?.();
    expect((await itemOf("ch20-s02", 1))?.answers).toEqual([["changed by a later import"]]);
  });
});
