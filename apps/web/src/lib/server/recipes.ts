/**
 * Recipe persistence, integrity, and Postgres→Meilisearch sync.
 *
 * The single home for recipe reads/writes used by ALL app endpoints (the tsx batch
 * reindex step imports the PURE `./recipe-document` directly). Mirrors `food-products.ts`:
 * every write path lives here, the Meili doc is built through the one shared pure builder,
 * and Meili sync stays OUTSIDE the DB transaction.
 *
 * Integrity model A (live FKs + recompute-on-write):
 *  - Nutrition is computed on write and CACHED on the recipe (totals, per-serving, full
 *    nutrient map, completeness + provenance). Reads serve the cache; no per-view recompute.
 *  - A change to a product or a sub-recipe fans out a recompute to every dependent recipe,
 *    up the sub-recipe graph to a fixpoint (`recomputeDependents`) — never capped, since a
 *    skipped recipe would serve silently-stale nutrition (PRD accuracy guardrail).
 *  - Delete-blocks (`assertRecipeNotInUse`, the product-delete guard) keep links from dangling.
 *
 * Error discipline: the DB recompute is CORRECTNESS and must surface (never swallowed). The
 * Meili re-sync follows the food pattern — swallow + log, reconverged by `recipe:reindex`.
 */
import type { MultiSearchParams } from "meilisearch";
import { prisma } from "$lib/server/db";
import { meili } from "$lib/server/search";
import { logger } from "$lib/server/logger";
import { Prisma } from "../../generated/prisma/client";
import {
	buildRecipeDocument,
	buildRecipeSearchQueries,
	shapeRecipeSearchResults,
	projectRecipeToDocInput,
	RECIPE_INDEX_NAME,
	RECIPE_INDEX_SETTINGS,
	type RecipeDocInput,
} from "./recipe-document";
import {
	rollupRecipe,
	MACRO_TAGS,
	type RollupComponent,
	type ProductNutrition,
	type SubRecipeNutrition,
	type RollupResult,
} from "$lib/recipe/nutrition";
import { resolveGrams, type UnitConversion } from "$lib/recipe/units";
import {
	wouldCreateCycle,
	exceedsMaxDepth,
	collectTransitiveParents,
	orderLeavesFirst,
	DEFAULT_MAX_DEPTH,
	type SubRecipeEdges,
	type ParentEdges,
} from "$lib/recipe/graph";
import {
	normalizeTaxonomySlug,
	type RecipeSavePayload,
	type RecipePatchPayload,
	type TaxonomyRef,
	type RecipeDocument,
	type RecipeSearchParams,
	type RecipeSearchResult,
} from "$lib/recipe/schema";

type TxClient = Prisma.TransactionClient;

// ─── Typed errors (mapped to HTTP by the REST layer) ────────────────────────────

export class RecipeNotFoundError extends Error {
	constructor(public id: string) {
		super("Recipe not found");
		this.name = "RecipeNotFoundError";
	}
}

export class RecipeForbiddenError extends Error {
	constructor(public id: string) {
		super("Recipe not owned by this user");
		this.name = "RecipeForbiddenError";
	}
}

/** Thrown when a recipe can't be deleted because other recipes use it as a sub-recipe. */
export class RecipeInUseError extends Error {
	constructor(public referencingIds: string[]) {
		super("Recipe is used as a sub-recipe");
		this.name = "RecipeInUseError";
	}
}

/** Thrown when linking a sub-recipe would create a cycle in the sub-recipe graph. */
export class RecipeCycleError extends Error {
	constructor() {
		super("Sub-recipe link would create a cycle");
		this.name = "RecipeCycleError";
	}
}

/** Thrown when nesting sub-recipes deeper than the allowed maximum. */
export class RecipeDepthError extends Error {
	constructor(public max: number = DEFAULT_MAX_DEPTH) {
		super(`Sub-recipe nesting exceeds the maximum depth of ${max}`);
		this.name = "RecipeDepthError";
	}
}

// ─── Meili index + single/batch doc sync ─────────────────────────────────────────

