// Edge Function: study reminders for the web app (Web Push), called every 5 minutes by pg_cron (README.md,
// "Reminders in the web app"). Sends one notification per study time and day, in each learner's own time zone, and
// forgets the subscriptions browsers have cancelled.
//
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT (an e-mail), CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { dueSlot, reminderText, SLOT_WINDOW_MINUTES } from "../_shared/reminderSlots.ts";

interface Subscription {
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

/** A browser that keeps refusing is let go after this many tries */
const MAX_FAILURES = 10;
/** Notifications sent at the same time */
const BATCH = 20;

Deno.serve(async (req) => {
  // Only the schedule may run it: anyone else would make every learner's phone ring
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });

  webpush.setVapidDetails(
    `mailto:${Deno.env.get("VAPID_CONTACT")}`,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
  );
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const now = new Date();
  // Only the subscriptions with a study time reached in the last minutes (0012_push_studied.sql), oldest first
  const { data, error } = await db.rpc("due_push_subscriptions", { p_window: SLOT_WINDOW_MINUTES });
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  let dropped = 0;
  const send = async (sub: Subscription) => {
    let slot: string | null;
    try {
      slot = dueSlot(sub.times, sub.tz, now, sub.last_slot);
    } catch {
      return; // a time zone this runtime does not know
    }
    if (!slot) return;
    // The slot is "YYYY-MM-DD HH:MM" in the learner's time zone: the day's goal is already reached
    if (sub.studied_on && slot.startsWith(sub.studied_on)) return;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(reminderText(slot)),
        { TTL: 60 * 60, urgency: "normal", topic: "study-reminder" }
      );
      await db.from("push_subscriptions").update({ last_slot: slot, failures: 0 }).eq("endpoint", sub.endpoint);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410 || sub.failures + 1 >= MAX_FAILURES) {
        await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        dropped++;
      } else {
        // Marked as sent all the same: a failing push is not retried every 5 minutes for this time
        await db.from("push_subscriptions").update({ last_slot: slot, failures: sub.failures + 1 }).eq("endpoint", sub.endpoint);
      }
    }
  };
  // A few at a time: one slow push service must not hold up everyone's reminder past the run's time limit
  const subs = (data ?? []) as Subscription[];
  for (let i = 0; i < subs.length; i += BATCH) await Promise.all(subs.slice(i, i + BATCH).map(send));
  return new Response(JSON.stringify({ sent, dropped }), { headers: { "Content-Type": "application/json" } });
});
