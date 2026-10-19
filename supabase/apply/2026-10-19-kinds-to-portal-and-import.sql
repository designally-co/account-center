-- Account Center: six migrations (2026-10-19) and the one-time import from HR, for the Supabase SQL Editor
-- of Project Friday. Run it once, as a whole (Run, not "Run selected").
--
-- Safe for HR: it only reads HR. Everything it creates is inside schema `account`, which no app uses yet.
-- A guard takes a fingerprint of everything outside `account` (HR's tables and data, Auth's users, every
-- other schema, table, column, function, rule and right) before and after. If even one item is different,
-- it stops with "GUARD STOPPED", and nothing in this file is kept.
-- It also stops if it was run before (the first ALTER fails), so running it twice changes nothing.
--
-- The migrations are copied exactly from supabase/migrations/20261019110000 to 20261019160000, and the
-- whole file was tested on a copy with Friday's state. When it worked, the last result is one row of counts.

begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temp table snap_before(line text) on commit drop;
create temp table snap_after(line text) on commit drop;
create temp table result(line text) on commit drop;
insert into snap_before
select 'rel ' || n.nspname || '.' || c.relname || ' ' || c.relkind::text || ' ' || coalesce(c.relacl::text, '')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema', 'pg_toast') and n.nspname not like 'pg_temp%' and n.nspname not like 'pg_toast_temp%'
union all
select 'fn ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || coalesce(p.proacl::text, '')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema')
union all
select 'trigger ' || t.tgrelid::regclass::text || ' ' || t.tgname
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname <> 'account' and n.nspname not like 'pg_temp%' and not t.tgisinternal
union all
select 'constraint ' || conrelid::regclass::text || ' ' || conname || ' -> ' || coalesce(confrelid::regclass::text, '')
from pg_constraint c join pg_namespace n on n.oid = c.connamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema') and n.nspname not like 'pg_temp%'
union all
select 'column ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' || coalesce(column_default, '') || ' ' || is_nullable
from information_schema.columns where table_schema not in ('account', 'pg_catalog', 'information_schema') and table_schema not like 'pg_temp%'
union all
select 'policy ' || schemaname || '.' || tablename || ' ' || policyname from pg_policies where schemaname <> 'account'
union all
select 'schema ' || nspname || ' ' || coalesce(nspacl::text, '') from pg_namespace where nspname not in ('account') and nspname not like 'pg_temp%' and nspname not like 'pg_toast_temp%'
union all
select 'data hr_employees ' || coalesce(md5(string_agg(e::text, '|' order by e.id)), 'empty') from public.hr_employees e
union all
select 'data auth.users ' || coalesce(md5(string_agg(u::text, '|' order by u.id)), 'empty') from auth.users u
union all
select 'data hr_teams ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.hr_teams t
union all
select 'data hr_employee_teams ' || coalesce(md5(string_agg(x::text, '|' order by x.id)), 'empty') from public.hr_employee_teams x
;

-- ===== 20261019110000_kinds_and_access_lists.sql (copied exactly from the file) =====
-- Account Center: kinds of people, and per-person access lists (Buk, 2026-10-19).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- 1. Each person has a kind (employee, outsource, ...). The list of kinds is data, not code, because it is
--    not decided yet. A kind can be kept out of an app: an outsource account never gets the HR app.
-- 2. A person's access list: per app, a ready role, plus exceptions for that one person (an action added
--    to the role, or an action taken out of it). Example: an Article Studio writer who may also publish.
-- 3. The check (account.person_can) now reads the exceptions and the kind's blocked apps, and still fails
--    closed: an action is a yes only when the role or an added exception gives it, no exception takes it
--    away, and the person's kind is not kept out of that app.

