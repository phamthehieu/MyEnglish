import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEFAULT_INITIAL_TENSE_IDS,
  GRAMMAR_TENSES_INIT_KEY,
  GRAMMAR_EXCLUDED_KEY,
  hasChosenInitialTenses,
  markInitialTensesDone,
  saveInitialTenses,
  getEffectiveLessonIds,
  getExcludedLessonIds,
  learningOrder,
  saveSelectedLessonIds,
} from "@/services/grammarPath";
import { TENSE_OPTIONS } from "@/components/grammar/TenseSelectionPicker";

describe("Initial Tense Selection for beginners & update migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defines Present Simple (ch01-l01) as the default initial tense", () => {
    expect(DEFAULT_INITIAL_TENSE_IDS).toEqual(["ch01-l01"]);
    const presentSimple = TENSE_OPTIONS.find((t) => t.id === "ch01-l01");
    expect(presentSimple).toBeDefined();
    expect(presentSimple?.titleVn).toBe("Thì hiện tại đơn");
    expect(presentSimple?.isDefault).toBe(true);
    expect(presentSimple?.recommendedBadge).toBeDefined();
  });

  it("contains all 13 tenses from chapter 1 in TENSE_OPTIONS", () => {
    expect(TENSE_OPTIONS).toHaveLength(13);
    const ids = TENSE_OPTIONS.map((t) => t.id);
    for (let i = 1; i <= 13; i++) {
      const id = `ch01-l${String(i).padStart(2, "0")}`;
      expect(ids).toContain(id);
    }
  });

  it("tracks whether user has initialized initial tenses", () => {
    expect(hasChosenInitialTenses()).toBe(false);
    markInitialTensesDone();
    expect(hasChosenInitialTenses()).toBe(true);
    expect(localStorage.getItem(GRAMMAR_TENSES_INIT_KEY)).toBe("1");
  });

  it("starts with the chosen tenses and keeps the whole book after them", () => {
    const allKnown = ["ch01-l01", "ch01-l02", "ch01-l03", "ch01-l05", "ch02-l01", "ch02-l02", "ch03-l01"];
    saveInitialTenses(["ch01-l05", "ch01-l01"]);
    expect(hasChosenInitialTenses()).toBe(true);
    expect(getExcludedLessonIds(allKnown)).toEqual([]);
    expect(getEffectiveLessonIds(allKnown)).toEqual(allKnown);
    expect(learningOrder(allKnown.map((id) => ({ id }))).map((l) => l.id)).toEqual([
      "ch01-l01",
      "ch01-l05",
      "ch01-l02",
      "ch01-l03",
      "ch02-l01",
      "ch02-l02",
      "ch03-l01",
    ]);
  });

  it("opens a path an older first run cut down to its tenses, once", () => {
    const allKnown = ["ch01-l01", "ch01-l02", "ch02-l01", "ch03-l01"];
    // What the older first run saved: every lesson but Present Simple taken off the path
    markInitialTensesDone();
    localStorage.setItem(GRAMMAR_EXCLUDED_KEY, JSON.stringify(["ch01-l02", "ch02-l01", "ch03-l01"]));
    expect(getEffectiveLessonIds(allKnown)).toEqual(allKnown);
    expect(learningOrder(allKnown.map((id) => ({ id })))[0].id).toBe("ch01-l01");
  });

  it("keeps a path the learner cut down to tenses themselves", () => {
    const allKnown = ["ch01-l01", "ch01-l02", "ch02-l01", "ch03-l01"];
    saveInitialTenses(["ch01-l01"]);
    // Later, in the grammar tab: only the first two tenses (picked before the book was cached, migrated on read)
    saveSelectedLessonIds(["ch01-l01", "ch01-l02"]);
    expect(getEffectiveLessonIds(allKnown)).toEqual(["ch01-l01", "ch01-l02"]);
    expect(getEffectiveLessonIds(allKnown)).toEqual(["ch01-l01", "ch01-l02"]);
  });
});