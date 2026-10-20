# Account Center

Every account and all access for Designally's own people (employees and outsourced workers, never clients), in one place. A plan and Buk's experiment: nothing in use changes until Buk and P Aek decide to switch. Address: account.designally.co. Not live yet.

- Spec: [`docs/spec.md`](docs/spec.md)
- Applying the database part to Project Friday (only after P Aek agrees): [`docs/apply-to-friday.md`](docs/apply-to-friday.md)
- Release and hosting on the NAS: [`docs/deploy-nas.md`](docs/deploy-nas.md)
- Rules for AI build sessions: [`AGENTS.md`](AGENTS.md)

## Work locally

Needs Node 22 and PostgreSQL (16 or 17).

```sh
npm ci
scripts/local-postgres.sh                 # starts a throwaway database and prints its address
test/run.sh "<that address>"              # schema tests: nothing outside schema account may change
TEST_ADMIN_URL="<that address>" npm test  # the app's access code against the schema
npm run typecheck && npm run build
```

Never point the tests at Project Friday; they refuse an address that contains "supabase".

To run the app, copy `.env.example` to `.env.local` and fill it in. Schema `account` is in Friday since 2026-10-19; real sign-in also needs the one-time import, a first admin and the `account_app` login (`docs/apply-to-friday.md`).
