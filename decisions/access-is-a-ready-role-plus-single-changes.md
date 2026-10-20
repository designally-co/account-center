---
title: A person's access in each app is a ready role plus single changes, shown as one allowed/blocked row per action
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (on a person's access list, choose the apps, then what they can do inside each app: for example, generate but not publish in Article Studio)"
  - "Buk, 2026-10-19 (yes start stage 1, you build first version; the first version may use both ready roles and per-person choices)"
  - "Buk, 2026-10-19 (make the access of each function simple, like ClickUp's tool permissions; no extra explaining)"
  - "Buk, 2026-10-19 (an outsource account never gets the HR app)"
  - supabase/migrations/20261019110000_kinds_and_access_lists.sql
  - src/app/people/[id]/access-form.tsx
---

## Decision

- Per app, a person has one ready role. On top of it, an admin can allow or block single actions for that one person (`account.person_actions`). The access check (`account.person_can`) says yes when the role or an allowed single change gives the action, and no single change blocks it.
- On screen, each app is one card: the ready role in its header, and one row per action with an allowed/blocked switch. Changing a row makes the role "custom". One Save per app stores the role and only the rows that differ from it.
- Each person has a kind (`account.kinds`: employee, outsource). A kind can be kept out of an app (`account.kind_blocked_apps`: outsource never gets HR). The database refuses such access, and refuses a change of kind while such access exists. Kinds and blocks are read-only for Account Center's server and change only through a migration.
- A save made from a page that is out of date is refused: each app's form carries a version of what it showed.

## Why

Buk wants to choose, per person, which apps they use and what they may do in each, and wants that screen simple (Buk, 2026-10-19). Ready roles make it fast for many people; single changes keep exceptions possible without new roles. Whether to keep both is open (spec, section 8, question 8).

The version check and the read-only kind rules came from an independent review of the first draft (2026-10-19): an unchanged old page could take away an action someone else had just given, and Account Center's own database user could have deleted the rule that keeps outsource accounts out of HR.
