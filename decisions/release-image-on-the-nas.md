---
title: Account Center ships as a tested image from GHCR, run by a Portainer stack on the NAS behind Caddy
app: account-center
decided: 2026-10-19
author: ai
sources:
  - decisions/stack-nextjs-on-nas.md
  - "designally-co/article-studio, docs/deploy-nas.md and .github/workflows/release.yml (the same pattern)"
  - "Buk, 2026-10-19 (stage 1.5: put Account Center online at account.designally.co on the NAS; Buk sets it up in Portainer)"
  - .github/workflows/release.yml
  - deploy/compose.production.yml
  - docs/deploy-nas.md
---

## Decision

- `.github/workflows/release.yml` builds a linux/amd64 image on every pull request and starts it against a throwaway PostgreSQL 17 with schema `account`, as `account_app`, checking `/api/health` (with the commit) and the sign-in redirect. A `release-*` tag on `main` pushes the tested image to `ghcr.io/designally-co/account-center:sha-<commit>`; never `latest`.
- `deploy/compose.production.yml` is the Portainer stack: container `account-center` on `caddy_default`, no published ports, three stack variables (`IMAGE_TAG`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`).
- The container never changes the database. Migrations are applied to Friday separately, with the guard, before the release that needs them.

## Why

It is the pattern Article Studio already uses on the same NAS, so the release steps and the Portainer setup are the same for Buk.
