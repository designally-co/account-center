#!/usr/bin/env bash
# Tests schema `account` on a throwaway database. Never point this at Project Friday.
# Usage: test/run.sh "postgresql://user@host:port/postgres"   (a superuser on a test server)
set -euo pipefail
ADMIN_URL="${1:?give the superuser connection string of a test server}"
case "$ADMIN_URL" in *supabase*) echo "Refusing: this looks like a Supabase project. Tests need a throwaway server." >&2; exit 2;; esac
HERE="$(cd "$(dirname "$0")" && pwd)"
DB=account_center_test
TEST_URL="${ADMIN_URL%/*}/$DB"
OUT="$(mktemp -d)"
psql() { command psql -X -q -v ON_ERROR_STOP=1 "$@"; }
set -o pipefail

psql "$ADMIN_URL" -c "drop database if exists $DB" -c "drop role if exists account_app" -c "drop role if exists hub_app" -c "drop role if exists studio_app"
psql "$ADMIN_URL" -c "create database $DB"
psql "$TEST_URL" -f "$HERE/stand-ins.sql" -f "$HERE/seed.sql"

echo "1. Snapshot of everything outside schema account, before"
psql "$TEST_URL" -At -f "$HERE/snapshot.sql" > "$OUT/before.txt"

echo "2. Apply the migration in one transaction"
psql "$TEST_URL" -1 -f "$HERE/../supabase/migrations/20261014100000_account_schema.sql"

echo "3. Run the one-time import from HR and the checks"
psql "$TEST_URL" -f "$HERE/import-only.sql" > /dev/null

echo "4. Snapshot after: must be identical (HR data, HR rules, other schemas, grants)"
psql "$TEST_URL" -At -f "$HERE/snapshot.sql" > "$OUT/after.txt"
if ! diff -u "$OUT/before.txt" "$OUT/after.txt"; then
  echo "FAILED: something outside schema account changed" >&2; exit 1
fi
echo "ok: nothing outside schema account changed ($(wc -l < "$OUT/before.txt") items compared)"

echo "5. Behaviour checks"
psql "$TEST_URL" -f "$HERE/checks.sql" 2>&1 | sed -n "s/^psql:[^ ]* NOTICE:  //p; /ALL CHECKS PASSED/p; /ERROR/p"

psql "$ADMIN_URL" -c "drop database $DB" -c "drop role account_app" -c "drop role hub_app" -c "drop role studio_app"
