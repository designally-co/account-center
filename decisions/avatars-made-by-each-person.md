---
title: Each person makes their own drawn avatar at first sign-in, stored as their choices
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (do not use a gradient circle for the profile; use a customizable avatar like Notion's avatar maker in the account creation step, to make it fun in the office)"
  - "@dicebear/notionists 9.4.3, LICENSE: drawings by Zoish, CC0 1.0; code MIT"
  - src/lib/avatar.ts
  - src/lib/self.ts
  - src/app/avatar/maker.tsx
  - supabase/migrations/20261019113000_avatars.sql
---

## Decision

- People have drawn avatars in the Notion style: the "Notionists" drawings (Zoish, CC0) drawn by the DiceBear library (MIT), inside the app, with no outside service. Apps keep their gradient orbs.
- The avatar maker shows a big preview, "Surprise me", one tab per part and a grid of choices. It opens the first time a person signs in ("Welcome, Ann"; "Later" skips it on that browser); account creation is not built yet (it waits for the switch), and the maker becomes a step of it then. Home has "Edit" to change it later.
- The avatar is stored as the person's choices in `account.people.avatar`, never as an image. The server accepts only known parts and values; the database limits shape and size. Until a person makes one, a stable starting face is made from their id.
- Only the person changes their own avatar, through their signed-in account (`saveMyAvatar`); the change is logged. An unchanged avatar is not written again, and saves are limited to one every few seconds, so nobody can fill the change log (found by an independent review, 2026-10-19).
- So that everyone can make one, every active company person with a working login can now sign in to Account Center and see Home (their avatar and their own access). The People pages still need Account Center's view right.

## Why

Buk asked for a customizable avatar like Notion's avatar maker, made in the account creation step, to make it fun in the office (Buk, 2026-10-19). The Notionists drawings match that style and are free to use for anything (CC0). Storing choices instead of images keeps the data small and structured, and needs no file storage.
