import { describe, it, expect } from "vitest";
import {
  buildGrammar,
  canCheck,
  confusablesFor,
  decoysFor,
  endSound,
  focusLabel,
  focusMates,
  focusOf,
  ipaOf,
  ipaSymbols,
  isCheckableWord,
  judge,
  SILENCE_PEAK,
  WEAK_CONFIDENCE,
} from "@/services/pronunciationCheck";
import { PRONUNCIATION_LESSONS } from "@/data/pronunciation";
import { CHECK_AGAINST } from "@/data/pronunciationCheckData";
import type { PronunciationLesson } from "@/types/pronunciation";

const byId = (id: string) => PRONUNCIATION_LESSONS.find((l) => l.id === id)!;
const lesson = PRONUNCIATION_LESSONS[0];
const small: PronunciationLesson = {
  id: "t",
  order: 1,
  title: "t",
  tagline: "t",
  intro: [],
  tips: [],
  examples: [{ text: "three", ipa: "/θriː/" }],
  pairs: [{ a: { text: "three", ipa: "/θriː/" }, b: { text: "tree", ipa: "/triː/" } }],
  quiz: [{ say: "free", question: "?", options: ["three", "free"], answer: "free", explanation: "" }],
};

describe("isCheckableWord", () => {
  it("accepts single plain lowercase words only", () => {
    expect(isCheckableWord("three")).toBe(true);
    expect(isCheckableWord(" Three ")).toBe(true);
    expect(isCheckableWord("I need to fix")).toBe(false);
    expect(isCheckableWord("COM-pu-ter")).toBe(false);
    expect(isCheckableWord("/t/")).toBe(false);
    expect(isCheckableWord("")).toBe(false);
  });
});

describe("confusablesFor", () => {
  it("finds the minimal-pair partner and the other quiz options", () => {
    expect(confusablesFor(small, "three").sort()).toEqual(["free", "tree"]);
    expect(confusablesFor(small, "tree")).toEqual(["three"]);
  });

  it("never lists the word itself, nor phrases", () => {
    expect(confusablesFor(small, "three")).not.toContain("three");
    const phrase: PronunciationLesson = {
      ...small,
      quiz: [{ say: "x", question: "?", options: ["fix it", "three"], answer: "three", explanation: "" }],
    };
    expect(confusablesFor(phrase, "three")).not.toContain("fix it");
  });

  it("gives every word of the first lesson's pairs a partner", () => {
    for (const pair of lesson.pairs ?? []) {
      expect(confusablesFor(lesson, pair.a.text)).toContain(pair.b.text.toLowerCase());
      expect(confusablesFor(lesson, pair.b.text)).toContain(pair.a.text.toLowerCase());
    }
  });

  it("sets each -s / -ed word against its base form", () => {
    expect(confusablesFor(byId("pron-s-endings"), "tests")).toEqual(["test"]);
    expect(confusablesFor(byId("pron-ed-endings"), "saved")).toEqual(["save"]);
  });
});

describe("-s and -ed lessons", () => {
  it.each(["pron-s-endings", "pron-ed-endings"])("%s: every example can be checked, and the data matches the lesson", (id) => {
    const l = byId(id);
    for (const item of l.examples) {
      expect(isCheckableWord(item.text)).toBe(true);
      expect(confusablesFor(l, item.text).length, item.text).toBeGreaterThan(0);
      // each base form is a plain word that is not the example itself
      for (const base of CHECK_AGAINST[id][item.text]) expect(base).not.toBe(item.text);
    }
    // nothing authored for a word the lesson does not have
    const words = new Set(l.examples.map((e) => e.text));
    for (const word of Object.keys(CHECK_AGAINST[id])) expect(words.has(word), word).toBe(true);
  });
});

describe("ipaSymbols / endSound", () => {
  it("splits an IPA string into sounds", () => {
    expect(ipaSymbols("/tʃek/")).toEqual(["tʃ", "e", "k"]);
    expect(ipaSymbols("/niːd/")).toEqual(["n", "iː", "d"]);
    expect(ipaSymbols("/ˈfɪksɪz/")).toEqual(["f", "ɪ", "k", "s", "ɪ", "z"]);
  });

  it("finds the last sound, with -es and -ed counted as /ɪz/ and /ɪd/", () => {
    expect(endSound("/fɪks/")).toBe("s");
    expect(endSound("/koʊd/")).toBe("d");
    expect(endSound("/ˈfɪksɪz/")).toBe("ɪz");
    expect(endSound("/ˈædɪd/")).toBe("ɪd");
    expect(endSound("/ˈoʊpənd/")).toBe("d");
    expect(endSound("/baɪ/")).toBeNull();
  });
});