async function waitForMeiliTask(taskUid: number): Promise<void> {
	const task = await meili.tasks.waitForTask(taskUid);
	if (task.status === "failed") {
		throw new Error(`Meili task ${taskUid} failed: ${task.error?.message ?? "unknown error"}`);
	}
}

/**
 * Ensure the recipe index carries its settings before the FIRST live `addDocuments`.
 * `addDocuments` auto-creates a bare index (empty filterable/sortable attributes); a
 * later faceted/sorted/visibility-filtered search would then throw. Memoize the in-flight
 * promise (one `updateSettings` per process); reset on failure so it can retry.
 * (Lessons: "Runtime-created Meili indexes must have settings applied before first use".)
 */
let indexConfigured: Promise<void> | null = null;
function ensureRecipeIndexConfigured(): Promise<void> {
	return (indexConfigured ??= configureRecipeIndex().catch((err) => {
		indexConfigured = null;
		throw err;
	}));
}

/** Apply the shared `RECIPE_INDEX_SETTINGS` to the runtime singleton index. Idempotent. */
export async function configureRecipeIndex(): Promise<void> {
	const index = meili.index(RECIPE_INDEX_NAME);
	const task = await index.updateSettings(RECIPE_INDEX_SETTINGS);
	await waitForMeiliTask(task.taskUid);
}

/** The relation graph a recipe needs to build its Meili document + roll up nutrition. */
const ROLLUP_INCLUDE = {
	components: {
		orderBy: { orderIndex: "asc" },
		include: {
			unit: true,
			product: { include: { foodNutrients: true } },
			subRecipe: true,
		},
	},
	mealTypes: true,
	diets: true,
	allergens: true,
	techniques: true,
	cuisine: true,
} satisfies Prisma.RecipeInclude;

type LoadedRecipe = Prisma.RecipeGetPayload<{ include: typeof ROLLUP_INCLUDE }>;

/**
 * Project a loaded recipe into the pure document builder's input shape. Delegates to the
 * shared `projectRecipeToDocInput` so the runtime sync and the batch reindex (Phase 4)
 * share ONE rebuild site (lessons: "update EVERY explicit object reconstruction").
 */
function toDocInput(recipe: LoadedRecipe): RecipeDocInput {
	return projectRecipeToDocInput(recipe);
}

/**
 * Rebuild and push the single Meili document for a recipe. DRAFT recipes (and recipes
 * that vanished) are REMOVED from the index — only PUBLISHED recipes are searchable.
 */
export async function syncRecipeDocument(id: string): Promise<void> {
	const recipe = await prisma.recipe.findUnique({ where: { id }, include: ROLLUP_INCLUDE });
	if (!recipe || recipe.status !== "PUBLISHED") {
		await removeRecipeDocument(id);
		return;
	}
	await ensureRecipeIndexConfigured();
	const index = meili.index(RECIPE_INDEX_NAME);
	const task = await index.addDocuments([buildRecipeDocument(toDocInput(recipe))], {
		primaryKey: "id",
	});
	await waitForMeiliTask(task.taskUid);
}

/** Remove a recipe's Meili document (no-op if absent). */
export async function removeRecipeDocument(id: string): Promise<void> {
	const index = meili.index(RECIPE_INDEX_NAME);
	const task = await index.deleteDocument(id);
	await waitForMeiliTask(task.taskUid);
}

/**
 * Re-sync many recipes in ONE batched `addDocuments` (PUBLISHED) + one `deleteDocuments`
 * (the rest) — so a wide recompute fan-out collapses to a couple of Meili writes rather
 * than N per-recipe round-trips (plan: Critical Implementation Details).
 */
async function syncRecipeDocumentsBatch(ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const recipes = await prisma.recipe.findMany({ where: { id: { in: ids } }, include: ROLLUP_INCLUDE });
	const publishedDocs = recipes
		.filter((r) => r.status === "PUBLISHED")
		.map((r) => buildRecipeDocument(toDocInput(r)));
	const publishedIds = new Set(publishedDocs.map((d) => d.id));
	const toRemove = ids.filter((id) => !publishedIds.has(id));

	const index = meili.index(RECIPE_INDEX_NAME);
	if (publishedDocs.length > 0) {
		await ensureRecipeIndexConfigured();
		const task = await index.addDocuments(publishedDocs, { primaryKey: "id" });
		await waitForMeiliTask(task.taskUid);
	}
	if (toRemove.length > 0) {
		const task = await index.deleteDocuments(toRemove);
		await waitForMeiliTask(task.taskUid);
	}
}

