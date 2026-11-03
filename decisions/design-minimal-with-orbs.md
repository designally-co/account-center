---
title: Account Center's design is minimal black and white, with a drawn avatar per person and small motion that answers what people do (the gradient orbs were removed on 2026-11-02)
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
  - "Buk, 2026-10-19 (the role and '2 of 3' count on Home: do not need that as it is a pain for employees; instead use the app description)"
  - "Buk, 2026-10-19 (the descriptions are too long, follow the Manus reference; since almost all apps will have the same logo or favicons, use the same concept as the Manus reference, showing what it does)"
  - supabase/migrations/20261019140000_app_cards.sql
  - public/apps/art/
  - "Buk, 2026-10-19 (do not use the status like this, use toast; the toast must be light theme too)"
  - "Buk, 2026-10-19 (the people page: people in a grid of cards by default, do not remove the list view)"
  - "Buk, 2026-10-19 (I don't like the name \"kind\", change it)"
  - src/components/toast.tsx
  - "Buk, 2026-10-19 (do not let the admin delete people from the list or grid view; they must go inside each one and delete)"
  - "Buk, 2026-10-19 (a design reference of two screenshots, a page of cards and a dialog: use the exact colours, surface, layer, modal, bg, outline, shadow)"
  - "Buk, 2026-11-02 (find the best UX for the whole site; think about how the user will use it while making the app look interesting with microinteractions)"
  - "Buk, 2026-11-02 (I don't want to use the orb)"
  - "Buk, 2026-11-02 (I clicked a button and I need to wait too long)"
  - "Buk, 2026-11-03 (I don't want the header bar, use a minimal side bar like this, with a screenshot of an icons-only sidebar)"
  - src/components/mark.tsx
  - src/components/app-icon.tsx
  - src/components/nav.tsx
  - src/app/(main)/layout.tsx
---

## Decision

