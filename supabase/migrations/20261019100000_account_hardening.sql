-- Account Center: four improvements after the first apply in Project Friday (Buk, 2026-10-19).
-- Same safety rules as 20261014100000_account_schema.sql: everything stays inside schema `account`,
-- and nothing outside it changes (the only other effect is taking back what that migration granted to
-- the other apps' users).

-- 1. Other apps get nothing until they use Account Center. The first migration let hub_app, studio_app
--    and survey_app call the checks, and me_by_email answers for any email (name and roles), so those
--    apps' logins could list staff once the HR list is imported. An app's own migration grants it the
--    checks on the day it starts using Account Center (docs/spec.md, "How an app checks access").
do $$
declare r text;
begin
  foreach r in array array['hub_app', 'studio_app', 'survey_app', 'ma_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function account.can_user(uuid, text), account.can_email(text, text), account.me_by_user(uuid), account.me_by_email(text) from %I', r);
      execute format('revoke usage on schema account from %I', r);
    end if;
  end loop;
end $$;

-- 2. Functions added later must not be executable by everyone. Not done here with
--    "alter default privileges ... in schema account revoke execute on functions from public": a per-schema
--    default can only add rights, never take away PostgreSQL's global default, so that line does nothing; and
--    the global version would change every new function in Project Friday, outside schema `account`.
--    Instead every migration that adds a function revokes it from public itself (AGENTS.md), and the tests
--    fail when any function in `account` is executable by everyone (test/checks.sql).

-- 3. Indexes for the foreign keys the Supabase performance advisor listed.
create index grants_app_role_idx         on account.grants (app_key, role_key);
create index person_emails_person_idx    on account.person_emails (person_id);
create index role_actions_app_action_idx on account.role_actions (app_key, action_key);

-- 4. The app list and the apps' actions are in the change log too.
create trigger log_apps    after insert or update or delete on account.apps    for each row execute function account.log_change();
create trigger log_actions after insert or update or delete on account.actions for each row execute function account.log_change();