/**
 * Run a Meili sync side-effect AFTER a committed DB write. The DB row is authoritative,
 * so an index failure must never mask a successful write: log it (the recoverable-drift
 * signal) and swallow. The index reconverges on the next mutation or `recipe:reindex`.
 */
async function syncAfterCommit(op: () => Promise<void>, id: string): Promise<void> {
	try {
		await op();
	} catch (err) {
		logger.error(
			{ err, id },
			"Meili recipe sync failed after committed DB write — index stale; recover via recipe:reindex",
		);
	}
}

// ─── Nutrition rollup + cache persistence ─────────────────────────────────────────

/**
 * Recompute a recipe's cached nutrition from its current components and persist it (the
 * cached `(totals, yieldWeightG)` pair, per-serving projection, promoted macros, the
 * clean `nutrients` map, completeness + `incompleteComponents` provenance) PLUS each
 * component's resolved grams. Runs inside the caller's transaction. Returns the rollup
 * result. Used by create, update, and the dependent fan-out.
 */
async function recomputeRecipe(tx: TxClient, recipeId: string): Promise<RollupResult> {
	const recipe = await tx.recipe.findUnique({ where: { id: recipeId }, include: ROLLUP_INCLUDE });
	if (!recipe) throw new RecipeNotFoundError(recipeId);

	const components: RollupComponent[] = [];
	const productMap = new Map<string, ProductNutrition>();
	const subMap = new Map<string, SubRecipeNutrition>();

	for (const c of recipe.components) {
		const unit: UnitConversion = { kind: c.unit.kind, baseFactor: c.unit.baseFactor };
		if (c.productId !== null && c.product !== null) {
			const per100: Record<string, number> = {};
			for (const fn of c.product.foodNutrients) {
				if (fn.amountPer100g !== null) per100[fn.nutrientId] = Number(fn.amountPer100g);
			}
			productMap.set(c.productId, {
				densityGPerMl: c.product.densityGPerMl,
				pieceWeightG: c.product.pieceWeightG,
				nutrientsPer100g: per100,
			});
			components.push({
				kind: "product",
				refId: c.productId,
				name: c.product.namePl ?? c.product.nameEn,
				amount: c.amount,
				unit,
			});
		} else if (c.subRecipeId !== null && c.subRecipe !== null) {
			subMap.set(c.subRecipeId, {
				totals: (c.subRecipe.nutrients ?? {}) as Record<string, number>,
				yieldWeightG: c.subRecipe.yieldWeightG,
				nutritionComplete: c.subRecipe.nutritionComplete,
			});
			components.push({
				kind: "subRecipe",
				refId: c.subRecipeId,
				name: c.subRecipe.name,
				amount: c.amount,
				unit,
			});
		}
	}

	const result = rollupRecipe(
		components,
		recipe.servings,
		(id) => productMap.get(id) ?? null,
		(id) => subMap.get(id) ?? null,
	);

	await tx.recipe.update({
		where: { id: recipeId },
		data: {
			yieldWeightG: result.yieldWeightG,
			energyKcalTotal: result.totals[MACRO_TAGS.energyKcal] ?? null,
			proteinTotal: result.totals[MACRO_TAGS.protein] ?? null,
			fatTotal: result.totals[MACRO_TAGS.fat] ?? null,
			carbsTotal: result.totals[MACRO_TAGS.carbs] ?? null,
			energyKcalPerServing: result.perServing[MACRO_TAGS.energyKcal] ?? null,
			proteinPerServing: result.perServing[MACRO_TAGS.protein] ?? null,
			fatPerServing: result.perServing[MACRO_TAGS.fat] ?? null,
			carbsPerServing: result.perServing[MACRO_TAGS.carbs] ?? null,
			nutrients: result.totals,
			nutritionComplete: result.nutritionComplete,
			incompleteComponents:
				result.incompleteComponents.length > 0
					? (result.incompleteComponents as unknown as Prisma.InputJsonValue)
					: Prisma.DbNull,
		},
	});

	// Cache each component's resolved grams (the gram clarifier the detail/form probes show).
	for (const c of recipe.components) {
		const unit: UnitConversion = { kind: c.unit.kind, baseFactor: c.unit.baseFactor };
		const conv =
			c.productId !== null && c.product !== null
				? { densityGPerMl: c.product.densityGPerMl, pieceWeightG: c.product.pieceWeightG }
				: {};
		const grams = resolveGrams(c.amount, unit, conv);
		await tx.recipeComponent.update({ where: { id: c.id }, data: { gramsResolved: grams } });
	}

	return result;
}

