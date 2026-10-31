import { describe, it, expect } from "vitest";
import { CAFE_ORDER } from "@/data/situations/cafe-order";
import {
  buildGrammar,
  decoysFor,
  judgeSpoken,
  nextNodeId,
  normalizeSpeech,
  speakableFrom,
  variantsOf,
  wordsOf,
} from "@/services/talk/engine";
import type { AsrResult } from "@/services/pronunciationCheck";

const line = (id: string) => CAFE_ORDER.lines.find((l) => l.id === id)!;
const heard = (text: string, conf = 0.9, peak = 0.4): AsrResult => ({
  ok: true,
  text,
  peak,
  words: text.split(" ").map((word) => ({ word, conf })),
});

describe("normalizeSpeech", () => {
  it("lowercases, drops punctuation, keeps apostrophes", () => {
    expect(normalizeSpeech("Can I have a coffee, please?")).toBe("can i have a coffee please");
    expect(normalizeSpeech("I’d like a coffee")).toBe("i'd like a coffee");
    expect(normalizeSpeech("  No,   that's all. ")).toBe("no that's all");
  });
});

describe("grammar", () => {
  it("lists every wording of the wanted lines and ends with [unk]", () => {
    const g = buildGrammar([line("cafe-order.l2"), line("cafe-order.l3")]);
    expect(g.phrases).toContain("a large one please");
    expect(g.phrases).toContain("large please");
    expect(g.phrases).toContain("small please");
    expect(g.phrases[g.phrases.length - 1]).toBe("[unk]");
    expect(g.owner.get("large please")).toBe("cafe-order.l2");
  });

  it("adds decoys from the rest of the situation", () => {
    const wanted = [line("cafe-order.l2")];
    const decoys = decoysFor(CAFE_ORDER, wanted);
    expect(decoys.some((l) => l.id === "cafe-order.l2")).toBe(false);
    expect(decoys.length).toBe(CAFE_ORDER.lines.length - 1);
    const g = buildGrammar(wanted, decoys);
    expect(g.owner.get("to go please")).toBe("cafe-order.l6");
  });

  it("drops a sentence with a word the recognizer does not know", () => {
    const g = buildGrammar(
      [line("cafe-order.l5")],
      [],
      speakableFrom(wordsOf(variantsOf(line("cafe-order.l5"))).filter((w) => w !== "sandwich"))
    );
    expect(g.phrases).toEqual(["[unk]"]);
  });

  it("gives every sentence of a situation to one line only", () => {
    const all = CAFE_ORDER.lines.flatMap((l) => variantsOf(l));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("judgeSpoken", () => {
  const wanted = [line("cafe-order.l2"), line("cafe-order.l3")];
  const grammar = buildGrammar(wanted, decoysFor(CAFE_ORDER, wanted));
  const valid = new Set(wanted.map((l) => l.id));

  it("passes an answer that makes sense here, and says which one", () => {
    const v = judgeSpoken(heard("a small one please"), grammar, valid);
    expect(v.kind).toBe("ok");
    expect(v.lineId).toBe("cafe-order.l3");
  });

  it("passes another wording of the same line", () => {
    expect(judgeSpoken(heard("large please"), grammar, valid).lineId).toBe("cafe-order.l2");
  });

  it("reports a sentence that does not fit this turn as 'other'", () => {
    const v = judgeSpoken(heard("to go please"), grammar, valid);
    expect(v.kind).toBe("other");
    expect(v.lineId).toBe("cafe-order.l6");
  });

  it("reports shaky when the recognizer was not sure", () => {
    expect(judgeSpoken(heard("a large one please", 0.2), grammar, valid).kind).toBe("shaky");
  });

  it("reports silence, nothing recognized, and errors", () => {
    expect(judgeSpoken(heard("a large one please", 0.9, 0.001), grammar, valid).kind).toBe("silent");
    expect(judgeSpoken({ ok: true, text: "", peak: 0.4 }, grammar, valid).kind).toBe("unclear");
    expect(judgeSpoken({ ok: true, text: "[unk]", peak: 0.4 }, grammar, valid).kind).toBe("unclear");
    expect(judgeSpoken({ ok: true, text: "can i have", peak: 0.4 }, grammar, valid).kind).toBe("unclear");
    expect(judgeSpoken({ ok: false, error: "model not loaded" }, grammar, valid).kind).toBe("error");
  });
});

describe("nextNodeId", () => {
  it("follows the answer to the next turn, and ends the talk", () => {
    expect(nextNodeId(CAFE_ORDER, "n1", "cafe-order.l1")).toBe("n2");
    expect(nextNodeId(CAFE_ORDER, "n2", "cafe-order.l3")).toBe("n3");
    expect(nextNodeId(CAFE_ORDER, "n5", "cafe-order.l8")).toBeNull();
  });

  it("returns undefined for an answer that is not offered at that turn", () => {
    expect(nextNodeId(CAFE_ORDER, "n1", "cafe-order.l8")).toBeUndefined();
  });
});

import { buildChoices, buildTiles, editDistance, matchTiles, matchTyped, pickMethod } from "@/services/talk/engine";

/** A random source that returns the given values in turn */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe("pickMethod", () => {
  it("uses a fixed level, but types instead of speaking where there is no microphone", () => {
    expect(pickMethod("choose", 9, true)).toBe("choose");
    expect(pickMethod("tiles", 9, true)).toBe("tiles");
    expect(pickMethod("say", 0, true)).toBe("say");
    expect(pickMethod("say", 0, false)).toBe("type");
    expect(pickMethod("type", 0, true)).toBe("type");
  });

  it("starts a new answer with choices in auto", () => {
    expect(pickMethod("auto", 0, true, seq(0.99))).toBe("choose");
  });

  it("climbs choose, tiles, then speaking or typing as the answer gets known", () => {
    expect(pickMethod("auto", 1, true, seq(0))).toBe("choose");
    expect(pickMethod("auto", 1, true, seq(0.99))).toBe("tiles");
    expect(pickMethod("auto", 2, true, seq(0))).toBe("tiles");
    expect(pickMethod("auto", 2, true, seq(0.99))).toBe("say");
    expect(pickMethod("auto", 5, true, seq(0))).toBe("say");
    expect(pickMethod("auto", 5, true, seq(0.99))).toBe("type");
    expect(pickMethod("auto", 5, false, seq(0.5))).toBe("type");
    expect(pickMethod("auto", 2, false, seq(0.99))).toBe("type");
  });
});

describe("buildChoices", () => {
  const sizes = [line("cafe-order.l2"), line("cafe-order.l3")];

  it("has the target and sentences that do not fit this turn", () => {
    const choices = buildChoices(sizes[1], sizes, CAFE_ORDER, 3, seq(0.1, 0.6, 0.3));
    expect(choices.length).toBe(3);
    expect(choices.filter((c) => c.correct).map((c) => c.line.id)).toEqual(["cafe-order.l3"]);
    for (const c of choices.filter((x) => !x.correct)) expect(sizes.some((l) => l.id === c.line.id)).toBe(false);
    expect(new Set(choices.map((c) => c.line.id)).size).toBe(3);
  });

  it("offers fewer choices when the situation has no more sentences to use", () => {
    const all = CAFE_ORDER.lines;
    expect(buildChoices(all[0], all, CAFE_ORDER, 3, seq(0.5)).length).toBe(1);
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions and changes", () => {
    expect(editDistance("coffee", "coffee")).toBe(0);
    expect(editDistance("coffee", "cofee")).toBe(1);
    expect(editDistance("coffee", "coffie")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("matchTyped", () => {
  const sizes = [line("cafe-order.l2"), line("cafe-order.l3")];

  it("accepts the sentence or another wording, ignoring case and punctuation", () => {
    expect(matchTyped("A LARGE one, please!", sizes)).toEqual({ lineId: "cafe-order.l2", exact: true });
    expect(matchTyped("small please", sizes)).toEqual({ lineId: "cafe-order.l3", exact: true });
  });

  it("forgives one slip in a longer sentence", () => {
    expect(matchTyped("a larg one please", sizes)).toEqual({ lineId: "cafe-order.l2", exact: false });
  });

  it("does not guess between very different sentences", () => {
    expect(matchTyped("a medium one please", sizes)).toBeNull();
    expect(matchTyped("to go please", sizes)).toBeNull();
    expect(matchTyped("   ", sizes)).toBeNull();
  });
});

describe("tiles", () => {
  const target = line("cafe-order.l1");

  it("holds the words of the sentence plus decoys from the rest of the situation, not in answer order", () => {
    const tiles = buildTiles(target, CAFE_ORDER, 2, seq(0.1, 0.7, 0.3, 0.9, 0.2));
    const words = tiles.map((t) => t.text);
    expect(words.length).toBe(6 + 2);
    for (const w of ["can", "i", "have", "a", "coffee", "please"]) expect(words).toContain(w);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
    expect(words.join(" ")).not.toBe("can i have a coffee please");
  });

  it("recognizes the sentence the tiles spell, and a wording the line accepts", () => {
    const tiles = buildTiles(target, CAFE_ORDER, 0, seq(0.5));
    const byText = (t: string) => tiles.find((x) => x.text === t)!;
    const right = ["can", "i", "have", "a", "coffee", "please"].map(byText);
    expect(matchTiles(right, [target])).toBe(target.id);
    expect(matchTiles([...right].reverse(), [target])).toBeNull();
    expect(matchTiles([], [target])).toBeNull();
  });
});

describe("a sentence the machine did not match", () => {
  const grammar = {
    phrases: ["i would like a coffee", "can i have the bill", "[unk]"],
    owner: new Map([
      ["i would like a coffee", "l1"],
      ["can i have the bill", "l2"],
    ]),
  };

  it("says what it heard and which words of the closest right sentence were missing", async () => {
    const { judgeSpoken } = await import("@/services/talk/engine");
    const verdict = judgeSpoken({ ok: true, text: "[unk]", words: [], peak: 0.4, free: "i would like coffee" }, grammar, new Set(["l1"]));
    expect(verdict.kind).toBe("unclear");
    expect(verdict.message).toContain('Máy nghe ra "i would like coffee"');
    expect(verdict.message).toContain('"a"');
    expect(verdict.message).not.toContain('"bill"');
  });

  it("keeps the plain message when nothing at all was made out", async () => {
    const { judgeSpoken } = await import("@/services/talk/engine");
    const verdict = judgeSpoken({ ok: true, text: "", words: [], peak: 0.4 }, grammar, new Set(["l1"]));
    expect(verdict.message).toBe("Máy chưa nghe rõ câu nào. Nói chậm, rõ từng từ rồi thử lại.");
  });
});
