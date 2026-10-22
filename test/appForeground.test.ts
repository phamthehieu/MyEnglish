import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Native commands are mocked: nothing blocks the popup, and the calls are recorded
const invokeCalls: string[] = [];
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    invokeCalls.push(cmd);
    if (cmd === "get_popup_blockers") {
      return { fullscreen_app: null, screen_sharing_app: null, focus_mode: null, idle_seconds: 30 };
    }
    return undefined;
  }),
}));

beforeEach(() => {
  invokeCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A worker whose next reminder is due now */
async function workerDue() {
  await vi.dynamicImportSettled();
  vi.resetModules();
  const db = await import("@/services/db");
  const srs = await import("@/services/srs");
  const reminders = await import("@/services/reminderSettings");
  await db.insertEnrichedWord({ word: "latency", meaning_vn: "độ trễ", synonyms: [], antonyms: [], examples: [] });
  reminders.saveReminderSettings({
    enabled: true,
    intervalMinutes: 15,
    triggerCondition: "due_only",
    respectFocus: false,
    snoozedUntil: null,
    contextMoments: false,
  });
  reminders.recordPopupDisplayed(Date.now() - 60 * 60 * 1000); // the last one was an hour ago
  invokeCalls.length = 0;
  return srs.srsWorker;
}

const screen = (visible: boolean, focused: boolean) =>
  vi.stubGlobal("document", { visibilityState: visible ? "visible" : "hidden", hasFocus: () => focused });

describe("reminders while the learner is in the app", () => {
  it("shows no reminder while the app is on screen and focused, and shows it once they are elsewhere", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T14:00:00"));
    const worker = await workerDue();

    screen(true, true);
    await worker.tick();
    expect(invokeCalls).not.toContain("show_review_nudge");

    screen(true, false); // another window has the focus
    await worker.tick();
    expect(invokeCalls).toContain("show_review_nudge");
  });

  it("shows it when the app is hidden (minimized or in the tray)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T14:00:00"));
    const worker = await workerDue();
    screen(false, false);
    await worker.tick();
    expect(invokeCalls).toContain("show_review_nudge");
  });

  it("a review the learner asks for (tray, test button) still opens while the app is in front", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T14:00:00"));
    const worker = await workerDue();
    screen(true, true);
    await worker.tick(true);
    expect(invokeCalls).toContain("show_review_popup");
  });
});