// ─── Sub-recipe graph loading (cycle / depth / fan-out) ──────────────────────────

/** Load every existing sub-recipe edge as both forward (children) + reverse (parents) maps. */
async function loadSubRecipeGraph(): Promise<{ childrenOf: SubRecipeEdges; parentsOf: ParentEdges }> {
	const rows = await prisma.recipeComponent.findMany({
		where: { subRecipeId: { not: null } },
		select: { recipeId: true, subRecipeId: true },
	});
	const childrenOf: SubRecipeEdges = {};
	const parentsOf: ParentEdges = {};
	for (const r of rows) {
		const child = r.subRecipeId!;
		(childrenOf[r.recipeId] ??= []).push(child);
		(parentsOf[child] ??= []).push(r.recipeId);
	}
	return { childrenOf, parentsOf };
}

/**
 * Assert that linking the given sub-recipe children under `recipeId` is safe: no cycle,
 * no nesting past the depth cap. `recipeId` may be a not-yet-persisted id (create path);
 * its prospective edges are spliced into the live graph before the checks.
 *
 * ACCEPTED RACE (TOCTOU, MVP): the graph is read here on the top-level client, before the
 * write transaction, so two concurrent saves can each pass against a pre-write snapshot and
 * together commit a cycle. Accepted for S-03 because (1) recipes are per-user and the race
 * needs two SIMULTANEOUS edits across public recipes — near-zero for a single-user MVP, and
 * (2) it matches the repo's existing accepted-race precedent (the taxonomy upsert below and
 * `saveFoodProduct`, which tolerate races + re-query rather than serializing). Moving the
 * check inside the transaction would NOT close it under Postgres READ COMMITTED (a concurrent
 * uncommitted txn stays invisible); true prevention needs SERIALIZABLE-with-retry or an
 * advisory lock — deferred to the S-06 integrity pass, not adopted now.
 */
async function assertSubRecipeSafety(recipeId: string, subRecipeIds: string[]): Promise<void> {
	if (subRecipeIds.length === 0) return;
	const { childrenOf } = await loadSubRecipeGraph();
	childrenOf[recipeId] = subRecipeIds;
	for (const childId of subRecipeIds) {
		if (wouldCreateCycle(recipeId, childId, childrenOf)) throw new RecipeCycleError();
	}
	if (exceedsMaxDepth(recipeId, childrenOf)) throw new RecipeDepthError();
}

// ─── Taxonomy find-or-create ─────────────────────────────────────────────────────

/** Prisma's "unique constraint failed" code (P2002), duck-typed (mirrors `food-products.ts`). */
function isUniqueConstraintError(err: unknown): boolean {
	return (
		typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002"
	);
}

/**
 * Resolve a list of taxonomy refs to ids: a ref with `id` links the existing row; a ref
 * with `name` finds-or-creates by normalized slug (the `Dodaj` chip), tagging new rows
 * with `createdByUserId`. Pure-ish over injected upsert/find callbacks so each vocabulary
 * stays typed.
 *
 * `upsert` is not atomic against a concurrent insert of the same brand-new slug: the loser
 * trips the unique constraint (P2002). Catch it and re-query by slug (the row now exists) —
 * the same race-and-recover the `saveFoodProduct` create path uses for `(source, sourceId)`.
 */
