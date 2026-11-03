---
title: Each team has its own list of apps, chosen with "Add app"
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"in the more action add one more action called add app so that the new app can be seen in the access list\")"
  - "Buk, 2026-11-03 (answer to Claude's question: \"Pick apps per team\")"
  - "Buk, 2026-11-03 (\"add app can be toggle for each app instead of add remove buttons\")"
  - supabase/migrations/20261103140000_team_apps.sql
  - src/app/(main)/teams/team-app-picker.tsx
---

## Context

A team's popup listed every app that had at least one action. Apps with no actions yet (in Friday: Knowledge Hub, MA Desk, Survey, HR) could not be seen there at all.

## Decision

- **Table `account.team_apps`** (team, app): the apps a team's popup shows. Never Account Center. Changes are logged.
- **"Add app"** in the team's "…" menu opens a window with every app and an on/off switch each. On puts the app on the list with nothing on; off takes it off, and what the team gave there goes too (its on/off actions and any older ready role), after a confirmation when the team gave something.
- **Starting list:** every team starts with what its popup showed before (every app with actions, and any app the team already gave something in), so nothing disappeared and nobody's access changed.
- Turning on an action for a team puts its app on the list if it was not there.

## Why

Buk asked for "Add app" so a new app can be seen in a team's access, and chose a list per team (sources). The starting list and removing what the team gave when an app leaves the list are AI's choices (2026-11-03), so nothing hidden keeps giving access.
