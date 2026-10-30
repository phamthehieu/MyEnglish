import { describe, it, expect } from "vitest";
import { dueSlot, localClock, reminderText, SLOT_WINDOW_MINUTES } from "../supabase/functions/_shared/reminderSlots";
import { timesToSend } from "@/services/webPush";

// 30 Oct 2026, 12:30 in Hanoi (UTC+7) = 05:30 UTC
const at = (utc: string) => new Date(`2026-10-30T${utc}:00Z`);

describe("study reminders of the web app (server side)", () => {
  it("reads the learner's own clock, not the server's", () => {
    expect(localClock(at("05:30"), "Asia/Ho_Chi_Minh")).toEqual({ date: "2026-10-30", minutes: 12 * 60 + 30 });
    // 23:30 UTC is already the next day in Hanoi
    expect(localClock(at("23:30"), "Asia/Ho_Chi_Minh").date).toBe("2026-10-31");
  });

  it("is due from the study time until the window closes, once a day", () => {
    const times = ["07:30", "12:30", "20:00"];
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", at("05:29"), null)).toBeNull(); // 12:29
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", at("05:30"), null)).toBe("2026-10-30 12:30");
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", at("05:40"), null)).toBe("2026-10-30 12:30"); // a late run
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", at("05:35"), "2026-10-30 12:30")).toBeNull(); // already sent
    const closed = new Date(at("05:30").getTime() + SLOT_WINDOW_MINUTES * 60_000);
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", closed, null)).toBeNull();
    // The next day the same time is due again
    expect(dueSlot(times, "Asia/Ho_Chi_Minh", new Date("2026-10-31T05:31:00Z"), "2026-10-30 12:30")).toBe("2026-10-31 12:30");
  });

  it("follows each learner's time zone", () => {
    // 12:30 in Hanoi is 06:30 in Paris (UTC+1 on 30 Oct 2026): Paris's 12:30 is not due yet
    expect(dueSlot(["12:30"], "Europe/Paris", at("05:30"), null)).toBeNull();
    expect(dueSlot(["12:30"], "Europe/Paris", at("11:30"), null)).toBe("2026-10-30 12:30");
  });

  it("skips times that are not times", () => {
    expect(dueSlot(["25:00", "12:3", "abc", "12:30"], "Asia/Ho_Chi_Minh", at("05:31"), null)).toBe("2026-10-30 12:30");
  });

  it("varies its words by day and time", () => {
    const words = new Set(["2026-10-30 07:30", "2026-10-30 12:30", "2026-10-31 07:30", "2026-11-01 20:00"].map((s) => reminderText(s).body));
    expect(words.size).toBeGreaterThan(1);
    expect(reminderText("x").title).toBe("MyEnglish");
  });
});

describe("study times sent from the web app", () => {
  it("leaves out night hours when nights are quiet, and keeps at most 6 sorted times", () => {
    expect(timesToSend(["21:30", "06:30", "12:30", "22:00", "07:00"], true)).toEqual(["07:00", "12:30", "21:30"]);
    expect(timesToSend(["22:00", "06:30"], false)).toEqual(["06:30", "22:00"]);
    expect(timesToSend(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "bad"], false)).toHaveLength(6);
  });
});
