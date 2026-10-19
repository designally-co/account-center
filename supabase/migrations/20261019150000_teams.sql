-- Account Center: teams (Buk, 2026-10-19: "use HR's teams too and come up with a solid structure"; "if someone
-- joins and the admin sets the team, give them the default access of the team they are in, and also let the
-- admin add or reduce more access"; teams belong to Account Center, HR asks it).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- 1. Teams, copied once from HR at the import (account.import_from_hr), then managed here.
-- 2. Members: a person is in one team at most (Buk, 2026-10-19: "one person should be in only one team"). Any
--    member can be a lead of their team, and a team can have more than one lead.
-- 3. Each team can give a default role per app. A member gets it, unless an admin set something else for that
--    person in that app: their own role (account.grants) or "no access" (account.team_opt_outs). Single
--    changes for the person (account.person_actions) still add or take away actions on top, and a kind that
--    is kept out of an app (outsource and HR) still never gets it.
-- 4. An Account Center admin has every action in every app, whatever their team (Buk, 2026-10-19: "the admin
--    has all access no matter which team he is in"). Admin is given person by person only: a team can never
--    give Account Center access. Single changes and the kind still apply (an outsource admin never gets HR).
-- 5. account.is_lead_of: "is this person a lead of that person's team?", for apps such as HR (leave
--    approvals). Granted to an app's user only on the day that app starts using Account Center.

create table account.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(btrim(name)) between 1 and 60),
  description text not null default '' check (length(description) <= 160),
  is_active   boolean not null default true,
  hr_team_id  uuid unique,                -- the HR team it was copied from (a plain id, no link into HR)
  created_at  timestamptz not null default now()
);

create table account.team_members (
  person_id  uuid primary key references account.people (id) on delete cascade,   -- one team per person
  team_id    uuid not null references account.teams (id) on delete cascade,
  is_lead    boolean not null default false,
  created_at timestamptz not null default now()
);
create index team_members_team_idx on account.team_members (team_id);

-- One default role per app per team.
create table account.team_roles (
  team_id  uuid not null references account.teams (id) on delete cascade,
  app_key  text not null,
  role_key text not null,
  primary key (team_id, app_key),
  foreign key (app_key, role_key) references account.roles (app_key, key) on delete cascade,
  check (app_key <> 'account_center')   -- Account Center access, admin above all, is given person by person
);
create index team_roles_role_idx on account.team_roles (app_key, role_key);

-- "No access in this app, whatever the person's teams give": set by an admin on the person's page.
create table account.team_opt_outs (
  person_id  uuid not null references account.people (id) on delete cascade,
  app_key    text not null references account.apps (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (person_id, app_key)
);
create index team_opt_outs_app_idx on account.team_opt_outs (app_key);

alter table account.teams         enable row level security;
alter table account.team_members  enable row level security;
alter table account.team_roles    enable row level security;
alter table account.team_opt_outs enable row level security;

create trigger log_teams         after insert or update or delete on account.teams         for each row execute function account.log_change();
create trigger log_team_members  after insert or update or delete on account.team_members  for each row execute function account.log_change();
create trigger log_team_roles    after insert or update or delete on account.team_roles    for each row execute function account.log_change();
create trigger log_team_opt_outs after insert or update or delete on account.team_opt_outs for each row execute function account.log_change();

-- ---------------------------------------------------------------------------------------------
-- What a person's roles give for one action, before single changes, the kind and the login are checked:
-- everything for an Account Center admin; else their own role in that app; or, when they have none there and
-- no "no access" there, their team's default role (active teams only).
create function account.base_allows(p_person_id uuid, p_action text) returns boolean
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
                        join account.team_roles tr on tr.team_id = m.team_id and tr.app_key = a.app_key
                        join account.role_actions ra on ra.app_key = tr.app_key and ra.role_key = tr.role_key
                        where m.person_id = p_person_id and ra.action_key = p_action))));
$$;

-- The check every app asks, now with teams. Same name, arguments and rights as before.
create or replace function account.person_can(p_person_id uuid, p_action text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p.is_active
       and p.auth_user_id is not null
       and account.login_ok(p.auth_user_id)
       and not exists (
         select 1 from account.actions a
         where a.key = p_action and account.kind_blocks_app(p.kind, a.app_key))
       and not exists (
         select 1 from account.person_actions x
         where x.person_id = p.id and x.action_key = p_action and not x.allowed)
       and (account.base_allows(p.id, p_action)
            or exists (select 1 from account.person_actions x
                       where x.person_id = p.id and x.action_key = p_action and x.allowed))
    from account.people p
    where p.id = p_person_id
  ), false);
$$;

