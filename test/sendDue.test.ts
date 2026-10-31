import { describe, it, expect } from "vitest";
import { sendDueReminders, MAX_FAILURES, type DueSubscription, type SendSteps } from "../supabase/functions/_shared/sendDue";

/** 20:05 in Ho Chi Minh City (UTC+7) on 31 October 2026 */
const NOW = new Date("2026-10-31T13:05:00Z");

const sub = (over: Partial<DueSubscription> = {}): DueSubscription => ({
  endpoint: `https://push.example.com/${Math.random()}`,
  p256dh: "p",
  auth: "a",
  times: ["20:00"],
  tz: "Asia/Ho_Chi_Minh",
  last_slot: null,
  failures: 0,
  studied_on: null,
  ...over,
});

/** The steps as a log; `refuse` makes the push service answer with that status */
function recorder(refuse?: (s: DueSubscription) => number | undefined) {
  const log: string[] = [];
  const steps: SendSteps = {
    push: async (s, payload) => {
      const status = refuse?.(s);
      if (status) throw Object.assign(new Error("refused"), { statusCode: status });
      log.push(`push ${s.endpoint} ${JSON.parse(payload).title}`);
    },
    sent: async (s, slot) => void log.push(`sent ${s.endpoint} ${slot}`),
    failed: async (s, slot) => void log.push(`failed ${s.endpoint} ${slot}`),
    drop: async (s) => void log.push(`drop ${s.endpoint}`),
  };
  return { log, steps };
}

describe("send-reminders: what is sent to whom", () => {
  it("sends the study time reached, once, and records it", async () => {
    const s = sub();
    const { log, steps } = recorder();
    expect(await sendDueReminders([s], NOW, steps)).toEqual({ sent: 1, dropped: 0, skipped: 0 });
    expect(log).toEqual([`push ${s.endpoint} MyEnglish`, `sent ${s.endpoint} 2026-10-31 20:00`]);

    // The next run, 5 minutes later, with that time recorded: nothing more
    const again = recorder();
    await sendDueReminders([{ ...s, last_slot: "2026-10-31 20:00" }], new Date(NOW.getTime() + 5 * 60_000), again.steps);
    expect(again.log).toEqual([]);
  });

  it("skips the rest of a day whose goal is reached, but not the next day", async () => {
    const studied = sub({ studied_on: "2026-10-31" });
    const { log, steps } = recorder();
    expect(await sendDueReminders([studied], NOW, steps)).toEqual({ sent: 0, dropped: 0, skipped: 1 });
    expect(log).toEqual([]);

    const yesterday = sub({ studied_on: "2026-10-30" });
    const next = recorder();
    expect((await sendDueReminders([yesterday], NOW, next.steps)).sent).toBe(1);
  });

  it("forgets a browser that cancelled (410, 404) and one that keeps refusing", async () => {
    const gone = sub();
    const missing = sub();
    const tired = sub({ failures: MAX_FAILURES - 1 });
    const { log, steps } = recorder((s) => (s === gone ? 410 : s === missing ? 404 : 500));
    expect(await sendDueReminders([gone, missing, tired], NOW, steps)).toEqual({ sent: 0, dropped: 3, skipped: 0 });
    expect(log.sort()).toEqual([`drop ${gone.endpoint}`, `drop ${missing.endpoint}`, `drop ${tired.endpoint}`].sort());
  });

  it("counts a refusal for now without retrying that time every 5 minutes", async () => {
    const busy = sub({ failures: 2 });
    const { log, steps } = recorder(() => 503);
    expect(await sendDueReminders([busy], NOW, steps)).toEqual({ sent: 0, dropped: 0, skipped: 0 });
    expect(log).toEqual([`failed ${busy.endpoint} 2026-10-31 20:00`]);
  });

  it("leaves out a time zone the runtime does not know, and the others still go", async () => {
    const odd = sub({ tz: "Mars/Olympus" });
    const fine = sub();
    const { steps } = recorder();
    expect((await sendDueReminders([odd, fine], NOW, steps)).sent).toBe(1);
  });

  it("sends a few at a time, every one of them in the end", async () => {
    let inFlight = 0;
    let most = 0;
    const steps: SendSteps = {
      push: async () => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 2));
        inFlight--;
      },
      sent: async () => {},
      failed: async () => {},
      drop: async () => {},
    };
    const many = Array.from({ length: 45 }, () => sub());
    expect((await sendDueReminders(many, NOW, steps, 20)).sent).toBe(45);
    expect(most).toBeLessThanOrEqual(20);
    expect(most).toBeGreaterThan(1);
  });
});
