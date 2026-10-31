-- MyEnglish: web reminders stop for the day once the learner has reached the day's goal. Run once in the SQL editor
-- after 0010.
--
-- The web app tells the server, through mark_push_studied, the local day on which this browser's learner reached
-- the goal (and the time zone they are in now: it changes when they travel). send-reminders skips the study times
-- of that day.

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
