#!/usr/bin/env bash
# Prueba migraciones, seed y tests SQL en un Postgres local temporal.
# Uso: npm run test:db   (requiere binarios de PostgreSQL 15+)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(dirname "$(command -v postgres 2>/dev/null || ls /usr/lib/postgresql/*/bin/postgres | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
# initdb no corre como root: en ese caso se usa el usuario del sistema "postgres".
AS=()
if [[ "$(id -u)" == "0" ]]; then
  AS=(runuser -u postgres --)
  chown postgres "$TMP"
fi
trap '"${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT

"${AS[@]}" "$PGBIN/initdb" -D "$TMP/data" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c timezone=UTC" -l "$TMP/log" start -w >/dev/null

psql_db() { PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}" psql -h "$TMP" -p "$PORT" -U postgres -d "$1" -v ON_ERROR_STOP=1 -q -X "${@:2}"; }

setup_db() {
  psql_db postgres -c "create database $1" >/dev/null
  psql_db "$1" -f "$ROOT/supabase/tests/00_supabase_stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    psql_db "$1" -f "$f"
  done
}

echo "→ migraciones"
setup_db milan_test
echo "→ re-aplicando migraciones (idempotencia)"
for f in "$ROOT"/supabase/migrations/*.sql; do
  PGOPTIONS="-c client_min_messages=warning" psql_db milan_test -f "$f" >/dev/null
done
# Todos los archivos de prueba corren en una misma sesión (comparten helpers pg_temp).
echo "→ tests: $(cd "$ROOT/supabase/tests" && ls [1-9]*.sql | tr '\n' ' ')"
cat "$ROOT"/supabase/tests/[1-9]*.sql | PGOPTIONS="-c client_min_messages=notice" psql_db milan_test -f - 2>&1 >/dev/null | sed -E 's/^psql:[^ ]+ NOTICE:  /  /'

echo "→ seed.sql (base aparte)"
setup_db milan_seed
psql_db milan_seed -f "$ROOT/supabase/seed.sql" >/dev/null
psql_db milan_seed -c "select count(*) as ventas_demo from public.sales" 
echo "✓ Pruebas de base de datos OK"