-- ---------------------------------------------------------------------------------------------
-- Each app's colour on screen (the hue of its orb, 0 to 359), as data: spread around the colour wheel so
-- the apps are easy to tell apart. Empty for a new app until someone chooses one (the screen then picks one
-- from the app's key). The Account Center app uses 190, which is also the brand mark's colour.
alter table account.apps add column hue smallint check (hue between 0 and 359);
-- Where the app opens (its own address, or a page of Account Center), and its own graphic: a file that ships
-- with Account Center under /apps/. Empty when not known yet: the card then cannot open the app, or shows
-- the orb instead of a graphic.
alter table account.apps add column url text check (url ~ '^(https://[a-z0-9.-]+(/[^\s]*)?|/[a-z0-9/_-]*)$');
alter table account.apps add column icon text check (icon ~ '^/apps/[a-z0-9_-]+\.(png|svg)$');
update account.apps set url = v.url, icon = v.icon
from (values
  ('account_center', '/people', null),
  ('studio', 'https://article-studio.designally.co', '/apps/studio.png'),
  ('hub', 'https://hub.designally.co', null),
  ('survey', 'https://survey.designally.co', null),
  ('brand', 'https://brand-guideline-portal.vercel.app/admin', null),
  ('hr', 'https://hr.designally.co', '/apps/hr.svg')) v(key, url, icon)
where account.apps.key = v.key;
update account.apps set hue = v.hue
from (values ('account_center', 190), ('studio', 220), ('hub', 150), ('brand', 330), ('survey', 40), ('ma', 270), ('hr', 10)) v(key, hue)
where account.apps.key = v.key;

-- ---------------------------------------------------------------------------------------------
-- Kinds of people
create table account.kinds (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name        text not null check (length(btrim(name)) > 0),
  description text not null default ''
);

insert into account.kinds (key, name, description) values
  ('employee',  'Employee',  'Works for Designally'),
  ('outsource', 'Outsource', 'An outsourced worker. Never gets the HR app');

alter table account.people add column kind text not null default 'employee' references account.kinds (key);
create index people_kind_idx on account.people (kind);

-- Apps a kind may never use, whatever its roles say. No cascade: deleting the HR app or a kind must never
-- quietly drop a block. Kinds and blocks change only through a migration run by a person (see Rights below).
create table account.kind_blocked_apps (
  kind    text not null references account.kinds (key),
  app_key text not null references account.apps (key),
  primary key (kind, app_key)
);
create index kind_blocked_apps_app_idx on account.kind_blocked_apps (app_key);

insert into account.kind_blocked_apps (kind, app_key) values ('outsource', 'hr');

-- ---------------------------------------------------------------------------------------------
-- Per-person exceptions to their ready role: allowed = true adds an action, false takes one away.
create table account.person_actions (
  person_id  uuid not null references account.people (id) on delete cascade,
  action_key text not null references account.actions (key) on delete cascade,
  allowed    boolean not null,
  created_at timestamptz not null default now(),
  primary key (person_id, action_key)
);
create index person_actions_action_idx on account.person_actions (action_key);

alter table account.kinds             enable row level security;
alter table account.kind_blocked_apps enable row level security;
alter table account.person_actions    enable row level security;

create trigger log_kinds             after insert or update or delete on account.kinds             for each row execute function account.log_change();
create trigger log_kind_blocked_apps after insert or update or delete on account.kind_blocked_apps for each row execute function account.log_change();
create trigger log_person_actions    after insert or update or delete on account.person_actions    for each row execute function account.log_change();

-- ---------------------------------------------------------------------------------------------
-- Clear refusals: no role or added action in an app the person's kind is kept out of, and no change of
-- kind while the person still has access to such an app. (The check below also refuses at use time.)
create function account.kind_blocks_app(p_kind text, p_app_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from account.kind_blocked_apps b where b.kind = p_kind and b.app_key = p_app_key);
$$;

create function account.check_access_allowed_for_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_kind text; v_app text;
begin
  if tg_table_name = 'person_actions' then
    if not new.allowed then return new; end if;
    select a.app_key into v_app from account.actions a where a.key = new.action_key;
  else
    v_app := new.app_key;
  end if;
  -- FOR SHARE waits for a kind change that is running at the same time, and then reads the new kind.
  select p.kind into v_kind from account.people p where p.id = new.person_id for share;
  if account.kind_blocks_app(v_kind, v_app) then
    raise exception 'a % account cannot get access to %', v_kind, v_app using errcode = 'AC001';
  end if;
  return new;
end $$;

create trigger check_grants_kind before insert or update on account.grants
  for each row execute function account.check_access_allowed_for_kind();
create trigger check_person_actions_kind before insert or update on account.person_actions
  for each row execute function account.check_access_allowed_for_kind();

create function account.check_kind_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind is distinct from old.kind and (
       exists (select 1 from account.grants g
               where g.person_id = new.id and account.kind_blocks_app(new.kind, g.app_key))
    or exists (select 1 from account.person_actions x join account.actions a on a.key = x.action_key
               where x.person_id = new.id and x.allowed and account.kind_blocks_app(new.kind, a.app_key))) then
    raise exception 'remove this person''s access to the apps a % account cannot use first', new.kind using errcode = 'AC002';
  end if;
  return new;
end $$;

create trigger check_people_kind before update of kind on account.people
  for each row execute function account.check_kind_change();

-- ---------------------------------------------------------------------------------------------
-- The check every app asks, now with exceptions and kinds. Same name and arguments as before, so
-- can_user, can_email and the apps do not change, and its rights (granted to nobody but its owner) stay.
create or replace function account.person_can(p_person_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_active
       and p.auth_user_id is not null
       and account.login_ok(p.auth_user_id)
       and not exists (
         select 1 from account.actions a
         where a.key = p_action and account.kind_blocks_app(p.kind, a.app_key))
       and not exists (
         select 1 from account.person_actions x
         where x.person_id = p.id and x.action_key = p_action and not x.allowed)
       and (
         exists (
           select 1
           from account.grants g
           join account.role_actions ra on ra.app_key = g.app_key and ra.role_key = g.role_key
           where g.person_id = p.id and ra.action_key = p_action)
         or exists (
           select 1 from account.person_actions x
           where x.person_id = p.id and x.action_key = p_action and x.allowed))
    from account.people p
    where p.id = p_person_id
  ), false);
