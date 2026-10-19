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
-- example every admin's login was blocked). Works only while no active person can manage it. Clears the
-- person's single changes in Account Center, so the admin role is not undercut by one, and refuses when
-- the person still could not manage afterwards (removed, or no working login). Same name, arguments and
-- rights as before: a person in the SQL Editor only.
create or replace function account.bootstrap_first_admin(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_person uuid;
begin
  if exists (select 1 from account.people p where p.is_active and account.person_can(p.id, 'account_center.manage')) then
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
  if not account.person_can(v_person, 'account_center.manage') then
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
