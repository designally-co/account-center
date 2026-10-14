-- Account Center: schema `account` in Project Friday.
--
-- Safety rules (docs/spec.md, Buk 2026-10-14: this must not affect the working HR app or any other app):
--   * Every object is created inside schema `account`, except one database role, `account_app`
--     (Account Center's own server; NOLOGIN here, given a password by sql/account-app-user.sql).
--   * auth.users and public.hr_employees are only READ, by functions below. public.hr_employees is read
--     ONCE, by account.import_from_hr(), run by a person when Account Center starts (Buk, 2026-10-14:
--     import the HR list once; after that Account Center's list is the real list). Nothing here writes them,
--     and there are no triggers, foreign keys or other constraints on them, so HR's add, delete and
--     offboarding flows behave exactly as before.
--   * Only these HR fields are read: id, auth_user_id, email, display_name, nickname, first_name,
--     is_active, is_fixture. Never phone, birthday, emergency contact, salary or anything else.
--   * Apps never read `account` tables. They only call the check functions with their own database user.

create schema account;
revoke all on schema account from public;

-- ---------------------------------------------------------------------------------------------
-- People: imported once from HR (source 'hr') or added in Account Center (source 'account_center').
-- auth_user_id and hr_employee_id are plain ids on purpose: no foreign keys into auth or HR.
create table account.people (
  id             uuid primary key default gen_random_uuid(),
  auth_user_id   uuid unique,
  hr_employee_id uuid unique,
  source         text not null check (source in ('hr', 'account_center')),
  display_name   text not null check (length(btrim(display_name)) > 0),
  email          text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Extra emails, mainly the designally.co work email that Google sign-in uses during the move.
create table account.person_emails (
  email      text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  person_id  uuid not null references account.people (id) on delete cascade,
  kind       text not null default 'work' check (kind in ('work', 'other')),
  created_at timestamptz not null default now()
);

-- Apps, their actions, roles per app, and which actions each role includes.
create table account.apps (
  key          text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  name         text not null,
  is_prototype boolean not null default false
);

create table account.actions (
  app_key     text not null references account.apps (key) on delete cascade,
  key         text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  description text not null default '',
  unique (app_key, key),
  check (split_part(key, '.', 1) = app_key)
);

create table account.roles (
  app_key     text not null references account.apps (key) on delete cascade,
  key         text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name        text not null,
  description text not null default '',
  primary key (app_key, key)
);

create table account.role_actions (
  app_key    text not null,
  role_key   text not null,
  action_key text not null,
  primary key (app_key, role_key, action_key),
  foreign key (app_key, role_key) references account.roles (app_key, key) on delete cascade,
  foreign key (app_key, action_key) references account.actions (app_key, key) on delete cascade
);

-- Which person has which role. Nobody has access by default.
create table account.grants (
  person_id  uuid not null references account.people (id) on delete cascade,
  app_key    text not null,
  role_key   text not null,
  created_at timestamptz not null default now(),
  primary key (person_id, app_key, role_key),
  foreign key (app_key, role_key) references account.roles (app_key, key) on delete cascade
);

-- History of every change to people, emails, roles and grants.
create table account.log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text not null,
  event      text not null,
  table_name text not null,
  row_before jsonb,
  row_after  jsonb
);

alter table account.people        enable row level security;
alter table account.person_emails enable row level security;
alter table account.apps          enable row level security;
alter table account.actions       enable row level security;
alter table account.roles         enable row level security;
alter table account.role_actions  enable row level security;
alter table account.grants        enable row level security;
alter table account.log           enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Change log. The Account Center server sets the actor for its transaction with
--   select set_config('account.actor', '<person id>', true);
-- Without it the actor is the database user (for example 'postgres').
create function account.log_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into account.log (actor, event, table_name, row_before, row_after)
  values (
    coalesce(nullif(current_setting('account.actor', true), ''), session_user),
    lower(tg_op),
    tg_table_name,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger log_people        after insert or update or delete on account.people        for each row execute function account.log_change();
create trigger log_person_emails after insert or update or delete on account.person_emails for each row execute function account.log_change();
create trigger log_roles         after insert or update or delete on account.roles         for each row execute function account.log_change();
create trigger log_role_actions  after insert or update or delete on account.role_actions  for each row execute function account.log_change();
create trigger log_grants        after insert or update or delete on account.grants        for each row execute function account.log_change();

create function account.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger touch_people before update on account.people for each row execute function account.touch_updated_at();

-- A work email must not be another person's main email.
create function account.check_person_email() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from account.people p where p.email = new.email and p.id <> new.person_id) then
    raise exception 'email % is already the main email of another person', new.email;
  end if;
  return new;
end $$;

create trigger check_person_email before insert or update on account.person_emails
  for each row execute function account.check_person_email();

-- ---------------------------------------------------------------------------------------------
-- Checks. Fail closed: anything unknown is a no.

-- Is this login usable (exists, not deleted, not blocked)? Reads auth.users only.
create function account.login_ok(p_auth_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = p_auth_user_id
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;

-- For Account Center's People page: only 'ok', 'blocked' or 'missing', never other account details.
create function account.login_state(p_auth_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_auth_user_id is null then 'missing'
    when not exists (select 1 from auth.users u where u.id = p_auth_user_id and u.deleted_at is null) then 'missing'
    when account.login_ok(p_auth_user_id) then 'ok'
    else 'blocked'
  end;
$$;

create function account.person_can(p_person_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_active
       and p.auth_user_id is not null
       and account.login_ok(p.auth_user_id)
       and exists (
         select 1
         from account.grants g
         join account.role_actions ra on ra.app_key = g.app_key and ra.role_key = g.role_key
         where g.person_id = p.id and ra.action_key = p_action
       )
    from account.people p
    where p.id = p_person_id
  ), false);
$$;

-- The one person an email belongs to (main or extra email). Null when none, or when it is unclear.
create function account.person_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select case when count(distinct m.person_id) = 1 then min(m.person_id::text)::uuid end
  from (
    select p.id as person_id from account.people p where p.email = lower(btrim(p_email))
    union all
    select e.person_id from account.person_emails e where e.email = lower(btrim(p_email))
  ) m;
$$;

-- For an app signed in with an Account Center account.
create function account.can_user(p_auth_user_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select account.person_can((select p.id from account.people p where p.auth_user_id = p_auth_user_id), p_action);
$$;

-- For an app that still signs people in with Google during the move (matched by work email).
create function account.can_email(p_email text, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select account.person_can(account.person_by_email(p_email), p_action);
$$;

-- Who is this, and which roles do they have? Null when the person cannot use anything.
create function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', g.app_key, 'role', g.role_key) order by g.app_key, g.role_key)
      from account.grants g where g.person_id = p.id
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;

create function account.me_by_user(p_auth_user_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select account.me((select p.id from account.people p where p.auth_user_id = p_auth_user_id));
$$;

create function account.me_by_email(p_email text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select account.me(account.person_by_email(p_email));
$$;

-- ---------------------------------------------------------------------------------------------
-- Import people from HR, once. Reads public.hr_employees (listed fields only), writes account.people only.
-- After the import Account Center's list is the real list: later HR changes are not copied. People who
-- leave still lose access everywhere at once, because every check reads the account's blocked state live.

-- The only place that reads HR: the listed fields, test fixtures left out.
create function account.hr_people()
returns table (hr_id uuid, auth_user_id uuid, email text, display_name text, is_active boolean)
language sql stable security definer set search_path = '' as $$
  select e.id,
         e.auth_user_id,
         lower(btrim(e.email)),
         coalesce(nullif(btrim(e.nickname), ''), nullif(btrim(e.display_name), ''),
                  nullif(btrim(e.first_name), ''), lower(btrim(e.email))),
         e.is_active
  from public.hr_employees e
  where coalesce(e.is_fixture, false) = false
    and e.email is not null and position('@' in e.email) > 1;
$$;

-- Run once in the SQL Editor: select account.import_from_hr();  Refuses when anyone is already in the list.
create function account.import_from_hr() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_added int;
begin
  if exists (select 1 from account.people) then
    raise exception 'People are already in Account Center; the HR list is imported only once';
  end if;
  perform set_config('account.actor', 'import from HR', true);
  insert into account.people (auth_user_id, hr_employee_id, source, display_name, email, is_active)
  select s.auth_user_id, s.hr_id, 'hr', s.display_name, s.email, s.is_active
  from account.hr_people() s;
  get diagnostics v_added = row_count;
  return jsonb_build_object('added', v_added);
end $$;

-- ---------------------------------------------------------------------------------------------
-- The first Account Center admin. Works only while nobody has that role.
-- Run once in the SQL Editor after the import: select account.bootstrap_first_admin('<your HR email>');
create function account.bootstrap_first_admin(p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_person uuid;
begin
  if exists (select 1 from account.grants g where g.app_key = 'account_center' and g.role_key = 'admin') then
    raise exception 'Account Center already has an admin';
  end if;
  v_person := account.person_by_email(p_email);
  if v_person is null then
    raise exception 'no single person with that email; run account.import_from_hr() first';
  end if;
  perform set_config('account.actor', 'bootstrap', true);
  insert into account.grants (person_id, app_key, role_key) values (v_person, 'account_center', 'admin');
  return v_person;
end $$;

-- ---------------------------------------------------------------------------------------------
-- The apps Account Center knows. Each app adds its own actions and roles when it is built.
insert into account.apps (key, name, is_prototype) values
  ('account_center', 'Account Center', false),
  ('ma',             'MA Desk', false),
  ('studio',         'Article Studio', false),
  ('hub',            'Knowledge Hub', false),
  ('survey',         'Survey', false),
  ('brand',          'Brand guideline portal', false),
  ('hr',             'HR', true);

insert into account.actions (app_key, key, description) values
  ('account_center', 'account_center.view',   'See people, roles and the change log'),
  ('account_center', 'account_center.manage', 'Create accounts, add work emails, give and remove roles');

insert into account.roles (app_key, key, name, description) values
  ('account_center', 'viewer', 'Viewer', 'Can look, cannot change anything'),
  ('account_center', 'admin',  'Admin',  'Manages accounts and access for every app');

insert into account.role_actions (app_key, role_key, action_key) values
  ('account_center', 'viewer', 'account_center.view'),
  ('account_center', 'admin',  'account_center.view'),
  ('account_center', 'admin',  'account_center.manage');

-- ---------------------------------------------------------------------------------------------
-- Who may do what with schema `account`.
revoke all on all tables in schema account from public;
revoke execute on all functions in schema account from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'account_app') then
    create role account_app nologin;
  end if;
end $$;


-- Row level security is on for every table (above). The functions run as their owner and are not
-- limited by it; Account Center's server gets these policies. Nobody else gets any.
create policy account_app_all on account.people        for all to account_app using (true) with check (true);
create policy account_app_all on account.person_emails for all to account_app using (true) with check (true);
create policy account_app_all on account.apps          for all to account_app using (true) with check (true);
create policy account_app_all on account.actions       for all to account_app using (true) with check (true);
create policy account_app_all on account.roles         for all to account_app using (true) with check (true);
create policy account_app_all on account.role_actions  for all to account_app using (true) with check (true);
create policy account_app_all on account.grants        for all to account_app using (true) with check (true);
create policy account_app_read on account.log          for select to account_app using (true);

-- Account Center's server: reads and writes its own tables (the log only through the triggers).
grant usage on schema account to account_app;
grant select, insert, update, delete on account.people, account.person_emails, account.apps,
  account.actions, account.roles, account.role_actions, account.grants to account_app;
grant select on account.log to account_app;
grant execute on function account.can_user(uuid, text), account.can_email(text, text),
  account.me_by_user(uuid), account.me_by_email(text), account.login_state(uuid) to account_app;
-- account.import_from_hr() and account.bootstrap_first_admin() are for a person in the SQL Editor only.

-- Other apps' servers: the checks only, never the tables. Granted to the app users that exist.
do $$
declare r text;
begin
  foreach r in array array['hub_app', 'studio_app', 'survey_app', 'ma_app'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant usage on schema account to %I', r);
      execute format('grant execute on function account.can_user(uuid, text), account.can_email(text, text), account.me_by_user(uuid), account.me_by_email(text) to %I', r);
    end if;
  end loop;
end $$;