$$;

-- ---------------------------------------------------------------------------------------------
-- "Who is this, and which roles do they have?" no longer lists a role in an app the person's kind is kept
-- out of, so it agrees with the check. Same name, arguments and rights as before.
create or replace function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', g.app_key, 'role', g.role_key) order by g.app_key, g.role_key)
      from account.grants g
      where g.person_id = p.id and not account.kind_blocks_app(p.kind, g.app_key)
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;

-- The first Account Center admin, and the way back if nobody can manage Account Center any more (for
-- example every admin's login was blocked). An admin is someone who can both see and manage Account Center,
-- the same rule Account Center's server uses for every change. Works only while no active person is one.
-- Clears the person's single changes in Account Center, so the admin role is not undercut by one, and
-- refuses when the person still could not act afterwards (removed, or no working login). Same name,
-- arguments and rights as before: a person in the SQL Editor only.
create or replace function account.bootstrap_first_admin(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_person uuid;
begin
  if exists (select 1 from account.people p
             where p.is_active and account.person_can(p.id, 'account_center.view')
               and account.person_can(p.id, 'account_center.manage')) then
    raise exception 'Account Center already has an admin who can manage it';
  end if;
  v_person := account.person_by_email(p_email);
  if v_person is null then
    raise exception 'no single person with that email; run account.import_from_hr() first';
  end if;
  perform set_config('account.actor', 'bootstrap', true);
  delete from account.person_actions x using account.actions a
   where x.person_id = v_person and a.key = x.action_key and a.app_key = 'account_center';
  insert into account.grants (person_id, app_key, role_key) values (v_person, 'account_center', 'admin')
  on conflict do nothing;
  if not (account.person_can(v_person, 'account_center.view') and account.person_can(v_person, 'account_center.manage')) then
    raise exception 'that person still cannot manage Account Center: they are removed, or their login is missing or blocked';
  end if;
  return v_person;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Rights. New functions are closed to everyone first (AGENTS.md), then the tables go to Account Center's
-- own server only, like the earlier tables. The kinds and their blocked apps are read-only for it: the
-- app never changes them, and a block that one statement could delete would not protect anything.
revoke execute on function account.kind_blocks_app(text, text) from public;
revoke execute on function account.check_access_allowed_for_kind() from public;
revoke execute on function account.check_kind_change() from public;
revoke all on account.kinds, account.kind_blocked_apps, account.person_actions from public;

create policy account_app_read on account.kinds             for select to account_app using (true);
create policy account_app_read on account.kind_blocked_apps for select to account_app using (true);
create policy account_app_all  on account.person_actions    for all to account_app using (true) with check (true);

grant select on account.kinds, account.kind_blocked_apps to account_app;
grant select, insert, update, delete on account.person_actions to account_app;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019110000', 'kinds_and_access_lists', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019110000_kinds_and_access_lists.sql']);

