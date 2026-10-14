# Account Center

Account Center holds every account and all access across the Designally ecosystem. A person's roles here decide which apps they can open (HR, Article Studio, the Knowledge Hub, the survey, MA Desk and the rest) and what they may do in each. It was called the "front desk" until Buk named it on 2026-10-14.

- **Spec:** `docs/spec.md`. Read it before building, and keep it true in the same change as the work.
- **Status:** nothing live. The database part (schema `account` in Project Friday) is written and tested on a local database only; applying it to Friday waits for P Aek.
- **Company rules:** start every build from the Designally Brain (the Designally Brain connector, and the repo `designally-co/designally-brain`, file `CLAUDE.md`, "Building or changing an app from this repo").
- **Real now vs prototype:** access for Buk's apps (MA Desk, Article Studio, the Knowledge Hub, the survey, the brand guideline portal) and account creation are real. Anything that touches HR or gives it rules is a prototype that changes nothing, until P Aek agrees.
- **Project Friday belongs to P Aek.** Change nothing in it outside schema `account` without his agreement. Never write to HR's tables. Read from HR only the fields listed in `docs/spec.md` (ids, name, email, active, login blocked).
- **No secrets and no personal data in this repo:** no passwords, keys, real names or real emails, not even as test data. Tests use made-up people.
- **Apps never read `account` tables.** They call the check functions only (`account.can_user`, `account.can_email`), with their own database user.
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
