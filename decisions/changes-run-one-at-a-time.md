---
title: Every change to people or access runs one at a time and re-checks the admin's own rights inside its transaction
app: account-center
decided: 2026-10-19
author: ai
sources:
  - src/lib/actor.ts
  - test/app/access-lists.test.ts
  - "Independent review of the kinds and access lists work, 2026-10-19 (two admins could take each other's rights at the same moment and leave nobody who can manage Account Center)"
---

## Decision

`withActor` (`src/lib/actor.ts`) wraps every change. In one transaction it takes a lock (`pg_advisory_xact_lock`), checks again that the admin may still both view and manage Account Center, and names the admin for the change log. Nobody can change their own Account Center access or remove themselves, and ids are compared without regard to letter case.

`account.bootstrap_first_admin` works whenever no active person can manage Account Center, so it is also the way back if every admin's login is blocked.

## Why

The review proved on a test database that two admins removing each other at the same moment both succeeded, leaving no admin, and that an id in capital letters got past the "not yourself" check. With one change at a time, the second change sees the first and is refused. The test "two admins taking each other's Account Center rights at the same moment leaves one admin" fails without the lock.
