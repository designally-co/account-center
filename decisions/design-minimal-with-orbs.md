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
  - "Buk, 2026-10-19 (do not use a gradient circle for the profile; use a customizable avatar like Notion's avatar maker)"
---

## Decision

- Black and white with soft grey surfaces, rounded cards and pill-shaped buttons and menus; dark mode follows the system.
- The Inter font, shipped inside the app (`@fontsource-variable/inter`), so pages load no outside fonts.
- Playful elements: a soft gradient orb for each app, with colours taken from its key, so the same app always looks the same (the orb turns a little on hover; the sign-in orb turns slowly), and each person's own drawn avatar (`decisions/avatars-made-by-each-person.md`). Motion stops when the system asks for reduced motion.
- Short labels only, no helper paragraphs. Each access row is the action's name and an allowed/blocked switch with a sliding thumb.
- Adding and removing work emails moved from the People table to each person's page, so the table only lists people.

## Why

Buk asked for a minimal, modern and intentional design like ElevenLabs, and for simple access rows without extra explaining (Buk, 2026-10-19).
