-- Account Center: shared subscriptions (migration 20261026100000), for the Supabase SQL Editor of Project
-- Friday. Run it once, as a whole.
--
-- Safe for HR and every other app: it only adds two tables inside schema `account`. A guard takes a
-- fingerprint of everything outside `account` (HR's tables and data, Auth's users, every other schema, table,
-- column, function, rule and right) before and after; if even one item is different, it stops with
-- "GUARD STOPPED" and nothing is kept. Running it twice stops at the first line and keeps nothing.
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

-- ===== 20261026100000_shared_subscriptions.sql (copied exactly from the file) =====
-- Account Center: shared subscriptions (Buk, 2026-10-26: "the people will share the company mail for
-- subscription access like claude, chat gpt, magnific and so on. they use their personal mail for HR";
-- "build the separate section now").
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- A shared subscription is a tool the company pays for and several people use with one shared login
-- (a company mailbox). Account Center keeps which tool, which shared email, and who may use it.
-- It never keeps a password or any other secret: those stay in the company's password manager. So there is
-- no free-text field at all, where a password could be pasted by mistake.
-- A shared email is not a person's work email (account.person_emails), and it is never used to find a person.

create table account.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 60),              -- the tool: Claude, ChatGPT, ...
  shared_email text not null check (shared_email = lower(btrim(shared_email))
                                    and shared_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
                                    and length(shared_email) <= 320),                    -- the login everyone shares
  plan         text not null default '' check (length(plan) <= 60),                      -- for example "Team, 5 seats"
  url          text check (url ~ '^https://[a-z0-9.-]+(/[^\s]*)?$' and length(url) <= 300),  -- where people sign in
  renews_on    date,                                                                      -- next payment, when known
  is_active    boolean not null default true,                                            -- off when the company stops paying
  created_at   timestamptz not null default now()
);

-- One subscription per tool name, whatever the capital letters.
create unique index subscriptions_name_idx on account.subscriptions (lower(name));

-- Who may use each shared subscription.
create table account.subscription_members (
  subscription_id uuid not null references account.subscriptions (id) on delete cascade,
  person_id       uuid not null references account.people (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (subscription_id, person_id)
);
create index subscription_members_person_idx on account.subscription_members (person_id);

alter table account.subscriptions        enable row level security;
alter table account.subscription_members enable row level security;

create trigger log_subscriptions        after insert or update or delete on account.subscriptions        for each row execute function account.log_change();
create trigger log_subscription_members after insert or update or delete on account.subscription_members for each row execute function account.log_change();

-- ---------------------------------------------------------------------------------------------
-- Rights: Account Center's server only. No app reads these tables, and no function is added.
revoke all on account.subscriptions, account.subscription_members from public;

create policy account_app_all on account.subscriptions        for all to account_app using (true) with check (true);
create policy account_app_all on account.subscription_members for all to account_app using (true) with check (true);

grant select, insert, update, delete on account.subscriptions, account.subscription_members to account_app;

insert into supabase_migrations.schema_migrations (version, name, statements) values ('20261026100000', 'shared_subscriptions', array['-- Applied in the SQL Editor with a guard that compared everything outside schema account before and after. Source: designally-co/account-center, supabase/migrations/20261026100000_shared_subscriptions.sql']);
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
       (select count(*) from pg_tables where schemaname = 'account') as account_tables;
commit;
