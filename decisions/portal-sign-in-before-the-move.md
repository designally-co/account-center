---
title: The portal tries Account Center sign-in now, before it moves into Project Friday, through a Friday user that may only ask the check
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (\"first use brand guideline portal first to try the account sign in, as it is still in development\"; then, asked how: \"Try sign-in now\", the portal's data staying where it is, and \"Yes, use these 3\" for the roles Viewer, Editor and Owner)"
  - "Buk, 2026-10-19 (\"you can change the brandguideline app, article studio, hub, survey if necessary, as they are in my control\")"
  - supabase/migrations/20261019160000_brand_portal.sql
  - sql/portal-check-user.sql
  - "khunshinesithu/brand-guideline-portal, branch claude/cool-edison-kgf8fy, commit eeb8c4e (README.md, \"Account Center sign-in\"; src/lib/account-center.ts, src/lib/admin.ts)"
---

## Context

`portal-is-the-pilot-app.md` said the portal moves into Project Friday first and then gets the checks through its own user `portal_app`. Moving the portal's database is a large job, and Buk wanted to try the sign-in now while the portal is still in development.

## Decision

- **Sign-in first, the move later.** The portal's data stays in its own Supabase project for now. This replaces the order in `portal-is-the-pilot-app.md`; the move into Friday is still planned.
- **One Friday user for the portal, `portal_check`**, that in schema `account` may only call `account.can_user(account id, action)`: no table, no other Account Center function, not `can_email`. It reads no HR table. Like every Friday login it keeps PostgreSQL's everyone-rights (PUBLIC) on functions in other schemas; taking those away would change HR's functions, so it is not done, and `sql/portal-check-user.sql` lists them instead. Its login is made by a person (`sql/portal-check-user.sql`). When the portal moves into Friday, its own user takes over.
- **The portal's 12 actions and three roles**: Viewer (look only), Editor (everything except deleting a brand, today's portal editor) and Owner (everything, today's portal owner).
- **In the portal:** "Sign in with Account Center" next to the old sign-in. The portal's server checks the password with Friday's Auth and ends that Friday session at once, asks `can_user(..., 'brand.view')`, then keeps its own signed cookie. Every admin page and action asks Account Center again for its own action, so a person removed or blocked in Account Center is out at once. Portal accounts keep exactly what their role allows today. The button shows only when the portal's three `ACCOUNT_CENTER_*` settings are set.

## Why

Buk asked to try the sign-in in the portal first because it is still in development, and chose to try it now rather than move the portal first (Buk, 2026-10-19). A user that can only ask the check keeps HR and every Account Center table out of the portal's reach, the same rule as for every other app (`docs/spec.md`, "How an app checks access"). Ending the Friday session at once means the portal never holds a Friday token.
