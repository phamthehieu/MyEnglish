-- MyEnglish: learner feedback (the "Góp ý" form). Run once in the SQL editor after 0001-0007.
--
-- The app sends a message through send_feedback, with or without an account. Nothing can be read back through the
-- API: read the messages in the dashboard (Table Editor → feedback) and tick `handled` once dealt with.
--
-- Each new message is also posted to a Telegram chat when two Vault secrets exist (see README.md, "Góp ý"):
--   select vault.create_secret('<bot token>', 'telegram_bot_token');
--   select vault.create_secret('<chat id>', 'telegram_chat_id');
-- Without them, or if Telegram fails, the message is still saved.

create extension if not exists pg_net;

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  -- the installation (sync_state "device_id"): only used to limit how many messages one device sends
  device_id text not null check (char_length(device_id) between 8 and 64),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'content', 'idea', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  -- how the learner wants an answer (email, Zalo...), optional
  contact text check (char_length(contact) <= 200),
  -- app version, platform, levels studied
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 2048),
  handled boolean not null default false
);
create index if not exists feedback_device_recent on public.feedback (device_id, created_at);
create index if not exists feedback_recent on public.feedback (created_at);

-- No policy: the table is not readable or writable through the API, only through send_feedback
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- At most 5 messages per device per day, and 60 per hour in all (keeps a flood out of the Telegram chat)
create or replace function public.send_feedback(
  p_device text, p_kind text, p_message text, p_contact text default null, p_context jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_message text := btrim(coalesce(p_message, ''));
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
begin
  if p_device is null or char_length(p_device) not between 8 and 64
    or coalesce(p_kind, '') not in ('bug', 'content', 'idea', 'other')
    or char_length(v_message) not between 1 and 2000
    or char_length(v_contact) > 200 then
    raise exception 'feedback_invalid';
  end if;
  if (select count(*) from public.feedback where device_id = p_device and created_at > now() - interval '1 day') >= 5 then
    raise exception 'feedback_limit';
  end if;
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'feedback_busy';
  end if;
  insert into public.feedback (device_id, user_id, kind, message, contact, context)
  values (
    p_device, (select auth.uid()), p_kind, v_message, v_contact,
    case when jsonb_typeof(p_context) = 'object' and pg_column_size(p_context) <= 2048 then p_context else '{}'::jsonb end
  );
end $$;

revoke execute on function public.send_feedback(text, text, text, text, jsonb) from public;
grant execute on function public.send_feedback(text, text, text, text, jsonb) to anon, authenticated;

-- Posts a new message to Telegram (pg_net sends it after the insert commits)
create or replace function public.feedback_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_chat text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_chat_id';
  if v_token is null or v_chat is null then
    return new;
  end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    body := jsonb_build_object(
      'chat_id', v_chat,
      'disable_web_page_preview', true,
      'text', format(
        E'Góp ý MyEnglish: %s\n\n%s\n\nLiên hệ: %s\nBản %s · %s · %s%s',
        case new.kind when 'bug' then 'Lỗi' when 'content' then 'Nội dung sai' when 'idea' then 'Ý tưởng' else 'Khác' end,
        new.message,
        coalesce(new.contact, '(không để lại)'),
        coalesce(new.context ->> 'version', '?'),
        coalesce(new.context ->> 'platform', '?'),
        coalesce(new.context ->> 'levels', '?'),
        case when new.user_id is not null then ' · có tài khoản' else '' end
      )
    )
  );
  return new;
exception when others then
  -- The message is saved even when the notice fails (pg_net missing, Vault unreadable...)
  return new;
end $$;

revoke execute on function public.feedback_notify() from public, anon, authenticated;

drop trigger if exists feedback_notify on public.feedback;
create trigger feedback_notify after insert on public.feedback for each row execute function public.feedback_notify();
