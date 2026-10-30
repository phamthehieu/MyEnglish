-- MyEnglish: a learner deletes their own account from inside the app (Settings → Tài khoản → Xóa tài khoản), as the
-- app stores require. Run once in the SQL editor after 0001-0010.
--
-- Deleting the auth user removes everything tied to it (on delete cascade): profile, synced rows, XP, groups the
-- learner owns and memberships. Feedback messages, error reports and web push subscriptions stay without the link to
-- the account (on delete set null). The learning data on the learner's devices stays there.

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  delete from auth.users where id = v_uid;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
