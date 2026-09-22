#!/usr/bin/env bash
#
# db-sync.sh — move catalog data between the repo, the local docker stack and Railway.
#
#   ./scripts/db-sync.sh publish       # catalog.jsonl -> Railway  (catalog tables only)  ← everyday
#   ./scripts/db-sync.sh harvest       # Railway catalog -> catalog.jsonl (adopt what prod added)
#   ./scripts/db-sync.sh pull          # Railway -> local          (overwrite local DB, reindex locally)
#   ./scripts/db-sync.sh reindex       # reindex Railway only
#   ./scripts/db-sync.sh mirror-push   # local -> Railway          (FULL DB overwrite — destroys prod user data)
#   ./scripts/db-sync.sh status        # resolved config + connectivity for both ends
#
# THE OWNERSHIP RULE THIS SCRIPT ENFORCES
#   Catalog data (food_category / food_product / food_nutrient / nutrient) is owned by the
#   REPO: `apps/web/data/catalog-seed/catalog.jsonl` is its single source of truth. User data
#   (user / session / recipe / nutritional_target) is owned by PRODUCTION and never travels
#   into git. `publish` respects that split; `mirror-push` violates it on purpose and says so.
#
# WHAT EACH COMMAND DOES
#   publish     backs up the remote catalog tables, then POSTs /api/admin/publish-catalog so the
#               DEPLOYED APP replays the snapshot from its own build into its own database — in
#               one transaction, over the private network — and reindexes itself. The write
#               never crosses the internet and needs no production credential here. Prod's
#               users and recipes are never touched.
#   harvest     the escape hatch for the other direction: snapshots the REMOTE catalog over
#               catalog.jsonl, so products added in the deployed app (OFF/CUSTOM) land in the
#               repo instead of being lost at the next publish. Review with `git diff`.
#   pull        full pg_dump | pg_restore of the remote DB into local + a local reindex. Safe
#               direction: it overwrites YOUR machine, which is how you get real recipes locally.
#   mirror-push full pg_dump | pg_restore of local over the remote DB. Overwrites production
#               auth, sessions, recipes and targets with whatever your laptop holds.
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
db-sync.sh — move catalog data between the repo, the local docker stack and Railway.

  ./scripts/db-sync.sh publish             # catalog.jsonl -> Railway (catalog tables only)
  ./scripts/db-sync.sh publish --reset     # ... and delete remote products absent from the snapshot
  ./scripts/db-sync.sh publish --reset --force   # ... including products added in the app
  ./scripts/db-sync.sh harvest             # Railway catalog -> catalog.jsonl (then review `git diff`)
  ./scripts/db-sync.sh reindex             # reindex Railway only (no data movement)
  ./scripts/db-sync.sh pull                # Railway -> local (overwrite local DB, reindex locally)
  ./scripts/db-sync.sh mirror-push         # local -> Railway, FULL DB (destroys prod user data)
  ./scripts/db-sync.sh mirror-push --no-reindex
  ./scripts/db-sync.sh status              # resolved config + connectivity for both ends

`publish` is the everyday command. The catalog lives in the repo, so the deployed app
publishes the snapshot from its OWN build: this script only takes a backup and triggers it.
The replay is one transaction — it lands completely or not at all — and never reads or
writes user / session / recipe / nutritional_target rows.

`publish --reset` deletes remote products that are not in the snapshot. Two kinds survive
it and are reported instead: products a recipe still references, and products created in
the app (OFF / CUSTOM), which exist in no other place. `harvest` captures the latter into
the snapshot; `--force` deletes them.

Deploy before you publish: the app replays the snapshot from its own build, so what lands
is the snapshot of the DEPLOYED commit, not the one in your working tree.

Backups go to backups/ (gitignored) before every publish.

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

# Run a seeder step against the REMOTE database. dotenv does not override variables that
# are already set, so this DATABASE_URL wins over apps/web/.env for this process only.
remote_seed() { ( cd "$WEB" && DATABASE_URL="$REMOTE_DATABASE_URL" pnpm tsx scripts/seed-food-data.ts "$@" ); }

confirm() { read -r -p "$1 [y/N] " a; [[ "$a" =~ ^[Yy]$ ]] || die "aborted"; }
count_products() { psql_url "$1" "select count(*) from food_product" 2>/dev/null || echo "?"; }

# Publish the catalog. The DESTRUCTIVE part runs on Railway: this backs the remote catalog up
# first, then asks the deployed app to replay the snapshot from its own build and reindex
# itself. Nothing here writes to the remote database, so no production credential is needed for
# the write path — only for the backup and the row counts.
cmd_publish() {
  local reset=0 force=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --reset) reset=1 ;;
      --force) force=1 ;;
      *) die "unknown option '$1' for publish (--reset, --force)" ;;
    esac
    shift
  done
  [ "$force" = 1 ] && [ "$reset" = 0 ] && die "--force only means something with --reset"
  load_remote
  echo "${c_ylw}PUBLISH${c_rst}  deployment snapshot  ->  Railway   ${c_dim}(catalog tables only; users and recipes untouched)${c_rst}"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL")"
  if [ "$reset" = 1 ]; then
    echo "${c_ylw}!${c_rst} --reset DELETES remote products missing from the snapshot"
    if [ "$force" = 1 ]; then
      echo "${c_red}!${c_rst} --force includes products ADDED IN THE APP (OFF/CUSTOM) — they exist nowhere else"
      echo "${c_dim}  \`harvest\` captures them into the snapshot instead${c_rst}"
      confirm "Delete app-created products that are missing from the snapshot?"
    else
      echo "${c_dim}  App-created products (OFF/CUSTOM) are kept and reported; --force deletes them too.${c_rst}"
      confirm "Make the remote catalog match the snapshot?"
    fi
  fi
  backup_remote_catalog
  info "asking the deployed app to publish its snapshot …"
  remote_publish "$reset" "$force"
  ok "catalog published ($(count_products "$REMOTE_DATABASE_URL") products on Railway)."
  echo "${c_dim}  The app publishes the snapshot from ITS build — deploy first if the commit matters.${c_rst}"
}

