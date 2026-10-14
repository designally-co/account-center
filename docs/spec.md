# Account Center: spec

Account Center is the app and the database part that hold every account and all access across the Designally ecosystem. It was called the "front desk" until Buk named it on 2026-10-14. Its database schema is `account` (name to be confirmed in the build).

Status: **approach agreed by Buk on 2026-10-14; schema `account` is written and tested on a local database (`supabase/migrations/`, `test/`); applying it to Project Friday waits for P Aek (`docs/apply-to-friday.md`).** Copied on 2026-10-14 from `designally-co/designally-brain`, `docs/account-center.md`; this file is now the living spec. Company decision notes (in the brain repo): `decisions/company-account-center-owns-people-and-access.md`, `decisions/company-account-center-for-every-app.md`.

The goal (Buk, 2026-10-14): one place that decides who may do what across the Designally ecosystem. Account Center comes first; every app, HR included, sits behind it.

**End state (Buk, 2026-10-14):** every account and all access come from Account Center. A person's roles there decide which apps they can use (HR, Article Studio, the Knowledge Hub, the survey, MA Desk and the rest) and what they may do in each. No app has its own accounts, user list or access rules. HR reaches this state when P Aek agrees; until then its part is a prototype.

## 1. What is real now, and what is a prototype

| Part | Now | Why |
|---|---|---|
| **Access for Buk's apps** (MA Desk, Knowledge Hub, Article Studio, survey, brand guideline portal) | **Real.** Account Center decides who may do what in them | They are Buk's apps |
| **People list** | **Real.** Imported **once** from HR when Account Center starts; from then on Account Center's list is the real list: people are added and removed here (Buk, 2026-10-14) | No need to read HR again and again |
| **Leaving** | **Real.** Someone who leaves is removed in Account Center: every role in every app is gone at once. HR follows (Buk, 2026-10-14; section 3, "When someone leaves") | One place for joining and leaving |
| **Account creation** | **Real** (Buk, 2026-10-14). Account Center creates accounts and gives a one-time link to set a password | Account Center is the starting point |
| **Sign-in** | **Goal: every app accepts only Account Center accounts.** Account Center and MA Desk use them from day one. The Hub, Studio, the survey and the brand guideline portal keep their Designally Google sign-in **for now**, next to the new sign-in, and drop it once everyone has moved | So nobody who uses them now is locked out |
| **Anything that touches HR** (HR's roles, HR records, HR's own rules) | **Prototype only.** Screens that show how it would work, with no effect on HR | HR is P Aek's; it changes only when he agrees |

```
            Account Center: people (imported once from HR), access (real)
     ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  MA Desk     Studio      Hub      Survey   Brand guide   HR (prototype)
```

## 2. What already exists (read-only check, 2026-10-14)

**Friday's accounts** are run by P Aek's HR app (`designally-co/friday-hr`, hr.designally.co).

| Fact | Value |
|---|---|
| Accounts | 22; 13 can sign in, 9 blocked (people who left) |
| Sign-in | Email and password only. No Google sign-in, no two-step login |
| HR link | Every account is linked to one row in `public.hr_employees` (`auth_user_id`) |
| Active employees' emails | 11 Gmail, 2 designally.co |
| Roles | In `hr_employees.role`: admin 5, team lead 1, employee 17. Used only inside HR |
| New accounts | Made by an HR admin only (`onboard-user`, or an invite link via `onboard-invite`). The email is marked confirmed without sending an email |
| Leaving | HR offboarding blocks the login and ends its sessions |
| Password | Employees change it in the HR sidebar. No "forgot password", no admin reset button |
| Other users of these accounts | HR, Blink, Design Studio, meetings and transcriptions, Storage rules; app.designally.co |

**Buk's apps sign in on their own:**

| App | Sign-in today | People in its own user table |
|---|---|---|
| Knowledge Hub | Google, designally.co accounts only; everyone is an admin | 2 |
| Article Studio | Google, designally.co accounts only; everyone is an admin | 3 |
| Survey | Google, in its Next.js app | has a `users` table |
| Brand guideline portal | The brain does not know (not live, not in the brain) | The brain does not know |
| MA Desk | Not built | none |