-- ===== 20261019113000_avatars.sql (copied exactly from the file) =====
-- Account Center: each person's avatar (Buk, 2026-10-19: a customizable avatar, like Notion's avatar maker,
-- made by the person when they first sign in, to make it fun in the office).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- The avatar is stored as the person's choices (which hair, eyes, glasses, ...), not as an image. Account
-- Center's server checks every value against the known parts before it saves; the database keeps the shape
-- and the size in check. Empty means "not made yet" (the app then shows a stable starting face).

alter table account.people add column avatar jsonb
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and length(avatar::text) <= 1000));

-- A person's own avatar saves are limited to one every few seconds (Account Center's server looks for their
-- latest change in the log), so the log needs a quick way to find a person's latest changes.
create index log_actor_at_idx on account.log (actor, at);

-- "Who is this?" also gives the avatar, so Account Center (and, later, an app that needs it) can show it.
-- Same name, arguments and rights as before.
create or replace function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'avatar', p.avatar,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', g.app_key, 'role', g.role_key) order by g.app_key, g.role_key)
      from account.grants g
      where g.person_id = p.id and not account.kind_blocks_app(p.kind, g.app_key)
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019113000', 'avatars', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019113000_avatars.sql']);

-- ===== 20261019130000_invitations.sql (copied exactly from the file) =====
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

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019130000', 'invitations', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019130000_invitations.sql']);

