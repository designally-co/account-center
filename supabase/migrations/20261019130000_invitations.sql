-- Account Center: invitations (Buk, 2026-10-19: an admin creates the account for a new person with their
-- Google email; the person accepts, sets a password, makes their avatar, and can reset the password).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- The accounts themselves are made by the server functions `account-invite` and `account-recover`
-- (supabase/functions/), not by this migration. Here the People pages only learn one more state: a person
-- whose account was invited but who has not opened the invitation yet.

-- 'invited': the account exists and is not blocked, but the person has not accepted the invitation (their
-- email is not confirmed yet). Still only a word for the People page, never other account details.
-- Same name, arguments and rights as before.
create or replace function account.login_state(p_auth_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_auth_user_id is null then 'missing'
    when not exists (select 1 from auth.users u where u.id = p_auth_user_id and u.deleted_at is null) then 'missing'
    when not account.login_ok(p_auth_user_id) then 'blocked'
    when exists (select 1 from auth.users u
                 where u.id = p_auth_user_id and u.invited_at is not null and u.email_confirmed_at is null) then 'invited'
    else 'ok'
  end;
$$;
