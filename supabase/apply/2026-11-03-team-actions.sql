-- Account Center: single changes on a team's default access (migration 20261103120000), for the Supabase SQL
-- Editor of Project Friday. Run it once, as a whole.
--
-- Safe for HR and every other app: it only adds the table account.team_actions and the check
-- account.team_allows inside schema `account`, and updates account.base_allows to read it. Nothing changes
-- for anyone until an admin switches a team's action. A guard takes a fingerprint of everything outside
-- `account` (HR's tables and data, Auth's users, every other schema, table, column, function, rule and right)
-- before and after; if even one item is different, it stops with "GUARD STOPPED" and nothing is kept. Running
-- it twice stops at the first change and keeps nothing.
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

-- ===== 20261103120000_team_actions.sql (copied exactly from the file) =====
-- Account Center: single changes on a team's default access (Buk, 2026-11-03: a team's popup shows, per app,
-- one allow/block switch per action; Buk chose "a ready role plus single changes", the same as a person's
-- access). Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- 1. A team still has one ready role per app (account.team_roles). On top of it an admin can allow or block
--    single actions for the whole team (account.team_actions). A team may also have single allowed actions in
--    an app where it has no role.
-- 2. What a team gives for one action: its single change for that action when it has one; else whether its role
--    in that app has it. A person gets an action from their teams when any of their teams gives it (the bigger
--    wins, as before), unless an admin set their own role or "No access" in that app.
-- 3. A team never gives Account Center access: the table refuses it and the check ignores it.

create table account.team_actions (
  team_id    uuid not null references account.teams (id) on delete cascade,
  app_key    text not null,
  action_key text not null,
  allowed    boolean not null,
  primary key (team_id, action_key),
  foreign key (app_key, action_key) references account.actions (app_key, key) on delete cascade,
  check (app_key <> 'account_center')
);
create index team_actions_action_idx on account.team_actions (app_key, action_key);

alter table account.team_actions enable row level security;
create trigger log_team_actions after insert or update or delete on account.team_actions for each row execute function account.log_change();

-- Does this team give this action? Its single change first, then its role in that app. Never Account Center.
create function account.team_allows(p_team_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select x.allowed from account.team_actions x where x.team_id = p_team_id and x.action_key = p_action),
    exists (select 1 from account.team_roles tr
            join account.role_actions ra on ra.app_key = tr.app_key and ra.role_key = tr.role_key
            where tr.team_id = p_team_id and ra.action_key = p_action))
  and split_part(p_action, '.', 1) <> 'account_center';
$$;

-- The same rule as before (20261019150000), with the team part asking account.team_allows. Same name,
-- arguments and rights.
create or replace function account.base_allows(p_person_id uuid, p_action text) returns boolean
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
                        where m.person_id = p_person_id and account.team_allows(m.team_id, p_action)))));
$$;

-- Rights. New functions are closed to everyone first (AGENTS.md); base_allows keeps its earlier rights.
revoke execute on function account.team_allows(uuid, text) from public;
-- Account Center's own server reads it for the access lists it shows; no app gets it.
grant execute on function account.team_allows(uuid, text) to account_app;
revoke all on account.team_actions from public;
create policy account_app_all on account.team_actions for all to account_app using (true) with check (true);
grant select, insert, update, delete on account.team_actions to account_app;
-- ===== end of the migration =====

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261103120000', 'team_actions', array['-- Applied in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261103120000_team_actions.sql']);
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
       (select count(*) from account.team_actions) as team_single_changes;
commit;