- Black and white with soft grey surfaces and rounded cards; dark mode follows the system.
- The light colours come from Buk's design reference (2026-10-19), measured from the screenshots' pixels: page `--bg` #f8f8f8, cards `--surface` #ffffff, soft fills `--layer` #f3f3f3, dialog `--modal` #f8f8f8 on a 30% black `--overlay`, card edge `--outline` #f0f0f0, edge inside a dialog and between rows `--outline-strong` #e9e9e9, text #111111, card text #484848, quiet text #6d6d6d, button #1a1a1a, link #1880e3. Cards have an outline and no shadow (`--shadow: none`); only a dialog has one. The screenshots were lossy (WebP), so a value can be one or two steps off. Corners follow the reference too: 16px cards, 10px inner cards and tiles, 8px buttons, fields and menus; tags and the allowed/blocked switch stay pill-shaped.
- Values the reference does not show are ours: field borders `--input-outline` #dcdcdc (a field must stay visible), green and red, and all of dark mode. The soft coloured glow at the top of every page was removed, because the reference page is plain.
- The Inter font, shipped inside the app (`@fontsource-variable/inter`), so pages load no outside fonts.
- **No orbs** (Buk, 2026-11-02: "I don't want to use the orb"). Account Center's mark is a keyhole in a tile in the text colour (`src/components/mark.tsx`), in the bar and on the sign-in pages; while signing in, the keyhole turns. An app without its own graphic shows its first letter on a soft tile in the app's colour (`account.apps.hue`, `src/components/app-icon.tsx`). Each person keeps their own drawn avatar (`decisions/avatars-made-by-each-person.md`).
- **Motion answers what a person does** (Buk, 2026-11-02: microinteractions): quick, ease-out, never bouncing, and all of it stops when the system asks for reduced motion. The highlight under the current page slides to the next one; a thin progress line runs under the bar from the click until the next page is on screen; saving buttons show a small turning ring; cards in a list arrive one after another; dialogs and the account menu grow in; a count that changes bumps; Copy turns into a tick; the plus on the visible/hidden button turns as you point at it.
- Short labels only, no helper paragraphs. Each access row is the action's name and an allowed/blocked switch with a sliding thumb.
- Adding and removing work emails moved from the People table to each person's page, so the table only lists people.
- Home shows one card per app the person can use; the card opens the app (`account.apps.url`) and shows the app's own graphic (`account.apps.icon`), or its first letter when there is none yet (an orb until 2026-11-02) (Buk, 2026-10-19: "people must be able to go to different apps they have access to in their home page and use the app graphic instead of the orb"; "use cards instead of lists"). The graphics known today are Article Studio's (`article-studio/src/app/icon.png`) and HR's (`friday-hr/web/public/logo-character.svg`), copied into `public/apps/`; the Hub, the survey, the brand portal and MA Desk have none in their code yet.
- Each Home card is laid out like the cards in Buk's design reference: the app's name, one short line about what it does (`account.apps.description`, at most 60 characters, shortened from each app's own description: its brain.yaml purpose, the portal's README, MA Desk's brief), and on the right a small picture of what the app does (`account.apps.art`, an SVG under `public/apps/art/`, drawn for Account Center on 2026-10-19), because most apps would otherwise show the same Designally logo. No arrow. Both are data, set in migration 20261019140000. It does not show the person's role or the "2 of 3" action count, which mean little to an employee (Buk, 2026-10-19). Admins still see both on each person's page.

- **Toasts for success:** a success message (Avatar saved, Saved, Invitation sent, Password saved, Removed) is a small light toast at the bottom of the screen that goes away after about 4 seconds (`src/components/toast.tsx`). Errors stay next to what they are about, because people need time to read them and act. A message that came in the address is taken out of it, so a reload does not show it again.
- **People as cards by default:** the People page shows a grid of person cards (avatar, name, email, status, employment type, number of apps); a Grid / List switch keeps the table one click away (`?view=list`). Neither view can remove anyone: **Remove** is only at the bottom of each person's page, behind a confirm step, and never on your own page.
- **Built around how people use it** (Buk, 2026-11-02, after a review of every page as an admin and as a team member):
  - The navigation stays on every signed-in page (it lives in the shared layout `src/app/(main)/layout.tsx`, not in each page). Since 2026-11-03 it is a slim rail of icons on the left instead of a bar on top (Buk: "I don't want the header bar, use a minimal side bar", with a reference of an icons-only sidebar whose icons show a dark label and a shortcut on hover): the mark at the top; Home, People, Teams, Subscriptions and your avatar in the middle; a soft square behind the current page that slides to the next; a dark label with the name and key (Alt or ⌥ with 1 to 4) on hover; on a phone the same icons along the bottom. Your avatar opens a menu: Your avatar, Change password, Sign out (`src/components/nav.tsx`).
  - People: a search box (name, email, work email, team; "/" jumps to it) and Active / Removed / All, Active first, because an admin comes to find one person.
  - A person's page shows Apps before shared subscriptions, because access is what the admin came for.
  - Home: each shared tool has Copy (the shared email) and Open, because that is what a person does with it.
  - Teams and Subscriptions: "New team" and "Add subscription" open a dialog from the top of the page, so the list stays the page; an error about the new name shows inside the dialog, which opens again by itself.
  - Taking something away asks first, in the same dialog everywhere: Remove (a person), Turn off (a team, a subscription). They sit at the bottom of their page. Remove also says how many shared logins the person knew.
  - A team's default role shows Save only after a change, like the other rows.
  - A renewal two weeks away or less is marked in amber, a passed one in red.
- **"Employment type", not "kind":** the screens say "Employment type" (values Employee and Outsource). The database keeps its internal name `kind`, so nothing else changes.

## Why

Buk asked for a minimal, modern and intentional design like ElevenLabs, and for simple access rows without extra explaining (Buk, 2026-10-19). On 2026-11-02 Buk asked for the best UX for the whole site, thought through from how people use it, with microinteractions, and for no orb.
