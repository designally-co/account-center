---
title: No ready roles on any screen; every action is a plain on/off switch
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"remove ready role across the site just keep manualy singe access control and make the toggle simple just on and off toggle\")"
  - "Buk, 2026-11-03 (\"add app can be toggle for each app instead of add remove buttons\")"
  - src/components/switch.tsx
  - src/app/(main)/people/[id]/access-form.tsx
  - src/app/(main)/teams/team-apps.tsx
  - src/lib/teams.ts
---

## Context

Until now a person's app page and a team's popup started from a ready role (for example the Brand Guideline Portal's Viewer, Editor, Owner), chosen in a menu, with single actions allowed or blocked on top by a two-button switch.

## Decision

- **No screen shows or chooses a ready role.** A person's app page and a team's open app list every action with one plain on/off switch (`Switch`, a button with `role="switch"`). Summaries say "N of M on" (and "from <team>" when a person gets exactly what their team gives).
- **Nothing stored changes.** Roles stay in the database underneath, as the starting point of what someone had before; a switch that differs from it is saved as a single change (`account.person_actions`, `account.team_actions`), a switch that matches it removes the change. So nobody's access changed with this release, and apps such as the portal, which ask `account.can_user` about actions, are not touched.
- **Account Center keeps its two levels**, because "admin" means every action in every app: its two switches are View and Manage; Manage needs View (turning one changes the other), and they pick the level (viewer or admin) underneath.
- **Account Center's two actions were reworded** without "roles" (migration `20261103140000`).
- A person's page keeps Save and Cancel (several switches, one save, checked against the page's version); a team's switches save at once.

## Why

Buk asked for single access control only, with a simple on/off switch (sources). Keeping roles underneath instead of converting them is AI's choice (2026-11-03): it changes nothing in Friday's data, keeps the portal's checks as they are, and can still be cleaned up later.
