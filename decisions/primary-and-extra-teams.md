---
title: A person has a primary team and extra teams; every team gives its default access; cards show the primary team and Lead
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"each person can have primary team and extra team like Buk (me) is from digital team but also the admin team and P Nick is from digital team but also in admin and management and P Dia is from branding but also in managment\")"
  - "Buk, 2026-11-03 (answers to Claude's questions: every team gives its default access, and the bigger role wins; the Lead badge shows for the lead of the primary team; ticking someone in a team's popup adds it as an extra team)"
  - "Buk, 2026-11-03 (\"remove active badge as it will be noise and use lead badge and it must be on the top right of the card and do not show how many apps she or he can access, and under the name show their primary team not the gmail\")"
  - supabase/migrations/20261103100000_extra_teams.sql
  - src/lib/teams.ts
  - src/app/(main)/people/people-browser.tsx
---

## Context

Until 2026-11-03 a person was in one team at most (`account.team_members` had one row per person; `decisions/teams-one-per-person-with-default-access.md`). Some people work in more than one team. That day Friday had 7 teams (Accounting/AE, AE, Branding, CP Team, Designer, Digital, Management), none called Admin (read-only counts). People's cards showed an Active badge, the sign-in email, the team and an app count.

## Decision

- **A primary team and extra teams.** `account.team_members` has one row per person and team, with `is_primary`. A unique index allows one primary team per person, and a check at the end of each transaction makes sure that anyone in a team has one. Everyone already in a team kept it as their primary team.
- **Every team gives its default access.** When two of a person's teams give different roles in one app, the person gets the actions of both, so the bigger role wins. `account.base_allows`, `account.me` and `account.is_lead_of` already read every team row, so they did not change. The person's page names the biggest team role.
- **A lead is per team**, as before. Leads of extra teams can only be set in the database for now: the person's page sets the lead of the primary team only (AI's choice when building, 2026-11-03; not discussed with Buk).
- **Where it is set:** the person's page has a Primary team row (moving it leaves the old primary team; "No team" leaves every team) and an Extra teams row. In a team's popup, ticking someone already in another team adds this one as an extra team; someone in no team gets it as their primary team. Taking someone off their primary team makes their oldest other team the primary one.
- **People's cards:** the avatar, the name and the primary team under it, with "Lead" at the top right when the person leads their primary team. No email, no app count and no "Active" badge; Removed, Invited, No login and Login blocked still show. The list view keeps every column and adds "Also" with the extra teams. Search finds people by any of their teams.
- **Applying it:** the migration goes into Friday through `supabase/apply/2026-11-03-extra-teams.sql` with the usual guard, just before the release that uses it.

## Why

Buk asked for primary and extra teams, and chose the access, lead badge and popup rules (sources). He removed the Active badge because almost everyone is active, so it was noise (Buk, 2026-11-03).
