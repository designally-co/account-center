---
title: Schema account only reads HR and the accounts, and adds nothing outside its own schema
app: account-center
decided: 2026-10-14
author: ai
sources:
  - "Buk, 2026-10-14 (make sure this does not affect the working HR app and the other apps)"
  - "Buk, 2026-10-14 (the people list comes from the HR app; anything that touches HR or gives it rules is a prototype)"
  - supabase/migrations/20261014100000_account_schema.sql
  - test/run.sh
  - docs/apply-to-friday.md
---

## Context

Account Center lives in Project Friday next to P Aek's HR app, which runs every account today and is in daily use. Account Center needs to read HR's employee list and the accounts' blocked state.

## Decision

- Every object is created inside schema `account`, plus one role, `account_app`.
- `auth.users` and `public.hr_employees` are only read, through security definer functions. `public.hr_employees` is read once, by `account.import_from_hr()`, and only these fields: id, account id, email, nickname, display name, first name, active, test-fixture flag.
- No trigger, foreign key, permission or column is added to anything outside schema `account`. People keep the HR employee id and account id as plain ids, without foreign keys, so HR's add, delete and offboarding flows behave exactly as before.
- Whether a login is blocked is read from the account at every check, not copied, so HR's offboarding stops access in every app at once.
- Every check fails closed: an unknown person, an inactive person, a blocked login, a missing role or an email that matches two people is a no.
- The tests snapshot everything outside schema `account` (tables, columns, functions, triggers, constraints, policies, permissions, and HR's and the accounts' data) before the migration and after the import, and fail on any difference. Each kind of change was injected once on purpose and caught.
- To undo: `drop schema account cascade; drop role account_app;`.

## Why

Buk asked that this must not affect the working HR app or the other apps (Buk, 2026-10-14). Reading only, and adding nothing outside the schema, means HR cannot notice that Account Center exists, and removing it leaves HR as it was.
