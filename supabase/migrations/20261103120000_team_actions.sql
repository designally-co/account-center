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
