/**
 * What send-reminders does with the subscriptions due now (shared by the Edge Function and the app's tests: plain
 * TypeScript, no Deno or browser API). The pushing and the database writes are handed in, so the decisions can be
 * tested without a push service or a database.
 */
import { dueSlot, reminderText } from "./reminderSlots.ts";

export interface DueSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  times: string[];
  tz: string;
  last_slot: string | null;
  failures: number;
  /** The learner's local day on which they reached the day's goal (0012): no more reminders that day */
  studied_on?: string | null;
}

export interface SendSteps {
  /** Push the notification; throws with `statusCode` when the push service refuses */
  push(sub: DueSubscription, payload: string): Promise<void>;
  /** Pushed: this study time is done for today */
  sent(sub: DueSubscription, slot: string): Promise<void>;
  /** Refused for now: this study time is not tried again, one more failure is counted */
  failed(sub: DueSubscription, slot: string): Promise<void>;
  /** The browser cancelled the subscription, or keeps refusing: forgotten */
  drop(sub: DueSubscription): Promise<void>;
}

/** A browser that keeps refusing is let go after this many tries */
export const MAX_FAILURES = 10;
/** Notifications sent at the same time */
export const BATCH = 20;

export async function sendDueReminders(
  subs: readonly DueSubscription[],
  now: Date,
  steps: SendSteps,
  batch = BATCH
): Promise<{ sent: number; dropped: number; skipped: number }> {
  let sent = 0;
  let dropped = 0;
  let skipped = 0;
  const one = async (sub: DueSubscription) => {
    let slot: string | null;
    try {
      slot = dueSlot(sub.times, sub.tz, now, sub.last_slot);
    } catch {
      return; // a time zone this runtime does not know
    }
    if (!slot) return;
    // The slot is "YYYY-MM-DD HH:MM" in the learner's time zone: the day's goal is already reached
    if (sub.studied_on && slot.startsWith(sub.studied_on)) {
      skipped++;
      return;
    }
    try {
      await steps.push(sub, JSON.stringify(reminderText(slot)));
      await steps.sent(sub, slot);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410 || sub.failures + 1 >= MAX_FAILURES) {
        await steps.drop(sub);
        dropped++;
      } else {
        // Marked as sent all the same: a failing push is not retried every 5 minutes for this time
        await steps.failed(sub, slot);
      }
    }
  };
  // A few at a time: one slow push service must not hold up everyone's reminder past the run's time limit
  for (let i = 0; i < subs.length; i += batch) await Promise.all(subs.slice(i, i + batch).map(one));
  return { sent, dropped, skipped };
}