async function findOrCreateBySlug(
	refs: TaxonomyRef[],
	upsertBySlug: (slug: string, name: string) => Promise<{ id: string }>,
	findBySlug: (slug: string) => Promise<{ id: string } | null>,
): Promise<string[]> {
	const ids: string[] = [];
	for (const ref of refs) {
		if (ref.id != null) {
			ids.push(ref.id);
			continue;
		}
		const name = ref.name!.trim();
		const slug = normalizeTaxonomySlug(name);
		try {
			const row = await upsertBySlug(slug, name);
			ids.push(row.id);
		} catch (err) {
			if (!isUniqueConstraintError(err)) throw err;
			// Concurrent insert won the race — the row exists now; re-query it.
			const existing = await findBySlug(slug);
			if (!existing) throw err;
			ids.push(existing.id);
		}
	}
	return ids;
}

async function resolveTaxonomyIds(userId: string, input: RecipeSavePayload) {
	const diets = await findOrCreateBySlug(
		input.diets,
		(slug, name) =>
			prisma.diet.upsert({
				where: { slug },
				update: {},
				create: { slug, namePl: name, nameEn: name, createdByUserId: userId },
				select: { id: true },
			}),
		(slug) => prisma.diet.findUnique({ where: { slug }, select: { id: true } }),
	);
	const techniques = await findOrCreateBySlug(
		input.techniques,
		(slug, name) =>
			prisma.technique.upsert({
				where: { slug },
				update: {},
				create: { slug, namePl: name, nameEn: name, createdByUserId: userId },
				select: { id: true },
			}),
		(slug) => prisma.technique.findUnique({ where: { slug }, select: { id: true } }),
	);
	const allergens = await findOrCreateBySlug(
		input.allergens,
		(slug, name) =>
			prisma.allergen.upsert({
				where: { slug },
				update: {},
				create: { slug, namePl: name, nameEn: name, createdByUserId: userId },
				select: { id: true },
			}),
		(slug) => prisma.allergen.findUnique({ where: { slug }, select: { id: true } }),
	);
	return { diets, techniques, allergens };
}

/** Build the nested `components.create` data from the payload (orderIndex = array position). */
function componentCreateData(input: RecipeSavePayload): Prisma.RecipeComponentCreateWithoutRecipeInput[] {
	return input.components.map((c, i) => ({
		orderIndex: i,
		amount: c.amount,
		note: c.note ?? null,
		unit: { connect: { id: c.unitId } },
		...(c.productId != null
			? { product: { connect: { id: c.productId } } }
			: { subRecipe: { connect: { id: c.subRecipeId! } } }),
	}));
}

// ─── Write paths ──────────────────────────────────────────────────────────────────

/** Create a recipe (+ components, taxonomy links), cache its nutrition, sync Meili. */
export async function createRecipe(userId: string, input: RecipeSavePayload): Promise<{ id: string }> {
	const recipeId = crypto.randomUUID();
	const subRecipeIds = input.components
		.map((c) => c.subRecipeId)
		.filter((id): id is string => id != null);
	// A brand-new recipe can't be referenced yet (no cycle possible), but a deep sub-recipe
	// chain still can exceed the depth cap — assertSubRecipeSafety covers both.
	await assertSubRecipeSafety(recipeId, subRecipeIds);

	const tax = await resolveTaxonomyIds(userId, input);

	await prisma.$transaction(async (tx) => {
		await tx.recipe.create({
			data: {
				id: recipeId,
				userId,
				name: input.name,
				description: input.description ?? null,
				servings: input.servings,
				prepTimeMin: input.prepTimeMin ?? null,
				cookTimeMin: input.cookTimeMin ?? null,
				difficulty: input.difficulty ?? null,
				status: input.status,
				visibility: input.visibility,
				tips: input.tips,
				steps: input.steps,
				cuisineId: input.cuisineId ?? null,
				components: { create: componentCreateData(input) },
				mealTypes: { connect: input.mealTypeIds.map((id) => ({ id })) },
				diets: { connect: tax.diets.map((id) => ({ id })) },
				techniques: { connect: tax.techniques.map((id) => ({ id })) },
				allergens: { connect: tax.allergens.map((id) => ({ id })) },
			},
		});
		await recomputeRecipe(tx, recipeId);
	});

	// No dependents on create (nothing references the new recipe yet); sync its own doc.
	await syncAfterCommit(() => syncRecipeDocument(recipeId), recipeId);
	return { id: recipeId };
}

