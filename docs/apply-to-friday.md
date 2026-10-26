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

   **Done 2026-10-19** (P Aek agreed to Part 1, Buk), through the Supabase connector, as one transaction that ended in an error on purpose, so everything was rolled back:
   - the migration ran as written: 8 tables, 15 functions, 7 triggers, 8 policies in `account`;
   - the import added 22 people: HR has 23 rows, 1 is a test fixture and was left out. 11 active; 11 logins ok, 10 blocked, 1 person with no login; no active person with a blocked login;
   - a second import was refused; a first admin (made only inside the rolled-back transaction) could manage, and an unknown account could not;
   - nothing outside schema `account` changed: 3,678 items compared before and after (HR's data and `auth.users` by fingerprint, tables, columns, functions, triggers, constraints, policies, permissions), 0 differences;
   - permissions: `anon` and `authenticated` cannot use schema `account`, read its tables or run the import; `service_role` cannot read `account.people`; `hub_app` can call the checks but not read the tables; `account_app` can read its tables but cannot run the import;
   - checked afterwards: schema `account` and role `account_app` do not exist in Friday.
3. **Apply for real** (Claude, through the Supabase connector, with Buk's go-ahead). Check again that HR's data and rules are unchanged, and that HR still opens and signs in (Buk).

   **Done 2026-10-19** (Buk's go-ahead). Applied through the Supabase connector in one transaction (repeatable read) with a guard: a snapshot of everything outside schema `account` (the same 3,678-item list as step 2) before and after the migration, and the transaction would have rolled itself back on any difference. The guard passed with 0 differences. Live afterwards: 8 tables, 15 functions, 7 triggers, 8 policies, role `account_app`, `account.people` empty; recorded in Friday's migration history as version `20261014100000`, name `account_schema`. HR opening and signing in: for Buk to confirm.

   **Checked afterwards (2026-10-19, five independent read-only checks):**
   - **Matches the repo file exactly:** every table, column, constraint, trigger, policy and function body; seed rows 7 apps, 2 actions, 2 roles, 3 role actions; `account.people` empty.
   - **HR and the other apps untouched:** the only row written outside `account` is the migration record in `supabase_migrations.schema_migrations`; nothing outside `account` depends on it; HR's policies (including `hr_attendance_self_insert` and `hr_attendance_self_update`) and triggers unchanged; every other app schema has the same tables as before.
   - **Bookkeeping outside `account`, all expected:** the role `account_app`, and PostgreSQL's automatic membership that makes `postgres` admin of a role it creates (no inherit, no set; the app users have the same).
   - **Security:** `anon`, `authenticated` and `service_role` have no access to `account`; `import_from_hr` and `bootstrap_first_admin` run as `postgres` only; every function has a fixed `search_path`; the security advisor reports nothing in `account`.
   - **Backup:** Friday's nightly backup will include `account` from the first run after the apply; check that run's schema list and restore count (8 more tables).
   - **Four improvements found by these checks:** see step 3b.
   - **Run the import outside 02:30 to 05:00 Bangkok time**, when the nightly backup runs, so its restore check does not see a half-done import.
3b. **Improvements** (`20261019100000_account_hardening.sql`; Buk's go-ahead 2026-10-19), applied with the same guard:
   - `hub_app`, `studio_app` and `survey_app` lose access to `account`; each app gets the checks only when it starts using Account Center (before, `me_by_email` would have shown staff names and roles to those apps' logins once the import ran);
   - functions added later: every migration revokes them from public itself, and `test/run.sh` fails otherwise (a per-schema default privilege cannot remove PostgreSQL's global default, and the global one would change all of Friday);
   - indexes for the three foreign keys the performance advisor listed;
   - change-log triggers on `account.apps` and `account.actions`.
3c. **Kinds of people and per-person access lists** (`20261019110000_kinds_and_access_lists.sql`), with the same guard. Not applied yet. It adds `account.kinds`, `account.kind_blocked_apps` and `account.person_actions`, a `kind` column on `account.people` (everyone starts as an employee), `hue`, `url` and `icon` columns on `account.apps` (each app's colour on screen, where it opens, and its graphic; set for the apps whose values are known), the checks that keep an outsource account out of HR, and new versions of `account.person_can`, `account.me` and `account.bootstrap_first_admin` (same names, arguments and rights). Run it before the release of Account Center that needs it. Together with it: `20261019113000_avatars.sql` (the `avatar` column on `account.people`, and `account.me` returns it).
3d. **Invitations** (`20261019130000_invitations.sql`), with the same guard: `account.login_state` also says `invited` (a login made by an invitation that was not accepted yet). Same name, arguments and rights. Run it with or after 3c.
3e. **App cards** (`20261019140000_app_cards.sql`), with the same guard: `description` (one short line) and `art` (a small picture of what the app does, a file under `/apps/art/` shipped with Account Center) columns on `account.apps`, shown on Home's app cards, set for the 7 apps. Run it with or after 3c.
3f. **Teams** (`20261019150000_teams.sql`), with the same guard: `account.teams`, `team_members` (one team per person), `team_roles` (a team's default role per app, never Account Center) and `team_opt_outs`; `account.base_allows`, `account.is_lead_of`; new versions of `person_can`, `me` and `import_from_hr` (same names, arguments and rights; the import also copies HR's teams, members and leads, reading HR only).
3g. **The Brand Guideline Portal** (`20261019160000_brand_portal.sql`; actions and roles approved by Buk, 2026-10-19), with the same guard: the portal's 12 actions and its roles Viewer, Editor and Owner (Editor and Owner match the portal's own roles today), and the role `portal_check`, which may only call `account.can_user`. Its login: `sql/portal-check-user.sql` (Buk, after the apply; the connection string goes straight into the portal's setting `ACCOUNT_CENTER_DB_URL`).
3h. **3c to 3g and the import in one go, in the SQL Editor** (2026-10-19). Through the connector every write call of more than a few lines stopped after 60 seconds without reaching the database (Postgres logged nothing; the counts were unchanged afterwards), so Buk runs `supabase/apply/2026-10-19-kinds-to-portal-and-import.sql` himself: open it on GitHub, copy all, paste into Friday's SQL Editor, press Run (and "Run this query" if Supabase warns about destructive operations). One transaction: the six migrations, copied exactly from their files (tested on a copy with Friday's state), their records in the migration history, `account.import_from_hr()`, then the guard. On any difference outside `account` it stops with "GUARD STOPPED" and keeps nothing; a second run stops at its first line and keeps nothing. Success is one row: the import's counts, the guard's line, and the numbers of people, teams and members. Not outside 02:30 to 05:00 Bangkok time (step 3).
   **Done 2026-10-20** (Buk, about 10:00 Bangkok time). Supabase's SQL Editor warned "creates a table without enabling Row Level Security: `supabase_migrations.schema_migrations`": a misreading (the file only inserts rows there); Buk chose **Run without RLS**, because "Run and enable RLS" would have changed Supabase's own migration table, outside `account`, which the guard does not watch. Result: import `{"added": 22, "leads": 4, "teams": 6, "team_members": 21, "leads_in_another_team": 2}`, guard 3,680 items compared, 0 changed. Checked afterwards through the connector (read only): all six versions recorded, 16 tables in `account`, 11 active people with a working login, 0 active people without a team, no function in `account` executable by everyone, the migration table's RLS unchanged.
3i. **Shared subscriptions** (`20261026100000_shared_subscriptions.sql`, 2026-10-26), with the same guard: the tables `account.subscriptions` and `account.subscription_members`, for Account Center's server only. Buk runs `supabase/apply/2026-10-26-shared-subscriptions.sql` in the SQL Editor, like 3h, **before** the release that has the Subscriptions page (until then that page fails; Home and the person pages simply show no shared tools). Success is one row: about 3,680 items compared, 0 changed, 18 tables in `account`.
4. **The one-time import and the first admin** (Buk, in the Supabase SQL Editor; the import is already in 3h's file). **Done 2026-10-20:** Buk is the first admin; `portal_check` has its login (`sql/portal-check-user.sql`). Its list of outside functions showed HR functions open to every login, `hr_enc_key` among them (see "Found while applying", below).
   - `select account.import_from_hr();` (once; a second run is refused). Look through the imported list once.
   - `select account.bootstrap_first_admin('<your HR email>');`
5. **No timer.** After the import, Account Center's list is the real list (Buk, 2026-10-14). People are added and removed in Account Center.
6. **Account Center's login** (when the app is about to go live): `sql/account-app-user.sql`.
7. **Backup:** Friday's nightly backup dumps every non-Supabase schema, so `account` is included; check that the next run counts its tables (the brain repo's `docs/backups.md`).

## Server functions (account-invite and account-recover)

Built and tested locally on 2026-10-19; **not deployed**. They make logins and reset links in Friday's Auth, so they wait for P Aek's agreement (`docs/spec.md`, section 8, question 1). Code: `supabase/functions/`.

When P Aek agrees:

1. **Email sender.** The functions send through Resend, like HR's server functions. Set these function secrets in Project Friday (Edge Functions > Secrets), typed there, never in chat or in this repo:
   - `RESEND_API_KEY`: a Resend key for the verified designally.co domain (HR's sender domain);
   - `ACCOUNT_MAIL_FROM`: the sender, for example `Designally <people@designally.co>` (agree the address with P Aek, as HR's was);
   - `ACCOUNT_APP_URL`: `https://account.designally.co`.
   Without `RESEND_API_KEY` nothing is emailed: the admin gets the invitation link to send by hand, and "Forgot your password?" sends nothing.
2. **Deploy both with JWT checking off** (each function checks its caller itself): `supabase functions deploy account-invite --no-verify-jwt` and the same for `account-recover`, from this repo, linked to Project Friday. Friday gives them `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` itself.
3. **Check:** add a made-up person with an email you can read, accept the invitation, set a password, make the avatar; then "Forgot your password?" for the same email; then remove the made-up person.
4. **Link lifetime:** an invitation or reset link stops working after Friday's Auth setting "Email OTP expiration" (Authentication > Providers > Email; Supabase's default is 1 hour). Not checked in Friday yet. The admin can always press Send again.

Nothing in Friday's Auth settings changes: no email templates, no SMTP sender, no redirect addresses. That keeps other apps that use Friday's Auth (Recruit, for example) as they are.

## Found while applying (2026-10-20)

`sql/portal-check-user.sql` lists the functions outside `account` that `portal_check` can run through PostgreSQL's everyone-rights (PUBLIC). The same rights belong to `anon`, the public key the HR website sends to every browser, so `portal_check` adds nothing. Checked read only, without showing any code or value: most HR functions refuse unless the caller is an HR admin or signed in, but `public.hr_enc_key()` (security definer, returns HR's encryption key for salaries, bank accounts and national IDs) checks nothing, and `hr_emit_system_alert`, `blink_0003_reconcile_cohort` and `blink_roll_rarity_min` check nothing either. Supabase's API log showed 0 calls to `rpc/hr_enc_key` in the 24 hours before. This is HR's code and P Aek's database: reported to Buk to pass on; not changed from here.

## Undo

Everything Account Center adds can be removed without touching HR:

```sql
drop schema account cascade;
drop role account_app;
```
