-- Account Center: what each app does, shown on the app cards on Home: a short description and a small picture (Buk, 2026-10-19: "use the
-- app description" instead of the person's role and action count, which mean little to an employee).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- Data, not code: one short line per app, like the cards in Buk's design reference (2026-10-19: "the desc are
-- too long, follow the Manus reference"). Taken, shortened, from what each app says about itself:
-- the Designally Brain (each app's brain.yaml, purpose, read 2026-10-19) for Article Studio, the Knowledge Hub,
-- the survey and HR; the portal's README; MA Desk's product brief (designally-brain docs/products/ma-desk.md);
-- Account Center's own AGENTS.md. Empty for an app added later until someone writes one.
alter table account.apps add column description text not null default ''
  check (length(description) <= 60);

update account.apps set description = v.description
from (values
  ('account_center', 'Your access to every app, and your avatar.'),
  ('studio', 'Turn a topic into a researched article.'),
  ('hub', 'Free design articles and resources.'),
  ('survey', 'Turn client answers into one clear page.'),
  ('brand', 'Client brand guidelines and access codes.'),
  ('ma', 'Website domains, servers and renewals.'),
  ('hr', 'Attendance, leave and overtime.')) v(key, description)
where account.apps.key = v.key;

-- A small picture of what the app does, for its card on Home (Buk, 2026-10-19: "since almost all apps will have
-- the same logo or favicons, use the same concept as the Manus reference, showing what it does"). A file that
-- ships with Account Center under /apps/art/. Empty: the card shows the app's graphic or orb instead.
alter table account.apps add column art text check (art ~ '^/apps/art/[a-z0-9_-]+\.svg$');
update account.apps set art = '/apps/art/' || replace(key, '_', '-') || '.svg'
where key in ('account_center', 'studio', 'hub', 'survey', 'brand', 'ma', 'hr');
