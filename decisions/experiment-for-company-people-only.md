---
title: Account Center is Buk's experiment for the company's own people only; it changes nothing in use until the switch, and access is chosen per app and per action
app: account-center
decided: 2026-10-19
author: ai
sources:
  - "Buk, 2026-10-19 (Account Center is still a plan; it is Buk's experiment to rebuild the system: everyone has an account from Account Center, and from there every app is used, HR included; it copies HR only the first time; make sure it does not affect anything, because the current HR app is still in use)"
  - "Buk, 2026-10-19 (Account Center is for employees, for the company, and has nothing to do with clients; when someone joins, an account is made and given a role; the account is like a badge: which apps and what they can do; an outsourced worker's account is marked as outsource, for example with Article Studio but not the HR app)"
  - "Buk, 2026-10-19 (on a person's access list, choose the apps, and inside each app what they can do: for example generate in Article Studio but not publish)"
  - "designally-co/designally-brain, decisions/company-account-center-experiment.md"
  - "designally-co/designally-brain, decisions/company-ecosystem-product-logins-apart-from-account-center.md"
---

## Context

The spec of 2026-10-14 made some parts "real now": access for Buk's apps (MA Desk, the Knowledge Hub, Article Studio, the survey, the brand guideline portal) and account creation in Project Friday's Auth. It described Account Center as holding every account across "the Designally ecosystem", and mentioned accounts for freelancers and partners.

## Decision

- **Who:** Designally's own people only, employees and outsourced workers. Never clients. The future client product has its own accounts, for clients and for staff.
- **An experiment that changes nothing in use:** the schema, the import and the app are built and tested, but no live app changes how people sign in, and nothing is written to Project Friday's Auth (account creation, blocking logins), until Buk and P Aek decide to switch. HR parts stay a prototype.
- **Access per app and per action:** a person's access list shows the apps they can use and, inside each, what they can do. Access is never only per app.
- **Kinds of people:** each account says what kind of person it is; an outsource account cannot get access to the HR app. The kind and the check are still to build; the full list of kinds is not decided.

Not decided yet: the list of kinds, whether access is chosen person by person, through ready roles or both, and when the switch happens.

## Why

Account Center is Buk's experiment to rebuild the system, and the current HR app is still in use, so it must not affect anything (Buk, 2026-10-19). It is for the company, and clients get the product's own login (Buk, 2026-10-19). Access per action is how Buk wants to give access, for example generate but not publish (Buk, 2026-10-19).
