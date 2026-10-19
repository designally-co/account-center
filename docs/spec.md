# Account Center: spec

Account Center is the app and the database part that hold every account and all access for **Designally's own people** (employees and outsourced workers, never clients; Buk, 2026-10-19) in the company's apps. It was called the "front desk" until Buk named it on 2026-10-14. Its database schema is `account` (name to be confirmed in the build).

Status: **a plan and Buk's experiment, not live** (Buk, 2026-10-19). The approach was agreed by Buk on 2026-10-14. Schema `account` is written and tested on a local database (`supabase/migrations/`, `test/`), and the app's first steps are built and tested locally (section 4). P Aek agreed to Part 1 and Part 2 (Buk, 2026-10-19), but Buk runs Part 1 first, and **switches only when Account Center is solid enough to replace the current system** (Buk, 2026-10-19; section 7, "Ready to switch"). The test run of the schema in Friday, which undid itself, passed on 2026-10-19, and the schema was applied for real the same day with Buk's go-ahead, changing nothing outside `account` (`docs/apply-to-friday.md`, steps 2 and 3). The one-time import and the first admin are next (step 4). Kinds of people and per-person access lists (migration `20261019110000`) are written and tested locally; applying them to Friday is step 3c of `docs/apply-to-friday.md`. **Nothing in use changes:** the current HR app stays the system everyone uses, and no live app changes how people sign in, until Buk and P Aek decide to switch (Buk, 2026-10-19). Company decision note (in the brain repo): `decisions/company-account-center-experiment.md`. Copied on 2026-10-14 from the brain repo; this file is the living spec.

The goal (Buk, 2026-10-14 and 2026-10-19): one place that decides who in the company may do what in each app. It is Buk's experiment to rebuild the system: everyone in the company gets one account from Account Center, and from there they use every app, HR included.

**End state:** every company account and all access come from Account Center. When someone joins the company, an account is made for them and they get a role. The account works like a **badge**: it says which apps the person can use and what they can do in each (Buk, 2026-10-19). No company app has its own accounts, user list or access rules. HR reaches this state when P Aek agrees; until then its part is a prototype.

**Who has an account** (Buk, 2026-10-19):

- **Employees and outsourced workers.** Each account says what **kind** of person it is. Example: an outsourced worker's account is marked as outsource, so they cannot use the HR app, but they can use Article Studio. The full list of kinds is not decided.
- **Never clients.** The future client product (the brand ecosystem, starting from the Brand Guideline Portal) has its own accounts, for clients and for Designally staff, and does not use Account Center (brain note `decisions/company-ecosystem-product-logins-apart-from-account-center.md`). **Until clients log in**, the portal's Designally team signs in with Account Center, because the portal is the first app (Buk, 2026-10-19; brain note `decisions/company-portal-first-app-on-account-center.md`). Its clients keep their access codes.

## 1. What is built, and what waits for the switch

Account Center is an experiment: nothing below changes anything in use until Buk and P Aek decide to switch (Buk, 2026-10-19). This replaces the 2026-10-14 plan, where access for Buk's apps and account creation were "real now".

