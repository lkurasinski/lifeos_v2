#!/usr/bin/env bash
#
# db-sync.sh — mirror the food catalog between the local docker stack and Railway.
#
#   ./scripts/db-sync.sh push      # local  ->  Railway   (overwrite remote DB, reindex on Railway)
#   ./scripts/db-sync.sh pull      # Railway ->  local    (overwrite local DB, reindex locally)
#   ./scripts/db-sync.sh status    # show resolved config + test connectivity to both ends
#
# WHAT IT DOES
#   1. pg_dump the whole source DB and pg_restore --clean it into the target (full mirror,
#      including auth + _prisma_migrations — the target schema ends up identical to the source).
#   2. Rebuild the target's Meilisearch index from the freshly-synced DB (full override):
#        push -> POST the app's /api/admin/reindex, so Railway reindexes ITSELF from its own
#                DB over the private network (no egress; Meili can stay private, no public domain).
#        pull -> the local tsx index step against the local stack.
#
# WHY THE POSTGRES TOOLS RUN IN DOCKER
#   The host pg_dump may be older than the server (a v14 client can't dump a v16 DB). The
#   compose `postgres` container ships a matching v16 client and can reach both localhost
#   and the public internet, so every pg_dump/pg_restore is routed through it.
#   NOTE: if the Railway Postgres major version is *newer* than the local one, `pull` will
#   fail (client too old). Bump the local docker-compose postgres image to match.
#
# REMOTE CONFIG  (scripts/railway-remote.env — gitignored; copy the .example)
#   REMOTE_DATABASE_URL=postgresql://postgres:<pw>@<host>:<port>/railway   # Postgres DATABASE_PUBLIC_URL
#   REMOTE_APP_URL=https://<app>.up.railway.app                            # the deployed app
#   REMOTE_REINDEX_TOKEN=<the REINDEX_TOKEN set on the app service>
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

usage() {
  cat <<'USAGE'
db-sync.sh — mirror the food catalog between the local docker stack and Railway.

  ./scripts/db-sync.sh push                # local  -> Railway  (overwrite remote DB, reindex on Railway)
  ./scripts/db-sync.sh push --no-reindex   # mirror only; skip reindex (run it after deploying new code)
  ./scripts/db-sync.sh reindex             # reindex Railway only (no DB mirror)
  ./scripts/db-sync.sh pull                # Railway -> local   (overwrite local DB, reindex locally)
  ./scripts/db-sync.sh status              # resolved config + connectivity for both ends

Full-override mirror via pg_dump | pg_restore (run inside the compose `postgres`
container so the client matches the v16 server). After a push, the deployed app
reindexes itself over Railway's private network via POST /api/admin/reindex.

Use `push --no-reindex` then `reindex` when the deployed schema changes shape: mirror
first, deploy the new code, then reindex (old code can't index the new schema).

Remote config: scripts/railway-remote.env  (copy the .example; gitignored)
USAGE
  exit "${1:-0}"
}

load_remote() {
  [ -f "$REMOTE_ENV" ] || die "missing $REMOTE_ENV — copy scripts/railway-remote.env.example and fill it in"
  set -a; . "$REMOTE_ENV"; set +a
  : "${REMOTE_DATABASE_URL:?set REMOTE_DATABASE_URL in $REMOTE_ENV}"
  : "${REMOTE_APP_URL:?set REMOTE_APP_URL in $REMOTE_ENV}"
  : "${REMOTE_REINDEX_TOKEN:?set REMOTE_REINDEX_TOKEN in $REMOTE_ENV}"
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

# Reindex ON Railway: the app rebuilds its index from its own DB over the private network.
# Keeps the index sourced from the Railway DB and avoids pulling rows out to us.
remote_reindex() {
  local resp code body
  resp=$(curl -sS -X POST "${REMOTE_APP_URL%/}/api/admin/reindex" \
           -H "Authorization: Bearer $REMOTE_REINDEX_TOKEN" -w $'\n%{http_code}') \
    || die "reindex request failed — is $REMOTE_APP_URL reachable?"
  code=${resp##*$'\n'}; body=${resp%$'\n'*}
  case "$code" in
    200) echo "  $body" ;;
    401) die "reindex unauthorized — REMOTE_REINDEX_TOKEN doesn't match the app's REINDEX_TOKEN" ;;
    503) die "reindex disabled — set REINDEX_TOKEN on the Railway app service and redeploy" ;;
    *)   die "reindex returned HTTP $code: $body" ;;
  esac
}
# Rebuild the LOCAL index from the local DB (reads apps/web/.env → local Meili).
local_reindex() { ( cd "$WEB" && pnpm tsx scripts/seed-food-data.ts --step index ); }

confirm() { read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy]$ ]] || die "aborted"; }
count_products() { psql_url "$1" "select count(*) from food_product" 2>/dev/null || echo "?"; }

cmd_push() {
  local no_reindex=0
  case "${1:-}" in
    --no-reindex) no_reindex=1 ;;
    "") ;;
    *) die "unknown option '$1' for push (only --no-reindex is supported)" ;;
  esac
  load_remote; compose_pg_up
  echo "${c_ylw}PUSH${c_rst}  local  ->  Railway   ${c_dim}(overwrites the remote database + search index)${c_rst}"
  info "local  food_product rows: $(count_products "$LOCAL_DB")"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL") (about to be replaced)"
  confirm "Overwrite the REMOTE database with your local data?"
  info "dumping local → restoring remote …"
  pg_dump_url "$LOCAL_DB" | pg_restore_url "$REMOTE_DATABASE_URL"
  ok "database mirrored to Railway ($(count_products "$REMOTE_DATABASE_URL") products)"
  if [ "$no_reindex" = 1 ]; then
    info "skipping reindex (--no-reindex)."
    echo "${c_ylw}!${c_rst} Deploy the new code, then reindex: ${c_dim}./scripts/db-sync.sh reindex${c_rst}"
    echo "${c_dim}  (the currently-deployed app may not be able to reindex the mirrored schema)${c_rst}"
    return
  fi
  info "triggering reindex on Railway (private network) …"
  remote_reindex
  ok "Railway is in sync with local."
}

# Reindex Railway only (no DB mirror) — for the mirror → deploy → reindex order, where
# the reindex must run AFTER the new code deploys (old code can't index the new schema).
cmd_reindex() {
  load_remote
  info "triggering reindex on Railway (private network) …"
  remote_reindex
  ok "Railway reindex complete."
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
  local_reindex
  ok "Local is in sync with Railway."
}

cmd_status() {
  load_remote; compose_pg_up
  echo "local  DB : $LOCAL_DB"
  echo "remote DB : ${REMOTE_DATABASE_URL%%@*}@${REMOTE_DATABASE_URL##*@}"
  echo "remote app: $REMOTE_APP_URL"
  echo "---"
  echo "local  reachable : $(psql_url "$LOCAL_DB" 'select 1' >/dev/null 2>&1 && echo yes || echo NO)   products: $(count_products "$LOCAL_DB")"
  echo "remote reachable : $(psql_url "$REMOTE_DATABASE_URL" 'select 1' >/dev/null 2>&1 && echo yes || echo NO)   products: $(count_products "$REMOTE_DATABASE_URL")"
}

case "${1:-}" in
  push)    shift; cmd_push "$@" ;;
  pull)    cmd_pull ;;
  reindex) cmd_reindex ;;
  status)  cmd_status ;;
  ""|-h|--help|help) usage 0 ;;
  *) die "unknown command '$1' (use push | pull | reindex | status)" ;;
esac
