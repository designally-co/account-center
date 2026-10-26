---
title: Shared subscriptions are listed in Account Center as tools, with who may use them, never with a password
app: account-center
decided: 2026-10-26
author: ai
sources:
  - "Buk, 2026-10-26, in a comment on the Account Center preview (\"the people will share the company mail for subscription access like claude, chat gpt, magnific and so on. they use their personal mail for HR\")"
  - "Buk, 2026-10-26 (asked to choose between hiding Work emails and keeping them with a separate list of shared subscriptions: \"do b but build the separate section now\")"
  - supabase/migrations/20261026100000_shared_subscriptions.sql
  - src/lib/subscriptions.ts
---

## Context

Account Center finds a person by their HR email, which is personal, and can also know a person's own work emails (`account.person_emails`, one person per address). Designally's team shares company logins for paid tools such as Claude, ChatGPT and Magnific. A shared address added as one person's work email would make every app treat it as that one person.

## Decision

- **A shared login is a tool, not a person.** Shared subscriptions get their own list (`account.subscriptions`): the tool, its shared login email, plan, sign-in address and renewal date, and who may use it (`account.subscription_members`). Work emails stay for addresses that belong to one person.
- **No passwords, ever.** There is no password field and no free-text field where one could be pasted; the screens say the password stays in the company's password manager. Only Account Center's server reads these tables; no app does.
- **Leaving people stay listed** on a tool until an admin takes them off, and both the tool's page and the person's page say to change that password first.
- **Each person sees their shared tools** and the shared email on Home, so they know which login to use.

## Why

People use personal emails for HR and share company logins for subscriptions, and Buk chose to keep Work emails and build a separate section for shared subscriptions now (Buk, 2026-10-26). Passwords stay out because Account Center must hold no secrets (AGENTS.md: no passwords or keys).