/**
 * Update a recipe (full content replacement), recompute its cache, fan out a recompute to
 * every dependent recipe up the sub-recipe graph, then sync Meili. Only the owner may edit.
 */
export async function updateRecipe(
	userId: string,
	id: string,
	input: RecipePatchPayload,
): Promise<{ id: string }> {
	const existing = await prisma.recipe.findUnique({ where: { id }, select: { userId: true } });
	if (!existing) throw new RecipeNotFoundError(id);
	if (existing.userId !== userId) throw new RecipeForbiddenError(id);

	const subRecipeIds = input.components
		.map((c) => c.subRecipeId)
		.filter((sid): sid is string => sid != null);
	await assertSubRecipeSafety(id, subRecipeIds);

	const tax = await resolveTaxonomyIds(userId, input);

	await prisma.$transaction(async (tx) => {
		// Full component replacement: drop the old rows, recreate from the payload.
		await tx.recipeComponent.deleteMany({ where: { recipeId: id } });
		await tx.recipe.update({
			where: { id },
			data: {
				name: input.name,
				description: input.description ?? null,
				servings: input.servings,
				prepTimeMin: input.prepTimeMin ?? null,
				cookTimeMin: input.cookTimeMin ?? null,
				difficulty: input.difficulty ?? null,
				status: input.status,
				visibility: input.visibility,
				tips: input.tips,
				steps: input.steps,
				cuisineId: input.cuisineId ?? null,
				components: { create: componentCreateData(input) },
				mealTypes: { set: input.mealTypeIds.map((mid) => ({ id: mid })) },
				diets: { set: tax.diets.map((did) => ({ id: did })) },
				techniques: { set: tax.techniques.map((tid) => ({ id: tid })) },
				allergens: { set: tax.allergens.map((aid) => ({ id: aid })) },
			},
		});
		await recomputeRecipe(tx, id);
	});

	// This recipe's cached totals changed → recompute every recipe that uses it as a
	// sub-recipe (and up the graph). CORRECTNESS: surfaced, never swallowed.
	await recomputeDependents({ recipeId: id });
	// Sync this recipe's own doc (DRAFT removes it; PUBLISHED upserts it).
	await syncAfterCommit(() => syncRecipeDocument(id), id);
	return { id };
}

/** Delete a recipe (components cascade). Blocked while it is used as a sub-recipe. */
export async function deleteRecipe(userId: string, id: string): Promise<void> {
	const existing = await prisma.recipe.findUnique({ where: { id }, select: { userId: true } });
	if (!existing) throw new RecipeNotFoundError(id);
	if (existing.userId !== userId) throw new RecipeForbiddenError(id);

	await assertRecipeNotInUse(id);

	await prisma.recipe.delete({ where: { id } });
	await syncAfterCommit(() => removeRecipeDocument(id), id);
}

/**
 * Throw `RecipeInUseError` (listing the referencing recipe ids) when `id` is used as a
 * sub-recipe by any other recipe. The reusable in-use seam S-06 (meal-plan delete-block)
 * plugs into — extend this with a meal-plan check when that model lands.
 */
export async function assertRecipeNotInUse(id: string): Promise<void> {
	const refs = await prisma.recipeComponent.findMany({
		where: { subRecipeId: id },
		select: { recipeId: true },
		distinct: ["recipeId"],
	});
	if (refs.length > 0) {
		throw new RecipeInUseError(refs.map((r) => r.recipeId));
	}
}

// ─── Recompute fan-out (integrity model A) ───────────────────────────────────────

