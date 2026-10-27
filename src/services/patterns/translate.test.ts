import { describe, expect, it } from "vitest";
import type { Pattern } from "@/types/pattern";
import { PATTERNS } from "@/data/patterns";
import { acceptedForms, buildTranslateRound, hintFor, isTranslation, limitFor, matchedWords, pointsFor, wordsOfSentence } from "./translate";

const pattern: Pattern = {
  id: "a1.i-am-from",
  level: "A1",
  topic: "greetings",
  topic_vi: "Chào hỏi",
  goals: ["social"],
  frame_en: "I'm from ___.",
  frame_vi: "Tôi đến từ ___.",
  note_vi: "Nói mình đến từ đâu.",
  slots: [
    { en: "Vietnam", vi: "Việt Nam" },
    { en: "Japan", vi: "Nhật Bản" },
    { en: "France", vi: "Pháp" },
    { en: "Korea", vi: "Hàn Quốc" },
    { en: "Hanoi", vi: "Hà Nội" },
  ],
  examples: [
    { en: "I'm from a small town.", vi: "Tôi đến từ một thị trấn nhỏ." },
    { en: "I'm from the north.", vi: "Tôi đến từ miền bắc." },
  ],
  asks: [{ en: "Where are you from?", vi: "Bạn đến từ đâu?" }],
};

describe("translation round", () => {
  it("builds the asked number of sentences, each with its Vietnamese and English", () => {
    const items = buildTranslateRound([pattern], 4);
    expect(items).toHaveLength(4);
    for (const it of items) {
      expect(it.en.startsWith("I'm from ")).toBe(true);
      expect(it.vi.startsWith("Tôi đến từ ")).toBe(true);
      expect(it.words).toEqual(wordsOfSentence(it.en));
    }
  });

  it("uses a different pattern for each sentence while there are enough", () => {
    const items = buildTranslateRound(PATTERNS.slice(0, 12), 10);
    expect(new Set(items.map((i) => i.pattern.id)).size).toBe(10);
  });

  it("gives less help to a pattern that is better known", () => {
    expect(hintFor(0)).toBe("full");
    expect(hintFor(2)).toBe("count");
    expect(hintFor(4)).toBe("none");
  });
});

describe("checking what is typed", () => {
  const words = wordsOfSentence("It's important to keep a record.");

  it("counts the words that are right from the start (the ones that light up)", () => {
    expect(matchedWords("it's important to keep a record", words)).toBe(6);
    expect(matchedWords("it's important two keep", words)).toBe(2);
    expect(matchedWords("", words)).toBe(0);
  });

  it("accepts the sentence with or without capitals and punctuation", () => {
    expect(isTranslation("its important to keep a record", "It's important to keep a record.")).toBe(false); // missing apostrophe is a different token
    expect(isTranslation("it's important to keep a record", "It's important to keep a record.")).toBe(true);
    expect(isTranslation("It is important to keep a record.", "It's important to keep a record.")).toBe(true);
  });

  it("forgives one slip in a long word but not a wrong word", () => {
    expect(isTranslation("i'm from vietnan", "I'm from Vietnam.")).toBe(true);
    expect(isTranslation("i'm from japan", "I'm from Vietnam.")).toBe(false);
    expect(isTranslation("i'm from", "I'm from Vietnam.")).toBe(false);
  });

  it("writes contractions out both ways", () => {
    expect(acceptedForms("I'm from Hanoi.")).toContain("i am from hanoi");
    expect(acceptedForms("I do not like fish.")).toContain("i do not like fish");
    expect(isTranslation("I am from Hanoi", "I'm from Hanoi.")).toBe(true);
  });
});

describe("time and points", () => {
  it("gives more time to longer sentences", () => {
    expect(limitFor(8)).toBeGreaterThan(limitFor(4));
  });

  it("pays less for help and wrong tries, and more for speed", () => {
    const limit = 20000;
    expect(pointsFor(false, 0, 0, 1000, limit)).toBe(0);
    expect(pointsFor(true, 0, 0, 1000, limit)).toBe(120);
    expect(pointsFor(true, 1, 0, 1000, limit)).toBe(95);
    expect(pointsFor(true, 0, 1, 19000, limit)).toBe(88);
    expect(pointsFor(true, 9, 9, 19000, limit)).toBe(20);
  });
});
