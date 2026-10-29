import { beforeEach, describe, expect, it } from "vitest";
import { PATTERNS } from "@/data/patterns";
import { SITUATIONS } from "@/data/situations";
import { STEPS, type PatternState } from "@/services/patterns/progress";
import { buildDayPlan } from "./plan";
import { buildPathStages, buildStages, estimateDays, STAGE_CONVERSATION } from "./stages";
import { currentStage, getRoadmap, markDone, markTested, setFocus, setGoal, skipLevel, skipStage, markTipSeen } from "./state";

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

const day = new Date(2026, 0, 10);
const A1 = PATTERNS.filter((p) => p.level === "A1");

describe("stages", () => {
  it("one stage per topic, with all the patterns of the topic", () => {
    const stages = buildStages(A1, "all");
    expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
    expect(stages.reduce((a, s) => a + s.patterns.length, 0)).toBe(A1.length);
  });

  it("starts with the greetings whatever the goal, then the topics that fit the goal", () => {
    for (const goal of ["travel", "work", "daily", "social"] as const) expect(buildStages(A1, goal)[0].id).toBe("greetings-introductions");
    const travel = buildStages(A1, "travel").map((s) => s.id);
    expect(travel.indexOf("directions-places")).toBeLessThan(travel.indexOf("family"));
  });

  it("gives every A1 stage a conversation, and every conversation named for a stage exists", () => {
    const ids = new Set(SITUATIONS.map((s) => s.id));
    for (const stage of buildStages(A1, "all")) expect(stage.conversationId, stage.id).toBeDefined();
    for (const [topic, id] of Object.entries(STAGE_CONVERSATION)) expect(ids.has(id), `${topic} -> ${id}`).toBe(true);
  });

  it("the path goes through the levels in order, A1 first", () => {
    const stages = buildPathStages(PATTERNS, "travel");
    const levels = stages.map((s) => s.level);
    expect(levels).toEqual([...levels].sort());
    expect(levels[0]).toBe("A1");
    expect(new Set(stages.map((s) => s.id)).size).toBe(stages.length);
    expect(stages.reduce((a, s) => a + s.patterns.length, 0)).toBe(PATTERNS.length);
  });

  it("starts at the learner's lowest level, or at the highest there is when that level has no sentences", () => {
    const levelsOf = (from?: string) => [...new Set(buildPathStages(PATTERNS, "all", from).map((s) => s.level))];
    expect(levelsOf("A1")).toEqual(["A1", "A2", "B1", "B2", "C1"]);
    expect(levelsOf("A2")).toEqual(["A2", "B1", "B2", "C1"]);
    expect(levelsOf("B1")).toEqual(["B1", "B2", "C1"]);
    expect(levelsOf("B2")).toEqual(["B2", "C1"]);
    expect(levelsOf("C1")).toEqual(["C1"]);
    expect(levelsOf()).toEqual(["A1", "A2", "B1", "B2", "C1"]);
  });

  it("estimates how long the path takes from the minutes of a day", () => {
    const stages = buildStages(A1, "all");
    expect(estimateDays(stages, 5)).toBeGreaterThan(estimateDays(stages, 10));
    expect(estimateDays(stages, 10)).toBeGreaterThan(estimateDays(stages, 25));
  });
});

describe("state", () => {
  it("the current stage is the first not finished, or the one jumped to", () => {
    const stages = buildStages(A1, "all");
    expect(currentStage(stages, getRoadmap())?.id).toBe(stages[0].id);
    markDone(stages[0].id);
    skipStage(stages[1].id);
    expect(currentStage(stages, getRoadmap())?.id).toBe(stages[2].id);
    setFocus(stages[5].id);
    expect(currentStage(stages, getRoadmap())?.id).toBe(stages[5].id);
  });

  it("skips a whole level, but not the stages already done", () => {
    const stages = buildPathStages(PATTERNS, "all");
    const a1 = stages.filter((s) => s.level === "A1");
    markDone(a1[0].id);
    expect(skipLevel(stages, "A1")).toBe(a1.length - 1);
    expect(getRoadmap().skipped).not.toContain(a1[0].id);
    expect(currentStage(stages, getRoadmap())?.level).toBe("A2");
    expect(skipLevel(stages, "A1")).toBe(0);
  });

  it("remembers the grammar tips the learner read, once each", () => {
    expect(getRoadmap().tipSeen).toEqual([]);
    markTipSeen("family");
    markTipSeen("family");
    expect(getRoadmap().tipSeen).toEqual(["family"]);
  });

  it("keeps the stages that are done when the goal changes", () => {
    const stages = buildStages(A1, "all");
    markDone(stages[0].id);
    setGoal("travel");
    expect(getRoadmap().done).toEqual([stages[0].id]);
  });
});

describe("the plan of a day", () => {
  const stage = buildStages(A1, "all")[0];
  const stateAt = (step: number, due = "2026-01-10", lastDay = ""): PatternState => ({ step, due, box: 0, times: [], lastDay });

  it("opens two new patterns with learn and substitute together on the first day", () => {
    const plan = buildDayPlan(stage, getRoadmap(), {}, [], 10, day);
    const steps = plan.tasks.filter((t) => t.kind === "step");
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0]).toMatchObject({ kind: "step", steps: [1, 2] });
    expect(plan.minutes).toBeLessThanOrEqual(10);
  });

  it("takes at least one task even when it is longer than the minutes of the day", () => {
    expect(buildDayPlan(stage, getRoadmap(), {}, [], 1, day).tasks).toHaveLength(1);
  });

  it("puts the next step of a started pattern before opening new ones", () => {
    const first = stage.patterns[0].id;
    const plan = buildDayPlan(stage, getRoadmap(), { [first]: stateAt(2) }, [], 25, day);
    expect(plan.tasks[0]).toMatchObject({ kind: "step", patternId: first, steps: [3] });
  });

  it("waits for tomorrow when every started pattern's next step is not due", () => {
    const states = Object.fromEntries(stage.patterns.map((p) => [p.id, stateAt(2, "2026-01-11")]));
    const plan = buildDayPlan(stage, getRoadmap(), states, [], 10, day);
    expect(plan.tasks).toHaveLength(0);
    expect(plan.waiting).toBe(true);
  });

  it("asks for the final challenge when every pattern is learned, then the conversation, then it is complete", () => {
    const states = Object.fromEntries(stage.patterns.map((p) => [p.id, stateAt(STEPS, "2026-02-01")]));
    expect(buildDayPlan(stage, getRoadmap(), states, [], 10, day).tasks[0]).toMatchObject({ kind: "test" });
    markTested(stage.id);
    expect(buildDayPlan(stage, getRoadmap(), states, [], 10, day).tasks[0]).toMatchObject({ kind: "conversation" });
    mem.set("myenglish_roadmap_v1", JSON.stringify({ ...getRoadmap(), conversed: [stage.id] }));
    const done = buildDayPlan(stage, getRoadmap(), states, [], 10, day);
    expect(done.complete).toBe(true);
    expect(done.tasks).toHaveLength(0);
  });

  it("starts the day with a short review of patterns from earlier stages", () => {
    const other = A1.find((p) => p.topic !== stage.id)!;
    const plan = buildDayPlan(stage, getRoadmap(), {}, [other.id], 10, day);
    expect(plan.tasks[0]).toMatchObject({ kind: "review", patternIds: [other.id] });
  });
});
