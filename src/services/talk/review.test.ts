import { beforeEach, describe, expect, it } from "vitest";
import { BOX_DAYS, dayAfter, dueLines, recordReview, reviewTotal, scheduleMiss } from "./review";

// A minimal localStorage and window for the node test environment
const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true };
});

const day0 = new Date(2026, 0, 10);
const later = (days: number) => new Date(2026, 0, 10 + days);

describe("talk review", () => {
  it("a missed line is due at once", () => {
    scheduleMiss("a.l1", day0);
    expect(dueLines(day0)).toEqual(["a.l1"]);
  });

  it("a right answer moves it to a later day, a wrong one back to the start", () => {
    scheduleMiss("a.l1", day0);
    recordReview("a.l1", true, day0);
    expect(dueLines(day0)).toEqual([]);
    expect(dueLines(later(BOX_DAYS[1]))).toEqual(["a.l1"]);
    recordReview("a.l1", false, later(BOX_DAYS[1]));
    expect(dueLines(later(BOX_DAYS[1]))).toEqual([]);
    expect(dueLines(later(BOX_DAYS[1] + BOX_DAYS[0]))).toEqual(["a.l1"]);
  });

  it("a line known through every box is done", () => {
    scheduleMiss("a.l1", day0);
    let now = day0;
    for (let i = 0; i < BOX_DAYS.length; i++) {
      recordReview("a.l1", true, now);
      now = later(100 * (i + 1));
    }
    expect(reviewTotal()).toBe(0);
  });

  it("the most overdue come first, and the number is limited", () => {
    scheduleMiss("old", day0);
    scheduleMiss("new", later(2));
    expect(dueLines(later(3))).toEqual(["old", "new"]);
    expect(dueLines(later(3), 1)).toEqual(["old"]);
  });

  it("counts days across a month end", () => {
    expect(dayAfter(new Date(2026, 0, 31), 1)).toBe("2026-02-01");
  });
});
