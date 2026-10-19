-- Made-up people. Ann: active. Ben: active but login blocked. Cat: left (inactive). Fix: an HR test fixture.
insert into auth.users (id, email, banned_until) values
  ('00000000-0000-0000-0000-00000000000a', 'ann@example.com', null),
  ('00000000-0000-0000-0000-00000000000b', 'ben@example.com', now() + interval '100 years'),
  ('00000000-0000-0000-0000-00000000000c', 'cat@example.com', null),
  ('00000000-0000-0000-0000-00000000000f', 'fix@example.com', null),
  ('00000000-0000-0000-0000-00000000000d', 'dee@example.com', null);

insert into public.hr_employees (id, auth_user_id, email, nickname, display_name, phone_number, birthday, role, is_active, is_fixture) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'Ann@Example.com', 'Ann', 'Ann Example', '000', '2000-01-01', 'admin', true, false),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'ben@example.com', null, 'Ben Example', '000', '2000-01-01', 'employee', true, false),
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'cat@example.com', 'Cat', null, '000', '2000-01-01', 'employee', false, false),
  ('10000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-00000000000f', 'fix@example.com', 'Fix', null, '000', '2000-01-01', 'employee', true, true);

-- Made-up teams. Ben is in two teams in HR (Digital is his primary one). Ann leads Branding and is also
-- named lead of Digital, where she is not a member.
insert into public.hr_teams (id, name, display_name, lead_id, is_active) values
  ('20000000-0000-0000-0000-000000000001', 'branding', 'Branding', '10000000-0000-0000-0000-00000000000a', true),
  ('20000000-0000-0000-0000-000000000002', 'digital',  'Digital',  '10000000-0000-0000-0000-00000000000a', true);
insert into public.hr_employee_teams (employee_id, team_id, is_primary) values
  ('10000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000001', false),
  ('10000000-0000-0000-0000-00000000000b', '20000000-0000-0000-0000-000000000002', true),
  ('10000000-0000-0000-0000-00000000000c', '20000000-0000-0000-0000-000000000001', true);
