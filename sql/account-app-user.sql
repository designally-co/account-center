-- Gives Account Center's server its login. Run by a person in the Supabase SQL Editor of Project
-- Friday, after the migration, and only when Account Center is about to go live.
-- Replace CHANGE_ME with a long random password, run, then put the connection string straight into
-- the server's settings. Never paste the password into a chat, a commit or a screenshot.
alter role account_app with login password 'CHANGE_ME' connection limit 10;

-- Checks (both must be true):
select has_schema_privilege('account_app', 'account', 'usage') as can_use_account,
       not has_table_privilege('account_app', 'public.hr_employees', 'select') as cannot_read_hr;
