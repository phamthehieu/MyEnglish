import { describe, it, expect } from "vitest";
import { alignVi, baseForms, englishWords, meaningPhrases } from "@/services/viHints";
import catalogFile from "@/data/vocabCatalog.json";

/** What a learner sees: [chunk=English] for a word that can be tapped */
const show = (segs: ReturnType<typeof alignVi>) => segs.map((s) => (s.en ? `[${s.text}=${s.en}]` : s.text)).join("");

const MEANINGS = new Map([
  ["ticket", "vé"],
  ["two", "hai"],
  ["coffee", "cà phê"],
  ["have", "có; bị (đau, ốm); đã (tạo thì hoàn thành)"],
  ["want", "muốn, mong muốn"],
  ["need", "cần"],
  ["more", "thêm, nhiều hơn"],
  ["time", "thời gian; lần"],
  ["would", "sẽ (tương lai trong quá khứ); có muốn … không (lời mời)"],
]);

describe("the deck's corrected meanings", () => {
  it("has the meaning a learner expects, each example still on its own sense", () => {
    const words = (catalogFile as unknown as { words: Array<{ word: string; vn: string; senses: Array<{ vn: string }>; examples: Array<{ en: string; senseIndex: number }> }> }).words;
    const of = (w: string) => words.find((x) => x.word === w)!;
    expect(of("give").vn.startsWith("cho, đưa")).toBe(true);
    expect(of("free").vn).toContain("rảnh");
    expect(of("by").vn).toContain("by bus");
    // An example stays on the sense it illustrates after a new sense went in before it
    const give = of("give");
    expect(give.senses[give.examples[0].senseIndex].vn).toBe("tặng");
    for (const w of words) for (const e of w.examples) expect(w.senses[e.senseIndex], w.word).toBeDefined();
  });
});

describe("tap a Vietnamese word to see its English", () => {
  it("pairs words with the words of the answer, keeping the sentence as written", () => {
    const segs = alignVi("Cho tôi hai vé đi Pa ri.", "Two tickets to Paris, please.", MEANINGS, [{ vi: "Pa ri", en: "Paris" }]);
    expect(segs.map((s) => s.text).join("")).toBe("Cho tôi hai vé đi Pa ri.");
    expect(show(segs)).toBe("Cho tôi [hai=Two] [vé=tickets] đi [Pa ri=Paris].");
  });

  it("pairs a slot as a whole when its words are not known", () => {
    const segs = alignVi("Tên tôi là Pa ri.", "My name is Paris.", new Map([["name", "tên"]]), [{ vi: "Pa ri", en: "Paris" }]);
    expect(show(segs)).toBe("[Tên=name] [tôi=My] [là=is] [Pa ri=Paris].");
  });

  it("pairs a long slot word by word when its words are known", () => {
    const segs = alignVi("Chúng ta cần thêm thời gian.", "We need more time.", MEANINGS, [{ vi: "chúng ta cần thêm thời gian", en: "we need more time" }]);
    expect(show(segs)).toBe("[Chúng ta=We] [cần=need] [thêm=more] [thời gian=time].");
  });

  it("pairs only with words that are in the answer", () => {
    // "có" means "have", but the answer has no "have"
    expect(show(alignVi("Tôi có cà phê.", "I want coffee.", MEANINGS))).toBe("[Tôi=I] có [cà phê=coffee].");
  });

  it("does not take a small word's dictionary meaning ('can' is not 'lon, hộp')", () => {
    const segs = alignVi("Tôi có thể mua một lon.", "I can buy one.", new Map([["can", "có thể; lon, hộp"]]));
    expect(show(segs)).toContain("[có thể=can]");
    expect(show(segs)).not.toContain("[lon=");
  });

  it("opens contractions and finds the deck form of a word", () => {
    expect(englishWords("I'm fine, don't worry.").map((w) => w.word)).toEqual(["i", "am", "fine", "do", "not", "worry"]);
    expect(englishWords("I'm here")[0].shown).toBe("I'm");
    expect(baseForms("tickets")).toContain("ticket");
    expect(baseForms("stopped")).toContain("stop");
    expect(baseForms("went")).toContain("go");
    expect(baseForms("making")).toContain("make");
  });

  it("reads a deck meaning as phrases, leaving out notes and gapped ones", () => {
    expect(meaningPhrases("sẽ (tương lai trong quá khứ); có muốn … không (lời mời)")).toEqual(["sẽ"]);
    expect(meaningPhrases("có thể, biết (làm gì); lon, hộp")).toEqual(["có thể", "biết", "lon", "hộp"]);
  });

  it("leaves a sentence with nothing to pair as plain text", () => {
    expect(alignVi("Ừ.", "Okay.", new Map())).toEqual([{ text: "Ừ." }]);
  });
});
