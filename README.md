# LifeOS

Meal planning with AI-assisted weekly plans and nutritional optimization. SvelteKit +
PostgreSQL (Prisma) + Meilisearch, deployed on Railway. Polish-language UI.

```bash
docker compose up -d                      # PostgreSQL :5444, Meilisearch :7700
cp apps/web/.env.example apps/web/.env    # fill in the keys
pnpm install && pnpm db:seed && pnpm dev
```

## Scripts

**Run everything from the repo root** — the root `package.json` is the entry point, and the
per-package scripts under `apps/web` are an implementation detail. The prefix says *where* a
command acts: unprefixed and `catalog:` / `search:` / `recipe:` touch **your** database (the one
`apps/web/.env` points at); `railway:` acts on **production**.

### App

| Command | Does |
| --- | --- |
| `pnpm dev` | Vite dev server on :3000 |
| `pnpm build` | Production build |
| `pnpm check` | Type-check (svelte-check) |
| `pnpm lint` · `pnpm lint:fix` | ESLint across the workspace |
| `pnpm format` · `pnpm format:check` | Prettier across the workspace |
| `pnpm test` · `pnpm test:watch` | Vitest |

### Database & data (local)

| Command | Does |
| --- | --- |
| `pnpm db:migrate` · `db:generate` · `db:studio` | Prisma migrate / client generation / Studio |
| `pnpm db:seed` | Full bootstrap: nutrient registry → catalog → search indexes |
| `pnpm catalog:export` | Snapshot the local catalog into `apps/web/data/catalog-seed/catalog.jsonl` |
| `pnpm catalog:import` | Replay that snapshot into the local database |
| `pnpm catalog:import:reset` | …and delete local products absent from the snapshot ⚠️ (keeps app-created ones; add `--force` to drop those too) |
| `pnpm search:reindex` | Rebuild the local food-product index |
| `pnpm recipe:seed` · `recipe:reindex` | Recipe taxonomies / recipe index, locally |

### Production (`scripts/db-sync.sh`)

Needs `scripts/railway-remote.env` (copy the `.example`; gitignored).

| Command | Does |
| --- | --- |
| `pnpm railway:status` | Resolved config + connectivity and row counts for both ends |
| `pnpm railway:publish` | Ask the deployed app to replay the snapshot from its own build and reindex itself |
| `pnpm railway:publish:reset` | …and delete production products absent from the snapshot ⚠️ (add `--force` to include app-created ones) |
| `pnpm railway:harvest` | Pull production's catalog back into the snapshot (for products added in the app) |
| `pnpm railway:reindex` | Rebuild production's search indexes, no data movement |
| `pnpm railway:pull` | Overwrite **your** database with production's (safe direction; how you get real recipes locally) |
| `pnpm railway:mirror-push` | Overwrite **production's entire database** with yours, user data included ⚠️⚠️ |

## Catalog data

The food catalog is **repo-owned**: `apps/web/data/catalog-seed/catalog.jsonl` is its single
source of truth — committed, id-stable, and the only reseed path. The USDA import that first
produced it is retired (`apps/web/scripts/legacy/README.md`). User data (accounts, recipes,
targets) is the opposite: production owns it and it never enters git.

Curate in the local app, then:

```bash
pnpm catalog:export     # capture it
git diff --stat         # review, then commit the snapshot
pnpm railway:publish    # publish (deploy first — the app publishes ITS build's snapshot)
```

A reset never deletes a product that exists only in a database — one added through the app's
Open Food Facts flow, or a custom one — nor one a recipe still references. Both are kept and
reported, and `--force` is what deletes them anyway. Capture them properly instead:
`pnpm catalog:export` locally, `pnpm railway:harvest` from production.

The guard covers the prune only. `pnpm db:seed --reset` also re-runs the nutrient step, which
wipes every nutrient row before replaying the snapshot — export first regardless.

Detail lives in the script headers: `apps/web/scripts/seed-food-data.ts` and
`scripts/db-sync.sh` (`pnpm railway:status` with no config prints the usage).
