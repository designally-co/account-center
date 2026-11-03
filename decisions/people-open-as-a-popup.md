---
title: A person opens as a popup that grows out of their card on the People page; cards are centred
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (\"I want the person view to be like the team popup too with the transition\")"
  - "Buk, 2026-11-03 (\"make the employee card center aligned\")"
  - src/components/popup.tsx
  - src/components/send-kept.ts
  - src/app/(main)/people/people-browser.tsx
  - src/app/(main)/people/page.tsx
  - src/app/(main)/people/[id]/person-view.tsx
  - src/app/(main)/people/[id]/page.tsx
---

## Context

A person's details were their own page, `/people/<id>`. Since earlier the same day a team opened as a popup that grows out of its card (`decisions/teams-open-as-a-popup.md`). A team's popup has all its data on the Teams page already; a person's details are much bigger (every app with every action), so they cannot all be loaded with the People list.

## Decision

- **A person opens as a popup on the People page**, at `/people?person=<id>`. The card grows into the popup and shrinks back when it closes (framer-motion at first; GSAP since later the same day, `decisions/motion-with-gsap.md`). The browser's Back closes it, a save inside it comes back to the same address, and old `/people/<id>` links open it.
- **The popup appears at once.** It draws the face, the name, the email, the status and the app count from the People list straight away. The rest (`PersonView`, the old page's body) is read from the server for that one person only, with soft grey shapes until it arrives.
- **One popup for both pages:** `src/components/popup.tsx` (the grow, Escape, Tab kept inside, no page scroll behind, focus back on the card) is used by Teams and People.
- **A person's app page** (`/people/<id>/apps/<app>`) stays a page of its own; its back link opens the person's popup again.
- **Cards are centred** (face, name, primary team, any warning), with "Lead" still at the top right.
- **Separate cards, no big box** (later the same day, Buk's bug pass: "I see so many flow bugs and ui bugs and also ux bugs. fix them all"): the popup is a column of cards like a team's. The person's own card (face, name, primary and extra teams, email, a warning only when one is needed, Close) is the one that grows out of the card on the page; Details, Apps, Shared subscriptions and Remove each follow as their own card. Apps inside the Apps card are soft-filled tiles, not outlined cards inside a card. When the details arrive after the grey cards, the real cards rise in one after another.
- **Person cards are wider, with more room inside** (Buk, 2026-11-03: "widen the person card and add more padding so that the lead tag can have breathing room without stacking over the image. and remove the lead icon in the tag"): at least 280 px wide, more space above the face, and "Lead" is the word only, with no crown, on the card, in the popup and on a team's tiles. On a phone the cards sit two to a row.
- **Focus on opening:** opened from the keyboard, focus lands on Close with its ring; opened with a mouse or a finger, it lands on the popup itself with no ring, and Tab then reaches Close. Before, a mouse open showed a large ring on Close.
- **Forms that follow React state send themselves** (`sendKept`). React resets a form's fields once a `<form action>` has finished. Testing the popup showed that after saving a primary team the box read "No team", and the next save would have sent that. The Employment type, Primary team and Extra teams forms now send themselves, so nothing is reset; their Save button gets the busy state from `useActionState`. Extra teams are toggle buttons with hidden fields, not checkboxes.

## Why

Buk asked for the person view to work like the team popup, with the same transition, and for centred cards (sources); then for every flow, UI and UX bug to be fixed, and for wider person cards with a plain "Lead" tag. The way the popup gets its data, `sendKept`, the card layout of the popup and the focus rule are AI's choices while building (2026-11-03).
