# Retired pipeline steps

These three steps built the original catalog from the USDA SR Legacy dump. They are
**retired**: none of them is reachable from `seed-food-data.ts`, and none of them is part
of any reseed path.

`data/catalog-seed/catalog.jsonl` is the single source of truth for the food catalog.
It is committed, id-stable, and replayed by `--step import-jsonl`. Curation now happens
in the app (locally), is snapshotted with `--step export-jsonl`, and is published to
Railway from that snapshot — so a deleted product stays deleted.

| File                    | What it did                                                                                                                                 | Why it is retired                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `import-usda.ts`        | Streamed the USDA SR Legacy CSVs into `food_product` + `food_nutrient`, minting new ids; held the category mapping and the raw-only filter. | Re-running it would remint ids (breaking `recipe_component` FKs) and resurrect every product pruned during curation. |
| `translate-products.ts` | Batch-translated `namePl` for freshly imported rows via Anthropic Haiku.                                                                    | Polish names now live in the snapshot; nothing arrives untranslated.                                                 |
| `curate-catalog.ts`     | Merged the per-animal categories into `meat` and pruned meat/seafood/nuts to the hand-curated shortlist TSVs.                               | Its output is baked into the snapshot. Further curation happens in the app, not in a script.                         |

They are kept (not deleted) because they document how the current catalog came to be: the
USDA category → slug mapping, the categories dropped as prepared/composite foods, and the
raw-only filter rules. `import-usda.ts`'s pure helpers are still unit-tested in
`src/lib/server/__tests__/food-pipeline.test.ts` — those rules are the provenance of every
row in the snapshot.

The source CSVs under `data/usda/` were never committed (`.gitignore`: `/data/*`), so a
rerun would need a fresh USDA download anyway.

**If you ever need a bulk import again** (e.g. a whole new food category): treat it as a
one-off, run it against a scratch database, export a snapshot, and reconcile that snapshot
into `catalog.jsonl` by hand. Do not point it at a database that recipes reference.
