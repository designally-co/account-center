-- Gives the Brand Guideline Portal its login to Project Friday: it may only ask Account Center
-- "may this account do this action?" (account.can_user). Run by a person in the Supabase SQL Editor of
-- Project Friday, after migration 20261019160000_brand_portal.sql.
-- Replace CHANGE_ME with a long random password of letters and digits only (at least 32 characters; turn
-- symbols off in the password manager, because they break this file or the connection string), run, then
-- put the connection string straight into the portal's server settings (ACCOUNT_CENTER_DB_URL). Never paste
-- the password into a chat, a commit or a screenshot.
alter role portal_check with login password 'CHANGE_ME' connection limit 10;

-- Checks (all must be true):
select has_function_privilege('portal_check', 'account.can_user(uuid, text)', 'execute') as can_ask,
       not has_function_privilege('portal_check', 'account.me_by_email(text)', 'execute') as cannot_list_people,
       not has_table_privilege('portal_check', 'account.people', 'select') as cannot_read_people,
       not has_table_privilege('portal_check', 'public.hr_employees', 'select') as cannot_read_hr;

-- For a person to look through: the functions outside schema `account` that portal_check can still run,
-- through PostgreSQL's everyone-rights (PUBLIC). They are other apps' functions (HR's among them); most check
-- the signed-in user and refuse a database login. Nothing here is changed: that would change those apps.
select n.nspname as schema, p.proname as function, p.prosecdef as runs_as_owner
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname not in ('account', 'pg_catalog', 'information_schema', 'extensions', 'pgbouncer', 'graphql', 'graphql_public', 'realtime', 'storage', 'vault', 'net', 'cron', 'supabase_functions', 'auth')
  and n.nspname not like 'pg_%'
  and has_function_privilege('portal_check', p.oid, 'execute')
order by 1, 2;
