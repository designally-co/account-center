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

-- "Forgot password" sends at most one link a minute per person, and a limited number a minute in all
-- (supabase/functions/_shared/core.ts, recover). The server function claims the slot here in one statement,
-- so requests at the same moment cannot all pass. One row per person who asked; only the account id and
-- the time. Only the server function (as Friday's own database user) reads and writes it.
create table account.recover_sends (
  auth_user_id uuid primary key,
  sent_at      timestamptz not null default now()
);
create index recover_sends_sent_at_idx on account.recover_sends (sent_at);
alter table account.recover_sends enable row level security;
revoke all on account.recover_sends from public;
