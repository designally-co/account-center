---
title: Account Center's design is minimal black and white, with a soft gradient orb per app and a drawn avatar per person
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (make sure the design is minimal, modern and intentional, interesting and exciting, like ElevenLabs)"
  - "Buk, 2026-10-19 (access rows simple, like ClickUp's tool permissions; no extra explaining)"
  - src/app/globals.css
  - src/components/orb.tsx
  - supabase/migrations/20261019110000_kinds_and_access_lists.sql (account.apps.hue)
  - "Buk, 2026-10-19 (do not use a gradient circle for the profile; use a customizable avatar like Notion's avatar maker)"
  - "Buk, 2026-10-19 (Home: go to the apps from cards, with the app graphic instead of the orb)"
---

## Decision

- Black and white with soft grey surfaces, rounded cards and pill-shaped buttons and menus; dark mode follows the system.
- The Inter font, shipped inside the app (`@fontsource-variable/inter`), so pages load no outside fonts.
- Playful elements: a soft gradient orb for each app. Its main colour is stored as data (`account.apps.hue`, set for the 7 apps in migration 20261019110000, spread around the colour wheel so apps are easy to tell apart; Account Center's 190 is also the brand mark); the key only adds the neighbouring colours, and the main one when no hue is set. The orb turns a little on hover; the sign-in orb turns slowly. Also and each person's own drawn avatar (`decisions/avatars-made-by-each-person.md`). Motion stops when the system asks for reduced motion.
- Short labels only, no helper paragraphs. Each access row is the action's name and an allowed/blocked switch with a sliding thumb.
- Adding and removing work emails moved from the People table to each person's page, so the table only lists people.
- Home shows one card per app the person can use; the card opens the app (`account.apps.url`) and shows the app's own graphic (`account.apps.icon`), or its orb when there is none yet (Buk, 2026-10-19: "people must be able to go to different apps they have access to in their home page and use the app graphic instead of the orb"; "use cards instead of lists"). The graphics known today are Article Studio's (`article-studio/src/app/icon.png`) and HR's (`friday-hr/web/public/logo-character.svg`), copied into `public/apps/`; the Hub, the survey, the brand portal and MA Desk have none in their code yet.

## Why

Buk asked for a minimal, modern and intentional design like ElevenLabs, and for simple access rows without extra explaining (Buk, 2026-10-19).
