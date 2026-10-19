-- Account Center: the Brand Guideline Portal is its first app (Buk, 2026-10-19: "first use the brand guideline
-- portal to try the account sign in, as it is still in development"; the actions and the three roles below
-- approved by Buk the same day). Same safety rules as the earlier migrations: everything stays inside schema
-- `account`, except one database role, `portal_check`.
--
-- 1. The portal's actions (app key `brand`), taken from the portal's admin server actions and its read-only
--    admin screens (khunshinesithu/brand-guideline-portal at 2ea3e75, src/app/admin/actions.ts). The ready
--    roles match what the portal's own admin_users roles allow today, so nobody gains or loses anything when
--    the portal starts asking Account Center: an editor may do everything except delete a brand, an owner
--    may do everything. Viewer is new.
-- 2. `portal_check`: the portal's database user in Friday. The portal's data is not in Friday yet (it moves
--    later), so this user may only ask one question, account.can_user(account id, action): no table, no
--    other function, nothing outside schema `account`. Its login is made by a person
--    (sql/portal-check-user.sql), never by a migration.

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

-- ---------------------------------------------------------------------------------------------
-- The portal's database user: the access question only.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_check') then
    create role portal_check nologin;
  end if;
end $$;

grant usage on schema account to portal_check;
grant execute on function account.can_user(uuid, text) to portal_check;
