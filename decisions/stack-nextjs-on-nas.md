---
title: The Account Center app is a Next.js app hosted on the Designally NAS, like MA Desk
app: account-center
decided: 2026-10-14
author: ai
sources:
  - "Buk, 2026-10-14 (use Next.js on the NAS like MA Desk)"
  - "designally-co/ma-desk, decisions/stack-nextjs-drizzle-on-nas.md: MA Desk is Next.js with Drizzle on the NAS"
  - "designally-co/designally-brain CLAUDE.md, 2026-10-14: the Hub, Studio and the survey run on the Designally NAS from a release-* image, set in Portainer"
  - decisions/schema-as-plain-sql.md
---

## Decision

The Account Center app is a Next.js app. It runs on the Designally NAS from a `release-*` image, set in Portainer, like MA Desk and Buk's other apps. Its database tables stay in the plain SQL migrations of schema `account`; the app does not create or change them. Its address is not decided yet.

## Why

Buk chose the same stack as MA Desk (Buk, 2026-10-14).
