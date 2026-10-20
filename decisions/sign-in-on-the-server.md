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
  - src/app/page.tsx
  - src/app/avatar/page.tsx
  - "Buk, 2026-10-19 (every company person makes their avatar at the first sign-in)"
---

## Decision

- People sign in with their Account Center account (their Project Friday account: email and password) through Supabase's `@supabase/ssr` on Account Center's server. The browser never talks to Supabase, so no Supabase key is needed in the browser.
- Every page first calls `requirePerson()`: the account is checked with Friday's Auth server (`getUser`, not only the cookie), then `account.me_by_user` answers as Account Center's own database user, `account_app`. No account sends the person to sign in; someone not on Account Center's list, removed, or with a blocked login sees a page that says so. Home and the avatar page need nothing more (since 2026-10-19 every active company person can sign in; `decisions/avatars-made-by-each-person.md`).
- Admin pages and every admin action then call `requireAction(action)`, which adds `account.can_user`. A person without that right goes back to Home with "You do not have access to that page." Every change also checks the rights again inside its transaction (`decisions/changes-run-one-at-a-time.md`).
- The first sign-in goes to the avatar step until the person saves an avatar, unless they chose "Later" on that browser.
- `/api/health` answers when the server can reach schema `account` with the newest database changes, for the container health check on the NAS.

## Why

AI's choice in the build session, not discussed with Buk: checking on the server, on every page, means that removing a role or blocking a login works on the next click, and the app never decides access by itself (`decisions/schema-account-cannot-affect-hr.md`).
