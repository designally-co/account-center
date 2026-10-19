#!/usr/bin/env bash
# Starts a throwaway Postgres for the tests and prints its connection string.
# Usage: scripts/local-postgres.sh [data dir]   Needs initdb and pg_ctl on PATH (or /usr/lib/postgresql/*/bin).
set -euo pipefail
DIR="${1:-/tmp/account-center-pg}"
BIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")"
PORT="${PGPORT_TEST:-54329}"
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [ ! -s "$DIR/PG_VERSION" ]; then
  mkdir -p "$DIR"; [ "$(id -u)" = 0 ] && chown postgres "$DIR"
  run "$BIN/initdb -D $DIR -U postgres --auth=trust >/dev/null"
fi
run "$BIN/pg_ctl -D $DIR -o '-p $PORT -k /tmp -c listen_addresses=127.0.0.1' -l $DIR/log.txt -w start >/dev/null" || true
echo "postgresql://postgres@127.0.0.1:$PORT/postgres"