-- ===== 20261019140000_app_cards.sql (copied exactly from the file) =====
-- Account Center: what each app does, shown on the app cards on Home: a short description and a small picture (Buk, 2026-10-19: "use the
-- app description" instead of the person's role and action count, which mean little to an employee).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- Data, not code: one short line per app, like the cards in Buk's design reference (2026-10-19: "the desc are
-- too long, follow the Manus reference"). Taken, shortened, from what each app says about itself:
-- the Designally Brain (each app's brain.yaml, purpose, read 2026-10-19) for Article Studio, the Knowledge Hub,
-- the survey and HR; the portal's README; MA Desk's product brief (designally-brain docs/products/ma-desk.md);
-- Account Center's own AGENTS.md. Empty for an app added later until someone writes one.
alter table account.apps add column description text not null default ''
  check (length(description) <= 60);

update account.apps set description = v.description
from (values
  ('account_center', 'Your access to every app, and your avatar.'),
  ('studio', 'Turn a topic into a researched article.'),
  ('hub', 'Free design articles and resources.'),
  ('survey', 'Turn client answers into one clear page.'),
  ('brand', 'Client brand guidelines and access codes.'),
  ('ma', 'Website domains, servers and renewals.'),
  ('hr', 'Attendance, leave and overtime.')) v(key, description)
where account.apps.key = v.key;

-- A small picture of what the app does, for its card on Home (Buk, 2026-10-19: "since almost all apps will have
-- the same logo or favicons, use the same concept as the Manus reference, showing what it does"). A file that
-- ships with Account Center under /apps/art/. Empty: the card shows the app's graphic or orb instead.
alter table account.apps add column art text check (art ~ '^/apps/art/[a-z0-9_-]+\.svg$');
update account.apps set art = '/apps/art/' || replace(key, '_', '-') || '.svg'
where key in ('account_center', 'studio', 'hub', 'survey', 'brand', 'ma', 'hr');

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019140000', 'app_cards', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019140000_app_cards.sql']);

-- ===== 20261019150000_teams.sql (copied exactly from the file) =====
-- Account Center: teams (Buk, 2026-10-19: "use HR's teams too and come up with a solid structure"; "if someone
-- joins and the admin sets the team, give them the default access of the team they are in, and also let the
-- admin add or reduce more access"; teams belong to Account Center, HR asks it).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- 1. Teams, copied once from HR at the import (account.import_from_hr), then managed here.
-- 2. Members: a person is in one team at most (Buk, 2026-10-19: "one person should be in only one team"). Any
--    member can be a lead of their team, and a team can have more than one lead.
-- 3. Each team can give a default role per app. A member gets it, unless an admin set something else for that
--    person in that app: their own role (account.grants) or "no access" (account.team_opt_outs). Single
--    changes for the person (account.person_actions) still add or take away actions on top, and a kind that
--    is kept out of an app (outsource and HR) still never gets it.
-- 4. An Account Center admin has every action in every app, whatever their team (Buk, 2026-10-19: "the admin
--    has all access no matter which team he is in"). Admin is given person by person only: a team can never
--    give Account Center access. Single changes and the kind still apply (an outsource admin never gets HR).
-- 5. account.is_lead_of: "is this person a lead of that person's team?", for apps such as HR (leave
--    approvals). Granted to an app's user only on the day that app starts using Account Center.

create table account.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 1 and 60),
  description text not null default '' check (length(description) <= 160),
  is_active   boolean not null default true,
  hr_team_id  uuid unique,                -- the HR team it was copied from (a plain id, no link into HR)
  created_at  timestamptz not null default now()
);

create table account.team_members (
  person_id  uuid primary key references account.people (id) on delete cascade,   -- one team per person
  team_id    uuid not null references account.teams (id) on delete cascade,
  is_lead    boolean not null default false,
  created_at timestamptz not null default now()
);
create index team_members_team_idx on account.team_members (team_id);

-- One default role per app per team.
create table account.team_roles (
  team_id  uuid not null references account.teams (id) on delete cascade,
  app_key  text not null,
  role_key text not null,
  primary key (team_id, app_key),
  foreign key (app_key, role_key) references account.roles (app_key, key) on delete cascade,
  check (app_key <> 'account_center')   -- Account Center access, admin above all, is given person by person
);
create index team_roles_role_idx on account.team_roles (app_key, role_key);

-- "No access in this app, whatever the person's teams give": set by an admin on the person's page.
create table account.team_opt_outs (
  person_id  uuid not null references account.people (id) on delete cascade,
  app_key    text not null references account.apps (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, app_key)
);
create index team_opt_outs_app_idx on account.team_opt_outs (app_key);

alter table account.teams         enable row level security;
alter table account.team_members  enable row level security;
alter table account.team_roles    enable row level security;
alter table account.team_opt_outs enable row level security;

create trigger log_teams         after insert or update or delete on account.teams         for each row execute function account.log_change();
create trigger log_team_members  after insert or update or delete on account.team_members  for each row execute function account.log_change();
create trigger log_team_roles    after insert or update or delete on account.team_roles    for each row execute function account.log_change();
create trigger log_team_opt_outs after insert or update or delete on account.team_opt_outs for each row execute function account.log_change();

-- ---------------------------------------------------------------------------------------------
-- What a person's roles give for one action, before single changes, the kind and the login are checked:
-- everything for an Account Center admin; else their own role in that app; or, when they have none there and
-- no "no access" there, their team's default role (active teams only).
create function account.base_allows(p_person_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from account.actions a
    where a.key = p_action
      and (
        exists (select 1 from account.grants g
                where g.person_id = p_person_id and g.app_key = 'account_center' and g.role_key = 'admin')
        or exists (select 1 from account.grants g
                join account.role_actions ra on ra.app_key = g.app_key and ra.role_key = g.role_key
                where g.person_id = p_person_id and ra.action_key = p_action)
        or (not exists (select 1 from account.grants g where g.person_id = p_person_id and g.app_key = a.app_key)
            and not exists (select 1 from account.team_opt_outs o where o.person_id = p_person_id and o.app_key = a.app_key)
            and exists (select 1 from account.team_members m
                        join account.teams t on t.id = m.team_id and t.is_active
                        join account.team_roles tr on tr.team_id = m.team_id and tr.app_key = a.app_key
                        join account.role_actions ra on ra.app_key = tr.app_key and ra.role_key = tr.role_key
                        where m.person_id = p_person_id and ra.action_key = p_action))));
$$;

-- The check every app asks, now with teams. Same name, arguments and rights as before.
create or replace function account.person_can(p_person_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_active
       and p.auth_user_id is not null
       and account.login_ok(p.auth_user_id)
       and not exists (
         select 1 from account.actions a
         where a.key = p_action and account.kind_blocks_app(p.kind, a.app_key))
       and not exists (
         select 1 from account.person_actions x
         where x.person_id = p.id and x.action_key = p_action and not x.allowed)
       and (account.base_allows(p.id, p_action)
            or exists (select 1 from account.person_actions x
                       where x.person_id = p.id and x.action_key = p_action and x.allowed))
    from account.people p
    where p.id = p_person_id
  ), false);
