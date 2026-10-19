-- PROPOSED, not applied: waits for Buk's approval of the list (2026-10-19). When approved, this file moves to
-- supabase/migrations/, runs through test/run.sh, and is applied in Friday with the guard.
--
-- The Brand Guideline Portal's actions in Account Center (app key `brand`), taken from the portal's 17 admin
-- server actions and its read-only admin screens (khunshinesithu/brand-guideline-portal at 6a2dbd4,
-- src/app/admin/actions.ts). The ready roles match what the portal's admin_users roles allow today, so nobody
-- gains or loses anything on the day the portal starts asking Account Center: today an editor may do
-- everything except delete a brand, and an owner may do everything. Viewer is new.

insert into account.actions (app_key, key, description) values
  ('brand', 'brand.view',            'Open the admin and see brands, sections, files and the strategy'),
  ('brand', 'brand.activity.view',   'See the activity log: which codes were used or shown, and when'),
  ('brand', 'brand.brand.create',    'Create a new brand (it starts as a draft)'),
  ('brand', 'brand.brand.edit',      'Edit a brand''s details: client name, accent colour, page font'),
  ('brand', 'brand.brand.publish',   'Publish, unpublish or archive a brand'),
  ('brand', 'brand.brand.delete',    'Delete a brand and all its files'),
  ('brand', 'brand.guideline.edit',  'Edit the guideline''s sections, and show or hide them'),
  ('brand', 'brand.strategy.edit',   'Edit the client team''s strategy'),
  ('brand', 'brand.strategy.share',  'Choose which strategy parts the guideline''s Brand core shows'),
  ('brand', 'brand.files.manage',    'Upload, edit and delete files'),
  ('brand', 'brand.code.manage',     'Create, replace, revoke and delete access codes'),
  ('brand', 'brand.code.reveal',     'Show an access code again (every showing is logged)');

insert into account.roles (app_key, key, name, description) values
  ('brand', 'viewer', 'Viewer', 'Can look at everything, cannot change anything'),
  ('brand', 'editor', 'Editor', 'Can do everything except delete a brand (today''s portal editor)'),
  ('brand', 'owner',  'Owner',  'Can do everything (today''s portal owner)');

insert into account.role_actions (app_key, role_key, action_key)
select 'brand', 'viewer', a from unnest(array['brand.view', 'brand.activity.view']) a
union all
select 'brand', 'editor', a.key from account.actions a where a.app_key = 'brand' and a.key <> 'brand.brand.delete'
union all
select 'brand', 'owner', a.key from account.actions a where a.app_key = 'brand';