# Dump the remote catalog tables before a publish. Cheap insurance: the snapshot can always be
# replayed, but rows the snapshot does not know about (OFF/CUSTOM products added in the app)
# exist nowhere else. Restore into a scratch database and cherry-pick — do not aim it at prod.
backup_remote_catalog() {
  compose_pg_up
  mkdir -p "$ROOT/backups"
  local out="$ROOT/backups/catalog-railway-$(date +%Y%m%d-%H%M%S).dump"
  info "backing up remote catalog tables → ${out#$ROOT/} …"
  $COMPOSE exec -T "$PG_SERVICE" pg_dump -Fc --no-owner --no-privileges \
    -t food_category -t food_product -t food_nutrient -t nutrient \
    "$REMOTE_DATABASE_URL" > "$out"
  [ -s "$out" ] || die "backup is empty — refusing to publish"
  ok "backup written ($(du -h "$out" | cut -f1))"
}

# POST the app's publish endpoint: it replays the snapshot from its own build into its own
# database over the private network, in one transaction, then reindexes.
remote_publish() {
  local reset="$1" force="$2" resp code body
  resp=$(curl -sS -X POST "${REMOTE_APP_URL%/}/api/admin/publish-catalog" \
           -H "Authorization: Bearer $REMOTE_REINDEX_TOKEN" \
           -H "Content-Type: application/json" \
           -d "{\"reset\":$([ "$reset" = 1 ] && echo true || echo false),\"force\":$([ "$force" = 1 ] && echo true || echo false)}" \
           --max-time 1800 -w $'\n%{http_code}') \
    || die "publish request failed — is $REMOTE_APP_URL reachable?"
  code=${resp##*$'\n'}; body=${resp%$'\n'*}
  case "$code" in
    200) echo "  $body" ;;
    400) die "publish rejected the request body: $body" ;;
    401) die "publish unauthorized — REMOTE_REINDEX_TOKEN doesn't match the app's REINDEX_TOKEN" ;;
    503) die "publish disabled or snapshot missing in the deployment: $body" ;;
    *)   die "publish returned HTTP $code: $body" ;;
  esac
}

# Adopt the remote catalog into the repo. The escape hatch for curation done in the
# deployed app — without it, the next publish --reset would drop those rows.
cmd_harvest() {
  load_remote
  echo "${c_ylw}HARVEST${c_rst}  Railway catalog  ->  catalog.jsonl   ${c_dim}(overwrites the snapshot in your working tree)${c_rst}"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL")"
  confirm "Overwrite apps/web/data/catalog-seed/catalog.jsonl with the remote catalog?"
  remote_seed --step export-jsonl
  ok "snapshot written."
  echo "${c_dim}  Review it before committing: git diff --stat apps/web/data/catalog-seed/catalog.jsonl${c_rst}"
}

cmd_mirror_push() {
  local no_reindex=0
  case "${1:-}" in
    --no-reindex) no_reindex=1 ;;
    "") ;;
    *) die "unknown option '$1' for mirror-push (only --no-reindex is supported)" ;;
  esac
  load_remote; compose_pg_up
  echo "${c_red}MIRROR-PUSH${c_rst}  local  ->  Railway   ${c_dim}(FULL database overwrite)${c_rst}"
  info "local  food_product rows: $(count_products "$LOCAL_DB")"
  info "remote food_product rows: $(count_products "$REMOTE_DATABASE_URL") (about to be replaced)"
  echo "${c_ylw}!${c_rst} This replaces EVERY table, not just the catalog: production users, sessions,"
  echo "${c_ylw}!${c_rst} recipes and nutritional targets are overwritten with your local ones."
  echo "${c_dim}  To publish only the catalog, use: ./scripts/db-sync.sh publish${c_rst}"
  confirm "Overwrite the ENTIRE remote database, including user data?"
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
  publish)     shift; cmd_publish "$@" ;;
  harvest)     cmd_harvest ;;
  pull)        cmd_pull ;;
  reindex)     cmd_reindex ;;
  mirror-push) shift; cmd_mirror_push "$@" ;;
  status)      cmd_status ;;
  push)    die "\`push\` is gone — it mirrored the whole database. Use \`publish\` for the catalog (the usual case), or \`mirror-push\` for the old full overwrite." ;;
  ""|-h|--help|help) usage 0 ;;
  *) die "unknown command '$1' (use publish | harvest | pull | reindex | mirror-push | status)" ;;
esac