$$;

-- "Who is this?" lists the roles the person has through their teams too. Same name, arguments and rights.
create or replace function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'avatar', p.avatar,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', r.app_key, 'role', r.role_key) order by r.app_key, r.role_key)
      from (
        select g.app_key, g.role_key from account.grants g where g.person_id = p.id
        union
        select tr.app_key, tr.role_key
        from account.team_members m
        join account.teams t on t.id = m.team_id and t.is_active
        join account.team_roles tr on tr.team_id = m.team_id
        where m.person_id = p.id
          and not exists (select 1 from account.grants g where g.person_id = p.id and g.app_key = tr.app_key)
          and not exists (select 1 from account.team_opt_outs o where o.person_id = p.id and o.app_key = tr.app_key)
      ) r
      where not account.kind_blocks_app(p.kind, r.app_key)
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;

-- For apps such as HR: is the first account a lead of the team the second account's person is in? Both must
-- be active, the lead's login must work, and nobody leads themselves.
create function account.is_lead_of(p_lead_auth_user_id uuid, p_person_auth_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from account.people l
    join account.team_members ml on ml.person_id = l.id and ml.is_lead
    join account.teams t on t.id = ml.team_id and t.is_active
    join account.team_members mp on mp.team_id = ml.team_id
    join account.people p on p.id = mp.person_id
    where l.auth_user_id = p_lead_auth_user_id
      and p.auth_user_id = p_person_auth_user_id
      and l.id <> p.id
      and l.is_active and p.is_active
      and account.login_ok(l.auth_user_id));
$$;

-- ---------------------------------------------------------------------------------------------
-- The one-time import also copies HR's teams, members and leads (read only from HR, once). HR lets a person
-- be in several teams; here they keep one: HR's primary team, else the first by name. An HR lead who ends up
-- in another team is not made a lead; the answer counts them, so an admin can set leads by hand.
-- Same name, arguments and rights as before; still refuses when anyone is already in the list.
create or replace function account.import_from_hr() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_added int; v_teams int; v_members int; v_leads int; v_leads_missed int;
begin
  if exists (select 1 from account.people) then
    raise exception 'People are already in Account Center; the HR list is imported only once';
  end if;
  perform set_config('account.actor', 'import from HR', true);
  insert into account.people (auth_user_id, hr_employee_id, source, display_name, email, is_active)
  select s.auth_user_id, s.hr_id, 'hr', s.display_name, s.email, s.is_active
  from account.hr_people() s;
  get diagnostics v_added = row_count;

  insert into account.teams (name, is_active, hr_team_id)
  select left(coalesce(nullif(btrim(t.display_name), ''), btrim(t.name)), 60), coalesce(t.is_active, true), t.id
  from public.hr_teams t
  where coalesce(nullif(btrim(t.display_name), ''), nullif(btrim(t.name), '')) is not null;
  get diagnostics v_teams = row_count;

  insert into account.team_members (person_id, team_id)
  select distinct on (p.id) p.id, at.id
  from public.hr_employee_teams et
  join account.teams at on at.hr_team_id = et.team_id
  join account.people p on p.hr_employee_id = et.employee_id
  order by p.id, (et.is_primary is true) desc, at.name;
  get diagnostics v_members = row_count;

  -- Leads: HR has one per team. A lead who is a member of that team leads it; a lead with no team here joins
  -- the (first) team they lead.
  update account.team_members m set is_lead = true
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where m.person_id = p.id and m.team_id = at.id;
  get diagnostics v_leads = row_count;
  insert into account.team_members (person_id, team_id, is_lead)
  select distinct on (p.id) p.id, at.id, true
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where not exists (select 1 from account.team_members m where m.person_id = p.id)
  order by p.id, at.name;
  get diagnostics v_members = row_count;
  v_leads := v_leads + v_members;
  select count(*) into v_members from account.team_members;
  select count(*) into v_leads_missed
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where not exists (select 1 from account.team_members m where m.person_id = p.id and m.team_id = at.id and m.is_lead);

  return jsonb_build_object('added', v_added, 'teams', v_teams, 'team_members', v_members,
                            'leads', v_leads, 'leads_in_another_team', v_leads_missed);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Rights. New functions are closed to everyone first (AGENTS.md). Account Center's server uses the tables
