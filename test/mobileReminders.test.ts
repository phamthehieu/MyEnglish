import { describe, it, expect } from "vitest";
import { planReminders, reminderGapMinutes, reminderRule, reminderWindow } from "@/services/mobileReminders";
import { DEFAULT_REMINDER_SETTINGS } from "@/services/reminderSettings";

const settings = (over: Partial<typeof DEFAULT_REMINDER_SETTINGS> = {}) => ({ ...DEFAULT_REMINDER_SETTINGS, ...over });
const hm = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
const dayOf = (ms: number) => new Date(ms).getDate();
const open = { goalMetToday: false, dueToday: 5 };

describe("reminderGapMinutes", () => {
  it("is the interval, spread so the daily limit lasts the day", () => {
    // 7:00 to 22:00 = 900 minutes, at most 8 a day: no closer than 113 minutes
    expect(reminderGapMinutes(settings({ intervalMinutes: 30, maxNudgesPerDay: 8 }))).toBe(113);
    expect(reminderGapMinutes(settings({ intervalMinutes: 120, maxNudgesPerDay: 8 }))).toBe(120);
    expect(reminderGapMinutes(settings({ intervalMinutes: 30, maxNudgesPerDay: 0 }))).toBe(30);
  });

  it("is 0 when the automatic reminders are off", () => {
    expect(reminderGapMinutes(settings({ enabled: false }))).toBe(0);
    expect(reminderGapMinutes(settings({ intervalMinutes: 0 }))).toBe(0);
  });
});

describe("reminderWindow", () => {
  it("leaves out the night quiet hours", () => {
    expect(reminderWindow({ nightQuiet: true })).toEqual({ startHour: 7, endHour: 22 });
    expect(reminderWindow({ nightQuiet: false })).toEqual({ startHour: 6, endHour: 23 });
  });
});

describe("planReminders", () => {
  const afternoon = new Date(2026, 9, 21, 14, 0, 0);

  it("counts the first reminder of today from the moment the learner leaves", () => {
    const plan = planReminders(afternoon, settings({ intervalMinutes: 30, maxNudgesPerDay: 8 }), open);
    expect(plan[0].at).toBe(afternoon.getTime() + 113 * 60_000);
    expect(plan[0].body).toContain("5 thẻ");
  });

  it("never plans in the night quiet hours, nor in the past", () => {
    const plan = planReminders(afternoon, settings(), open);
    expect(plan.length).toBeGreaterThan(0);
    for (const p of plan) {
      expect(p.at).toBeGreaterThan(afternoon.getTime());
      expect(hm(p.at)).toBeGreaterThanOrEqual(7 * 60);
      expect(hm(p.at)).toBeLessThan(22 * 60);
    }
  });

  it("respects the daily limit on every day", () => {
    const plan = planReminders(afternoon, settings({ intervalMinutes: 15, maxNudgesPerDay: 3 }), open);
    const perDay = new Map<number, number>();
    for (const p of plan) perDay.set(dayOf(p.at), (perDay.get(dayOf(p.at)) ?? 0) + 1);
    for (const count of perDay.values()) expect(count).toBeLessThanOrEqual(3);
  });

  it("starts the next days in the morning, and plans three days", () => {
    const plan = planReminders(afternoon, settings({ intervalMinutes: 120, maxNudgesPerDay: 0 }), open);
    const days = new Set(plan.map((p) => dayOf(p.at)));
    expect(days).toEqual(new Set([21, 22, 23]));
    expect(hm(plan.find((p) => dayOf(p.at) === 22)!.at)).toBe(7 * 60);
  });

  it("plans only the study times when the interval reminders are off", () => {
    const plan = planReminders(
      new Date(2026, 9, 21, 6, 0, 0),
      settings({ intervalMinutes: 0, anchors: ["after_lunch", "end_of_day"] }),
      open
    );
    expect(plan.filter((p) => dayOf(p.at) === 21).map((p) => hm(p.at))).toEqual([13 * 60 + 15, 17 * 60 + 30]);
  });

  it("adds the chosen study times to the interval ones, not closer than 20 minutes", () => {
    const plan = planReminders(new Date(2026, 9, 21, 6, 0, 0), settings({ intervalMinutes: 120, maxNudgesPerDay: 0, anchors: ["after_lunch"] }), open);
    const today = plan.filter((p) => dayOf(p.at) === 21).map((p) => p.at);
    expect(today.map(hm)).toContain(13 * 60 + 15);
    for (let i = 1; i < today.length; i++) expect(today[i] - today[i - 1]).toBeGreaterThanOrEqual(20 * 60_000);
  });

  it("stops for the rest of today once the goal is reached, but not tomorrow", () => {
    const plan = planReminders(afternoon, settings(), { goalMetToday: true, dueToday: 0 });
    expect(plan.every((p) => dayOf(p.at) !== 21)).toBe(true);
    expect(plan.length).toBeGreaterThan(0);
    const keepGoing = planReminders(afternoon, settings({ stopAfterGoal: false }), { goalMetToday: true, dueToday: 3 });
    expect(keepGoing.some((p) => dayOf(p.at) === 21)).toBe(true);
  });

  it("skips today when nothing is due and reminders are for due words only", () => {
    const plan = planReminders(afternoon, settings({ triggerCondition: "due_only" }), { goalMetToday: false, dueToday: 0 });
    expect(plan.every((p) => dayOf(p.at) !== 21)).toBe(true);
    const all = planReminders(afternoon, settings({ triggerCondition: "all_words" }), { goalMetToday: false, dueToday: 0 });
    expect(all.some((p) => dayOf(p.at) === 21)).toBe(true);
  });

  it("holds back reminders while paused", () => {
    const until = new Date(2026, 9, 22, 9, 0, 0).getTime();
    const plan = planReminders(afternoon, settings({ snoozedUntil: until }), open);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0].at).toBeGreaterThanOrEqual(until);
  });

  it("is empty when reminders are off", () => {
    expect(planReminders(afternoon, settings({ enabled: false }), open)).toEqual([]);
  });
});

describe("reminderRule", () => {
  it("carries what Android needs to keep planning after the plan runs out", () => {
    const rule = reminderRule(settings({ intervalMinutes: 30, maxNudgesPerDay: 8, anchors: ["after_lunch"] }))!;
    expect(rule.gapMin).toBe(113);
    expect(rule.startHour).toBe(7);
    expect(rule.endHour).toBe(22);
    expect(rule.cap).toBe(8);
    expect(rule.anchors).toEqual([[13, 15]]);
    expect(Array.isArray(rule.bodies)).toBe(true);
  });

  it("is null when there is nothing to remind", () => {
    expect(reminderRule(settings({ enabled: false }))).toBeNull();
    expect(reminderRule(settings({ intervalMinutes: 0, anchors: [] }))).toBeNull();
  });

  it("keeps the study times when the interval reminders are off", () => {
    const rule = reminderRule(settings({ intervalMinutes: 0, anchors: ["end_of_day"] }))!;
    expect(rule.gapMin).toBe(0);
    expect(rule.anchors).toEqual([[17, 30]]);
  });
});
