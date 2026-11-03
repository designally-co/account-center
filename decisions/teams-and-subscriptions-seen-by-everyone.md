---
title: Every company person sees Teams and Subscriptions; only an admin sees their settings; a team is never turned off
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"team must not be turned off and only admin can see the settings for team and subscriptions, members can see the overall view\")"
  - src/app/(main)/teams/page.tsx
  - src/app/(main)/teams/team-detail.tsx
  - src/app/(main)/subscriptions/page.tsx
  - src/app/(main)/subscriptions/[id]/page.tsx
  - src/components/nav.tsx
---

## Context

Teams and Subscriptions were admin pages: only someone who may view Account Center (the roles Viewer and Admin) could open them, and an admin could turn a team off. On 2026-11-03 Friday had 7 teams, none turned off, 1 admin and no viewer (read-only counts).

## Decision

- **A team is never turned off.** The Turn off and Turn on buttons, their action and `setTeamActive` are gone. The column `account.teams.is_active` and the database's rule that a team that is off gives nothing stay, as a safety net; the tests switch it directly in the database.
- **Teams and Subscriptions are in the menu for every company person.** People stays for those who may view Account Center.
- **Teams, for everyone:** each team, its description, members and leads, as cards that open the team's popup. **For an admin only** (may manage Account Center): the default access (on the card and in the popup), the member picker, the name form and New team. A member's page gets none of those settings. Links to people's pages show only for someone who may view Account Center. No email reaches the page for anyone, because nothing on it shows one.
- **Subscriptions, for everyone:** the tools that are on, their shared login email, plan and renewal date, and the people still here who use each. **For an admin only:** a tool's own page (its settings: details, who may use it, turn off; now `account_center.manage`, was `view`), tools that are turned off, the people who left and the warning to change the password, and Add subscription.
- "Admin" means the Account Center role Admin (`account_center.manage`). A Viewer sees what a member sees here, plus links to people's pages (AI's reading of "only admin", 2026-11-03; there is no viewer today).

## Why

Buk asked for it on 2026-11-03 (sources). No further reason was given.
