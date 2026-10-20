# Account Center

Account Center holds every account and all access for Designally's own people: employees and outsourced workers, **never clients** (Buk, 2026-10-19). A person's access list here decides which apps they can open (HR, Article Studio, the Knowledge Hub, the survey, MA Desk and the rest) and what they may do in each. It is **a plan and Buk's experiment**: nothing in use changes until Buk and P Aek decide to switch (Buk, 2026-10-19). It was called the "front desk" until Buk named it on 2026-10-14.

- **Spec:** `docs/spec.md`. Read it before building, and keep it true in the same change as the work.
- **Release:** `docs/deploy-nas.md` (image from GHCR, Portainer stack on the NAS).
- **Status:** the app is not live. Schema `account` is in Project Friday since 2026-10-19 (applied with Buk's go-ahead; nothing outside `account` changed; `docs/apply-to-friday.md`). On 2026-10-20 Buk ran migrations `20261019110000` to `20261019160000` and the one-time import from HR in the SQL Editor (22 people, 6 teams; the guard compared 3,680 items outside `account`, 0 changed), made himself the first admin, and gave `portal_check` its login. The Brand Guideline Portal is the first app using it: its team can sign in there with their Account Center account (live on the portal's `main` since 2026-10-20; Buk signed in the same day). The app's first steps (sign-in, access check on every page, the People page, each person's access page, avatars, Add person with an invitation email, Forgot your password, Change password) are written and tested on a local database only. The two server functions `account-invite` and `account-recover` (`supabase/functions/`) are **not deployed to Friday**: they write Friday's Auth, so they wait for P Aek's agreement (`docs/apply-to-friday.md`, "Server functions"). Stack: Next.js on the NAS, address account.designally.co.
- **Company rules:** start every build from the Designally Brain (the Designally Brain connector, and the repo `designally-co/designally-brain`, file `CLAUDE.md`, "Building or changing an app from this repo").
- **Experiment vs switch** (Buk, 2026-10-19): build and test the experiment, but change nothing in use. No live app's sign-in changes, and nothing is written to Project Friday's Auth (account creation, blocking logins), until Buk and P Aek decide to switch (`docs/spec.md`, sections 1 and 7). Anything that touches HR or gives it rules is a prototype that changes nothing, until P Aek agrees.
- **Clients never get an account here.** The future client product has its own accounts, for clients and staff.
- **Project Friday belongs to P Aek.** Change nothing in it outside schema `account` without his agreement. Never write to HR's tables. HR's list is imported once (`account.import_from_hr()`, fields listed in `docs/spec.md`); after that Account Center's list is the real list and nothing reads HR's table again. People who leave are removed in Account Center, never erased.
- **No secrets and no personal data in this repo:** no passwords, keys, real names or real emails, not even as test data. Tests use made-up people.
- **Apps never read `account` tables.** They call the check functions only (`account.can_user`, `account.can_email`), with their own database user, which gets them only on the day that app starts using Account Center (`docs/spec.md`, "How an app checks access").
- **Every new function in schema `account` is revoked from public** in the same migration (`revoke execute on function ... from public`), then granted only to the users that need it. PostgreSQL makes new functions executable by everyone, and a per-schema default cannot change that. `test/run.sh` fails if any function in `account` is executable by everyone.
- **Every change to people or access goes through `withActor`** (`src/lib/actor.ts`): it runs one change at a time, checks again inside the transaction that the admin may still view and manage Account Center, and names the admin for the change log. Two exceptions: a person's own avatar, saved by `saveMyAvatar` (`src/lib/self.ts`), which takes the person from the signed-in account, never from the form, and changes nothing else; and the `account-invite` server function, which links a login to a person under the same lock, after the same view-and-manage check, and names the admin for the change log.
- **One-time links never leave the email**, except to the admin who needs to pass an invitation on by hand when the email could not be sent. Never log a link, and never put one in any other address or message. The server functions make links with Friday's master key; Account Center's own server never holds that key.
- **Every migration runs through `test/run.sh` first** (nothing outside `account` may change), then in Friday with the same guard as `docs/apply-to-friday.md`.
- **`brain.yaml`** is added when Account Center goes live. From then on, the rule below keeps it true.

# Decision notes for the Designally Brain

Before you finish a build session, write a note for each decision the session made, in `decisions/`, and commit it with the work. Do this without being asked; there is no approval step. Format and rules: `decisions/README.md`.

- A decision is a choice someone could later ask "why is it like this?" about: a library or service, the data shape, hosting and deploys, a rule users meet, an approach tried and dropped. Small fixes need no note.
- Read `decisions/` first. If a note already covers it, update that note.
- Never guess. Take facts only from sources: a link pinned to a commit, a file in this repo, or what the person said in the session ("Buk, 2026-10-07"). If the reason is not clear, ask the person once; if it is still unknown, leave `## Why` empty.
- Write `author: ai`. No secrets, passwords, client contact details or personal data.

# Keep `brain.yaml` true

`brain.yaml` at the repo root is how the Designally Brain knows what this app is and does. The Brain reads it from `main` every night, and nothing else updates it: the loader never edits it. So when a change makes anything in it untrue, update it in the same change, without being asked.

- Check it whenever a change touches what a person can do, what the app is for, its address, its stack, its tables or its links to other apps. Examples: a feature added, removed or hidden; a language turned off; a new table; a move to another database.
- Edit only what the change made untrue. Keep the rest exactly as it is, and leave `generated` alone (the person who merges the change checks the file).
- Format: `https://github.com/designally-co/designally-brain/blob/main/docs/brain-yaml.md`. Same rules as the notes: no guessing (unknown stays empty), no secrets, no personal data.
- Name the update in the pull request, so the reviewer checks it.
- Facts that live outside the code (a Portainer or Vercel setting, a release that went live) cannot be seen by the Brain. When the session learns one that matters later, write it in a decision note or in the right doc listed under `docs:` in `brain.yaml`.
- The Brain does not have to wait for the night. After the change is merged into `main`, a person can load it at once: in `designally-co/designally-brain`, open Actions, then **Brain loader**, then **Run workflow** on `main` with mode **load** (the default, `dry-run`, writes nothing). Search by meaning catches up a few minutes later. The AI cannot start it (GitHub refuses with 403). So when a session ends with a merged change the Brain should know about, tell the person they can run it now.