describe("focusOf / focusMates", () => {
  it("is the last sound in the ending lessons", () => {
    const l = byId("pron-final-sounds");
    const code = l.examples.find((e) => e.text === "code")!;
    expect(focusOf(l, code)).toEqual({ symbols: ["d"], position: "end" });
    expect(focusLabel(l, code)).toBe("/d/");
  });

  it("is what differs from the pair partner elsewhere", () => {
    const l = byId("pron-th");
    const pair = l.pairs![0];
    const focus = focusOf(l, pair.a)!;
    expect(focus.symbols.length).toBeGreaterThan(0);
    expect(["start", "mid", "end"]).toContain(focus.position);
  });

  it("lists other words of the lesson ending in the same sound", () => {
    const l = byId("pron-final-sounds");
    const mates = focusMates(l, "code");
    expect(mates.length).toBeGreaterThan(0);
    expect(mates).not.toContain("code");
    expect(mates).not.toContain("coat");
    for (const m of mates) expect(endSound(ipaOf(l, m)!)).toBe("d");
  });

  it("is empty for a word with no focus", () => {
    expect(focusMates(byId("pron-final-sounds"), "knee")).toEqual([]);
    expect(focusMates(byId("pron-final-sounds"), "unknownword")).toEqual([]);
  });
});

describe("buildGrammar", () => {
  it("is the target, its confusables and mates once each, then [unk]", () => {
    expect(buildGrammar("Three", ["tree", "free", "tree"])).toEqual(["three", "tree", "free", "[unk]"]);
    expect(buildGrammar("sit", [])).toEqual(["sit", "[unk]"]);
    expect(buildGrammar("code", ["coat"], ["ride", "coat"])).toEqual(["code", "coat", "ride", "[unk]"]);
  });
});

describe("judge", () => {
  const hints = { ipaTarget: "/θriː/", ipaOf: (w: string) => ipaOf(small, w) };
  const heard = (text: string, conf = 1, peak = 0.5) => ({ ok: true, text, words: [{ word: text, conf }], peak });

  it("says match when the target was heard clearly", () => {
    const v = judge("three", heard("three"), hints);
    expect(v.kind).toBe("match");
    expect(v.ok).toBe(true);
  });

  it("level focus passes a shaky target; level word does not", () => {
    const shaky = heard("three", WEAK_CONFIDENCE - 0.1);
    expect(judge("three", shaky, { ...hints, level: "focus" })).toMatchObject({ kind: "match", ok: true });
    expect(judge("three", shaky, { ...hints, level: "word" })).toMatchObject({ kind: "weak", ok: false });
  });

  it("names what was heard instead, with both sounds", () => {
    const v = judge("three", heard("tree"), hints);
    expect(v).toMatchObject({ kind: "confused", ok: false, heard: "tree" });
    expect(v.message).toContain("tree");
    expect(v.message).toContain("/θriː/");
    expect(v.message).toContain("/triː/");
  });

  it("a word with the right sound passes at level focus only", () => {
    const options = { mates: ["ride"], focusLabel: "/d/" };
    const easy = judge("code", heard("ride"), { ...options, level: "focus" });
    expect(easy).toMatchObject({ kind: "focus_ok", ok: true, heard: "ride" });
    expect(easy.message).toContain("/d/");
    expect(judge("code", heard("ride"), { ...options, level: "word" })).toMatchObject({ kind: "confused", ok: false });
  });

  it("the wrong sound fails at both levels", () => {
    for (const level of ["focus", "word"] as const) {
      expect(judge("code", heard("coat"), { mates: ["ride"], level }).ok).toBe(false);
    }
  });

  it("separates silence, unclear speech and failures", () => {
    expect(judge("three", { ok: true, text: "", peak: SILENCE_PEAK / 2 }, hints).kind).toBe("silent");
    expect(judge("three", { ok: true, text: "[unk]", peak: 0.4 }, hints).kind).toBe("unclear");
    expect(judge("three", { ok: true, text: "", peak: 0.4 }, hints).kind).toBe("unclear");
    expect(judge("three", { ok: false, error: "model not loaded" }, hints)).toMatchObject({ kind: "error", ok: false });
  });
});

describe("canCheck / decoysFor", () => {
  it("offers a single word of the ending lessons even without a look-alike", () => {
    const l = byId("pron-final-sounds");
    expect(confusablesFor(l, "fix")).toEqual([]);
    expect(canCheck(l, "fix")).toBe(true);
    expect(canCheck(l, "test")).toBe(true);
  });

  it("still refuses phrases and acronyms", () => {
    expect(canCheck(byId("pron-th"), "the code")).toBe(false);
    expect(canCheck(byId("pron-th"), "COM-pu-ter")).toBe(false);
  });

  it("keeps the lessons a recognizer cannot judge to words with a look-alike", () => {
    const stress = byId("pron-word-stress");
    for (const item of stress.examples) expect(canCheck(stress, item.text)).toBe(confusablesFor(stress, item.text).length > 0);
    const it = byId("pron-it-words");
    expect(canCheck(it, "cache")).toBe(false);
  });

  it("gives a word with no alternatives other words of the lesson, never itself", () => {
    const l = byId("pron-final-sounds");
    const decoys = decoysFor(l, "fix", []);
    expect(decoys.length).toBe(4);
    expect(decoys).not.toContain("fix");
    expect(new Set(decoys).size).toBe(decoys.length);
    for (const d of decoys) expect(isCheckableWord(d)).toBe(true);
  });

  it("adds only what is missing to reach four alternatives", () => {
    const l = byId("pron-final-sounds");
    expect(decoysFor(l, "fix", ["a", "b", "c", "d"])).toEqual([]);
    expect(decoysFor(l, "fix", ["a", "b"]).length).toBe(2);
  });
});
