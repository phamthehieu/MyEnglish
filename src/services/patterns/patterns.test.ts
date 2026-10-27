import { beforeEach, describe, expect, it } from "vitest";
import type { Pattern } from "@/types/pattern";
import { fillPattern } from "@/types/pattern";
import { buildRapid, buildSubstitution, buildTilesItem, patternLines, tilesSpell } from "./engine";
import { averageTime, completeStep, duePatterns, getPatternState, recordReview, recordTime, STEPS } from "./progress";
import { validatePattern } from "./validate";
import { buildRapidMix, buildStepTasks, sessionPassed } from "./session";

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

const pattern: Pattern = {
  id: "a1.can-i-have",
  level: "A1",
  topic: "food-drink",
  topic_vi: "Gọi đồ ăn uống",
  goals: ["travel", "daily"],
  frame_en: "Can I have ___, please?",
  frame_vi: "Cho tôi ___ nhé?",
  note_vi: "Câu gọi đồ lịch sự.",
  slots: [
    { en: "a coffee", vi: "một ly cà phê" },
    { en: "a tea", vi: "một ly trà" },
    { en: "some water", vi: "ít nước" },
    { en: "an orange juice", vi: "một ly nước cam" },
    { en: "a sandwich", vi: "một cái bánh sandwich" },
    { en: "the menu", vi: "thực đơn" },
  ],
  examples: [
    { en: "Can I have some rice, please?", vi: "Cho tôi ít cơm nhé?" },
    { en: "Can I have the bill, please?", vi: "Cho tôi xin hóa đơn nhé?" },
  ],
  asks: [{ en: "What would you like?", vi: "Bạn muốn dùng gì?" }],
};

describe("pattern validation", () => {
  it("accepts a good pattern and explains a bad one", () => {
    expect(validatePattern(pattern)).toEqual([]);
    const bad = { ...pattern, frame_en: "Can I have, please?", slots: pattern.slots.slice(0, 2) };
    expect(validatePattern(bad).length).toBeGreaterThan(0);
  });
});

describe("pronunciation of the patterns that come with the app", () => {
  it("every slot sentence and every example has its IPA (run scripts/add-pattern-ipa.mjs after importing patterns)", async () => {
    const { PATTERNS } = await import("@/data/patterns");
    expect(PATTERNS.length).toBeGreaterThan(0);
    for (const p of PATTERNS) {
      for (const s of p.slots) expect(s.ipa, `${p.id} / ${s.en}`).toMatch(/^\/.+\/$/);
      for (const e of p.examples) expect(e.ipa, `${p.id} / ${e.en}`).toMatch(/^\/.+\/$/);
    }
  });
});

describe("exercise builders", () => {
  it("substitution has the right answer among three different options", () => {
    const item = buildSubstitution(pattern, pattern.slots[0]);
    expect(item.options).toHaveLength(3);
    expect(new Set(item.options.map((o) => o.en)).size).toBe(3);
    expect(item.options.some((o) => o.en === item.answer.en)).toBe(true);
    expect(item.full).toBe(fillPattern(pattern, pattern.slots[0]).en);
  });

  it("tiles can spell the sentence, and the wrong words do not", () => {
    const item = buildTilesItem(pattern, pattern.slots[1]);
    const words = item.en.replace(/[.,?!]/g, "").split(" ");
    const right = words.map((w) => item.tiles.find((t) => t.text === w)!);
    expect(tilesSpell(right, item)).toBe(true);
    expect(tilesSpell([...right].reverse(), item)).toBe(false);
  });

  it("rapid-fire asks one of the pattern's questions and wants the filled sentence", () => {
    const item = buildRapid(pattern, pattern.slots[2]);
    expect(item.ask.en).toBe("What would you like?");
    expect(item.en).toBe("Can I have some water, please?");
    expect(patternLines(pattern).map((l) => l.en)).toContain(item.en);
  });

  it("builds the tasks of every step", () => {
    expect(buildStepTasks(pattern, 1)).toHaveLength(1);
    expect(buildStepTasks(pattern, 2).every((t) => t.kind === "substitute")).toBe(true);
    expect(buildStepTasks(pattern, 3).every((t) => t.kind === "tiles")).toBe(true);
    expect(buildStepTasks(pattern, 4).every((t) => t.kind === "rapid")).toBe(true);
    expect(buildRapidMix([pattern, { ...pattern, id: "a1.x" }], 8)).toHaveLength(2);
  });
});

describe("progress", () => {
  const day = new Date(2026, 0, 10);

  it("climbs one step at a time and is due the next day", () => {
    completeStep(pattern.id, 2, day); // skipping a step changes nothing
    expect(getPatternState(pattern.id).step).toBe(0);
    completeStep(pattern.id, 1, day);
    expect(getPatternState(pattern.id).step).toBe(1);
    expect(duePatterns(day)).toEqual([]);
    expect(duePatterns(new Date(2026, 0, 11))).toEqual([pattern.id]);
  });

  it("is mastered after the last step, then reviewed on a schedule", () => {
    for (let s = 1; s <= STEPS; s++) completeStep(pattern.id, s, day);
    expect(getPatternState(pattern.id).step).toBe(STEPS);
    recordReview(pattern.id, true, new Date(2026, 0, 12));
    expect(getPatternState(pattern.id).box).toBe(1);
    recordReview(pattern.id, false, new Date(2026, 0, 20));
    expect(getPatternState(pattern.id).step).toBe(STEPS - 1);
  });

  it("keeps the last ten response times and their average", () => {
    for (const ms of [1000, 2000, 3000]) recordTime(pattern.id, ms, day);
    expect(averageTime(getPatternState(pattern.id))).toBe(2000);
    for (let i = 0; i < 12; i++) recordTime(pattern.id, 1000, day);
    expect(getPatternState(pattern.id).times).toHaveLength(10);
  });

  it("a sitting passes with four right in five", () => {
    const tasks = buildStepTasks(pattern, 2);
    const results = tasks.map((t, i) => ({ patternId: t.pattern.id, kind: t.kind, ok: i !== 0 }));
    expect(sessionPassed(tasks, results)).toBe(true);
    expect(sessionPassed(tasks, results.map((r, i) => ({ ...r, ok: i > 1 })))).toBe(false);
  });
});
