import { describe, expect, it, beforeEach } from "vitest";
import {
  candidateBaseForms,
  lookupDictionaryWord,
  searchEnglishDictionary,
  searchVietnameseDictionary,
  recordDictLookup,
  getDictHistory,
  clearDictHistory,
  toggleBookmarkWord,
  isWordBookmarked,
  getBookmarkedWords,
  type DictEntry,
} from "../src/services/dictionary";

describe("Multi-purpose Dictionary Service (EN-VI, EN-EN, VI-EN)", () => {
  beforeEach(() => {
    clearDictHistory();
    for (const item of getBookmarkedWords()) {
      toggleBookmarkWord({ w: item.word });
    }
  });

  it("extracts morphological base forms (irregular & regular inflections)", () => {
    expect(candidateBaseForms("went")).toContain("go");
    expect(candidateBaseForms("children")).toContain("child");
    expect(candidateBaseForms("studies")).toContain("study");
    expect(candidateBaseForms("debugging")).toContain("debug");
    expect(candidateBaseForms("happier")).toContain("happy");
  });

  it("looks up common words with both Vietnamese and English-English definitions", async () => {
    const entry = await lookupDictionaryWord("develop", { allowOnlineFallback: false });
    expect(entry).not.toBeNull();
    expect(entry!.w).toBe("develop");
    expect(entry!.i).toBeTruthy();
    const senses = entry!.m || [];
    expect(senses.length).toBeGreaterThan(0);

    const hasVi = senses.some((s) => Boolean(s.v && s.v.length > 0));
    const hasEn = senses.some((s) => Boolean(s.e && s.e.length > 0));
    expect(hasVi).toBe(true);
    expect(hasEn).toBe(true);
  });

  it("resolves irregular and regular inflected forms to their dictionary entries", async () => {
    const wentEntry = await lookupDictionaryWord("went", { allowOnlineFallback: false });
    expect(wentEntry).not.toBeNull();
    expect(["go", "went"]).toContain(wentEntry!.w);
    expect((wentEntry!.m || []).length).toBeGreaterThan(0);

    const runningEntry = await lookupDictionaryWord("running", { allowOnlineFallback: false });
    expect(runningEntry).not.toBeNull();
    expect((runningEntry!.m || []).length).toBeGreaterThan(0);
  });

  it("looks up specialized/extended words outside the 5,000 Oxford deck (161k corpus)", async () => {
    const entry = await lookupDictionaryWord("photosynthesis", { allowOnlineFallback: false });
    expect(entry).not.toBeNull();
    expect(entry!.w).toBe("photosynthesis");
    expect((entry!.m || []).length).toBeGreaterThan(0);
  });

  it("searches English dictionary prefix and substring matches quickly", async () => {
    const results = await searchEnglishDictionary("algorith", 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.w === "algorithm")).toBe(true);
  });

  it("searches Vietnamese-to-English index (accented and unaccented)", async () => {
    const accented = await searchVietnameseDictionary("lập trình", 10);
    expect(accented.length).toBeGreaterThan(0);

    const unaccented = await searchVietnameseDictionary("lap trinh", 10);
    expect(unaccented.length).toBeGreaterThan(0);
  });

  it("tracks lookup history and bookmarks", () => {
    const algo: DictEntry = { w: "algorithm", i: "/ˈælɡərɪðəm/", m: [{ p: "n", v: "thuật toán" }] };
    const db: DictEntry = { w: "database", i: "/ˈdeɪtəbeɪs/", m: [{ p: "n", v: "cơ sở dữ liệu" }] };

    recordDictLookup(algo);
    recordDictLookup(db);
    recordDictLookup(algo);

    const history = getDictHistory();
    expect(history.length).toBe(2);
    expect(history[0].word).toBe("algorithm");
    expect(history[0].count).toBe(2);

    expect(isWordBookmarked("algorithm")).toBe(false);
    const savedAfterAdd = toggleBookmarkWord(algo);
    expect(savedAfterAdd.bookmarked).toBe(true);
    expect(isWordBookmarked("algorithm")).toBe(true);

    const savedAfterRemove = toggleBookmarkWord(algo);
    expect(savedAfterRemove.bookmarked).toBe(false);
    expect(isWordBookmarked("algorithm")).toBe(false);
  });
});
