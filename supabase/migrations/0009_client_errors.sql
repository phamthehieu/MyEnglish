-- MyEnglish: errors met on learners' devices. Run once in the SQL editor after 0001-0008.
--
-- The app (src/services/errorReport.ts) sends the errors it could not handle, in batches, through report_errors,
-- with or without an account. Nothing can be read back through the API: read them in the dashboard
-- (Table Editor → client_errors, newest `last_at` first) and tick `handled` once fixed.
--
-- One row per device, error and day: the same error met again that day only raises `count`. No study data is sent:
-- the error's message and stack, the app version, the platform and the screen it happened on.

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  day date not null default current_date,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  -- the installation (sync_state "device_id"): groups a device's errors and limits how many it sends
  device_id text not null check (char_length(device_id) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  -- the same error on any device: message and first stack line, hashed by the app
  fingerprint text not null check (char_length(fingerprint) between 1 and 64),
  message text not null check (char_length(message) between 1 and 500),
  stack text check (char_length(stack) <= 4000),
  -- app version, platform (android / desktop / web...), where it happened (window, error kind)
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 2048),
  count integer not null default 1 check (count >= 1),
  handled boolean not null default false,
  unique (device_id, fingerprint, day)
);
create index if not exists client_errors_recent on public.client_errors (last_at desc);
create index if not exists client_errors_fingerprint on public.client_errors (fingerprint, day);

-- No policy: the table is not readable or writable through the API, only through report_errors
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

-- A batch of at most 20 errors. Bounds: 30 different errors per device per day, 3000 new rows per hour in all; over
-- them the batch is dropped quietly (the app forgets it: errors are a sample, not a ledger).
create or replace function public.report_errors(p_device text, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_fingerprint text;
  v_message text;
  v_stack text;
  v_context jsonb;
  v_count integer;
begin
  if p_device is null or char_length(p_device) not between 8 and 64
    or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 20 then
    raise exception 'errors_invalid';
  end if;
  if (select count(*) from public.client_errors where device_id = p_device and day = current_date) >= 30
    or (select count(*) from public.client_errors where first_at > now() - interval '1 hour') >= 3000 then
    return;
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_fingerprint := left(btrim(coalesce(v_item ->> 'fingerprint', '')), 64);
    v_message := left(btrim(coalesce(v_item ->> 'message', '')), 500);
    v_stack := nullif(left(coalesce(v_item ->> 'stack', ''), 4000), '');
    v_context := case when jsonb_typeof(v_item -> 'context') = 'object' and pg_column_size(v_item -> 'context') <= 2048
      then v_item -> 'context' else '{}'::jsonb end;
    v_count := least(greatest(coalesce((v_item ->> 'count')::integer, 1), 1), 1000);
    continue when v_fingerprint = '' or v_message = '';
    insert into public.client_errors (device_id, user_id, fingerprint, message, stack, context, count)
    values (p_device, (select auth.uid()), v_fingerprint, v_message, v_stack, v_context, v_count)
    on conflict (device_id, fingerprint, day) do update
      set count = least(public.client_errors.count + excluded.count, 1000000),
          last_at = now(),
          context = excluded.context;
  end loop;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'errors_invalid';
end $$;

revoke execute on function public.report_errors(text, jsonb) from public;
grant execute on function public.report_errors(text, jsonb) to anon, authenticated;
