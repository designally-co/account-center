# Applying schema `account` to Project Friday

**Only after P Aek agrees.** Project Friday is his, and HR depends on it.

What the migration does in Friday: creates schema `account` with its tables and functions, and one database role, `account_app` (no login yet). It only **reads** `auth.users` and the listed fields of `public.hr_employees`. It adds no trigger, foreign key, permission or column to anything outside schema `account`. The local tests prove this on every change (`test/run.sh`, also on GitHub with PostgreSQL 17).

## Steps

1. **P Aek agrees** to: schema `account`, the role `account_app`, and a one-time import of these HR fields: id, account id, email, nickname / display name / first name, active, test-fixture flag. After the import Account Center never reads HR's table again.
2. **Rehearsal in Friday that undoes itself** (Claude, through the Supabase connector): in one transaction, run the migration, then `select account.import_from_hr();`, then check:
   - the number of people imported equals HR's active and inactive employees (test fixtures left out);
   - `account.login_ok(...)` is true for a known active account and false for a blocked one. HR's own functions guard against not being allowed to read `auth.users`; if that happens here, every check answers no, and this step shows it;
   - `public.hr_employees` and `auth.users` are unchanged (same row count and the same fingerprint before and after);
   - then **roll back**. Nothing stays.
3. **Apply for real** (Claude, through the Supabase connector, with Buk's go-ahead). Check again that HR's data and rules are unchanged, and that HR still opens and signs in (Buk).
4. **The one-time import and the first admin** (Buk, in the Supabase SQL Editor):
   - `select account.import_from_hr();` (once; a second run is refused). Look through the imported list once.
   - `select account.bootstrap_first_admin('<your HR email>');`
5. **No timer.** After the import, Account Center's list is the real list (Buk, 2026-10-14). People are added and removed in Account Center.
6. **Account Center's login** (when the app is about to go live): `sql/account-app-user.sql`.
7. **Backup:** Friday's nightly backup dumps every non-Supabase schema, so `account` is included; check that the next run counts its tables (the brain repo's `docs/backups.md`).

## Undo

Everything Account Center adds can be removed without touching HR:

```sql
drop schema account cascade;
drop role account_app;
```
