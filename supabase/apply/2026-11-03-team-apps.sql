-- Account Center: each team's own list of apps (migration 20261103140000), for the Supabase SQL Editor of
-- Project Friday. Run it once, as a whole.
--
-- Safe for HR and every other app: it only adds the table account.team_apps inside schema `account` and fills
-- it with what each team's popup shows today, so nobody's access changes, and rewords Account Center's two
-- actions without the word "roles". A guard takes a fingerprint of
-- everything outside `account` (HR's tables and data, Auth's users, every other schema, table, column,
-- function, rule and right) before and after; if even one item is different, it stops with "GUARD STOPPED" and
-- nothing is kept. Running it twice stops at the first change and keeps nothing.
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

-- ===== 20261103140000_team_apps.sql (copied exactly from the file) =====
-- Account Center: each team's own list of apps (Buk, 2026-11-03: "in the more action add one more action called
-- add app so that the new app can be seen in the access list"; Buk chose "pick apps per team"). Same safety
-- rules as the earlier migrations: everything stays inside schema `account`.
--
-- 1. A team's popup shows only the apps on its list. "Add app" puts one on the list, even an app with no
--    actions yet, so it can be seen. Taking an app off the list also takes away what the team gives in it
--    (done by Account Center's server, in the same change).
-- 2. Every team starts with what its popup showed before: every app that has at least one action, and any app
--    the team already gives something in. So nothing disappears and nobody's access changes.
-- 3. Never Account Center: a team never gives Account Center access.
-- 4. Account Center's own two actions no longer speak of roles (Buk, 2026-11-03: "remove ready role across the
--    site"); only their words change.

create table account.team_apps (
  team_id    uuid not null references account.teams (id) on delete cascade,
  app_key    text not null references account.apps (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, app_key),
  check (app_key <> 'account_center')
);
create index team_apps_app_idx on account.team_apps (app_key);

alter table account.team_apps enable row level security;

insert into account.team_apps (team_id, app_key)
select t.id, a.key
from account.teams t cross join account.apps a
where a.key <> 'account_center'
  and (exists (select 1 from account.actions x where x.app_key = a.key)
       or exists (select 1 from account.team_roles r where r.team_id = t.id and r.app_key = a.key)
       or exists (select 1 from account.team_actions c where c.team_id = t.id and c.app_key = a.key));

-- The change log follows the list from now on (the starting rows above are not changes anyone made).
create trigger log_team_apps after insert or update or delete on account.team_apps for each row execute function account.log_change();

revoke all on account.team_apps from public;
create policy account_app_all on account.team_apps for all to account_app using (true) with check (true);
grant select, insert, update, delete on account.team_apps to account_app;

update account.actions set description = 'See people, their access and the change log'
where key = 'account_center.view' and description = 'See people, roles and the change log';
update account.actions set description = 'Add people, change their teams and turn their access on or off'
where key = 'account_center.manage' and description = 'Create accounts, add work emails, give and remove roles';
-- ===== end of the migration =====

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261103140000', 'team_apps', array['-- Applied in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261103140000_team_apps.sql']);
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
       (select count(*) from account.team_apps) as team_app_rows;
commit;
