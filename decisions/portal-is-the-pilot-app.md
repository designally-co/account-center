---
title: The Brand Guideline Portal is Account Center's first app, for its Designally team only, with the old sign-in kept until the switch is proven
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (connect Account Center with the Brand Guideline Portal first, then Article Studio, the Hub admin, the survey and so on)"
  - "Buk, 2026-10-19 (team only, clients keep access codes; the team signs in with Account Center instead of Google; when clients log in, staff move to product accounts; the portal moves into Project Friday first; the old sign-in stays next to the new one until everyone has moved)"
  - "designally-co/designally-brain, decisions/company-portal-first-app-on-account-center.md"
---

**Changed 2026-10-19:** the sign-in is tried before the move, through the Friday user `portal_check`; see `portal-sign-in-before-the-move.md`.

## Decision

- The portal is the first app on Account Center (spec section 7, step 3b), before MA Desk and the other company apps.
- Only the portal's Designally team signs in with Account Center. Clients keep their access codes.
- The portal moves into Project Friday first, with its own user `portal_app`. `portal_app` gets the checks (`account.can_user`, `account.can_email`) in an Account Center migration on the day the portal starts using them.
- The portal's actions and ready roles are added to `account.actions` and `account.roles` before that day.
- The old sign-in stays next to the new one until the "Ready to switch" list is done for the portal.

## Why

Buk chose the portal first (Buk, 2026-10-19). Keeping the old sign-in during the change means nobody on the team is locked out while the portal is in use.
