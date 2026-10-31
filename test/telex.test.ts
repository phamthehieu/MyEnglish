import { describe, it, expect } from "vitest";
import { hasVietnameseLetters, undoTelex } from "@/lib/telex";
import { matchTypedAnswer } from "@/services/smartReview";

/** What the review session accepts: a reading of the Telex text that matches the word */
const accepted = (typed: string, target: string) => undoTelex(typed).some((t) => matchTypedAnswer(t, target) === "exact");

describe("English typed with a Vietnamese keyboard (Telex)", () => {
  it("is recognised by its Vietnamese letters", () => {
    expect(hasVietnameseLetters("hơ")).toBe(true);
    expect(hasVietnameseLetters("đeploy")).toBe(true);
    expect(hasVietnameseLetters("deploy")).toBe(false);
  });

  it("reads back the keys that were pressed", () => {
    expect(accepted("hơ", "how")).toBe(true); // o + w
    expect(accepted("lơer", "lower")).toBe(true);
    expect(accepted("nêd", "need")).toBe(true); // e + e
    expect(accepted("thẻi", "their")).toBe(true); // the tone key typed at the end of the word
    expect(accepted("đeploy", "ddeploy")).toBe(true);
  });

  it("does not turn a wrong word into a right one", () => {
    expect(accepted("hơ", "who")).toBe(false);
    expect(accepted("lơer", "lover")).toBe(false);
  });

  it("leaves text with no Vietnamese letters, or a whole Vietnamese sentence, alone", () => {
    expect(undoTelex("deploy")).toEqual([]);
    expect(undoTelex("triển khai ứng dụng mới nhất")).toEqual([]);
  });
});
