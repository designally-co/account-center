---
title: New people get an email invitation from Account Center, and everyone can reset and change their own password, through two server functions in Friday
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (the admin must be able to create the account (new employee's Google account) and the employee can accept the account creation and go to the account center to set up the avatar and they can also reset password)"
  - "Buk, 2026-10-19 (chose: the admin types the employee's Google email; they get an invite email, set a password, make the avatar, and can reset the password by email)"
  - supabase/functions/_shared/core.ts
  - src/app/people/new/page.tsx
  - src/app/accept/page.tsx
  - src/app/password/actions.ts
  - supabase/migrations/20261019130000_invitations.sql
  - docs/spec.md (section 3, "Creating an account in Account Center" and "Passwords")
  - friday-hr supabase/functions/_shared/mail.ts (HR's server functions send email through Resend; sender agreed with P Aek)
---

## Decision

- An admin presses **Add person**, types the name, the person's **Google email** and their kind. Account Center saves the person, then the server function `account-invite` links an existing login with that email (no email), or makes an invited login and **emails the invitation**.
- The person presses **Accept the invitation** on `/accept`, chooses a password, makes their avatar and lands on Home. **Forgot your password?** (server function `account-recover`) and **Change password** on Home cover passwords.
- Both server functions live in Project Friday and send email through **Resend**, like HR's server functions. They do not use Friday's Auth email templates or SMTP sender, so Friday's shared Auth settings stay as they are.
- `/accept` uses the link only when the person presses the button, not when the page opens.
- After a link, the person may choose a password without the old one for 30 minutes; Account Center reads this from Friday's signed sign-in token ("amr", method `otp`, with its time), not from a cookie or the form.
- The People page shows **Invited** (`account.login_state`) until the person accepts; **Send again** at most once a minute.
- When the email cannot be sent, the admin gets the invitation link to pass on by hand, the way HR's invite link works.
- Built and tested locally (Deno running the real functions, a local Friday Auth, a stand-in inbox). **Not deployed to Friday**: it writes Friday's Auth, which waits for P Aek's agreement (AGENTS.md, "Experiment vs switch").

## Why

Buk asked for admins to create accounts for new employees with their Google email, for employees to accept, set up their avatar, and reset their password (Buk, 2026-10-19).

- **Server functions:** the design already said account creation goes through a small function in Friday, so Account Center's server never holds Friday's master key (`docs/spec.md`, section 3, written 2026-10-14).
- **Resend, not Friday's Auth emails:** HR already sends its emails through Resend from its own server functions, with a sender agreed with P Aek (friday-hr `supabase/functions/_shared/mail.ts`). Changing Friday's Auth email templates would change them for every app that uses Friday's Auth; Recruit has its own sign-in callback (designally-recruit `src/app/auth/callback/route.ts`), so that change could affect it.
- **A button on `/accept`:** email scanners open links on their own; a link used on page load could be used up before the person sees it.
- **The token's sign-in method instead of a cookie:** checked locally on 2026-10-19, Friday's Auth (GoTrue v2.179.0) writes `amr: [{method: "otp", timestamp}]` after an email link and `method: "password"` after a password sign-in, and the token is signed, so the server can trust it without a new secret.
- **Forgot password always answers the same:** so nobody can use it to learn which emails have an account.
