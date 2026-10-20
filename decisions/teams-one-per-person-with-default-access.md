---
title: Teams live in Account Center; one team per person, each team gives a default role per app, admins have every action
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (\"study the current hr app people structure, it has the team like website team, the branding team and so on. I want to use that too and come up with a solid structure\")"
  - "Buk, 2026-10-19 (asked whether HR or Account Center should own teams; answered: Account Center owns people, logins, access and teams; HR asks it)"
  - "Buk, 2026-10-19 (\"if someone join and admin set the team, give them the default access according to the team he is in. and also let the admin add/reduce more access\"; \"one person should be in only one team\"; \"the admin have all access no matter in which team he is in\"; \"for eg, I am the admin but I am in the digital team\")"
  - "Buk, 2026-10-20 (\"why there is no team setting for each person in account setting\": the screens were built that day)"
  - supabase/migrations/20261019150000_teams.sql
  - src/lib/teams.ts
---

## Context

HR keeps teams (`public.hr_teams`, `public.hr_employee_teams`) with one lead each, and lets a person be in several teams. On 2026-10-19 Friday's HR had 6 teams; one active person was in two teams and one in none (read-only counts). Account Center gave access only person by person.

## Decision

- **Teams belong to Account Center.** They were copied once from HR with the import (teams, members, leads; HR is only read), then are managed here. Apps such as HR ask `account.is_lead_of` later, when P Aek agrees.
- **One team per person**; any member can be a lead, and a team can have more than one. HR's primary team wins at the import; an HR lead who ends up in another team is counted, so an admin can set it by hand.
- **A team gives a default role per app** (`account.team_roles`). A person's own role in an app, or "No access" chosen for them there (`account.team_opt_outs`), wins over it; single allowed or blocked actions still apply on top. A team never gives Account Center access, and a team that is turned off gives nothing.
- **An Account Center admin has every action in every app**, whatever their team; the person's kind still keeps them out of an app (an outsource admin never gets HR).
- **Screens** (2026-10-20): Teams in the menu, each team's page (default role per app, members, on or off, name), and a Team row on each person's page. People are added to or moved between teams on their own page (AI's choice when building, 2026-10-20: one place changes a person, next to their access list; not discussed with Buk yet).

## Why

Buk wanted HR's team structure in Account Center, new people to get their team's access at once, admins able to add or reduce access per person, one team per person, and admins with all access in whatever team they are (Buk, 2026-10-19).
