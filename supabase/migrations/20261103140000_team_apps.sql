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