/**
 * Recompute every recipe that depends on a changed product or sub-recipe, then re-sync
 * the touched docs to Meili in a single batch. Walks the sub-recipe graph leaves-first so
 * a parent always rolls up freshly-recomputed children. NEVER caps the dependent set —
 * the per-recipe DB recompute is correctness and is surfaced; only the Meili re-sync is
 * swallowed (reconverges via reindex).
 *
 * - `{ productId }`: seeds = recipes with a component referencing that product (they too
 *   must recompute) ∪ their ancestors.
 * - `{ recipeId }`: seeds = the changed recipe's direct parents ∪ their ancestors (the
 *   changed recipe itself is already recomputed by `updateRecipe`).
 *
 * Seeds come from a TARGETED query first, so the common "nothing depends on this" edit
 * returns before the (catalog-wide) full-graph load — the graph is only needed for the
 * transitive walk + leaves-first ordering when there actually are dependents.
 */
export async function recomputeDependents(
	target: { productId: string } | { recipeId: string },
): Promise<void> {
	const seedWhere =
		"productId" in target ? { productId: target.productId } : { subRecipeId: target.recipeId };
	const seedRows = await prisma.recipeComponent.findMany({
		where: seedWhere,
		select: { recipeId: true },
		distinct: ["recipeId"],
	});
	const seeds = seedRows.map((r) => r.recipeId);
	if (seeds.length === 0) return;

	// Dependents exist — now load the full graph for the transitive walk + ordering.
	const { childrenOf, parentsOf } = await loadSubRecipeGraph();
	const affected = new Set<string>(seeds);
	for (const ancestor of collectTransitiveParents(seeds, parentsOf)) affected.add(ancestor);

	// Recompute children before parents; each in its own transaction. Errors surface (not
	// swallowed) — but because each recipe commits independently, a throw partway through
	// leaves an earlier-committed prefix fresh and the rest STALE, and 500s the caller. This
	// is partial-staleness, not corruption: leaves-first ordering guarantees no committed
	// parent rolled up a stale child, so the set self-heals on the next edit or a
	// `recipe:reindex`. (No cross-recipe atomicity — per plan: no background jobs.)
	const ordered = orderLeavesFirst([...affected], childrenOf);
	for (const rid of ordered) {
		await prisma.$transaction((tx) => recomputeRecipe(tx, rid));
	}

	// One batched Meili write for the whole fan-out (swallow + log — reconverges via reindex).
	await syncAfterCommit(() => syncRecipeDocumentsBatch(ordered), `recompute:${ordered.length}`);
}

// ─── Read paths ───────────────────────────────────────────────────────────────────

/** Drop `userId` from a row (privacy: the product is non-social — owner ids never ship). */
function omitUserId<T extends { userId: unknown }>(row: T): Omit<T, "userId"> {
	const rest = { ...row };
	delete (rest as { userId?: unknown }).userId;
	return rest;
}

/**
 * Project a loaded recipe into the serializable detail-view DTO: replace `userId` with an
 * `isOwner` flag (so the owner gets the Usuń/Edytuj affordances without leaking the owner id
 * — same for a nested sub-recipe), and `Number()`-normalize the product nutrient `Decimal`s
 * so the read model matches the rest of the codebase (no `Decimal`-as-string over the wire).
 */
function toRecipeView(recipe: LoadedRecipe, viewerId: string) {
	const base = omitUserId(recipe);
	return {
		...base,
		isOwner: recipe.userId === viewerId,
		components: recipe.components.map((c) => ({
			...c,
			product: c.product
				? {
						...c.product,
						foodNutrients: c.product.foodNutrients.map((fn) => ({
							nutrientId: fn.nutrientId,
							amountPer100g: fn.amountPer100g === null ? null : Number(fn.amountPer100g),
						})),
					}
				: null,
			subRecipe: c.subRecipe ? omitUserId(c.subRecipe) : null,
		})),
	};
}

/** The detail-view read model — owner id replaced by `isOwner`, nutrient amounts numeric. */
export type RecipeView = ReturnType<typeof toRecipeView>;

