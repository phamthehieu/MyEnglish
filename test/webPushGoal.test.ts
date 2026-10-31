import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The web app telling the server the day's goal is reached (webPush.watchGoalForWebReminders), so the rest of the
 * day's reminders are not sent: once a day, only when this browser has reminders on, and again after a failure.
 */
const rpc = vi.fn();
vi.mock("@/services/supabase", () => ({ getSupabase: () => ({ rpc }) }));

const ENDPOINT = "https://push.example.com/send/abc";

function browser({ subscribed = true } = {}) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: async () => ({ pushManager: { getSubscription: async () => (subscribed ? { endpoint: ENDPOINT } : null) } }),
    },
  });
}

async function start() {
  vi.resetModules();
  vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "public-key");
  const push = await import("@/services/webPush");
  const streak = await import("@/services/streak");
  return { stop: push.watchGoalForWebReminders(), streak };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

beforeEach(() => {
  localStorage.clear();
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("web reminders stop once the day's goal is reached", () => {
  it("tells the server once, on the day the goal is reached", async () => {
    browser();
    const { stop, streak } = await start();
    await settle();
    expect(rpc).not.toHaveBeenCalled(); // nothing studied yet

    streak.recordDailyActivity(streak.getDailyGoal());
    await settle();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("mark_push_studied", {
      p_endpoint: ENDPOINT,
      p_day: streak.getLocalDateString(),
      p_tz: expect.any(String),
    });

    // More answers the same day: already told
    streak.recordDailyActivity(1);
    await settle();
    expect(rpc).toHaveBeenCalledTimes(1);
    stop();
  });

  it("tries again on the next answer when the server could not be told", async () => {
    browser();
    rpc.mockResolvedValueOnce({ error: { message: "function mark_push_studied does not exist" } });
    const { stop, streak } = await start();
    streak.recordDailyActivity(streak.getDailyGoal());
    await settle();
    streak.recordDailyActivity(1);
    await settle();
    expect(rpc).toHaveBeenCalledTimes(2);
    stop();
  });

  it("says nothing for a browser with reminders off", async () => {
    browser({ subscribed: false });
    const { stop, streak } = await start();
    streak.recordDailyActivity(streak.getDailyGoal());
    await settle();
    expect(rpc).not.toHaveBeenCalled();
    stop();
  });
});
