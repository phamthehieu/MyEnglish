# Supabase backend (accounts, sync, leaderboard)

The app works fully offline without any of this. With a Supabase project connected, a learner can sign in,
keep their progress in step across machines and race others on XP.

## Set up

1. Create a project at <https://supabase.com> (free tier is enough).
2. **SQL editor** → paste and run [`migrations/0001_init.sql`](migrations/0001_init.sql), then [`migrations/0002_standing.sql`](migrations/0002_standing.sql) (rank widgets), then [`migrations/0003_avatar.sql`](migrations/0003_avatar.sql) (profile avatars), then [`migrations/0004_progress_merge.sql`](migrations/0004_progress_merge.sql) (conflicts settled by progress first), then [`migrations/0005_xp_limits.sql`](migrations/0005_xp_limits.sql) (XP and streak limits per account), then [`migrations/0006_sync_scale.sql`](migrations/0006_sync_scale.sql) (scale and hardening), then [`migrations/0007_focus_retention.sql`](migrations/0007_focus_retention.sql) (return-rate reports), then [`migrations/0008_feedback.sql`](migrations/0008_feedback.sql) (the "Góp ý" form, see "Feedback" below), then [`migrations/0009_client_errors.sql`](migrations/0009_client_errors.sql) (errors met on learners' devices, see "Errors" below), then [`migrations/0010_web_push.sql`](migrations/0010_web_push.sql) (study reminders in the web app, see "Reminders in the web app" below). Each file is run once, in order.

   0006 changes:
   - the leaderboard sums the XP ledger once instead of per profile, and `standing_board` returns the rank widgets' data (top, you, the people just above and below, the total) in one call
   - `sync_push` skips a row with an unreadable timestamp instead of failing the batch, and an account stores at most 300,000 synced rows
   - `profiles.sync_epoch` goes up on "reset all data", so other devices can notice the reset
   - invite codes come from a cryptographically random source (10 characters)
   - display names are trimmed and their spaces collapsed, 3-20 characters, checked in the database
   - row level security policies use `(select auth.uid())`, which Postgres evaluates once per query
3. **Authentication → Providers → Email**: keep email + password on.
   - Easiest: turn **Confirm email** off, so a new account can sign in at once.
   - With it on, sign-up shows "check your email" and sign-in works after the link is opened.
4. **Project Settings → API**: copy the *Project URL* and the *anon / publishable key*.
5. In the repo root create `.env.local` (gitignored, see `.env.example`):

   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```

   The anon key is meant to ship inside client apps; row level security is what protects the data.
   Never put the `service_role` key here.
6. Restart `npm run tauri dev` (or rebuild). Without these two variables the account section says the
   feature is not configured and nothing else changes.

## What is stored

| Table | Content |
|---|---|
| `profiles` | display name, avatar (preset id), level, streak, reset counter (`sync_epoch`) |
| `sync_rows` | generic synced rows (`card`, `word`, `log`, `event`, `mistake`, `grammar`, `kv`) as JSON |
| `sync_usage` | rows stored per account (the 300,000-row quota; not readable through the API) |
| `xp_daily` | XP earned per device per day (the leaderboard sums it) |
| `groups`, `group_members` | friend groups joined with an invite code |
| `feedback` | messages from the "Góp ý" form (not readable through the API) |
| `client_errors` | errors the app could not handle, one row per device, error and day (not readable through the API) |
| `push_subscriptions` | browsers of the web app that turned reminders on: push address and keys, study times, time zone (not readable through the API) |

Never uploaded: the imported grammar book, custom grammar exercises, the Oxford deck itself, API keys and
machine paths. Only an allowlist of settings is synced.

## Trust

XP is reported by the app. The database bounds it but cannot prove it was earned: the ranking is meant for
friends, not for prizes. The limits (0005):

- 5000 XP per account per day, all devices together; a device's day never decreases.
- XP from before the first sync (opening balance): 100,000 per account in all, written once per device.
- XP from at most 10 devices per account (a reinstall gets a new device id). An 11th device still syncs progress,
  but its XP is refused and the account section says so.
- The streak shown on the board is at most the number of days with XP in the streak's span.

Still possible for a modified client: claiming up to the daily cap on days it did not study.

## Feedback ("Góp ý") and the Telegram notice

The app's "Góp ý cho app" form (Settings, and the end-of-day card on Today) calls `send_feedback` from
[`0008_feedback.sql`](migrations/0008_feedback.sql). No account is needed. A message carries the app version, the
platform and the levels studied, never study data. Limits: 5 messages per device per day, 60 per hour in all.
A build without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` hides the link on Today and says so in Settings.

Read the messages in **Table Editor → feedback**, and tick `handled` once dealt with.

To get each new message in Telegram:

1. In Telegram, talk to **@BotFather** → `/newbot` → copy the bot token.
2. Send any message to the new bot, then open `https://api.telegram.org/bot<token>/getUpdates` in a browser and
   copy the number in `"chat":{"id": ...}`.
3. **Database → Extensions**: make sure `pg_net` is on (0008 turns it on if it can).
4. **SQL editor**, once:

   ```sql
   select vault.create_secret('<bot token>', 'telegram_bot_token');
   select vault.create_secret('<chat id>', 'telegram_chat_id');
   ```

   To change one later:
   `select vault.update_secret((select id from vault.secrets where name = 'telegram_bot_token'), '<new token>');`

Without the two secrets, or when Telegram fails, the message is still saved. To see why a notice did not arrive:
`select status_code, content, error_msg from net._http_response order by created desc limit 5;`

## Errors met on learners' devices

The app (all platforms) sends the errors nothing handled (an uncaught exception, a promise nobody awaited, a screen
that crashed) through `report_errors` from [`0009_client_errors.sql`](migrations/0009_client_errors.sql), in batches
a few seconds later, or at the next start when it was offline. Sent: the message and stack with e-mail addresses,
keys, tokens and the query part of addresses taken out, the app version, the platform (`android`, `desktop`, `web`)
and where it happened. Never study data. Limits: 30 different errors per device per day, 3000 new rows per hour in
all; the same error again the same day only raises `count`.

Read them in **Table Editor → client_errors**, newest `last_at` first, or grouped across devices:

```sql
select fingerprint, min(message) as message, sum(count) as times, count(distinct device_id) as devices,
       max(context ->> 'version') as latest_version, max(last_at) as last_seen
from public.client_errors where not handled and day > current_date - 7
group by fingerprint order by devices desc, times desc;
```

Tick `handled` once fixed. Until 0009 is run, the app keeps at most 20 errors waiting and tries again later.

## Reminders in the web app (Web Push)

The phone and desktop apps remind on their own. The web app cannot run in the background, so the server sends its
reminders: the browser saves its push subscription and the learner's study times (Settings → Nhắc học), and the
Edge Function [`send-reminders`](functions/send-reminders/index.ts) runs every 5 minutes and sends one notification
per study time and day, in the learner's time zone. On an iPhone this works for the web app added to the home
screen, iOS 16.4 and later.

Once:

1. Run [`0010_web_push.sql`](migrations/0010_web_push.sql) in the SQL editor.
2. Make a VAPID key pair on your computer (not in a chat or a shared document): `npx web-push generate-vapid-keys`.
   The **public** key goes in `.env.local` as `VITE_VAPID_PUBLIC_KEY=...` (rebuild the web app). The **private** key
   goes only into the function's secrets (next step).
3. **Edge Functions → Secrets**: add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` (your e-mail, shown to
   push services) and `CRON_SECRET` (any long random text).
4. Deploy the function without JWT checks (it checks `CRON_SECRET` itself), with the Supabase CLI:
   `npx supabase functions deploy send-reminders --no-verify-jwt --project-ref <ref>`
   (it takes `_shared/reminderSlots.ts` along).
5. **Database → Extensions**: turn on `pg_cron` and `pg_net`. Then in the SQL editor, with the same `CRON_SECRET`:

   ```sql
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   select cron.schedule('myenglish-web-reminders', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<ref>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
       body := '{}'::jsonb)
   $$);
   ```

Check: `select status_code, content from net._http_response order by created desc limit 5;` shows
`{"sent":…,"dropped":…}` every 5 minutes. Without step 2's public key in the build, the web app says its browser
cannot receive reminders.