**Another people list exists:** `public.people` (15 rows, 1 linked to an account), used by the app at app.designally.co. Account Center does not use it; it is listed here so nobody mistakes it for the team list.

## 3. The design

### People: imported once from HR, then managed here

- `account.people` holds one row per person. When Account Center starts, a person runs `account.import_from_hr()` **once** in the SQL Editor. It takes only: the HR employee id, the account id, nickname or display name, the HR email, and active or not. Never phone, birthday, emergency contact, salary or any other HR detail. A second import is refused.
- **After the import, Account Center's list is the real list** (Buk, 2026-10-14). Later changes in HR are not copied, and Account Center never reads HR's table again. New people are added in Account Center; people who leave are removed in Account Center.
- **Each person can have more than one email.** The HR email (their Account Center account) is usually a personal Gmail, but Google sign-in in Buk's apps uses their designally.co account. During the move, an Account Center admin adds each person's work email in Account Center (`account.person_emails`), so a Google sign-in finds the right person. Google has already proven the work email, so the apps can match on it safely.
- Account Center can show HR details as a prototype only; it does not write to HR.

### Access: real, for Buk's apps

- Each app lists its actions (for example `studio.article.publish`). Actions are grouped into roles per app (for example Writer, Publisher, Admin). People are given roles.
- **Nobody has access by default.** A person can do something only after an Account Center admin gives them a role in that app.
- **An inactive person or a blocked login loses everything,** in every app, on the next action.
- **Apps check the action, never a role name,** on the server, for every action. Hiding a button is only for the screen.
- **Every change is logged:** who gave or removed which role, and when.

### Sign-in: Account Center accounts

- **An Account Center account** is the person's account in Project Friday's Auth. For people already in HR it is the account they use for HR (their HR email and password). New people get one from Account Center (below).
- **One sign-in for all apps:** the apps run on addresses under designally.co, so Account Center's sign-in can be shared across them (one session cookie for `.designally.co`): sign in once, and every app knows who you are. To be proven in the build; the fallback is the same account on a sign-in page in each app.
- **Account Center and MA Desk** accept Account Center accounts only, from day one.
- **The Hub, Studio, the survey and the brand guideline portal, during the move:** they show both "Sign in with your Designally account" (new) and the current Google sign-in (old). A person who signs in with Google is matched to their Account Center person by their work email (`account.person_emails`), so their access is the same either way. When everyone uses the new sign-in, the app drops Google sign-in.

### Creating an account in Account Center

1. An Account Center admin types the person's name and email, and chooses their roles.
2. Account Center creates the account in Project Friday's Auth (through a small server function in Friday, `account-invite`, so the app never holds Friday's master key), adds the person to `account.people` (marked "created by Account Center"), and shows a **one-time invite link**.
3. The admin sends the link to the person (LINE or email). Friday's Auth sends no emails today, so the link is sent by hand, the same way HR's invite link works.
4. The person opens the link, sets their own password, and can sign in to every app their roles allow.
5. Every creation is logged (who created whom, when).

Rules:

- **Only Account Center admins** can create accounts.
- **The account is blocked until the person sets their password**, and the link works once and expires (for example after 7 days).
- **No HR record is made.** A person created here is not an employee in HR. This also makes accounts for freelancers and partners possible.
- **People who leave are removed in Account Center** (below).
- **Check the email before creating:** if an account with that email already exists (for example from HR), Account Center links to it instead of creating a second one.

**The clash with HR, and how to avoid it:** HR's **Add Employee** and invite link always create a new account, and they refuse an email that already has one ("An account with this email already exists"). So if Account Center creates an account for someone who later becomes an employee, HR cannot onboard them with that email. Until P Aek changes HR to link an existing account:

- for a **new employee**, create them in HR as today, then add their existing account in Account Center (it finds the account by email and links to it; part of step 4);
- use Account Center creation for **everyone else** (freelancers, partners, and people who are not in HR).

When P Aek agrees, HR's onboarding links to Account Center account instead, and every account is created in Account Center.

### When someone leaves

An Account Center admin presses **Remove** on the People page and confirms (Buk, 2026-10-14: people who leave are removed in Account Center, and the HR app follows).

