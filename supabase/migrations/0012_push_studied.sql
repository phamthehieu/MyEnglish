-- MyEnglish: web reminders, second part. Run once in the SQL editor after 0011, and BEFORE deploying send-reminders
-- again (the new function reads what this file adds).
--
-- - Reminders stop for the day once the learner reached the day's goal: the web app tells the server, through
--   mark_push_studied, the local day on which this browser's learner did (and the time zone they are in now: it
--   changes when they travel). send-reminders skips the study times of that day.
-- - send-reminders reads only the subscriptions due now (due_push_subscriptions), not the whole table.
-- - New subscriptions are limited per minute: saving one needs no account.

alter table public.push_subscriptions add column if not exists studied_on text
  check (studied_on is null or studied_on ~ '^\d{4}-\d{2}-\d{2}$');

-- This browser's learner reached today's goal (p_day: their local date). Only a browser that knows its own push
-- address can mark it; nothing is created.
create or replace function public.mark_push_studied(p_endpoint text, p_day text, p_tz text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'push_invalid';
  end if;
  update public.push_subscriptions
    set studied_on = p_day,
        tz = case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else tz end,
        updated_at = now()
    where endpoint = p_endpoint;
end $$;

revoke execute on function public.mark_push_studied(text, text, text) from public;
grant execute on function public.mark_push_studied(text, text, text) to anon, authenticated;

-- The subscriptions with a study time reached less than p_window minutes ago in their own time zone: send-reminders
-- reads only these (it used to read every subscription, the first 10 000 in no order, so a crowded table left
-- learners out). The function itself still decides, per row, whether that time was already sent.
create or replace function public.due_push_subscriptions(p_window integer default 15)
returns table (endpoint text, p256dh text, auth text, times text[], tz text, last_slot text, failures integer, studied_on text)
language sql stable security definer set search_path = public as $$
  select s.endpoint, s.p256dh, s.auth, s.times, s.tz, s.last_slot, s.failures, s.studied_on
  from public.push_subscriptions s
  where cardinality(s.times) > 0
    and exists (
      select 1 from unnest(s.times) as t
      where t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (extract(hour from (now() at time zone s.tz)) * 60 + extract(minute from (now() at time zone s.tz)))
            - (substr(t, 1, 2)::int * 60 + substr(t, 4, 2)::int) between 0 and p_window - 1
    )
  order by s.updated_at
  limit 5000;
$$;
revoke execute on function public.due_push_subscriptions(integer) from public, anon, authenticated;
grant execute on function public.due_push_subscriptions(integer) to service_role;

-- A new subscription is refused when the table took many in the last minute: nobody signing in is needed to save
-- one, so a script could otherwise fill it. Learners turning reminders on come far below this.
create or replace function public.limit_new_push_subscriptions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.push_subscriptions where created_at > now() - interval '1 minute') >= 60 then
    raise exception 'push_busy';
  end if;
  return new;
end $$;
drop trigger if exists push_subscriptions_rate on public.push_subscriptions;
create trigger push_subscriptions_rate before insert on public.push_subscriptions
  for each row execute function public.limit_new_push_subscriptions();