/**
 * Load a recipe for the detail view, enforcing visibility: the owner sees any of their
 * recipes (incl. drafts); other viewers see only PUBLISHED + PUBLIC. Returns the projected
 * DTO (cached nutrients map + components + taxonomies) — the detail UI reads the cache from
 * Postgres, never Meili. `null` when missing or not visible to the viewer.
 */
export async function getRecipeForView(viewerId: string, id: string): Promise<RecipeView | null> {
	const recipe = await prisma.recipe.findUnique({ where: { id }, include: ROLLUP_INCLUDE });
	if (!recipe) return null;
	const visible =
		recipe.userId === viewerId ||
		(recipe.status === "PUBLISHED" && recipe.visibility === "PUBLIC");
	return visible ? toRecipeView(recipe, viewerId) : null;
}

/**
 * Load a recipe for editing — owner-only. Throws not-found / forbidden like the write paths.
 *
 * Returns the full loaded ROW (not a form-draft projection), so it is deliberately named
 * `getRecipeForEdit`, NOT the plan's `getRecipeDraftForEdit`: there is no `RecipeDraft` shape
 * yet. The editable-draft projection (numeric amounts, taxonomy refs as id-or-name, flattened
 * components — analogous to `getFoodProductDraft`) is designed against the Phase 6 `form.html`
 * probe and can take the `getRecipeDraftForEdit` name then.
 */
export async function getRecipeForEdit(userId: string, id: string): Promise<LoadedRecipe> {
	const recipe = await prisma.recipe.findUnique({ where: { id }, include: ROLLUP_INCLUDE });
	if (!recipe) throw new RecipeNotFoundError(id);
	if (recipe.userId !== userId) throw new RecipeForbiddenError(id);
	return recipe;
}

/**
 * List the viewer's own DRAFT recipes (the `Szkice N` scope segment). Drafts are never
 * indexed in Meili, so this scope is served straight from Postgres (plan: Phase 4).
 */
export function listOwnDrafts(userId: string): Promise<LoadedRecipe[]> {
	return prisma.recipe.findMany({
		where: { userId, status: "DRAFT" },
		include: ROLLUP_INCLUDE,
		orderBy: { updatedAt: "desc" },
	});
}

// ─── Search ─────────────────────────────────────────────────────────────────────

/** An empty facet-distribution set (the draft scope carries no facets — the probe shows none). */
const EMPTY_RECIPE_FACETS: RecipeSearchResult["facets"] = {
	mealTypeSlugs: {},
	dietSlugs: {},
	allergenSlugs: {},
	techniqueSlugs: {},
	cuisineSlug: {},
	difficulty: {},
};

/**
 * The single typed recipe search, used by both the SSR page load and the thin GET endpoint.
 * Mirrors `searchFoodProducts`: one `multiSearch` round-trip delivers disjunctive facets (a
 * query per dimension, each omitting its own filter) alongside the hits query. Query
 * construction + shaping are pure (`recipe-document.ts`); this does only the I/O, threading
 * `viewerId` so the base visibility filter (`visibility = PUBLIC OR ownerId = viewerId`) is
 * always applied.
 *
 * `scope === "szkice"` (the viewer's own drafts) BYPASSES Meili — drafts are never indexed —
 * and is served from Postgres via `listOwnDrafts`, projected into the SAME card read model so
 * the browse UI consumes one shape. Drafts carry no facets and are paginated in memory.
 */
export async function searchRecipes(
	params: RecipeSearchParams,
	viewerId: string,
): Promise<RecipeSearchResult> {
	if (params.scope === "szkice") {
		const drafts = await listOwnDrafts(viewerId);
		const start = (params.page - 1) * params.limit;
		const hits: RecipeDocument[] = drafts
			.slice(start, start + params.limit)
			.map((r) => buildRecipeDocument(toDocInput(r)));
		return { hits, total: drafts.length, page: params.page, limit: params.limit, facets: EMPTY_RECIPE_FACETS };
	}

	const queries = buildRecipeSearchQueries(params, viewerId);
	const { results } = await meili.multiSearch<MultiSearchParams, RecipeDocument>({ queries });
	return shapeRecipeSearchResults(params, results);
}
