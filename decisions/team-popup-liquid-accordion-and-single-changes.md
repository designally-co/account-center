---
title: A team's popup shows its people as tiles and its default access as a liquid accordion, with single changes per action
app: account-center
decided: 2026-11-03
author: ai
sources:
  - "Buk, 2026-11-03 (his layout for a team, collapsed and expanded: \"I want the team to behave like this with fluid transition between the collapse expand transition. something like this microinteraction called liquid accordion\", Morphin's stacked liquid accordion)"
  - "Buk, 2026-11-03 (\"this is the card view in the catalog page\": the team's name large, its description and a row of faces)"
  - "Buk, 2026-11-03 (\"the icons the text and so on are just draft, I show you the interaction and layout, use the best icons and text\")"
  - "Buk, 2026-11-03 (answer to Claude's question: a team's access is a ready role plus single changes, the same as a person's)"
  - "Buk, 2026-11-03 (\"I want the view to be separated containers not inside one big container\")"
  - "Buk, 2026-11-03 (\"you need to fix the typography and hirearchy and so on as it looks too big and popup must be in the center middle. and add people must be in the more action. in more there are edit info (to change team name and desc), add people, delete team\"; \"do not use shadow\"; \"I want to remove all contaienr outlines\")"
  - supabase/migrations/20261103120000_team_actions.sql
  - src/app/(main)/teams/team-detail.tsx
  - src/app/(main)/teams/team-apps.tsx
  - src/app/(main)/teams/team-board.tsx
---

## Context

A team's popup listed its members, then a ready role per app in a menu, then a name form. Buk drew a new layout: the team's name and description with a "…" button, its people as tiles, and its apps as an accordion where the open app shows one allow/block switch per action; opening an app shrinks the people into a row of faces. A team could only give a ready role per app, not single actions. morphin.dev could not be opened from Claude's session, so the motion was built from Buk's pictures.

## Decision

- **Single changes for a team** (migration `20261103120000`): `account.team_actions` keeps, per team and action, allowed or blocked. `account.team_allows` answers for one team: its single change first, else its role. `account.base_allows` asks it for every team the person is in, so the bigger access still wins. Choosing a ready role again clears the team's single changes in that app. A team never gives an Account Center action (the table refuses it, the check ignores it).
- **Separate cards, no big box** (Buk, 2026-11-03): the popup is a column of separate cards floating over a soft, blurred veil of the page. The team's card on top is the Teams page's card grown bigger (they share one layoutId); the apps' cards follow under it. Shared code: `Popup` with `stack` (`src/components/popup.tsx`).
- **The popup:** the name and description, a "…" menu (Edit name and description, in a small window), the people as tiles (face, name, email for those who may view Account Center, a Lead badge), the member picker for an admin, and, for an admin only, **Default access** as a stacked "liquid" accordion.
- **The motion** (on framer-motion until later the same day; GSAP since, `decisions/motion-with-gsap.md`): closed, the apps sit in one card. Opening one splits the card into separate cards (the apps above, the open app, the apps below) that slide apart in one spring (framer-motion layout animations in one LayoutGroup for the whole popup), and the people's tiles shrink into a row of overlapping faces. Closing melts them back. The open app shows a ready-role menu and one round allow/block pair per action; every switch saves at once (no Save button), shows "Changed" when it differs from the role, and the app's line says "+ changes".
- **Polish** (Buk, 2026-11-03): smaller type with a clear order (the team's name 20px, its description and labels muted and small, tiles with 48px faces), the column of cards in the middle of the window (at the top when taller, then it scrolls), and **no shadows and no outlines** on the Teams page cards and on the team's cards, menu and windows: a card is its surface on the soft veil, and what sits inside a card (the people's tiles, the menu) gets a soft grey fill instead of a line. The thin dividers between rows stay. The "…" menu holds **Edit info** (name and description), **Add people** (a window with everyone and Add or Remove; someone in another team joins as an extra team) and **Delete team** (after a question; anyone for whom it was the primary team gets their oldest other team as primary, then the team, its members, default roles and single changes go; the change log keeps them). The member picker pill left the popup.
- **The Teams page card** is the team's name large, its description and a row of faces; the default access line left the card.
- **Fixed on the way:** the popup's title area covered its Close button, so it could not be pressed; Close now sits above it. The edit window closes once a save comes back.

## Why

Buk asked for this layout and motion, and chose a ready role plus single changes (sources). The words, icons (lucide), spring values and the place of the member picker are AI's choices while building (2026-11-03), as Buk asked.

## Changed later the same day

- **Ready roles are gone from the popup** (`decisions/no-ready-roles-on-off-switches.md`): the open app shows one plain on/off switch per action.
- **The accordion is now one list moved by CSS** (Buk: "the animation looks broken and not seamless"): the apps no longer re-group into separate cards; the open app gets a gap above and below and rounded corners, its neighbours round off too, and its height opens with a grid-row transition. Opening, closing and going straight to another app are one smooth move with nothing to overlap. GSAP's Flip now only moves the team's card and the faces when the first app opens or the last closes, and the popup stops re-centring once an app is opened, so nothing above the open app jumps.
- **Roomier people tiles** ("the employee card in the team modal is too tight"), the page colour as their fill, a darker "…" menu with no shadow ("the more dropdown looks dirty"), and "Add app" in the menu (`decisions/team-app-list.md`).
- **Cards lift a little under the pointer** instead of turning grey ("the hover stage looks dirty"); **scroll bars are thin and round** ("the scroll bar need simplicity with round ends"); **the veil behind a popup is darker** with a light blur ("too blur and white, make it darker so that the white container pop up").

