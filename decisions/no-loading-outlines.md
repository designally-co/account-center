---
title: No loading outlines (loading.tsx); a progress line under the bar shows that a click was heard
app: account-center
decided: 2026-11-02
author: ai
sources:
  - "Buk, 2026-11-02 (I clicked a button and I need to wait too long)"
  - "Buk, 2026-11-02 (find the best UX for the whole site)"
  - src/components/nav-progress.tsx
  - src/app/(main)/layout.tsx
---

## Context

On 2026-11-02 clicks on the live app felt slow, mostly because Vercel ran the app in Washington, D.C. and the database is in Singapore (`hosting-on-vercel-first.md`). To make every click answer at once, the session first gave each signed-in page a loading outline (Next.js `loading.tsx`): grey shapes of the page, shown while the real page loads.

Tested in a browser on a local copy, with Next.js 15.5.27: with any `loading.tsx` above a page, a save that sends the person back to the same page did not finish. The server saved the change and answered correctly, but the page stayed on "Saving…" for good. It happened on a person's page (the visible/hidden button) and on a subscription's page (adding someone), with outlines at any level above them; a team's page did not show it. Removing every `loading.tsx` made all of them work again. The cause inside Next.js was not found.

## Decision

- No `loading.tsx` anywhere in the app.
- The bar at the top lives in the shared layout of the signed-in pages (`src/app/(main)/layout.tsx`), so it stays on screen while the next page loads.
- A thin line under the bar starts the moment a link inside the app is clicked and finishes when the next page is on screen (`src/components/nav-progress.tsx`); it gives up after 15 seconds so it never stays. Buttons that save show a small turning ring.
- A future change that adds `loading.tsx` must first run the browser checks for saves that come back to the same page (the visible/hidden button on a person's page, adding someone to a subscription).

## Why

A click must never look ignored (Buk, 2026-11-02), and a save that never finishes is worse than a page that loads a little later.
