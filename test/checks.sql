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
  = array['auth_user_id','created_at','display_name','email','hr_employee_id','id','is_active','kind','source','updated_at'],
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

-- The way back when nobody can manage Account Center any more (each block is undone at its end)
begin;
update auth.users set banned_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-00000000000a';
select account.bootstrap_first_admin('dee@example.com');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000d', 'account_center.manage'),
                  'when every admin''s login is blocked, a new first admin can be set');
rollback;
begin;
insert into account.person_actions (person_id, action_key, allowed)
select id, 'account_center.manage', false from account.people where email = 'ann@example.com';
select account.bootstrap_first_admin('ann@example.com');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'account_center.manage'),
                  'when a single change took the last admin''s right away, the way back clears it');
rollback;
begin;
update auth.users set banned_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform account.bootstrap_first_admin('cat@example.com');
  raise exception 'FAILED: a removed person became the first admin';
exception when raise_exception then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok: a removed person cannot become the first admin';
end $$;
rollback;

-- Kinds of people
select pg_temp.ok((select count(*) from account.people where kind = 'employee') = (select count(*) from account.people), 'everyone starts as an employee');
insert into account.actions (app_key, key, description) values ('hr', 'hr.leave.view', 'See leave');
insert into account.roles (app_key, key, name) values ('hr', 'staff', 'Staff');
insert into account.role_actions values ('hr', 'staff', 'hr.leave.view');
update account.people set kind = 'outsource' where email = 'dee@example.com';
do $$ begin
  insert into account.grants (person_id, app_key, role_key) select id, 'hr', 'staff' from account.people where email = 'dee@example.com';
  raise exception 'FAILED: an outsource account got an HR role';
exception when sqlstate 'AC001' then raise notice 'ok: an outsource account cannot get an HR role';
end $$;
do $$ begin
  insert into account.person_actions (person_id, action_key, allowed) select id, 'hr.leave.view', true from account.people where email = 'dee@example.com';
  raise exception 'FAILED: an outsource account got a single HR action';
exception when sqlstate 'AC001' then raise notice 'ok: an outsource account cannot get a single HR action';
end $$;
insert into account.grants (person_id, app_key, role_key) select id, 'studio', 'publisher' from account.people where email = 'dee@example.com';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000d', 'studio.article.publish'), 'an outsource account can use Article Studio');
insert into account.grants (person_id, app_key, role_key) select id, 'hr', 'staff' from account.people where email = 'ann@example.com';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'hr.leave.view'), 'an employee can get HR');
do $$ begin
  update account.people set kind = 'outsource' where email = 'ann@example.com';
  raise exception 'FAILED: kind changed to outsource while the person had HR access';
exception when sqlstate 'AC002' then raise notice 'ok: the kind cannot change to outsource while the person has HR access';
end $$;
insert into account.kind_blocked_apps (kind, app_key) values ('employee', 'hr');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'hr.leave.view') = false, 'a kind rule added later stops access at once');
select pg_temp.ok(not (account.me((select id from account.people where email = 'ann@example.com'))->'roles' @> '[{"app": "hr"}]'),
                  '"who is this" does not list a role in an app the person''s kind is kept out of');
delete from account.kind_blocked_apps where kind = 'employee' and app_key = 'hr';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'hr.leave.view'), 'and access comes back when the rule goes');
delete from account.grants where app_key = 'hr';
do $$ begin
  delete from account.apps where key = 'hr';
  raise exception 'FAILED: deleting the HR app quietly dropped the rule that keeps outsource accounts out';
exception when foreign_key_violation then raise notice 'ok: the HR app cannot be deleted while a kind is kept out of it';
end $$;

-- Single changes to a ready role, for one person
insert into account.person_actions (person_id, action_key, allowed) select id, 'studio.article.publish', false from account.people where email = 'ann@example.com';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish') = false, 'an action taken away for one person is a no, although the role gives it');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.draft.edit'), 'the rest of the role still works');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000d', 'studio.article.publish'), 'taking an action away from one person does not touch the others with the role');
insert into account.actions (app_key, key, description) values ('hub', 'hub.article.edit', 'Edit an article');
insert into account.person_actions (person_id, action_key, allowed) select id, 'hub.article.edit', true from account.people where email = 'dee@example.com';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000d', 'hub.article.edit'), 'an action added for one person is a yes without a role');
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'hub.article.edit') = false, 'an action added for one person gives nothing to the others');
update auth.users set banned_until = now() + interval '1 day' where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000d', 'hub.article.edit') = false, 'an added action still needs a working login');
update auth.users set banned_until = null where id = '00000000-0000-0000-0000-00000000000d';
select pg_temp.ok((select count(*) from account.log where table_name = 'person_actions') = 2, 'single changes are in the change log');
delete from account.person_actions where action_key = 'studio.article.publish';
delete from account.person_actions where person_id = (select id from account.people where email = 'dee@example.com');
delete from account.grants where person_id = (select id from account.people where email = 'dee@example.com');
update account.people set kind = 'employee' where email = 'dee@example.com';

