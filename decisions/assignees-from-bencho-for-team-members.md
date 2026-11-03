---
title: A team's page adds and takes off members with Bencho's Assignees pill (MIT), on framer-motion and lucide-react
app: account-center
decided: 2026-11-02
author: ai
sources:
  - "Buk, 2026-11-02 (add the \"Assignees\" component from Bencho; it is MIT licensed, bencho.dev/licence; install framer-motion and lucide-react; map Bencho's design tokens to the project's own; keep the comments; use this for the team card adding team members)"
  - src/components/assignees.tsx
  - src/app/(main)/teams/team-members.tsx
  - src/app/(main)/teams/actions.ts
  - src/lib/teams.ts
  - src/app/globals.css
  - "Buk, 2026-11-03 (user must go inside first to add the team member)"
---

## Context

Before, a team's members could only be changed one person at a time, from each person's page ("Team"). A team's card on the Teams page showed its members' faces but could not change them.

## Decision

- **The component:** Bencho's "Assignees" (bencho.dev), given by Buk with its source and CSS under the MIT licence (bencho.dev/licence), is `src/components/assignees.tsx`, exported as `Assignees`. Bencho's comments are kept; each change for Account Center has an "In Account Center:" note beside Bencho's.
- **The licence notice:** the licence's copyright line could not be read in the build session (bencho.dev was not reachable from it), so the file names the licence and asks for the line to be added from bencho.dev/licence. The MIT licence asks for its notice to travel with the code.
- **Changes for a real page:**
  - The people come from a prop, with each person's own drawn avatar (Bencho's pictures are not licensed to travel).
  - It starts shut and closes on a press outside or Escape (Bencho's own note says a real interface wants that listener back).
  - `fit` drops Bencho's reserved 264 × 268 box, so the list floats over the cards below.
  - Past six faces the rest are a "+N", so a big team still fits in its card.
  - Motion follows the system's reduced-motion setting (`MotionConfig reducedMotion="user"`).
- **Two new packages:** `framer-motion` (the springs) and `lucide-react` (the check and chevron icons), as Bencho's code uses them.
- **Bencho's design tokens:** they are mapped on the component's own root (`.pik`), never as globals.
  - `--card` and `--fill-slab` become `--surface`; `--fill-on` and `--ink` become `--fg`; `--pane-edge` becomes `--outline-strong`.
  - `--fill-on-rgb` and `--ink-rgb` are `--fg`'s numbers for light and dark, comma-separated, because Bencho's CSS builds `rgba(var(...), 0.45)`.
  - `--font-ui` names the app's Inter stack, which the app sets on `:root` without a variable.
  - Bencho's `.rst-at` rule styles a different Bencho block and was not copied.
  - The app's own button look is kept off the pill and the rows.
  - In a page, the floating list gets a soft shadow and scrolls past about seven people.
- **On a team's own page** (first on each card of the Teams list, 2026-11-02; moved inside the team's page on 2026-11-03, because Buk wants people to open the team first to add a member): an admin sees the pill next to "Members" on an active team, with a list of every active person and their current team ("In this team", "In Digital: moves here", "No team").
  - Ticking someone runs `addToTeam`: it puts them in this team, moving them out of their old one, and not as lead. Ticking someone already in the team changes nothing, so a lead stays a lead.
  - Unticking runs `takeOffTeam`: it removes them from this team only. If another admin moved them meanwhile, they stay where they are.
  - Both run through `withActor` like every other change, and the page refreshes after each save.
  - Turned-off teams, and people who may only view, see the members list only. The cards on Teams show the members' faces and open the team's page.
- **Avatars are drawn in the browser:** the team's page gets each person's small avatar choices, not the drawn pictures. A picture is about 23 KB and the list holds everyone.

## Why

Buk asked for this component and for it to be used to add team members (Buk, 2026-11-02), from inside the team's page (Buk, 2026-11-03). The reasons for the changes are in the "In Account Center:" notes in the code.