-- and base_allows (for the People page's counts); is_lead_of goes to an app's user on that app's day.
revoke execute on function account.base_allows(uuid, text) from public;
revoke execute on function account.is_lead_of(uuid, uuid) from public;
revoke all on account.teams, account.team_members, account.team_roles, account.team_opt_outs from public;

create policy account_app_all on account.teams         for all to account_app using (true) with check (true);
create policy account_app_all on account.team_members  for all to account_app using (true) with check (true);
create policy account_app_all on account.team_roles    for all to account_app using (true) with check (true);
create policy account_app_all on account.team_opt_outs for all to account_app using (true) with check (true);

grant select, insert, update, delete on account.teams, account.team_members, account.team_roles, account.team_opt_outs to account_app;
grant execute on function account.base_allows(uuid, text) to account_app;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019150000', 'teams', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019150000_teams.sql']);

-- ===== 20261019160000_brand_portal.sql (copied exactly from the file) =====
-- Account Center: the Brand Guideline Portal is its first app (Buk, 2026-10-19: "first use the brand guideline
-- portal to try the account sign in, as it is still in development"; the actions and the three roles below
-- approved by Buk the same day). Same safety rules as the earlier migrations: everything stays inside schema
-- `account`, except one database role, `portal_check`.
--
-- 1. The portal's actions (app key `brand`), taken from the portal's admin server actions and its read-only
--    admin screens (khunshinesithu/brand-guideline-portal at 2ea3e75, src/app/admin/actions.ts). The ready
--    roles match what the portal's own admin_users roles allow today, so nobody gains or loses anything when
--    the portal starts asking Account Center: an editor may do everything except delete a brand, an owner
--    may do everything. Viewer is new.
-- 2. `portal_check`: the portal's database user in Friday. The portal's data is not in Friday yet (it moves
--    later), so this user may only ask one question, account.can_user(account id, action): no table, no
--    other function, nothing outside schema `account`. Its login is made by a person
--    (sql/portal-check-user.sql), never by a migration.

insert into account.actions (app_key, key, description) values
  ('brand', 'brand.view',            'Open the admin and see brands, sections, files and the strategy'),
  ('brand', 'brand.activity.view',   'See the activity log: which codes were used or shown, and when'),
  ('brand', 'brand.brand.create',    'Create a new brand (it starts as a draft)'),
  ('brand', 'brand.brand.edit',      'Edit a brand''s details: client name, accent colour, page font'),
  ('brand', 'brand.brand.publish',   'Publish, unpublish or archive a brand'),
  ('brand', 'brand.brand.delete',    'Delete a brand and all its files'),
  ('brand', 'brand.guideline.edit',  'Edit the guideline''s sections, and show or hide them'),
  ('brand', 'brand.strategy.edit',   'Edit the client team''s strategy'),
  ('brand', 'brand.strategy.share',  'Choose which strategy parts the guideline''s Brand core shows'),
  ('brand', 'brand.files.manage',    'Upload, edit and delete files'),
  ('brand', 'brand.code.manage',     'Create, replace, revoke and delete access codes'),
  ('brand', 'brand.code.reveal',     'Show an access code again (every showing is logged)');

