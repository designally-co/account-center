# Account Center on the Designally NAS

How Account Center goes online at account.designally.co: an image from GHCR, a Portainer stack, Caddy.
It follows the same pattern as Article Studio (`designally-co/article-studio`, `docs/deploy-nas.md`).

Going online changes nothing in use: no live app asks Account Center yet, and Account Center only reads and
writes its own schema `account` (spec, section 1). No secret value appears here, and none may be added.

## 1. The image

`ghcr.io/designally-co/account-center:sha-<full 40-character commit>`, linux/amd64, built by
[`.github/workflows/release.yml`](../.github/workflows/release.yml).

**On every pull request** the workflow builds the image and checks it, without pushing anything:

- it is `linux/amd64` and has a health check;
- no credential-shaped string is in its layer history;
- started against a throwaway PostgreSQL 17 with schema `account`, **as `account_app`** (the same user as in
  Friday), `/api/health` answers `ok: true` with the commit it was built from (it also checks that the newest
  database changes are there);
- every page refuses to be shown inside another site's frame;
- a signed-out visitor is sent to `/login`, and `/login` answers.

**To release**, tag a commit that is already on `main`:

```bash
git tag release-2026-10-19 <full commit>
git push origin release-2026-10-19
```

The same checks run, plus the schema tests and the app tests, then the exact image that passed is pushed as
`sha-<commit>`. The run summary shows the
image, its digest and the commit. A manual run of the workflow on `main` does the same. There is no `latest`
tag, and a commit that is not on `main` is refused.

## 2. Settings (Portainer stack variables)

Names only. Values are typed into Portainer, never into Git, chat or a ticket.

| Name | What it is |
|---|---|
| `IMAGE_TAG` | `sha-<full commit>` from the release run summary |
| `SUPABASE_PUBLISHABLE_KEY` | Project Friday's publishable key (Supabase > Project Friday > Project Settings > API Keys). Public by design |
| `DATABASE_URL` | Friday's **session pooler** string for the user `account_app` (step 3 below), never `postgres` |

The stack file sets the rest itself: `SUPABASE_URL` (Friday's address), `HOSTNAME`, `PORT`, `NODE_ENV`.

## 3. Steps for Buk (first time)

1. **The import and the first admin** (stage 1.1, if not done yet): in Friday's SQL Editor, outside 02:30 to
   05:00 Bangkok time (the nightly backup), run `select account.import_from_hr();`, look through the list
   once, then `select account.bootstrap_first_admin('<your HR email>');`.
2. **Account Center's database login:** make a random password in your password manager: **letters and digits
   only, at least 32 characters** (turn symbols off; they break the SQL file or the connection string). In
   Friday's SQL Editor, run [`sql/account-app-user.sql`](../sql/account-app-user.sql) with that password in
   place of `CHANGE_ME`. Both checks at the end must say `true`.
3. **The connection string:** Supabase > Project Friday > Connect > **Session pooler**. Use the user
   `account_app.urzwmhoujpphumruhgkv` and the password from step 2. Keep it in the password manager. (The app
   always encrypts this connection.)
4. **The newest database changes:** before the first release, the migrations after the first two must be in
   Friday: [`docs/apply-to-friday.md`](apply-to-friday.md) step 3c (`20261019110000_kinds_and_access_lists.sql`
   and `20261019113000_avatars.sql`). Claude applies them through the Supabase connector, with the guard, after
   your go-ahead. If they are missing, `/api/health` answers 503 and the container shows as unhealthy.
5. **Release:** after the pull request is merged, push a `release-*` tag on `main` (above), or ask Claude to.
   Copy `sha-<commit>` from the run summary.
6. **Portainer:** Stacks > Add stack > name `account-center` > Web editor: paste
   [`deploy/compose.production.yml`](../deploy/compose.production.yml). Add the three variables from section 2.
   Deploy. The registry login Portainer already uses for the other `designally-co` images covers this one.
7. **Check on the NAS:** `docker exec account-center wget -qO- http://127.0.0.1:3000/api/health` shows
   `"ok":true` and the release commit.
8. **The address:** add a DNS record for `account.designally.co` the same way as the other NAS apps (copy
   the record of `article-studio.designally.co`), and a Caddy block, then reload Caddy:

   ```
   account.designally.co {
   	reverse_proxy account-center:3000
   }
   ```

   Tell P Aek before you change DNS or Caddy on the NAS.
9. **Open https://account.designally.co** and sign in with your HR email and password. The first time, you
   land on the avatar step ("Welcome, ..."): make your avatar and save it (or press Later). Then Home shows
   your access.

## 4. Later releases

Push a new `release-*` tag on `main`, then change `IMAGE_TAG` in the Portainer stack and redeploy.
Database changes are never run by the container: each migration in `supabase/migrations/` is applied to
Friday separately, with the guard in [`docs/apply-to-friday.md`](apply-to-friday.md), **before** the
release that needs it.

## 5. Way back

- **A bad release:** set `IMAGE_TAG` to the previous `sha-…` and redeploy.
- **Take it offline:** stop the stack. Nothing else depends on Account Center yet.
