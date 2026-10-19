-- Account Center: each person's avatar (Buk, 2026-10-19: a customizable avatar, like Notion's avatar maker,
-- made by the person when they first sign in, to make it fun in the office).
-- Same safety rules as the earlier migrations: everything stays inside schema `account`.
--
-- The avatar is stored as the person's choices (which hair, eyes, glasses, ...), not as an image. Account
-- Center's server checks every value against the known parts before it saves; the database keeps the shape
-- and the size in check. Empty means "not made yet" (the app then shows a stable starting face).

alter table account.people add column avatar jsonb
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and length(avatar::text) <= 1000));

-- "Who is this?" also gives the avatar, so Account Center (and, later, an app that needs it) can show it.
-- Same name, arguments and rights as before.
create or replace function account.me(p_person_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'person_id', p.id,
    'display_name', p.display_name,
    'avatar', p.avatar,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('app', g.app_key, 'role', g.role_key) order by g.app_key, g.role_key)
      from account.grants g
      where g.person_id = p.id and not account.kind_blocks_app(p.kind, g.app_key)
    ), '[]'::jsonb)
  )
  from account.people p
  where p.id = p_person_id
    and p.is_active
    and p.auth_user_id is not null
    and account.login_ok(p.auth_user_id);
$$;
