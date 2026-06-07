#!/usr/bin/env bash
#
# db-sync.sh — mirror the food catalog between the local docker stack and Railway.
#
#   ./scripts/db-sync.sh push      # local  ->  Railway   (overwrites the remote DB + index)
#   ./scripts/db-sync.sh pull      # Railway ->  local     (overwrites the local DB + index)
#   ./scripts/db-sync.sh status    # show resolved config + test connectivity to both ends
#
# WHAT IT DOES
#   1. pg_dump the whole source DB and pg_restore --clean it into the target (full mirror,
#      including auth + _prisma_migrations — the target schema ends up identical to the source).
#   2. Rebuild the target's Meilisearch index from the freshly-synced DB (the index step
#      clears the index first, so it's a full override too).
#
# WHY THE POSTGRES TOOLS RUN IN DOCKER
#   The host pg_dump may be older than the server (a v14 client can't dump a v16 DB). The
#   compose `postgres` container ships a matching v16 client and can reach both localhost
#   and the public internet, so every pg_dump/pg_restore is routed through it.
#   NOTE: if the Railway Postgres major version is *newer* than the local one, `pull` will
#   fail (client too old). Bump the local docker-compose postgres image to match, or set
#   PG_SERVICE to a container with a matching client.
#
# REMOTE CREDENTIALS  (scripts/railway-remote.env — gitignored; copy the .example)
#   REMOTE_DATABASE_URL=postgresql://postgres:<pw>@<public-host>:<port>/railway
#   REMOTE_MEILISEARCH_HOST=https://<meili>.up.railway.app
#   REMOTE_MEILISEARCH_API_KEY=<meili master key>
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB="$ROOT/apps/web"
COMPOSE="docker compose -f $ROOT/docker-compose.yml"
PG_SERVICE="${PG_SERVICE:-postgres}"
REMOTE_ENV="$ROOT/scripts/railway-remote.env"

# Local DB as seen from *inside* the postgres container (its own server on localhost:5432).
LOCAL_DB="${LOCAL_DB:-postgresql://lifeos:lifeos@localhost:5432/lifeos}"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_ylw=$'\033[33m'; c_dim=$'\033[2m'; c_rst=$'\033[0m'
die()  { echo "${c_red}error:${c_rst} $*" >&2; exit 1; }
info() { echo "${c_dim}· $*${c_rst}"; }
ok()   { echo "${c_grn}✓${c_rst} $*"; }

usage() { sed -n '2,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

load_remote() {
  [ -f "$REMOTE_ENV" ] || die "missing $REMOTE_ENV — copy scripts/railway-remote.env.example and fill it in"
  set -a; . "$REMOTE_ENV"; set +a
  : "${REMOTE_DATABASE_URL:?set REMOTE_DATABASE_URL in $REMOTE_ENV}"
  : "${REMOTE_MEILISEARCH_HOST:?set REMOTE_MEILISEARCH_HOST in $REMOTE_ENV}"
  : "${REMOTE_MEILISEARCH_API_KEY:?set REMOTE_MEILISEARCH_API_KEY in $REMOTE_ENV}"
}

compose_pg_up() {
  $COMPOSE ps --status running --services 2>/dev/null | grep -qx "$PG_SERVICE" \
    || die "compose service '$PG_SERVICE' is not running — start it with: docker compose up -d"
}

# pg_dump <url> to stdout (custom format) — runs in the container.
pg_dump_url() { $COMPOSE exec -T "$PG_SERVICE" pg_dump -Fc --no-owner --no-privileges "$1"; }
# pg_restore from stdin into <url>, dropping existing objects first.
pg_restore_url() { $COMPOSE exec -T "$PG_SERVICE" pg_restore --clean --if-exists --no-owner --no-privileges -d "$1"; }
# psql one-liner against <url>.
psql_url() { $COMPOSE exec -T "$PG_SERVICE" psql -tA "$1" -c "$2"; }

# Rebuild a target's Meili index from its DB (the index step clears the index first).
reindex() { # <db_url> <meili_host> <meili_key>
  ( cd "$WEB" && DATABASE_URL="$1" MEILISEARCH_HOST="$2" MEILISEARCH_API_KEY="$3" \
      pnpm tsx scripts/seed-food-data.ts --step index )
}

confirm() { # <prompt>
  read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy]$ ]] || die "aborted"
}

count_products() { psql_url "$1" "select count(*) from food_product" 2>/dev/null || echo "?"; }

cmd_push() {
  load_remote; compose_pg_up
  echo "${c_ylw}PUSH${c_rst}  local  ->  Railway   ${c_dim}(overwrites the remote database + search index)${c_rst}"
  info "local  food_product rows: $(count_products "$LOCAL_DB")"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL") (about to be replaced)"
  confirm "Overwrite the REMOTE database with your local data?"
  info "dumping local → restoring remote …"
  pg_dump_url "$LOCAL_DB" | pg_restore_url "$REMOTE_DATABASE_URL"
  ok "database mirrored to Railway ($(count_products "$REMOTE_DATABASE_URL") products)"
  info "rebuilding remote Meilisearch index …"
  reindex "$REMOTE_DATABASE_URL" "$REMOTE_MEILISEARCH_HOST" "$REMOTE_MEILISEARCH_API_KEY"
  ok "Railway is in sync with local."
}

cmd_pull() {
  load_remote; compose_pg_up
  echo "${c_ylw}PULL${c_rst}  Railway ->  local     ${c_dim}(overwrites your local database + search index)${c_rst}"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL")"
  info "local  food_product rows: $(count_products "$LOCAL_DB") (about to be replaced)"
  confirm "Overwrite your LOCAL database with the Railway data?"
  info "dumping remote → restoring local …"
  pg_dump_url "$REMOTE_DATABASE_URL" | pg_restore_url "$LOCAL_DB"
  ok "database mirrored to local ($(count_products "$LOCAL_DB") products)"
  info "rebuilding local Meilisearch index …"
  ( cd "$WEB" && pnpm tsx scripts/seed-food-data.ts --step index )   # reads apps/web/.env (local Meili)
  ok "Local is in sync with Railway."
}

cmd_status() {
  load_remote; compose_pg_up
  echo "local  DB : $LOCAL_DB"
  echo "remote DB : ${REMOTE_DATABASE_URL%%@*}@${REMOTE_DATABASE_URL##*@}"
  echo "remote Meili: $REMOTE_MEILISEARCH_HOST"
  echo "---"
  echo "local  reachable : $(psql_url "$LOCAL_DB" 'select 1' >/dev/null 2>&1 && echo yes || echo NO)   products: $(count_products "$LOCAL_DB")"
  echo "remote reachable : $(psql_url "$REMOTE_DATABASE_URL" 'select 1' >/dev/null 2>&1 && echo yes || echo NO)   products: $(count_products "$REMOTE_DATABASE_URL")"
}

case "${1:-}" in
  push)   cmd_push ;;
  pull)   cmd_pull ;;
  status) cmd_status ;;
  ""|-h|--help|help) usage 0 ;;
  *) die "unknown command '$1' (use push | pull | status)"; ;;
esac
