---
title: Account Center signs people in on its server through Friday's Auth, and checks access in the database on every page
app: account-center
decided: 2026-10-14
author: ai
sources:
  - "Buk, 2026-10-14 (every app accepts only Account Center accounts; Account Center accounts are the people's Project Friday accounts)"
  - src/lib/session.ts
  - src/app/actions.ts
  - src/middleware.ts
  - test/app/access.test.ts
---

## Decision

- People sign in with their Account Center account (their Project Friday account: email and password) through Supabase's `@supabase/ssr` on Account Center's server. The browser never talks to Supabase, so no Supabase key is needed in the browser.
- Every page first calls `requireAction(action)`: the account is checked with Friday's Auth server (`getUser`, not only the cookie), then `account.can_user` and `account.me_by_user` answer as Account Center's own database user, `account_app`. No account sends the person to sign in; no access shows a page that says so.
- `/api/health` answers when the server can reach schema `account`, for the container health check on the NAS.

## Why

AI's choice in the build session, not discussed with Buk: checking on the server, on every page, means that removing a role or blocking a login works on the next click, and the app never decides access by itself (`decisions/schema-account-cannot-affect-hr.md`).