-- Other apps' users: nothing until their app uses Account Center, then the checks only
set role hub_app;
do $$ begin
  perform account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish');
  raise exception 'FAILED: an app that does not use Account Center called the check';
exception when insufficient_privilege then raise notice 'ok: an app that does not use Account Center cannot call the checks';
end $$;
do $$ begin
  perform account.me_by_email('ann@example.com');
  raise exception 'FAILED: an app that does not use Account Center looked up a person by email';
exception when insufficient_privilege then raise notice 'ok: an app that does not use Account Center cannot look up staff by email';
end $$;
reset role;
-- The day an app starts using Account Center, its own migration grants it the checks:
grant usage on schema account to hub_app;
grant execute on function account.can_user(uuid, text), account.can_email(text, text) to hub_app;
set role hub_app;
select pg_temp.ok(account.can_user('00000000-0000-0000-0000-00000000000a', 'studio.article.publish'), 'an app user can call the check once granted');
do $$ begin
  perform 1 from account.person_actions;
  raise exception 'FAILED: an app user read account.person_actions';
exception when insufficient_privilege then raise notice 'ok: an app user cannot read anyone''s single changes';
end $$;
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
select pg_temp.ok((select count(*) from account.kinds) = 2 and (select count(*) from account.kind_blocked_apps) = 1, 'Account Center''s user reads the kinds and their rules');
do $$ begin
  delete from account.kind_blocked_apps where kind = 'outsource' and app_key = 'hr';
  raise exception 'FAILED: Account Center''s user removed the rule that keeps outsource accounts out of HR';
exception when insufficient_privilege then raise notice 'ok: Account Center''s user cannot remove a kind''s blocked apps';
end $$;
do $$ begin
  insert into account.kinds (key, name) values ('visitor', 'Visitor');
  raise exception 'FAILED: Account Center''s user added a kind';
exception when insufficient_privilege then raise notice 'ok: Account Center''s user cannot change the kinds (a migration does)';
end $$;
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

-- No function in schema account is executable by everyone (every migration must revoke it from public)
select pg_temp.ok(
  not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
              where p.pronamespace = 'account'::regnamespace and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
  'no function in schema account is executable by everyone');
do $$ begin
  if not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where p.oid = 'account.can_user(uuid, text)'::regprocedure and a.privilege_type = 'EXECUTE') then
    raise exception 'FAILED: the check above looks at nothing';
  end if;
  create function account.zz_forgotten() returns int language sql as 'select 1';
  if not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                 where p.oid = 'account.zz_forgotten()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception 'FAILED: the check would not catch a function someone forgot to revoke';
  end if;
  drop function account.zz_forgotten();
  raise notice 'ok: the check catches a function someone forgot to revoke';
end $$;

-- The foreign keys have indexes
select pg_temp.ok((select count(*) from pg_indexes where schemaname = 'account'
                   and indexname in ('grants_app_role_idx', 'person_emails_person_idx', 'role_actions_app_action_idx')) = 3,
                  'the three foreign key indexes exist');

-- Changes to the app list and actions are logged
insert into account.apps (key, name) values ('logtest', 'Log test');
insert into account.actions (app_key, key) values ('logtest', 'logtest.view');
delete from account.apps where key = 'logtest';
select pg_temp.ok((select count(*) from account.log where table_name = 'apps' and (row_after->>'key' = 'logtest' or row_before->>'key' = 'logtest')) = 2,
                  'adding and removing an app is logged');
select pg_temp.ok((select count(*) from account.log where table_name = 'actions' and (row_after->>'key' = 'logtest.view' or row_before->>'key' = 'logtest.view')) = 2,
                  'adding an action, and its removal with its app, is logged');

select 'ALL CHECKS PASSED' as result;