-- "Who is this?" lists the roles the person has through their teams too. Same name, arguments and rights.
create or replace function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'avatar', p.avatar,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', r.app_key, 'role', r.role_key) order by r.app_key, r.role_key)
      from (
        select g.app_key, g.role_key from account.grants g where g.person_id = p.id
        union
        select tr.app_key, tr.role_key
        from account.team_members m
        join account.teams t on t.id = m.team_id and t.is_active
        join account.team_roles tr on tr.team_id = m.team_id
        where m.person_id = p.id
          and not exists (select 1 from account.grants g where g.person_id = p.id and g.app_key = tr.app_key)
          and not exists (select 1 from account.team_opt_outs o where o.person_id = p.id and o.app_key = tr.app_key)
      ) r
      where not account.kind_blocks_app(p.kind, r.app_key)
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;

-- For apps such as HR: is the first account a lead of the team the second account's person is in? Both must
-- be active, the lead's login must work, and nobody leads themselves.
create function account.is_lead_of(p_lead_auth_user_id uuid, p_person_auth_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from account.people l
    join account.team_members ml on ml.person_id = l.id and ml.is_lead
    join account.teams t on t.id = ml.team_id and t.is_active
    join account.team_members mp on mp.team_id = ml.team_id
    join account.people p on p.id = mp.person_id
    where l.auth_user_id = p_lead_auth_user_id
      and p.auth_user_id = p_person_auth_user_id
      and l.id <> p.id
      and l.is_active and p.is_active
      and account.login_ok(l.auth_user_id));
$$;

-- ---------------------------------------------------------------------------------------------
-- The one-time import also copies HR's teams, members and leads (read only from HR, once). HR lets a person
-- be in several teams; here they keep one: HR's primary team, else the first by name. An HR lead who ends up
-- in another team is not made a lead; the answer counts them, so an admin can set leads by hand.
-- Same name, arguments and rights as before; still refuses when anyone is already in the list.
create or replace function account.import_from_hr() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_added int; v_teams int; v_members int; v_leads int; v_leads_missed int;
begin
  if exists (select 1 from account.people) then
    raise exception 'People are already in Account Center; the HR list is imported only once';
  end if;
  perform set_config('account.actor', 'import from HR', true);
  insert into account.people (auth_user_id, hr_employee_id, source, display_name, email, is_active)
  select s.auth_user_id, s.hr_id, 'hr', s.display_name, s.email, s.is_active
  from account.hr_people() s;
  get diagnostics v_added = row_count;

  insert into account.teams (name, is_active, hr_team_id)
  select left(coalesce(nullif(btrim(t.display_name), ''), btrim(t.name)), 60), coalesce(t.is_active, true), t.id
  from public.hr_teams t
  where coalesce(nullif(btrim(t.display_name), ''), nullif(btrim(t.name), '')) is not null;
  get diagnostics v_teams = row_count;

  insert into account.team_members (person_id, team_id)
  select distinct on (p.id) p.id, at.id
  from public.hr_employee_teams et
  join account.teams at on at.hr_team_id = et.team_id
  join account.people p on p.hr_employee_id = et.employee_id
  order by p.id, (et.is_primary is true) desc, at.name;
  get diagnostics v_members = row_count;

  -- Leads: HR has one per team. A lead who is a member of that team leads it; a lead with no team here joins
  -- the (first) team they lead.
  update account.team_members m set is_lead = true
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where m.person_id = p.id and m.team_id = at.id;
  get diagnostics v_leads = row_count;
  insert into account.team_members (person_id, team_id, is_lead)
  select distinct on (p.id) p.id, at.id, true
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where not exists (select 1 from account.team_members m where m.person_id = p.id)
  order by p.id, at.name;
  get diagnostics v_members = row_count;
  v_leads := v_leads + v_members;
  select count(*) into v_members from account.team_members;
  select count(*) into v_leads_missed
  from public.hr_teams t
  join account.teams at on at.hr_team_id = t.id
  join account.people p on p.hr_employee_id = t.lead_id
  where not exists (select 1 from account.team_members m where m.person_id = p.id and m.team_id = at.id and m.is_lead);

  return jsonb_build_object('added', v_added, 'teams', v_teams, 'team_members', v_members,
                            'leads', v_leads, 'leads_in_another_team', v_leads_missed);
end $$;

-- ---------------------------------------------------------------------------------------------
-- Rights. New functions are closed to everyone first (AGENTS.md). Account Center's server uses the tables
-- and base_allows (for the People page's counts); is_lead_of goes to an app's user on that app's day.
revoke execute on function account.base_allows(uuid, text) from public;
revoke execute on function account.is_lead_of(uuid, uuid) from public;
revoke all on account.teams, account.team_members, account.team_roles, account.team_opt_outs from public;

create policy account_app_all on account.teams         for all to account_app using (true) with check (true);
create policy account_app_all on account.team_members  for all to account_app using (true) with check (true);
create policy account_app_all on account.team_roles    for all to account_app using (true) with check (true);
create policy account_app_all on account.team_opt_outs for all to account_app using (true) with check (true);

grant select, insert, update, delete on account.teams, account.team_members, account.team_roles, account.team_opt_outs to account_app;
grant execute on function account.base_allows(uuid, text) to account_app;
