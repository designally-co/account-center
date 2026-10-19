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
  - "Buk, 2026-10-19 (a design reference of two screenshots, a page of cards and a dialog: use the exact colours, surface, layer, modal, bg, outline, shadow)"
---

## Decision

- Black and white with soft grey surfaces and rounded cards; dark mode follows the system.
- The light colours come from Buk's design reference (2026-10-19), measured from the screenshots' pixels: page `--bg` #f8f8f8, cards `--surface` #ffffff, soft fills `--layer` #f3f3f3, dialog `--modal` #f8f8f8 on a 30% black `--overlay`, card edge `--outline` #f0f0f0, edge inside a dialog and between rows `--outline-strong` #e9e9e9, text #111111, card text #484848, quiet text #6d6d6d, button #1a1a1a, link #1880e3. Cards have an outline and no shadow (`--shadow: none`); only a dialog has one. The screenshots were lossy (WebP), so a value can be one or two steps off. Corners follow the reference too: 16px cards, 10px inner cards and tiles, 8px buttons, fields and menus; tags and the allowed/blocked switch stay pill-shaped.
- Values the reference does not show are ours: field borders `--input-outline` #dcdcdc (a field must stay visible), green and red, and all of dark mode. The soft coloured glow at the top of every page was removed, because the reference page is plain.
- The Inter font, shipped inside the app (`@fontsource-variable/inter`), so pages load no outside fonts.
- Playful elements: a soft gradient orb for each app. Its main colour is stored as data (`account.apps.hue`, set for the 7 apps in migration 20261019110000, spread around the colour wheel so apps are easy to tell apart; Account Center's 190 is also the brand mark); the key only adds the neighbouring colours, and the main one when no hue is set. The orb turns a little on hover; the sign-in orb turns slowly. Also and each person's own drawn avatar (`decisions/avatars-made-by-each-person.md`). Motion stops when the system asks for reduced motion.
- Short labels only, no helper paragraphs. Each access row is the action's name and an allowed/blocked switch with a sliding thumb.
- Adding and removing work emails moved from the People table to each person's page, so the table only lists people.
- Home shows one card per app the person can use; the card opens the app (`account.apps.url`) and shows the app's own graphic (`account.apps.icon`), or its orb when there is none yet (Buk, 2026-10-19: "people must be able to go to different apps they have access to in their home page and use the app graphic instead of the orb"; "use cards instead of lists"). The graphics known today are Article Studio's (`article-studio/src/app/icon.png`) and HR's (`friday-hr/web/public/logo-character.svg`), copied into `public/apps/`; the Hub, the survey, the brand portal and MA Desk have none in their code yet.

## Why

Buk asked for a minimal, modern and intentional design like ElevenLabs, and for simple access rows without extra explaining (Buk, 2026-10-19).