| Part | Now | At the switch (Buk and P Aek decide) |
|---|---|---|
| **People list** | Imported **once** from HR when Account Center starts in Friday (with P Aek's agreement); from then on Account Center's list is the real list (Buk, 2026-10-14 and 2026-10-19). Reading HR changes nothing in HR | No change |
| **Access** (which apps, and which actions in each) | Designed and built; tested locally. No live app asks Account Center yet | Apps start asking Account Center |
| **Leaving** | Removing someone in Account Center takes away every role (built, local) | Their login is also blocked, and HR follows |
| **Account creation** | Built and tested locally (2026-10-19): an admin adds a person with their Google email, and the server function `account-invite` emails an invitation. It writes Friday's Auth, so it is **not deployed to Friday** until P Aek agrees | The two server functions are deployed in Friday and email is set up; admins add new people here |
| **Passwords** | Built and tested locally (2026-10-19): "Forgot your password?" (server function `account-recover`) and "Change password" on Home. Not deployed to Friday, same reason | Every company person can reset their own password |
| **Sign-in** | Every live app keeps its own sign-in as it is | Apps add Account Center sign-in; in the end every company app accepts only Account Center accounts |
| **Anything that touches HR** (HR's roles, HR records, HR's own rules) | **Prototype only.** Screens that show how it would work, with no effect on HR | Real when P Aek agrees |

```
        Account Center (experiment): company people (imported once from HR), access per app and action
     ┌──────────┬──────────┬──────────┬──────────┬──────────┐
  MA Desk     Studio      Hub      Survey   Recruit ...   HR (prototype)
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
| Brand guideline portal | Email and password in the portal's own Supabase project (outside the Designally org); only people in its `admin_users` list (roles editor and owner) get in. Clients use access codes, no accounts (checked 2026-10-19 at commit 6a2dbd4) | not counted |
| MA Desk | Not built | none |

**Another people list exists:** `public.people` (15 rows, 1 linked to an account), used by the app at app.designally.co. Account Center does not use it; it is listed here so nobody mistakes it for the team list.

## 3. The design

### People: imported once from HR, then managed here

- `account.people` holds one row per person. When Account Center starts, a person runs `account.import_from_hr()` **once** in the SQL Editor. It takes only: the HR employee id, the account id, nickname or display name, the HR email, and active or not. Never phone, birthday, emergency contact, salary or any other HR detail. A second import is refused.
- **After the import, Account Center's list is the real list** (Buk, 2026-10-14). Later changes in HR are not copied, and Account Center never reads HR's table again. New people are added in Account Center; people who leave are removed in Account Center.
- **Each person can have more than one email.** The HR email (their Account Center account) is usually a personal Gmail, but Google sign-in in Buk's apps uses their designally.co account. During the move, an Account Center admin adds each person's work email in Account Center (`account.person_emails`), so a Google sign-in finds the right person. Google has already proven the work email, so the apps can match on it safely.
- Account Center can show HR details as a prototype only; it does not write to HR.

### Avatars: made by each person, for fun in the office

- Every person makes their own avatar (Buk, 2026-10-19): drawn faces in the Notion style ("Notionists" by Zoish, CC0, drawn by the DiceBear library, MIT), chosen part by part (hair, eyes, brows, mouth, nose, glasses, beard, outfit, hands, badge, colour), with "Surprise me". Until they make one, they see a stable starting face made from their id.
- **When:** the first time a person signs in to Account Center, they land on the avatar step ("Welcome, Ann"). "Later" skips it on that browser; Home still offers it. It becomes a step of account creation when that is built (section 1). They can change it any time from Home.
- **Stored as their choices** (`account.people.avatar`, a small object), never as an image. Account Center's server accepts only known parts with known values; the database keeps the shape and size in check.
- **Only the person changes their own avatar**, through their own signed-in account (`saveMyAvatar`, `src/lib/self.ts`); admins cannot. Every change is in the change log; an unchanged avatar is not written again, and a person can save at most once every few seconds.
- `account.me` (and so `me_by_user`, `me_by_email`) returns the avatar, so an app that later shows people can show it too.

### Access: per app and per action

- **A person's access list** shows the apps they can use, and inside each app what they can do (Buk, 2026-10-19). Access is never only "can use this app" or "cannot". Example: in Article Studio a person can generate an article but cannot publish it.
- Each app lists its actions (for example `studio.article.publish`). Actions are grouped into ready roles per app (for example Writer, Publisher, Admin).
- **A ready role, plus single changes** (first version, 2026-10-19): per app, a person gets one ready role; on top of it an admin can allow or block single actions for that one person. On screen, each app is one card with its role in the header and one row per action, allowed or blocked (Buk, 2026-10-19: simple, like ClickUp's tool permissions). Changing a row makes the role "custom". Choosing a role again starts from that role.
- **A person's kind limits their access** (Buk, 2026-10-19): an outsource account cannot get access to the HR app. Built (migration `20261019110000`): `account.kinds` (employee, outsource; data, not code, because the full list is not decided) and `account.kind_blocked_apps` (outsource never gets `hr`). The database refuses an HR role or an allowed HR action for an outsource account, and refuses a change of kind while such access exists. The check also says no when a block is added later.
- **Changes run one at a time.** Every change takes a lock and checks again, inside the same transaction, that the admin may still see and manage Account Center. Nobody changes their own Account Center access. A save from a page that is out of date (someone changed the same access meanwhile) is refused.
- **Nobody has access by default.** A person can do something only after an Account Center admin gives them a role in that app.
- **An inactive person or a blocked login loses everything,** in every app, on the next action.
- **Apps check the action, never a role name,** on the server, for every action. Hiding a button is only for the screen.
- **Every change is logged:** who gave or removed which role, and when.

### Sign-in: Account Center accounts

- **An Account Center account** is the person's account in Project Friday's Auth. For people already in HR it is the account they use for HR (their HR email and password). New people get one from Account Center (below).
- **One sign-in for all apps:** the apps run on addresses under designally.co, so Account Center's sign-in can be shared across them (one session cookie for `.designally.co`): sign in once, and every app knows who you are. To be proven in the build; the fallback is the same account on a sign-in page in each app.
- **Account Center itself** accepts Account Center accounts only. **MA Desk** does too, from the switch (section 7).
- **The Hub, Studio and the survey, during the move (after the switch):** they show both "Sign in with your Designally account" (new) and the current Google sign-in (old). A person who signs in with Google is matched to their Account Center person by their work email (`account.person_emails`), so their access is the same either way. When everyone uses the new sign-in, the app drops Google sign-in.

### Creating an account in Account Center

Built and tested locally on 2026-10-19 (Buk, 2026-10-19: "the admin must be able to create the account (new employee's Google account) and the employee can accept the account creation and go to the account center to set up the avatar and they can also reset password"). Not deployed to Friday until P Aek agrees (section 8, question 1).

1. An Account Center admin presses **Add person** on the People page and types the person's name, their **Google email** (Gmail or designally.co; Buk chose "their Google email" on 2026-10-19: it is the sign-in email, and the invitation goes there) and their kind. Roles are given afterwards on their page, like everyone else's.
2. Account Center adds the person to `account.people` (marked "created by Account Center", logged with the admin), then asks the server function **`account-invite`** in Friday. The function checks the admin's token with Friday's Auth and their rights in `account` (view and manage, under the same lock as every change), then:
   - if a login with that email already exists (for example HR made it), it is **not linked at once**: anyone may have made it, because Friday's sign-up may be open (section 6, item 1). The admin sees "A login with this email already exists" and presses **Link the existing login** only if they know it is this person's. A blocked login, or one whose email was never confirmed, is never linked. Nothing is emailed;
   - otherwise it makes an **invited** login with no password (Friday's Auth, `generate_link`), links it, and **emails the invitation** through Resend, the same email provider and sender domain as HR's server functions.
3. The person opens the email and presses **Accept the invitation** on Account Center's `/accept` page (a button, so an email scanner that opens links cannot use it up). The link works once, and only while it is fresh (Friday's Auth setting for email links).
4. They choose their password (at least 8 characters with letters and numbers, HR's rule), then make their avatar, and land on Home.
5. If the email cannot be sent (email not set up, or Resend refuses it), the admin sees the **invitation link** to copy and send by hand (LINE or email), like HR's invite link. Account Center's server sees a link only in this case.
6. The People page shows **Invited** until the person accepts. On their page, **Send again** makes a new link (the old one stops working), at most once a minute.

### Passwords

- **Forgot your password?** on the sign-in page: the person types their email, and the server function **`account-recover`** emails a link to `/accept`, then they choose a new password. The answer is always the same ("If this email belongs to an account, we sent a link"), so nobody can find out which emails have an account. A link is sent only to an active person in Account Center's list whose login is not blocked, at most once a minute per person and 20 a minute in all (`account.recover_sends`). The answer comes before the link is made and emailed, so its timing does not tell either.
- **Change password** on Home: the person types their current password, then the new one.
- After an invitation or reset link, the person does not need the old password for 30 minutes: Friday's Auth writes "signed in by an email link" and its time into the signed sign-in token, and Account Center's server reads it there (never from the form).
- After a new password is saved, every other browser signed in to that account is signed out.
- **Why server functions:** they keep Friday's master key inside Supabase, and they send email themselves, so Friday's shared Auth settings (its email templates and email sender, which other apps such as Recruit may use) do not change. Code: `supabase/functions/`; the logic is `_shared/core.ts`, tested in `test/app/functions.test.ts`.

Rules:

- **Only Account Center admins** can create accounts.
- **The account is blocked until the person sets their password**, and the link works once and expires (for example after 7 days).
- **No HR record is made.** A person created here is not an employee in HR. This also makes accounts for outsourced workers possible.
- **People who leave are removed in Account Center** (below).
- **Check the email before creating:** if an account with that email already exists (for example from HR), Account Center links to it instead of creating a second one.

**The clash with HR, and how to avoid it:** HR's **Add Employee** and invite link always create a new account, and they refuse an email that already has one ("An account with this email already exists"). So if Account Center creates an account for someone who later becomes an employee, HR cannot onboard them with that email. Until P Aek changes HR to link an existing account:

- for a **new employee**, create them in HR as today, then add their existing account in Account Center (it finds the account by email and links to it; part of step 4);
- use Account Center creation for **outsourced workers** and other company people who are not in HR.

When P Aek agrees, HR's onboarding links to Account Center account instead, and every account is created in Account Center.

### When someone leaves

An Account Center admin opens the person's page, presses **Remove** at the bottom and confirms (Buk, 2026-10-14: people who leave are removed in Account Center, and the HR app follows; Buk, 2026-10-19: not from the People grid or list, only inside each person's page).

1. **At once (built):** every role in every app is taken away and the person is marked inactive, in one logged change. Every app's next check says no.
2. **Their login is blocked** (with account creation, step 4: the server function `account-remove`, which writes Friday's Auth, so it waits for P Aek). From then on they cannot sign in to any app, HR included. This is what HR's offboarding does today.
3. **HR follows** (when P Aek agrees): HR learns from Account Center that the person left and closes its own record. Until then, HR's admin records the leaving in HR as today.

**Removed, not erased.** The person's record, their history and their Friday account stay; only access ends. Erasing a Friday account would also erase that person's Design Studio work (its tables delete their rows with the account), and HR's employee table refuses the erase while it points to the account (checked read-only, 2026-10-14). An admin cannot remove themselves.

### How an app checks access

1. The person signs in (Account Center account, or Google during the move).
2. The app's server asks Account Center: `account.can_user(account id, action)` for an Account Center account, or `account.can_email(work email, action)` for a Google sign-in. The answer is yes or no.
3. The app allows or refuses the action.

Each app connects with its own database user (`hub_app`, `studio_app`, `survey_app`, later MA Desk's). **An app's user gets the checks only on the day that app starts using Account Center**, in that app's own migration: `grant usage on schema account` and `grant execute on function account.can_user(uuid, text), account.can_email(text, text)` (and `me_by_*` only if the app needs the name and roles). Until then it has no access to `account` at all (migration `20261019100000_account_hardening.sql`, 2026-10-19), so no app can look up staff before it uses Account Center. The Brand Guideline Portal's database is not in Project Friday yet, so it has its own small Friday user, `portal_check`, that may only call `account.can_user` (migration `20261019160000_brand_portal.sql`, login `sql/portal-check-user.sql`; Buk, 2026-10-19). The apps never read `account` tables directly and never read HR.

### Schema `account` (written: `supabase/migrations/`, `20261014100000_account_schema.sql`, `20261019100000_account_hardening.sql`, `20261019110000_kinds_and_access_lists.sql`, `20261019113000_avatars.sql`, `20261019130000_invitations.sql`, `20261019140000_app_cards.sql`, `20261019150000_teams.sql`, `20261019160000_brand_portal.sql`)

| Table | Holds |
|---|---|
| `account.people` | One row per person: account id, HR employee id (when imported from HR), where they came from (`hr` or `account_center`), name, email, kind, active, avatar (the person's own choices; empty until they make one). Whether the login is blocked is read from the account itself at each check, not copied |
| `account.kinds` | The kinds of people (employee, outsource). Read-only for Account Center's server; changed by a migration |
| `account.kind_blocked_apps` | Apps a kind may never use (outsource: HR). Read-only for Account Center's server; changed by a migration |
| `account.person_emails` | Extra emails per person (work email for Google sign-in), added in Account Center |
| `account.apps` | The apps that use Account Center, each with one short line about it and a small picture of what it does (`description` and `art`, on Home's cards), its colour on screen (`hue`), where it opens (`url`) and its own graphic (`icon`, a file under `/apps/` shipped with Account Center) |
| `account.actions` | Each app's actions, with a short description |
| `account.roles` | Roles per app |
| `account.role_actions` | Which actions each role includes |
| `account.grants` | Which person has which ready role |
| `account.person_actions` | Single changes for one person: an action allowed on top of their role, or blocked although the role gives it |
| `account.log` | History of every change to people, emails, roles and grants, written by triggers; the actor is set by Account Center's server |

Database functions (all in schema `account`; every check fails closed):

| Function | Who may call it | What it does |
|---|---|---|
| `can_user(account id, action)` | an app's database user from the day that app uses Account Center (granted in its own migration), and Account Center | Yes only when the person is active, their login is not blocked, their kind may use the app, their role includes the action or a single change allows it, and no single change blocks it |
| `can_email(email, action)` | an app's database user from the day that app uses Account Center, and Account Center | The same, finding the person by their HR email or an added work email (Google sign-in during the move). An email that matches two people is a no |
| `me_by_user(account id)`, `me_by_email(email)` | Account Center; an app's user only if that app needs the name and roles | The person's id, name and roles (not roles in an app their kind is kept out of); empty when they cannot use anything |
| `import_from_hr()` | a person in the SQL Editor, once | Imports people from HR when Account Center starts; refused when anyone is already in the list |
| `login_state(account id)` | Account Center | Only `ok`, `blocked` or `missing`, for the People page |
| `hr_people()` | nobody outside the schema | The only place that reads HR, listed fields only; used by the import |
| `bootstrap_first_admin(email)` | a person in the SQL Editor | Gives the first Account Center admin. Works only while no active person can manage Account Center, so it is also the way back if every admin's login is blocked |

Server functions in Friday, still to write (step 4): `account-invite` (creates the account and the one-time link) and `account-remove` (blocks the login of someone who left). Only Account Center admins can use them.

Database users: `account_app` (Account Center's server: its tables, never HR), and each app's own user (`portal_check` for the Brand Guideline Portal while its data is outside Friday, then `studio_app`, `hub_app`, `survey_app`, later `ma_app`), which may call the checks only, and only from the day that app uses Account Center (migration `20261019100000_account_hardening.sql` took the first migration's grants away).

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

**Who can sign in:** every active company person with a working login (Buk, 2026-10-19), to see their own access and make their avatar. **Home** shows one card per app the person can use, with a small picture of what the app does (`account.apps.art`, like the cards in Buk's design reference; the app's own graphic or orb when there is no picture) and one short line about what the app is for (`account.apps.description`); the card opens the app (Buk, 2026-10-19). The card does not show the person's role or how many actions they have: that means little to an employee (Buk, 2026-10-19: "use the app desc"). Admins see roles and counts on each person's page. The People pages and every change to access need Account Center's own actions (view, manage).

**Built so far** (tested on a local database only): step 1, sign-in and an access check on every page; step 2, the **People** page (everyone with their status and kind, **Remove** for people who leave; every change in the change log with the admin's id); step 3 (first version, 2026-10-19), **each person's page**: kind, work emails, and per app a ready role and one allowed/blocked row per action; step 4, **avatars** (the maker, shown at first sign-in); step 5 (2026-10-19), **Add person with an invitation email, Forgot your password and Change password** (section 3, "Creating an account" and "Passwords"; the server functions are not deployed to Friday). Design: minimal, black and white, with a soft gradient orb per app and a drawn avatar per person (Buk, 2026-10-19: "minimal, modern and intentional", like ElevenLabs). Release and hosting: `docs/deploy-nas.md`. The HR list is imported once, by a person, when Account Center starts in Friday.

**Stack:** Next.js on the Designally NAS, like MA Desk (Buk, 2026-10-14; `decisions/stack-nextjs-on-nas.md`). **Address:** account.designally.co (Buk, 2026-10-14).

- **Planned for the experiment:** the list of people (imported once from HR, then managed here) with their kind and work emails; removing people who leave; apps, actions and roles; each person's access list (apps, then actions); the change history.
- **Waits for the switch:** creating accounts and blocking logins in Friday's Auth.
- **Prototype:** HR screens (HR roles, HR records). They show the future flow and change nothing.
- Sign-in: Account Center accounts only.

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
5. **Emails are never checked** when an account is made. Check Supabase > Authentication > Emails > SMTP Settings to see whether a password reset could reach a stranger. (Accounts made by Account Center's invitation are checked: the person must open the email.)
6. **No way back from a forgotten password** except an admin in Supabase. (Account Center's "Forgot your password?" fixes this for people in its list, once its server functions are deployed.)

## 7. Steps

**Now (the experiment; changes nothing in use):**

1. **P Aek agrees** to a new schema `account` in Project Friday that imports HR's employee list once (the fields in section 3 only) and changes nothing in HR. Done: P Aek agreed (Buk, 2026-10-19).
2. **Build `account`** as a migration: tested on a local database (done), then in Friday inside a transaction that undoes itself (done 2026-10-19, nothing changed outside `account`), then for real (done 2026-10-19, Buk's go-ahead). Check that the import holds no HR details beyond section 3.
3. **Build Account Center** (people with their kind, access lists per app and action, removal; HR screens as a prototype). Steps 1 to 3 of the app are built locally (section 4); it goes online on the NAS with `docs/deploy-nas.md`.
3b. **Pilot: the Brand Guideline Portal, team only** (Buk, 2026-10-19). The portal first moves into Project Friday (schema `portal`, user `portal_app`). Then it adds "Sign in with Designally account" next to its current sign-in, and checks each admin action with `account.can_user`. Clients keep their access codes. The old sign-in stays until the "Ready to switch" list below is done for the portal; then it is removed. This is the first app's switch, agreed by Buk (brain note `decisions/company-portal-first-app-on-account-center.md`).

**Ready to switch** (Buk, 2026-10-19: Account Center must be solid enough to replace the current system before any switch). Proposed by AI on 2026-10-19, for Buk to confirm; every item checked and written down before step 4:

- **Safe sign-in:** "forgot password" works, emails are checked, and a second step (or Google sign-in for Friday's accounts) protects the accounts that will guard every app (section 6, items 5 and 6, and section 8, question 2).
- **Friday's account fixes decided with P Aek:** section 6, items 1 to 4.
- **Every company app's actions listed** and given to the right people, matching what each person can do today, so nobody gains or loses access on the day of the switch.
- **Joining and leaving tested end to end** on test accounts: add a person, give access, remove them, and see every app refuse them at once.
- **Kinds of people work:** an outsource account cannot get HR access.
- **The change log** shows who changed what for every change, and Buk has read it after a real week of use.
- **Way back:** each app keeps its old sign-in until its own switch is checked, and `account` is in Friday's nightly backup with a tested restore.
- **Used for real** by Buk (and a few people) for a period agreed with P Aek, with no open problem.

**At the switch (Buk and P Aek decide when; P Aek agreed on 2026-10-19):**

4. Account creation, password reset and login blocking in Friday's Auth: deploy the `account-invite` and `account-recover` functions (built and tested locally, 2026-10-19; `docs/apply-to-friday.md`, "Server functions") and write `account-remove`.
5. **MA Desk** signs in with Account Center accounts and checks every action with Account Center.
6. **The other company apps** (after the portal: Article Studio, the Hub admin, the survey, then Recruit and the rest; Buk, 2026-10-19), one at a time: add Account Center sign-in next to their current sign-in, and the access check. Each starts with today's users given the access that matches what they can do now (everyone is an admin in the Hub and Studio), so nobody loses access on the day of the switch. Drop the old sign-in once everyone has moved.
7. **HR follows Account Center** when P Aek agrees (section 5).

## 8. Open questions

1. P Aek: may `account` import HR's employee list once (section 3 fields only)? And, at the switch, may Account Center create accounts and block the login of people who leave in Friday's Auth?
2. Account Center accounts use email and password today (the HR password). With no "forgot password" and unchecked emails (section 6), these accounts will guard every app. Turning on Google sign-in for Friday's accounts would fix both, but it is a setting in P Aek's project: ask him when and how.
3. ~~Account Center's repo name and address~~ Decided: `designally-co/account-center`, account.designally.co (Buk, 2026-10-14).
4. Who may change access: only Buk, or also P Aek and each app's owner?
5. ~~Brand guideline portal~~ Decided (Buk, 2026-10-19): the portal is the first app, for its Designally team only, until clients log in; then staff move to the client product's own accounts (step 3b).
6. P Aek: when can HR's Add Employee link an account that already exists, so that every account can start in Account Center?
7. The kinds of people besides employee and outsource.
8. Access lists: chosen person by person, through ready roles, or both? The first version builds both (a ready role plus single changes, 2026-10-19), for Buk to confirm.
9. When the switch happens (Buk and P Aek).
