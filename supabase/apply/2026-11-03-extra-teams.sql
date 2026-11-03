-- Account Center: primary and extra teams (migration 20261103100000), for the Supabase SQL Editor of Project
-- Friday. Run it once, as a whole.
--
-- Safe for HR and every other app: it only changes the table account.team_members inside schema `account`
-- (a new column is_primary, a new key, one rule). Everyone already in a team keeps it as their primary team.
-- A guard takes a fingerprint of everything outside `account` (HR's tables and data, Auth's users, every other
-- schema, table, column, function, rule and right) before and after; if even one item is different, it stops
-- with "GUARD STOPPED" and nothing is kept. Running it twice stops at the first change and keeps nothing.
-- If Supabase warns "destructive operations" or offers to enable RLS on supabase_migrations.schema_migrations,
-- choose "Run without RLS": the file only adds one row there.

begin isolation level repeatable read;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
create temp table snap_before(line text) on commit drop;
create temp table snap_after(line text) on commit drop;
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

-- ===== 20261103100000_extra_teams.sql (copied exactly from the file) =====
-- Account Center: a primary team and extra teams (Buk, 2026-11-03: "each person can have primary team and extra
-- team like Buk (me) is from digital team but also the admin team"). Same safety rules as the earlier
-- migrations: everything stays inside schema `account`.
--
-- 1. A person can be in several teams. One of them is their primary team (shown under their name); the others
--    are extra teams. Everyone already in a team keeps it as their primary team.
-- 2. Every team a person is in gives its default access (Buk, 2026-11-03). When two of their teams give
--    different roles in the same app, the person gets the actions of both, so the bigger role wins.
--    account.base_allows, account.me and account.is_lead_of already read every team row a person has, so
--    they stay as they are. A lead is still per team.
-- 3. A person in any team has exactly one primary team: at most one by a unique index, at least one by a check
--    at the end of each transaction (so one change can move the primary from one team to another).
-- 4. The one-time import is unchanged: it puts each person in one team, which the default below makes primary.

alter table account.team_members add column is_primary boolean not null default true;
alter table account.team_members drop constraint team_members_pkey;
alter table account.team_members add primary key (person_id, team_id);
create unique index team_members_one_primary on account.team_members (person_id) where is_primary;

create function account.check_primary_team() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    if exists (select 1 from account.team_members m where m.person_id = old.person_id)
       and not exists (select 1 from account.team_members m where m.person_id = old.person_id and m.is_primary) then
      raise exception 'a person in a team must have a primary team' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if not exists (select 1 from account.team_members m where m.person_id = new.person_id and m.is_primary) then
      raise exception 'a person in a team must have a primary team' using errcode = 'check_violation';
    end if;
  end if;
  return null;
end $$;

create constraint trigger check_primary_team after insert or update or delete on account.team_members
  deferrable initially deferred for each row execute function account.check_primary_team();

-- New functions are closed to everyone (AGENTS.md); a trigger runs without that right.
revoke execute on function account.check_primary_team() from public;
-- ===== end of the migration =====

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261103100000', 'extra_teams', array['-- Applied in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261103100000_extra_teams.sql']);
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
end $guard$;
select (select count(*) from snap_before) as items_outside_account_compared,
       0 as changed_outside_account,
       (select count(*) from pg_tables where schemaname = 'account') as account_tables,
       (select count(*) from account.team_members where is_primary) as primary_teams,
       (select count(*) from account.team_members where not is_primary) as extra_teams;
commit;
