---
title: The HR list is imported once; after that people are added and removed in Account Center, and HR follows
app: account-center
decided: 2026-10-14
author: ai
sources:
  - "Buk, 2026-10-14 (no need to grab the HR list all the time; grab all the lists once and we will use it)"
  - "Buk, 2026-10-14 (when people leave, we will delete the account in Account Center; the HR app will follow)"
  - "Project Friday, read-only check 2026-10-14: foreign keys to auth.users include design_studio tables with ON DELETE CASCADE and public.hr_employees.auth_user_id with NO ACTION"
  - supabase/migrations/20261014100000_account_schema.sql
  - src/lib/people.ts
---

## Context

The first design copied HR's employee list into Account Center every 15 minutes, with a "Copy from HR now" button for admins.

## Decision

- `account.import_from_hr()` imports HR's list **once**, run by a person in the SQL Editor when Account Center starts. A second run is refused. The timer and the button are gone.
- From then on Account Center's list is the real list: later HR changes are not copied, and nothing reads HR's table again.
- **Someone who leaves is removed in Account Center:** every role in every app is taken away and the person is marked inactive, in one logged change (built). Their login is then blocked by a server function, `account-remove`, so they cannot sign in to any app, HR included (with account creation; it writes Friday's Auth, so it waits for P Aek). HR follows and closes its own record when P Aek agrees.
- **Removed, not erased:** the record, its history and the Friday account stay. An admin cannot remove themselves.

## Why

Buk said the HR list does not need to be read again and again, and that leaving is done in Account Center, with HR following (Buk, 2026-10-14). "Delete" became "remove access and block the login" in AI's design because erasing a Friday account would also erase that person's Design Studio work (its tables delete their rows with the account), and HR's employee table refuses the erase while it points to the account (read-only check, 2026-10-14).
