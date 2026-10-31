// Edge Function: study reminders for the web app (Web Push), called every 5 minutes by pg_cron (README.md,
// "Reminders in the web app"). Sends one notification per study time and day, in each learner's own time zone, and
// forgets the subscriptions browsers have cancelled. What to send and when: ../_shared/sendDue.ts (tested).
//
// Secrets (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CONTACT (an e-mail), CRON_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SLOT_WINDOW_MINUTES } from "../_shared/reminderSlots.ts";
import { sendDueReminders, type DueSubscription } from "../_shared/sendDue.ts";

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

  // Only the subscriptions with a study time reached in the last minutes (0012_push_studied.sql), oldest first
  const { data, error } = await db.rpc("due_push_subscriptions", { p_window: SLOT_WINDOW_MINUTES });
  if (error) return new Response(error.message, { status: 500 });

  const result = await sendDueReminders((data ?? []) as DueSubscription[], new Date(), {
    push: async (sub, payload) => {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, {
        TTL: 60 * 60,
        urgency: "normal",
        topic: "study-reminder",
      });
    },
    sent: async (sub, slot) => {
      await db.from("push_subscriptions").update({ last_slot: slot, failures: 0 }).eq("endpoint", sub.endpoint);
    },
    failed: async (sub, slot) => {
      await db.from("push_subscriptions").update({ last_slot: slot, failures: sub.failures + 1 }).eq("endpoint", sub.endpoint);
    },
    drop: async (sub) => {
      await db.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    },
  });
  return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
});
