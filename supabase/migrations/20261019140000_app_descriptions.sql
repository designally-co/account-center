-- Account Center: a short description of each app, shown on the app cards on Home (Buk, 2026-10-19: "use the
-- app description" instead of the person's role and action count, which mean little to an employee).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- Data, not code: one sentence per app. Taken, shortened, from what each app says about itself:
-- the Designally Brain (each app's brain.yaml, purpose, read 2026-10-19) for Article Studio, the Knowledge Hub,
-- the survey and HR; the portal's README; MA Desk's product brief (designally-brain docs/products/ma-desk.md);
-- Account Center's own AGENTS.md. Empty for an app added later until someone writes one.
alter table account.apps add column description text not null default ''
  check (length(description) <= 160);

update account.apps set description = v.description
from (values
  ('account_center', 'Accounts and access for Designally''s people, and your avatar.'),
  ('studio', 'Researched articles with images, in Designally''s voice, ready for the Knowledge Hub.'),
  ('hub', 'The free public library of design articles and downloadable resources.'),
  ('survey', 'Client questionnaires, turned into one page of what is settled and what is not.'),
  ('brand', 'Clients'' interactive brand guidelines. The team builds them and manages access codes.'),
  ('ma', 'Website maintenance plans: domains, servers, subscriptions and renewals.'),
  ('hr', 'Attendance, leave and overtime. Replaces Calamari.')) v(key, description)
where account.apps.key = v.key;
