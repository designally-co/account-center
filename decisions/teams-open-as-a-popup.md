---
title: A team opens as a popup that grows out of its card on the Teams page, not as its own page
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (each team page must be popup modal, not a page; when the user clicks the team in the teams page, show the small team card going bigger into a big popup modal)"
  - "Buk, 2026-11-03 (user must go inside first to add the team member)"
  - src/app/(main)/teams/team-board.tsx
  - src/app/(main)/teams/team-detail.tsx
  - src/app/(main)/teams/actions.ts
  - src/app/(main)/teams/[id]/page.tsx
---

## Context

Until 2026-11-03 each team had its own page (`/teams/<id>`): default access, members, name and description, Turn off. Adding members moved there from the cards the same day.

## Decision

- **A popup, not a page:** pressing a team's card on the Teams page opens the team as a popup over the list. Everything the team page held is in it, with Members first.
- **The grow:** the card and the popup share one framer-motion `layoutId`. The card's box grows into the popup and shrinks back into its place when the popup closes. The popup's words fade in after the box has grown, so they are never seen stretched. Motion follows the system's reduced-motion setting.
- **The address:**
  - The open team is in the address, `/teams?team=<id>`, changed with the browser's own history calls, so opening and closing ask nothing of the server.
  - Back closes the popup, and a link opens it.
  - A save inside it (a server action) comes back to the same address, so it stays open.
  - Old `/teams/<id>` addresses forward to it.
- **Data:** the Teams page loads every team's details and the people list once, so any popup opens at once.
- **Keyboard:** Escape closes the popup. If a people list or a confirmation inside it is open, Escape closes that first. Tab stays inside the popup, and focus goes back to the card after. While a card's team is open, the card stays as a hidden, inert copy that keeps its place in the grid.

## Why

Buk asked for each team to be a popup that grows out of its card (Buk, 2026-11-03).