1. **At once (built):** every role in every app is taken away and the person is marked inactive, in one logged change. Every app's next check says no.
2. **Their login is blocked** (with account creation, step 4: the server function `account-remove`, which writes Friday's Auth, so it waits for P Aek). From then on they cannot sign in to any app, HR included. This is what HR's offboarding does today.
3. **HR follows** (when P Aek agrees): HR learns from Account Center that the person left and closes its own record. Until then, HR's admin records the leaving in HR as today.

**Removed, not erased.** The person's record, their history and their Friday account stay; only access ends. Erasing a Friday account would also erase that person's Design Studio work (its tables delete their rows with the account), and HR's employee table refuses the erase while it points to the account (checked read-only, 2026-10-14). An admin cannot remove themselves.

### How an app checks access

1. The person signs in (Account Center account, or Google during the move).
2. The app's server asks Account Center: `account.can_user(account id, action)` for an Account Center account, or `account.can_email(work email, action)` for a Google sign-in. The answer is yes or no.
3. The app allows or refuses the action.

Each app connects with its own database user (`hub_app`, `studio_app`, `survey_app`, later MA Desk's). Only these users, and Account Center, may call the check. The brand guideline portal's database is not in Project Friday, so it would need its own small Friday user that may only call the check. The apps never read `account` tables directly and never read HR.

### Schema `account` (written: `supabase/migrations/20261014100000_account_schema.sql`)

| Table | Holds |
|---|---|
| `account.people` | One row per person: account id, HR employee id (when imported from HR), where they came from (`hr` or `account_center`), name, email, active. Whether the login is blocked is read from the account itself at each check, not copied |
| `account.person_emails` | Extra emails per person (work email for Google sign-in), added in Account Center |
| `account.apps` | The apps that use Account Center |
| `account.actions` | Each app's actions, with a short description |
| `account.roles` | Roles per app |
| `account.role_actions` | Which actions each role includes |
| `account.grants` | Which person has which role |
| `account.log` | History of every change to people, emails, roles and grants, written by triggers; the actor is set by Account Center's server |

Database functions (all in schema `account`; every check fails closed):

| Function | Who may call it | What it does |
|---|---|---|
| `can_user(account id, action)` | each app's database user, Account Center | Yes only when the person is active, their login is not blocked, and one of their roles includes the action |
| `can_email(email, action)` | each app's database user, Account Center | The same, finding the person by their HR email or an added work email (Google sign-in during the move). An email that matches two people is a no |
| `me_by_user(account id)`, `me_by_email(email)` | each app's database user, Account Center | The person's id, name and roles; empty when they cannot use anything |
| `import_from_hr()` | a person in the SQL Editor, once | Imports people from HR when Account Center starts; refused when anyone is already in the list |
| `login_state(account id)` | Account Center | Only `ok`, `blocked` or `missing`, for the People page |
| `hr_people()` | nobody outside the schema | The only place that reads HR, listed fields only; used by the import |
| `bootstrap_first_admin(email)` | a person in the SQL Editor | Gives the first Account Center admin; works only once |

Server functions in Friday, still to write (step 4): `account-invite` (creates the account and the one-time link) and `account-remove` (blocks the login of someone who left). Only Account Center admins can use them.

Database users: `account_app` (Account Center's server: its tables, never HR), and the apps' existing users (`hub_app`, `studio_app`, `survey_app`, later `ma_app`), which may call the checks only.

Example:

| App | Role | Actions |
|---|---|---|
| MA Desk | Viewer | `ma.view` |
| MA Desk | Manager | `ma.view`, `ma.edit`, `ma.archive` |
| Article Studio | Writer | `studio.draft.create`, `studio.draft.edit` |
| Article Studio | Publisher | Writer + `studio.article.publish` |
| Article Studio | Admin | Publisher + `studio.article.delete`, `studio.settings` |
| Knowledge Hub | Editor | `hub.article.edit`, `hub.article.publish` |
| HR (prototype) | HR admin | `hr.employees.manage`, `hr.payroll.view` (shown, not enforced) |

## 4. Account Center

**Built so far** (tested on a local database only): step 1, sign-in and an access check on every page; step 2, the **People** page (everyone with their status, work emails added and removed by admins, **Remove** for people who leave; every change in the change log with the admin's id). The HR list is imported once, by a person, when Account Center starts in Friday.

**Stack:** Next.js on the Designally NAS, like MA Desk (Buk, 2026-10-14; `decisions/stack-nextjs-on-nas.md`). **Address:** account.designally.co (Buk, 2026-10-14).

- **Real:** creating accounts; the list of people (imported once from HR, then managed here) with their work emails; removing people who leave; apps, actions and roles; giving and removing roles; the change history.
- **Prototype:** HR screens (HR roles, HR records). They show the future flow and change nothing.
- Sign-in: Account Center accounts only. Its repo and address: see the open questions.

## 5. Later, when P Aek agrees: HR follows Account Center

Account Center's list is the real list from the import on. Nothing is reset when HR follows.

- `account.people` keeps the HR employee id and the account id from the import. So every HR record and every account is already linked to its Account Center person.
- HR receives people from Account Center: new people are added and invited there, people who leave are removed there, and HR follows. HR's existing records (attendance, leave, payroll, documents) stay exactly where they are, attached to the same people.
- Same accounts, same passwords, same ids. HR's own checks can then use Account Center access, and the HR prototype screens become real.

## 6. Fixes to discuss with P Aek

Found in the read-only check. They are in P Aek's system, so he decides how to fix them. None was changed.

1. **Public sign-up may be on.** If "Allow new users to sign up" is on, anyone can create an account. Check in Supabase > Project Friday > Authentication > Sign In / Providers.
2. **`hr_self_register` turns any signed-in account into an active employee** (with leave balances). The HR app no longer calls it. With item 1, an outsider could become an "employee" and so be in the one-time import. They would still get no access, because nobody has access by default. Check the imported list once, right after the import.
3. **Every signed-in account can read every employee's private details** (the select rule on `hr_employees` is `true`).
4. **A shared starting password is written in `friday-hr`** (`scripts/create-auth-accounts.ts`, used for the first 15 accounts in April 2026). People who never changed it should change it, and the script should read it from a setting instead.
5. **Emails are never checked** when an account is made. Check Supabase > Authentication > Emails > SMTP Settings to see whether a password reset could reach a stranger.
6. **No way back from a forgotten password** except an admin in Supabase.

## 7. Steps

1. **P Aek agrees** to a new schema `account` in Project Friday that imports HR's employee list once (the fields in section 3 only) and changes nothing in HR, and to Account Center **creating accounts** and **blocking the login of people who leave** in Friday's Auth.
2. **Build `account`** as a migration: tested on a local database, then in Friday inside a transaction that undoes itself, then for real. Check that the import holds no HR details beyond section 3.
3. **Build Account Center** (real account creation, removal and access screens, HR screens as a prototype) and the `account-invite` and `account-remove` functions.
4. **MA Desk** signs in with Account Center accounts and checks every action with Account Center from day one.
5. **Article Studio, the Hub, the survey and the brand guideline portal**, one at a time: add Account Center sign-in next to Google, and the access check. Each starts with today's users given the role that matches what they can do now (everyone is an admin in the Hub and Studio), so nobody loses access on the day of the switch.
6. **Drop Google sign-in** in each app once everyone in it signs in with their Account Center account.

## 8. Open questions

1. P Aek: may `account` import HR's employee list once (section 3 fields only), and may Account Center create accounts and block the login of people who leave in Friday's Auth?
2. Account Center accounts use email and password today (the HR password). With no "forgot password" and unchecked emails (section 6), these accounts will guard every app. Turning on Google sign-in for Friday's accounts would fix both, but it is a setting in P Aek's project: ask him when and how.
3. ~~Account Center's repo name and address~~ Decided: `designally-co/account-center`, account.designally.co (Buk, 2026-10-14).
4. Who may change access: only Buk, or also P Aek and each app's owner?
5. Brand guideline portal: how does it sign people in today? (Not in the brain.)
6. P Aek: when can HR's Add Employee link an account that already exists, so that every account can start in Account Center?
