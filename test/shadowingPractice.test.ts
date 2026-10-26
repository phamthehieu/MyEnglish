import { describe, expect, it } from "vitest";
import { bareWord, countWords, gradeBlanks, gradeDictation, pickBlanks } from "@/services/shadowingPractice";

describe("dictation", () => {
  const target = "Pressure, releasing a flood of decomposing corpses.";

  it("accepts the sentence typed without capitals or punctuation", () => {
    expect(gradeDictation(target, "pressure releasing a flood of decomposing corpses").correct).toBe(true);
  });

  it("is not correct with a wrong, a missing or an extra word, and says which", () => {
    const wrong = gradeDictation(target, "pressure releasing a flute of decomposing corpses");
    expect(wrong.correct).toBe(false);
    expect(wrong.check.words.find((w) => w.status === "wrong")).toMatchObject({ text: "flood", heard: "flute" });

    const missing = gradeDictation(target, "pressure releasing a flood of corpses");
    expect(missing.correct).toBe(false);
    expect(missing.check.words.filter((w) => w.status === "missing").map((w) => w.text)).toEqual(["decomposing"]);

    expect(gradeDictation(target, "pressure releasing a big flood of decomposing corpses").correct).toBe(false);
  });

  it("does not hold a figure against the learner", () => {
    expect(gradeDictation("It's 1780 in Paris", "it's 1780 in paris").correct).toBe(true);
  });

  it("nothing typed is never correct", () => {
    expect(gradeDictation(target, "   ").correct).toBe(false);
  });

  it("counts the words typed", () => {
    expect(countWords("  a flood,  of corpses ")).toBe(4);
    expect(countWords("")).toBe(0);
  });
});

describe("blanks", () => {
  const sentence = "releasing a flood of decomposing corpses, remains from the neighboring cemetery of the Innocents.".split(" ");

  it("takes 1 to 4 words, in order, and none of the small ones", () => {
    const blanks = pickBlanks(sentence, () => false);
    expect(blanks.length).toBeGreaterThanOrEqual(1);
    expect(blanks.length).toBeLessThanOrEqual(4);
    expect([...blanks].sort((a, b) => a - b)).toEqual(blanks);
    for (const i of blanks) expect(bareWord(sentence[i]).length).toBeGreaterThanOrEqual(4);
  });

  it("prefers the words the learner has not learned", () => {
    const blanks = pickBlanks(sentence, (w) => bareWord(w) === "flood");
    expect(blanks.map((i) => bareWord(sentence[i]))).toContain("flood");
  });

  it("is the same every time for the same sentence", () => {
    expect(pickBlanks(sentence, () => false)).toEqual(pickBlanks(sentence, () => false));
  });

  it("leaves a sentence of small words without blanks", () => {
    expect(pickBlanks("it is so big".split(" "), () => false)).toEqual([]);
  });

  it("grades each blank on its own, ignoring case and spaces", () => {
    expect(gradeBlanks(["Flood ", "", "cemetery"], ["flood", "corpses", "cemetry"])).toEqual([true, false, false]);
  });
});
