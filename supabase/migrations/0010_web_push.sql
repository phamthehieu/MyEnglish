-- MyEnglish: study reminders for the web app (Web Push). Run once in the SQL editor after 0001-0009.
--
-- A browser that turned reminders on (Settings → Nhắc học, web app) saves its push subscription and the learner's
-- study times here through save_push_subscription, with or without an account. The Edge Function send-reminders
-- (supabase/functions/send-reminders) runs every 5 minutes, sends a notification at each study time in the
-- learner's own time zone, once a day per time, and forgets subscriptions the browser has cancelled.
-- Setting up the keys, the function and its schedule: README.md, "Reminders in the web app".

create table if not exists public.push_subscriptions (
  -- the browser's push address (unique per browser and site)
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  -- the installation (sync_state "device_id"): limits how many subscriptions one device keeps
  device_id text not null check (char_length(device_id) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  -- the subscription's keys (public: they let the server encrypt for this browser, nothing else)
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  -- study times "HH:MM", local time, at most 6
  times text[] not null default '{}' check (cardinality(times) <= 6),
  -- IANA time zone of the learner ("Asia/Ho_Chi_Minh")
  tz text not null check (char_length(tz) between 1 and 64),
  -- the last reminder sent, "YYYY-MM-DD HH:MM" local: one per study time and day
  last_slot text,
  failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_device on public.push_subscriptions (device_id);

-- No policy: not readable or writable through the API; the Edge Function reads it with the service role
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Save or update this browser's subscription and study times. At most 3 subscriptions per device.
create or replace function public.save_push_subscription(
  p_device text, p_endpoint text, p_p256dh text, p_auth text, p_times text[], p_tz text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_times text[];
begin
  if p_device is null or char_length(p_device) not between 8 and 64
    or p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
    or char_length(coalesce(p_p256dh, '')) not between 20 and 200
    or char_length(coalesce(p_auth, '')) not between 8 and 100
    or char_length(coalesce(p_tz, '')) not between 1 and 64
    or not exists (select 1 from pg_timezone_names where name = p_tz) then
    raise exception 'push_invalid';
  end if;
  select coalesce(array_agg(distinct t order by t), '{}') into v_times
  from unnest(coalesce(p_times, '{}')) as t where t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
  if cardinality(v_times) > 6 then
    raise exception 'push_invalid';
  end if;
  if not exists (select 1 from public.push_subscriptions where endpoint = p_endpoint)
    and (select count(*) from public.push_subscriptions where device_id = p_device) >= 3 then
    -- the device's oldest goes (a browser that re-subscribed leaves its old address behind)
    delete from public.push_subscriptions where endpoint = (
      select endpoint from public.push_subscriptions where device_id = p_device order by updated_at limit 1);
  end if;
  insert into public.push_subscriptions (endpoint, device_id, user_id, p256dh, auth, times, tz)
  values (p_endpoint, p_device, (select auth.uid()), p_p256dh, p_auth, v_times, p_tz)
  on conflict (endpoint) do update
    set device_id = excluded.device_id, user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        times = excluded.times, tz = excluded.tz, failures = 0, updated_at = now();
end $$;

-- Turn reminders off for this browser
create or replace function public.remove_push_subscription(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke execute on function public.save_push_subscription(text, text, text, text, text[], text) from public;
grant execute on function public.save_push_subscription(text, text, text, text, text[], text) to anon, authenticated;
revoke execute on function public.remove_push_subscription(text) from public;
grant execute on function public.remove_push_subscription(text) to anon, authenticated;