insert into account.roles (app_key, key, name, description) values
  ('brand', 'viewer', 'Viewer', 'Can look at everything, cannot change anything'),
  ('brand', 'editor', 'Editor', 'Can do everything except delete a brand (today''s portal editor)'),
  ('brand', 'owner',  'Owner',  'Can do everything (today''s portal owner)');

insert into account.role_actions (app_key, role_key, action_key)
select 'brand', 'viewer', a from unnest(array['brand.view', 'brand.activity.view']) a
union all
select 'brand', 'editor', a.key from account.actions a where a.app_key = 'brand' and a.key <> 'brand.brand.delete'
union all
select 'brand', 'owner', a.key from account.actions a where a.app_key = 'brand';

-- ---------------------------------------------------------------------------------------------
-- The portal's database user: the access question only.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_check') then
    create role portal_check nologin;
  end if;
end $$;

grant usage on schema account to portal_check;
grant execute on function account.can_user(uuid, text) to portal_check;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261019160000', 'brand_portal', array['-- Applied 2026-10-19 in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261019160000_brand_portal.sql']);

-- ===== the one-time import from HR (reads HR only) =====
insert into result select account.import_from_hr()::text;
insert into snap_after
select 'rel ' || n.nspname || '.' || c.relname || ' ' || c.relkind::text || ' ' || coalesce(c.relacl::text, '')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema', 'pg_toast') and n.nspname not like 'pg_temp%' and n.nspname not like 'pg_toast_temp%'
union all
select 'fn ' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || coalesce(p.proacl::text, '')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema')
union all
select 'trigger ' || t.tgrelid::regclass::text || ' ' || t.tgname
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
where n.nspname <> 'account' and n.nspname not like 'pg_temp%' and not t.tgisinternal
union all
select 'constraint ' || conrelid::regclass::text || ' ' || conname || ' -> ' || coalesce(confrelid::regclass::text, '')
from pg_constraint c join pg_namespace n on n.oid = c.connamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema') and n.nspname not like 'pg_temp%'
union all
select 'column ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type || ' ' || coalesce(column_default, '') || ' ' || is_nullable
from information_schema.columns where table_schema not in ('account', 'pg_catalog', 'information_schema') and table_schema not like 'pg_temp%'
union all
select 'policy ' || schemaname || '.' || tablename || ' ' || policyname from pg_policies where schemaname <> 'account'
union all
select 'schema ' || nspname || ' ' || coalesce(nspacl::text, '') from pg_namespace where nspname not in ('account') and nspname not like 'pg_temp%' and nspname not like 'pg_toast_temp%'
union all
select 'data hr_employees ' || coalesce(md5(string_agg(e::text, '|' order by e.id)), 'empty') from public.hr_employees e
union all
select 'data auth.users ' || coalesce(md5(string_agg(u::text, '|' order by u.id)), 'empty') from auth.users u
union all
select 'data hr_teams ' || coalesce(md5(string_agg(t::text, '|' order by t.id)), 'empty') from public.hr_teams t
union all
select 'data hr_employee_teams ' || coalesce(md5(string_agg(x::text, '|' order by x.id)), 'empty') from public.hr_employee_teams x
;
do $guard$
declare v_changed int; v_items int;
begin
  select count(*) into v_items from snap_before;
  select count(*) into v_changed from (
    (select line from snap_before except all select line from snap_after)
    union all
    (select line from snap_after except all select line from snap_before)) d;
  if v_items < 1000 or v_changed <> 0 then
    raise exception 'GUARD STOPPED (nothing kept): % items compared, % changed outside schema account', v_items, v_changed;
  end if;
  insert into result values ('guard: ' || v_items || ' items outside schema account compared, 0 changed');
end $guard$;
select (select string_agg(line, ' | ') from result) as result,
       (select count(*) from account.people) as people,
       (select count(*) from account.teams) as teams,
       (select count(*) from account.team_members) as team_members;
commit;

-- Next, only after the row above appears: make yourself the first admin (your own HR email):
-- select account.bootstrap_first_admin('your-hr-email@example.com');
