# Refactoring & Clean-Architecture Findings

_Analysis date: 2026-06-13 · branch `food-product-catalog`_

## Overview

The codebase is well-architected: pure logic (`food-document.ts`, `recipe-document.ts`,
`nutrition.ts`, `graph.ts`, `units.ts`) is cleanly separated from I/O (`recipes.ts`,
`food-products.ts`), routes are thin, and documentation is exceptional. The opportunities
below are almost entirely **duplication between two parallel domains (food ↔ recipe)** that
grew by copy-paste — the service files repeatedly say "Mirrors `food-products.ts`" /
"mirrors `food-document.ts`". Grouped by ROI.

---

## Tier 1 — Route/controller boilerplate (highest ROI, lowest risk)

There is **no shared HTTP helper** in `lib/server/`. Every endpoint hand-rolls three patterns.

**1a. Error→HTTP mapping** — 6 catch blocks repeat `instanceof` chains:
- `api/recipes/+server.ts`, `api/recipes/[id]/+server.ts`, `api/foods/+server.ts`,
  `api/foods/[id]/+server.ts`, `api/foods/off-preview/+server.ts`

Typed errors already exist (`RecipeNotFoundError`, `FoodProductInUseError`, etc.) — they need
one mapping table. A `mapServiceError(err)` helper (or a registry where each error class
declares its `status` + body) collapses ~80 lines.

**1b. Zod parse → 400** — identical in 5 endpoints:
```ts
let payload;
try { payload = schema.parse(await request.json()); }
catch { error(400, "Nieprawidłowe dane …"); }
```
→ `parseJsonBody(request, schema, msg)`.

**1c. Auth guard** — `error(401)` appears 13× and `locals.user?.id` + `if (!userId) error(401)`
3×, with two subtly different shapes (`!locals.session` vs `!locals.session || !locals.user`).
→ `requireUserId(locals): string`. Routes *inside* `(app)/` re-check auth even though
`(app)/+layout.server.ts` already gates it — some checks are redundant.

**Suggested home:** new `lib/server/http.ts` (server-only).

---

## Tier 2 — The food↔recipe service mirror (medium effort, real payoff)

`recipes.ts` and `food-products.ts` contain **byte-identical** Meili plumbing:

| Helper | `recipes.ts` | `food-products.ts` | Status |
|---|---|---|---|
| `waitForMeiliTask` | L117 | L101 | identical |
| `syncAfterCommit` | L230 | L163 | identical except log string |
| `ensureXIndexConfigured` (memoized) | L132 | L117 | identical pattern |
| `configureXIndex` | L140 | L497 | identical pattern |
| `isUniqueConstraintError` | L381 | L54 | identical |

→ Extract `meili-sync.ts` with `waitForMeiliTask`, `syncAfterCommit(op, id, recoveryHint)`,
and a `makeIndexConfigurer(indexName, settings)` factory. The P2002/P2003 duck-typed guards
belong in a `prisma-errors.ts` (or the Tier-1 `http.ts`).

**Memoize-with-reset-on-failure recurs 4×** (`indexConfigured` ×2, `registryCache`,
`categoriesCache`):
```ts
return (cache ??= load().catch((e) => { cache = null; throw e; }));
```
→ a 4-line `memoizeAsync(loader)` util removes all four.

**Pure search-query construction is mirrored** between `food-document.ts` and
`recipe-document.ts`: `orClause`, the disjunctive multiSearch fan-out, result-shaping.

> ⚠️ **Latent inconsistency to fix during extraction:** recipe's `orClause` escapes `"`/`\`
> in facet values (free-text URL values); food's `orClause` (`food-document.ts:130`) does
> **not**. Food slugs are lower-risk, but unify on the escaping version to close the gap.

---

## Tier 3 — Shared domain primitives (low effort)

**3a. Macro tag constants** defined in ≥3 places with different shapes:
- `nutrition.ts:25` `MACRO_TAGS = {energyKcal:"ENERC_KCAL", …}`
- `food-document.ts:31` `MACRO_FIELDS` (inverse mapping)
- `catalog/meta.ts:84` inline `"ENERC_KCAL"` literal

→ one `lib/macros.ts` with the canonical INFOODS tag map; derive the inverse from it.

**3b. URL search-param parsing** — the `list()` and `num()` closures inside `parseSearchParams`
(food) and `parseRecipeSearchParams` (recipe) are **identical**, and the Zod schemas share the
`q/sort/dir/page/limit` skeleton. → `lib/search-params.ts` with shared `list`/`num` extractors
+ a base schema the two extend.

**3c. `macro()` em-dash formatter** — identical in `RecipeCard.svelte:34` and
`ProductTable.svelte:37`:
```ts
function macro(value) { return value === undefined ? "—" : formatAmount(value); }
```
→ move to the shared `catalog/meta.ts` (which already owns `formatAmount`).

---

## Tier 4 — Component decomposition (readability, larger effort)

Largest components mixing concerns:
- `RecipeForm.svelte` — **1048 lines** (bindings + live nutrition rollup + step editor +
  component editor + taxonomy chips). Extract `<LiveNutritionPanel>` and the step/component editors.
- `RecipeDetail.svelte` — **910 lines**. Step-staging derivation (~L103–127) is a pure function
  begging to be a tested util.
- `ComponentEditor.svelte` (554), `ProductPicker.svelte` (507), `ProductForm.svelte` (474) —
  each would benefit from a row/result child component.

The client correctly reads server-cached nutrition (no redundant recompute) — that part is clean.

---

## Structural note on `recipes.ts` (1046 lines)

Cohesive but carries 7 responsibilities (errors, Meili sync, nutrition recompute, graph safety,
taxonomy upsert, write paths, view projections, search). Could split into a `recipes/` folder,
but only *after* Tiers 1–2 pull out shared plumbing — that alone removes ~120 lines and makes
the split obvious. Also: `food-products.ts` imports `recomputeDependents` from `recipes.ts`
while `recipes.ts` is the integrity hub — a near-circular dependency a shared
`recompute`/`integrity` seam would clarify.

---

## Suggested sequence

1. **Tier 1** — `lib/server/http.ts` + wire 5 endpoints (~150 lines removed, no behavior change,
   covered by existing tests).
2. **Tier 2** — consolidate the mirror; fix the `orClause` escaping inconsistency.
3. **Tier 3** — shared primitives (`macros.ts`, `search-params.ts`, `macro()` formatter).
4. **Tier 4** — component decomposition, incremental.
