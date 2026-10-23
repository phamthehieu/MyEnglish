import { beforeEach, describe, expect, it } from "vitest";
import { getMastery, recordMasteryAnswers, recordMasteryWords, summarizeMastery } from "@/services/pronunciationMastery";

const day = (n: number) => new Date(2026, 9, n, 12);
const WORDS = ["see", "tea", "key", "eat", "week", "green"];

describe("pronunciation mastery", () => {
  beforeEach(() => localStorage.clear());

  it("is new until something is practised", () => {
    expect(summarizeMastery(undefined, 6)).toMatchObject({ level: "new", percent: 0 });
  });

  it("is not mastered after one perfect session: it needs several days", () => {
    recordMasteryAnswers(["a"], 12, 12, WORDS, day(1));
    const m = summarizeMastery(getMastery().a, 6);
    expect(m.level).toBe("learning");
    expect(m.goodDays).toBe(1);
    expect(m.percent).toBeLessThan(100);
  });

  it("is mastered with accuracy on 3 different days and most words met", () => {
    for (const d of [1, 2, 3]) recordMasteryAnswers(["a"], 5, 5, WORDS, day(d));
    const m = summarizeMastery(getMastery().a, 6);
    expect(m).toMatchObject({ level: "mastered", percent: 100, goodDays: 3 });
  });

  it("does not count a day with too few answers", () => {
    for (const d of [1, 2, 3]) recordMasteryAnswers(["a"], 2, 2, WORDS, day(d));
    expect(summarizeMastery(getMastery().a, 6).goodDays).toBe(0);
  });

  it("falls back when recent answers go wrong", () => {
    for (const d of [1, 2, 3]) recordMasteryAnswers(["a"], 5, 5, WORDS, day(d));
    recordMasteryAnswers(["a"], 2, 10, [], day(4));
    expect(summarizeMastery(getMastery().a, 6).level).toBe("learning");
  });

  it("needs the words to be met, and counts words said aloud", () => {
    for (const d of [1, 2, 3]) recordMasteryAnswers(["a"], 5, 5, [], day(d));
    expect(summarizeMastery(getMastery().a, 6).level).toBe("learning");
    recordMasteryWords("a", WORDS);
    expect(summarizeMastery(getMastery().a, 6).level).toBe("mastered");
  });

  it("one drill counts for both sounds of a pair", () => {
    recordMasteryAnswers(["a", "b"], 1, 1, ["see"], day(1));
    expect(getMastery().a.recent).toEqual([1]);
    expect(getMastery().b.recent).toEqual([1]);
  });
});
