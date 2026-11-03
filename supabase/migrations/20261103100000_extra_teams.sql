-- Account Center: a primary team and extra teams (Buk, 2026-11-03: "each person can have primary team and extra
-- team like Buk (me) is from digital team but also the admin team"). Same safety rules as the earlier
-- migrations: everything stays inside schema `account`.
--
-- 1. A person can be in several teams. One of them is their primary team (shown under their name); the others
--    are extra teams. Everyone already in a team keeps it as their primary team.
-- 2. Every team a person is in gives its default access (Buk, 2026-11-03). When two of their teams give
--    different roles in the same app, the person gets the actions of both, so the bigger role wins.
--    account.base_allows, account.me and account.is_lead_of already read every team row a person has, so
--    they stay as they are. A lead is still per team.
-- 3. A person in any team has exactly one primary team: at most one by a unique index, at least one by a check
--    at the end of each transaction (so one change can move the primary from one team to another).
-- 4. The one-time import is unchanged: it puts each person in one team, which the default below makes primary.

alter table account.team_members add column is_primary boolean not null default true;
alter table account.team_members drop constraint team_members_pkey;
alter table account.team_members add primary key (person_id, team_id);
create unique index team_members_one_primary on account.team_members (person_id) where is_primary;

create function account.check_primary_team() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then
    if exists (select 1 from account.team_members m where m.person_id = old.person_id)
       and not exists (select 1 from account.team_members m where m.person_id = old.person_id and m.is_primary) then
      raise exception 'a person in a team must have a primary team' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if not exists (select 1 from account.team_members m where m.person_id = new.person_id and m.is_primary) then
      raise exception 'a person in a team must have a primary team' using errcode = 'check_violation';
    end if;
  end if;
  return null;
end $$;

create constraint trigger check_primary_team after insert or update or delete on account.team_members
  deferrable initially deferred for each row execute function account.check_primary_team();

-- New functions are closed to everyone (AGENTS.md); a trigger runs without that right.
revoke execute on function account.check_primary_team() from public;
