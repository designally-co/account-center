---
title: Account Center runs on Vercel first, not on the NAS, while only the portal and MA Desk use it
app: account-center
decided: 2026-10-20
author: ai
sources:
  - "Buk, 2026-10-20 (\"deployed it on vercel first as I will only use it with the portal and ma desk apps\"; \"it is already deployed on vercel\")"
  - "Project Friday, read-only check 2026-10-20 through the Supabase connector: account_app has its login (connection limit 10) and one open session; a person saved an avatar through the app at 11:16 Bangkok time"
  - decisions/stack-nextjs-on-nas.md
  - docs/deploy-nas.md
  - "Buk, 2026-11-02 (\"I clicked a button and I need to wait too long\"; Vercel's Function Region showed iad1; changed to Singapore, redeployed: \"it's faster now\")"
  - "Project Friday, read-only check 2026-11-02 through the Supabase connector: region ap-southeast-1 (Singapore); account_app statements about 9 ms on average, portal_check about 2 ms (pg_stat_statements)"
---

## Context

`stack-nextjs-on-nas.md` put the Account Center app on the Designally NAS, from a `release-*` image in Portainer, like MA Desk and Buk's other apps, and `docs/deploy-nas.md` describes that release. On 2026-10-20 the only app asking Account Center was the Brand Guideline Portal, which runs on Vercel.

## Decision

- **For now Account Center runs on Vercel**, in Buk's personal (Hobby) Vercel account, built from `main` of `designally-co/account-center`. The NAS release (`docs/deploy-nas.md`, the image built by `.github/workflows/release.yml`) stays ready and unused.
- Settings in Vercel: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `DATABASE_URL` for the user `account_app` through Friday's **shared transaction pooler** (Supabase's Connect, "Use IPv4 connection"), because Vercel cannot reach Friday's IPv6-only addresses. The app already turns prepared statements off, which that pooler needs.
- **Function Region: Singapore (`sin1`)** since 2026-11-02, next to Friday (`ap-southeast-1`). Vercel's default was Washington, D.C. (`iad1`): one click makes several database trips one after another, each crossing the Pacific (about 0.2 s), so buttons were slow while the database itself answered in milliseconds. The Hobby plan allows one region; a change needs a new deployment.
- The address is Vercel's own for now; account.designally.co comes later, with a DNS change P Aek is told about first.

## Why

Buk will use Account Center only with the portal and MA Desk for now, and deployed it on Vercel first (Buk, 2026-10-20).

## Watch

Vercel's Hobby plan limits deployments from private repositories owned by a GitHub organization (Vercel community answers, 2026). This one deployed; if a later commit does not appear on Vercel, the build was likely refused for that reason, and a person starts it again in Vercel or the app moves to the NAS release.
