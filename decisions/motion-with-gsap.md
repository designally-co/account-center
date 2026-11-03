---
title: The app's motion runs on GSAP and its Flip plugin; popups grow out of their cards and shrink back
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"I see you remove the growing card effect. use that effect in all possible way. every transition must have smooth animation and so on.\"; \"use GSAP motion\")"
  - src/components/motion.ts
  - src/components/popup.tsx
  - src/components/dialog-motion.tsx
  - src/app/(main)/teams/team-detail.tsx
  - src/app/(main)/teams/team-apps.tsx
  - package.json
---

## Context

The team popup and the person popup grew out of their cards with framer-motion's shared layoutId. When the team popup became separate cards with a "liquid" accordion (one LayoutGroup with its own id around the whole popup), that group renamed the popup card's layoutId, so it no longer matched the Teams page card and the grow effect stopped; measured on 2026-11-03: the team's card appeared at full size at once. Windows (<dialog>) opened with a CSS animation and closed at once.

## Decision

- **GSAP 3.15.0 with its Flip plugin** (and `@gsap/react` 2.1.2) is the app's motion library; `framer-motion` was removed. GSAP is free to use, also commercially, under its standard licence (the one limit is a tool that competes with Webflow, which Account Center is not). Shared pieces: `src/components/motion.ts` (one family of eases, reduced-motion, `boxOffset`, `closeDialog`).
- **Popups grow out of their cards and shrink back** (`Popup`): the card carries `data-grow`; the box that grows is the popup's panel, or in a stack popup the card marked `data-grow-target`. It starts as the card's box and grows into place (expo out, about 0.6 s); its words fade in after; the popup's other cards rise in one after another. Closing runs it backwards: the words fade, the other cards sink away, the box shrinks back into the card, which then shows its words again. Used by Teams and People (cards, and the People list's rows).
- **The accordion and the faces** (team popup): GSAP's Flip notes every marked part (`data-flip-id`: the team's card, each face, each app card and row) just before an app opens or closes, and slides each one to its new place in one ease, so the cards split or join, the tiles shrink into faces or grow back, and the column re-centres together. The open app's rows come in one after another; the chevron turns.
- **Going straight from one open app to another** first joins the cards (about 0.3 s), then splits them around the new app, so the two moves never cross over each other (they did, for a moment, when both ran at once; found in the bug pass, 2026-11-03).
- **Windows close softly**: every `.modal` dialog fades and sinks a little before it closes, on its own buttons and on Escape (`DialogMotion` in the root layout); they keep their CSS opening.
- Reduced motion (the system setting) turns the moves into short fades.

## Why

Buk asked for the grow effect everywhere it fits, smooth motion in every transition, and GSAP (sources). Which parts got which motion is AI's choice while building (2026-11-03).
