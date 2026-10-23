import { describe, expect, it } from "vitest";
import { checkSentence, normalizeWord } from "@/services/sentenceCheck";

const said = (text: string, conf = 0.9) => text.split(" ").map((word) => ({ word, conf }));
const statuses = (sentence: string, heard: ReturnType<typeof said>) => checkSentence(sentence, heard).words.map((w) => w.status);

describe("normalizeWord", () => {
  it("drops punctuation and case, keeps apostrophes inside a word", () => {
    expect(normalizeWord("Face.")).toBe("face");
    expect(normalizeWord("I'm")).toBe("i'm");
    expect(normalizeWord("don’t,")).toBe("don't");
    expect(normalizeWord('"Hello!"')).toBe("hello");
  });
});

describe("checkSentence", () => {
  it("marks every word clear when all were heard clearly", () => {
    const r = checkSentence("I also brush my teeth.", said("i also brush my teeth"));
    expect(r.words.map((w) => w.status)).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(r).toMatchObject({ clear: 5, judged: 5, extra: [] });
  });

  it("marks a heard-but-unsure word as shaky, not clear", () => {
    const heard = [{ word: "wash", conf: 0.3 }, ...said("my face")];
    expect(statuses("Wash my face", heard)).toEqual(["shaky", "ok", "ok"]);
    expect(checkSentence("Wash my face", heard).clear).toBe(2);
  });

  it("says what was heard instead of a word", () => {
    const r = checkSentence("I wash my face", said("i wash my phase"));
    expect(r.words[3]).toMatchObject({ text: "face", status: "wrong", heard: "phase" });
  });

  it("marks a word that was not said as missing", () => {
    expect(statuses("I also brush my teeth", said("i brush my teeth"))).toEqual(["ok", "missing", "ok", "ok", "ok"]);
  });

  it("lists words that were said but are not in the sentence", () => {
    const r = checkSentence("I brush my teeth", said("i um brush my teeth"));
    expect(r.extra).toEqual(["um"]);
    expect(r.words.every((w) => w.status === "ok")).toBe(true);
  });

  it("finds nothing when nothing was heard", () => {
    const r = checkSentence("Good morning.", []);
    expect(r.words.map((w) => w.status)).toEqual(["missing", "missing"]);
    expect(r.clear).toBe(0);
  });

  it("does not judge figures, which the recognizer writes as words", () => {
    const r = checkSentence("It takes only 1 minute.", said("it takes only one minute"));
    expect(r.words.map((w) => w.status)).toEqual(["ok", "ok", "ok", "skip", "ok"]);
    expect(r.judged).toBe(4);
  });

  it("matches contractions written with a curly apostrophe", () => {
    expect(statuses("I’m ready.", said("i'm ready"))).toEqual(["ok", "ok"]);
  });
});
