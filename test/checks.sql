-- Behaviour checks. Each block stops the run with a clear message when something is wrong.
\set ON_ERROR_STOP on
create function pg_temp.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAILED: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

-- People imported once from HR
select pg_temp.ok((select count(*) from account.people) = 3, 'three people imported (the HR test fixture is left out)');
select pg_temp.ok((select email from account.people where hr_employee_id = '10000000-0000-0000-0000-00000000000a') = 'ann@example.com', 'emails are stored in lower case');
select pg_temp.ok((select display_name from account.people where hr_employee_id = '10000000-0000-0000-0000-00000000000b') = 'Ben Example', 'name falls back to the display name');
select pg_temp.ok(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns where table_schema = 'account' and table_name = 'people')
  = array['auth_user_id','created_at','display_name','email','hr_employee_id','id','is_active','source','updated_at'],
  'no HR details (phone, birthday, role) in account.people');
do $$ begin
  perform account.import_from_hr();
  raise exception 'FAILED: a second import ran';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: the HR list is imported only once';
end $$;
select pg_temp.ok((select count(*) from account.log where actor = 'import from HR') = 3, 'the import is in the change log');

-- Nobody has access by default
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'account_center.view') = false, 'no role, no access');

-- Roles for a test app
insert into account.actions (app_key, key, description) values
  ('studio', 'studio.article.publish', 'Publish an article'),
  ('studio', 'studio.draft.edit', 'Edit a draft');
insert into account.roles (app_key, key, name) values ('studio', 'publisher', 'Publisher');
insert into account.role_actions values ('studio', 'publisher', 'studio.article.publish'), ('studio', 'publisher', 'studio.draft.edit');

begin;
select set_config('account.actor', 'test-admin', true);
insert into account.grants (person_id, app_key, role_key)
select id, 'studio', 'publisher' from account.people where hr_employee_id in
  ('10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000c');
commit;

select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish'), 'a role gives its action');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.settings') = false, 'an action the role does not include is a no');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'hub.article.publish') = false, 'a role in one app gives nothing in another');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000b', 'studio.article.publish') = false, 'a blocked login is a no, even with the role');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000c', 'studio.article.publish') = false, 'a person who was inactive in HR at the import is a no, even with the role');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-0000000000ff', 'studio.article.publish') = false, 'an unknown account is a no');
select pg_temp.ok((select count(*) from account.log where table_name = 'grants' and actor = 'test-admin') = 3, 'every grant is in the change log with who did it');

-- Google sign-in during the move: matched by work email
insert into account.person_emails (email, person_id) select 'ann@work.example', id from account.people where email = 'ann@example.com';
select pg_temp.ok(account.can_email('  ANN@work.example ', 'studio.article.publish'), 'a work email finds the person (any case, spaces trimmed)');
select pg_temp.ok(account.can_email('ann@example.com', 'studio.article.publish'), 'the HR email works too');
select pg_temp.ok(account.can_email('nobody@work.example', 'studio.article.publish') = false, 'an unknown email is a no');
do $$ begin
  insert into account.person_emails (email, person_id) select 'ann@work.example', id from account.people where email = 'ben@example.com';
  raise exception 'FAILED: one work email for two people';
exception when unique_violation then raise notice 'ok: one work email cannot belong to two people';
end $$;
do $$ begin
  insert into account.person_emails (email, person_id) select 'ben@example.com', id from account.people where email = 'ann@example.com';
  raise exception 'FAILED: another person''s main email added as a work email';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: another person''s main email cannot be added as a work email';
end $$;

-- Login state for the People page
select pg_temp.ok(account.login_state('00000000-0000-0000-0000-00000000000a') = 'ok', 'login state: ok');
select pg_temp.ok(account.login_state('00000000-0000-0000-0000-00000000000b') = 'blocked', 'login state: blocked');
select pg_temp.ok(account.login_state(null) = 'missing' and account.login_state('00000000-0000-0000-0000-0000000000ff') = 'missing', 'login state: missing');

-- me: name and roles, nothing for a blocked login
select pg_temp.ok(account.me_by_user('00000000-0000-0000-0000-00000000000a') -> 'roles' = '[{"app": "studio", "role": "publisher"}]'::jsonb, 'me shows the roles');
select pg_temp.ok(account.me_by_user('00000000-0000-0000-0000-00000000000b') is null, 'me is empty for a blocked login');

-- After the import, HR changes are not copied, but a blocked login stops access at once
update public.hr_employees set nickname = 'Changed in HR' where id = '10000000-0000-0000-0000-00000000000a';
select pg_temp.ok((select display_name from account.people where auth_user_id = '00000000-0000-0000-0000-00000000000a') = 'Ann', 'later HR changes are not copied: Account Center''s list is the real list');
update auth.users set banned_until = now() + interval '100 years' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish') = false, 'when HR blocks a login (offboarding), access stops at once');
update auth.users set banned_until = null where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish'), 'and comes back if the login is unblocked');

-- A person added in Account Center
insert into account.people (auth_user_id, source, display_name, email)
values ('00000000-0000-0000-0000-00000000000d', 'account_center', 'Dee', 'dee@example.com');
select pg_temp.ok(account.login_state('00000000-0000-0000-0000-00000000000d') = 'ok', 'a person added in Account Center uses their account');

-- First admin, once only
select pg_temp.ok(account.bootstrap_first_admin('ann@example.com') is not null, 'the first admin can be set');
do $$ begin
  perform account.bootstrap_first_admin('ben@example.com');
  raise exception 'FAILED: a second first admin';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: the first admin can be set only once';
end $$;
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'account_center.manage'), 'the admin can manage Account Center');

-- Other apps' users: the checks only
set role hub_app;
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish'), 'an app user can call the check');
do $$ begin
  perform 1 from account.people;
  raise exception 'FAILED: an app user read account.people';
exception when insufficient_privilege then raise notice 'ok: an app user cannot read Account Center''s tables';
end $$;
do $$ begin
  perform account.import_from_hr();
  raise exception 'FAILED: an app user ran the import';
exception when insufficient_privilege then raise notice 'ok: an app user cannot run the import from HR';
end $$;
reset role;

-- Account Center's own user: its tables yes, HR no, the log read-only
set role account_app;
select pg_temp.ok((select count(*) from account.people) = 4, 'Account Center''s user reads its own tables');
do $$ begin
  perform account.import_from_hr();
  raise exception 'FAILED: Account Center''s user ran the import';
exception when insufficient_privilege then raise notice 'ok: Account Center''s user cannot run the import (a person does it once)';
end $$;
do $$ begin
  perform 1 from public.hr_employees;
  raise exception 'FAILED: Account Center''s user read HR directly';
exception when insufficient_privilege then raise notice 'ok: Account Center''s user cannot read HR''s table';
end $$;
begin;
select set_config('account.actor', 'admin-person-id', true);
insert into account.person_emails (email, person_id) select 'dee@work.example', id from account.people where email = 'dee@example.com';
insert into account.grants (person_id, app_key, role_key) select id, 'studio', 'publisher' from account.people where email = 'dee@example.com';
delete from account.grants where person_id = (select id from account.people where email = 'dee@example.com');
commit;
select pg_temp.ok((select count(*) from account.log where actor = 'admin-person-id') = 3, 'changes made by Account Center''s server are logged with the admin who made them');
do $$ begin
  insert into account.log (actor, event, table_name) values ('x', 'x', 'x');
  raise exception 'FAILED: Account Center''s user wrote the log by hand';
exception when insufficient_privilege then raise notice 'ok: the change log cannot be written by hand';
end $$;
reset role;

select 'ALL CHECKS PASSED' as result;
