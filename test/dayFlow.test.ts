import { beforeEach, describe, expect, it } from "vitest";
import { advanceFlow, getFlow, nextInFlow, planFlow, retreatFlow, startFlow, stopFlow } from "@/services/dayFlow";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  (globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true };
});

const day = new Date(2026, 0, 10, 9);

describe("the day as one flow", () => {
  it("is made of the things not done yet, in the order of the list", () => {
    expect(
      planFlow([
        { id: "speaking", done: false },
        { id: "vocab", done: true },
        { id: "grammar", done: false },
        { id: "pronunciation", done: false },
      ])
    ).toEqual(["speaking", "grammar", "pronunciation"]);
    expect(planFlow([{ id: "vocab", done: true }])).toEqual([]);
  });

  it("does not start with nothing to do", () => {
    expect(startFlow([], day)).toBeNull();
    expect(getFlow(day)).toBeNull();
  });

  it("goes from one thing to the next and ends after the last", () => {
    const flow = startFlow(["speaking", "vocab", "pronunciation"], day)!;
    expect(flow.index).toBe(0);
    expect(nextInFlow(flow)).toBe("vocab");
    expect(advanceFlow(day)).toBe("vocab");
    expect(getFlow(day)?.index).toBe(1);
    expect(advanceFlow(day)).toBe("pronunciation");
    expect(nextInFlow(getFlow(day)!)).toBeNull();
    expect(advanceFlow(day)).toBeNull();
    expect(getFlow(day)).toBeNull();
  });

  it("steps back when the learner stays where they were, and never before the first thing", () => {
    startFlow(["speaking", "vocab", "grammar"], day);
    advanceFlow(day);
    expect(getFlow(day)?.index).toBe(1);
    retreatFlow(day);
    expect(getFlow(day)?.index).toBe(0);
    retreatFlow(day);
    expect(getFlow(day)?.index).toBe(0);
  });

  it("can be stopped, and does not outlive its day", () => {
    startFlow(["vocab", "grammar"], day);
    expect(getFlow(new Date(2026, 0, 11, 9))).toBeNull();
    stopFlow();
    expect(getFlow(day)).toBeNull();
  });

  it("ignores a damaged value", () => {
    mem.set("myenglish_dayflow_v1", JSON.stringify({ queue: ["vocab", "nonsense"], index: 0, day: "2026-01-10" }));
    expect(getFlow(day)).toBeNull();
    mem.set("myenglish_dayflow_v1", "{not json");
    expect(getFlow(day)).toBeNull();
  });
});
