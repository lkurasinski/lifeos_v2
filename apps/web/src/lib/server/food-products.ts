/**
 * Shared product persistence, Postgres→Meilisearch sync, and the nutrient registry.
 *
 * The single home for create/update/delete used by ALL app endpoints (never the
 * tsx batch step — that imports the pure `./food-document` directly). Keeping every
 * write path here, building the Meili doc through the one shared builder, prevents
 * the catalog's read model from drifting from the live mutations.
 *
 * Meili sync stays OUTSIDE the DB transaction (matching the batch pattern): a failed
 * index task leaves a recoverable DB row that `--step index` will pick up.
 */
import type { MultiSearchParams } from "meilisearch";
import { prisma } from "$lib/server/db";
import { meili } from "$lib/server/search";
import { logger } from "$lib/server/logger";
import { waitForMeiliTask, syncAfterCommit, makeIndexConfigurer } from "$lib/server/meili-sync";
import { memoizeAsync } from "$lib/server/memoize";
import { isUniqueConstraintError, isForeignKeyConstraintError } from "$lib/server/prisma-errors";
import {
	buildFoodDocument,
	buildFoodSearchQueries,
	shapeFoodSearchResults,
	FOOD_INDEX_NAME,
	FOOD_INDEX_SETTINGS,
} from "./food-document";
import { searchOFF, getOFFProductByBarcode, buildNutrimentRows } from "$lib/server/off";
import { recomputeDependents } from "$lib/server/recipes";
import { offToDraft } from "$lib/food/off-mapping";
import {
	isBarcodeQuery,
	partitionNutrients,
	resolveSourceId,
	shouldFlagUserModified,
	type SavePayload,
	type PatchPayload,
	type SearchParams,
	type DraftProduct,
	type FoodSource,
	type FoodDocument,
	type FoodSearchResult,
	type FoodCategoryMeta,
	type NutrientRegistryEntry,
	type NutrientRegistryGroup,
	type PreviewResult,
} from "$lib/food/schema";

/** Thrown when a `(source, sourceId)` already exists — the dedup rule. */
export class FoodProductConflictError extends Error {
	constructor(public existingId: string) {
		super("Food product already exists");
		this.name = "FoodProductConflictError";
	}
}

/** Thrown when an update/delete targets a missing product. */
export class FoodProductNotFoundError extends Error {
	constructor(public id: string) {
		super("Food product not found");
		this.name = "FoodProductNotFoundError";
	}
}

/** Thrown when a product can't be deleted because recipes map ingredients to it. */
export class FoodProductInUseError extends Error {
	constructor(public referencingRecipeIds: string[]) {
		super("Food product is used by recipes");
		this.name = "FoodProductInUseError";
	}
}

/** Thrown when a payload references a `nutrientId` that is not a known Nutrient tag.
 *  `nutrientId` is a natural key (INFOODS tagname) the client sends, so an unknown
 *  value trips the FK (P2003) on insert — surface it as a 400, not a 500. */
export class UnknownNutrientError extends Error {
	constructor() {
		super("Unknown nutrient id");
		this.name = "UnknownNutrientError";
	}
}

// ─── Meili single-doc sync helpers ────────────────────────────────────────────

/**
 * The runtime index configurer (shared plumbing). `configureFoodIndex` applies the settings
 * idempotently; `ensureConfigured` runs once per process before the first live `addDocuments`.
 * Mirrors the batch step's `updateSettings` (same constant), so search/facet/sort behavior is
 * identical whether the index was last touched by a reseed or a live mutation.
 */
const foodIndex = makeIndexConfigurer(FOOD_INDEX_NAME, FOOD_INDEX_SETTINGS);
export const configureFoodIndex = foodIndex.configure;

/** Rebuild and push the single Meili document for a product (no-op if it vanished). */
export async function syncFoodDocument(id: string): Promise<void> {
	const product = await prisma.foodProduct.findUnique({
		where: { id },
		include: {
			category: true,
			foodNutrients: true,
		},
	});
	if (!product) return;

	const doc = buildFoodDocument(
		product,
		product.foodNutrients.map((fn) => ({
			nutrientId: fn.nutrientId,
			amountPer100g: fn.amountPer100g === null ? null : Number(fn.amountPer100g),
		})),
		product.category,
	);

	await foodIndex.ensureConfigured();
	const index = meili.index(FOOD_INDEX_NAME);
	const task = await index.addDocuments([doc], { primaryKey: "id" });
	await waitForMeiliTask(task.taskUid);
}

/** Remove a product's Meili document. */
export async function removeFoodDocument(id: string): Promise<void> {
	const index = meili.index(FOOD_INDEX_NAME);
	const task = await index.deleteDocument(id);
	await waitForMeiliTask(task.taskUid);
}

/** The catalog-index reconvergence path, appended to the shared `syncAfterCommit` log line. */
const FOOD_SYNC_RECOVERY = "catalog index stale; recover via search:reindex";

// ─── Write paths ──────────────────────────────────────────────────────────────

/**
 * Create a product + its non-null nutrient rows, then sync the Meili doc.
 * For CUSTOM sources, generates a `sourceId` when none is supplied. Throws
 * `FoodProductConflictError` when `(source, sourceId)` already exists.
 */
export async function saveFoodProduct(input: SavePayload) {
	const sourceId = resolveSourceId(input.source, input.sourceId);

	const existing = await prisma.foodProduct.findUnique({
		where: { source_sourceId: { source: input.source, sourceId } },
		select: { id: true },
	});
	if (existing) {
		throw new FoodProductConflictError(existing.id);
	}

	let product;
	try {
		product = await prisma.$transaction(async (tx) => {
			const created = await tx.foodProduct.create({
				data: {
					source: input.source,
					sourceId,
					nameEn: input.nameEn,
					namePl: input.namePl ?? null,
					brand: input.brand ?? null,
					categoryId: input.categoryId ?? null,
					servingSizeG: input.servingSizeG ?? null,
					densityGPerMl: input.densityGPerMl ?? null,
					pieceWeightG: input.pieceWeightG ?? null,
					imageUrl: input.imageUrl ?? null,
					imageThumbUrl: input.imageThumbUrl ?? null,
					imageIngredientsUrl: input.imageIngredientsUrl ?? null,
					imageNutritionUrl: input.imageNutritionUrl ?? null,
				},
			});
			const rows = input.nutrients.filter((n) => n.amountPer100g !== null);
			if (rows.length > 0) {
				await tx.foodNutrient.createMany({
					data: rows.map((n) => ({
						foodId: created.id,
						nutrientId: n.nutrientId,
						amountPer100g: n.amountPer100g,
					})),
				});
			}
			return created;
		});
	} catch (err) {
		// The findUnique pre-check above is not atomic with the create; a concurrent
		// save of the same (source, sourceId) loses the race here on the DB unique
		// constraint (P2002). Re-query and surface the same 409 as the pre-check.
		if (isUniqueConstraintError(err)) {
			logger.warn({ err }, "concurrent save race — re-querying");
			const conflict = await prisma.foodProduct.findUnique({
				where: { source_sourceId: { source: input.source, sourceId } },
				select: { id: true },
			});
			throw new FoodProductConflictError(conflict?.id ?? sourceId);
		}
		// A nutrientId that isn't a seeded Nutrient tag trips the FK (P2003).
		if (isForeignKeyConstraintError(err)) {
			throw new UnknownNutrientError();
		}
		throw err;
	}

	await syncAfterCommit(() => syncFoodDocument(product.id), product.id, FOOD_SYNC_RECOVERY);
	return product;
}

/**
 * Update a product's names/category/serving size and reconcile its nutrient rows to
 * match the input (a nutrient set to null removes its row, distinct from 0). Sets
 * `userModified = true` for non-CUSTOM sources, then re-syncs the Meili doc.
 */
export async function updateFoodProduct(id: string, input: PatchPayload) {
	const existing = await prisma.foodProduct.findUnique({
		where: { id },
		select: { source: true },
	});
	if (!existing) {
		throw new FoodProductNotFoundError(id);
	}

	const { present, removed } = partitionNutrients(input.nutrients);
	const flagModified = shouldFlagUserModified(existing.source);

	try {
		await prisma.$transaction(async (tx) => {
			await tx.foodProduct.update({
				where: { id },
				data: {
					nameEn: input.nameEn,
					namePl: input.namePl ?? null,
					brand: input.brand ?? null,
					categoryId: input.categoryId ?? null,
					servingSizeG: input.servingSizeG ?? null,
					densityGPerMl: input.densityGPerMl ?? null,
					pieceWeightG: input.pieceWeightG ?? null,
					imageUrl: input.imageUrl ?? null,
					imageThumbUrl: input.imageThumbUrl ?? null,
					imageIngredientsUrl: input.imageIngredientsUrl ?? null,
					imageNutritionUrl: input.imageNutritionUrl ?? null,
					...(flagModified ? { userModified: true } : {}),
				},
			});

			if (removed.length > 0) {
				await tx.foodNutrient.deleteMany({
					where: { foodId: id, nutrientId: { in: removed } },
				});
			}
			for (const n of present) {
				await tx.foodNutrient.upsert({
					where: { foodId_nutrientId: { foodId: id, nutrientId: n.nutrientId } },
					create: { foodId: id, nutrientId: n.nutrientId, amountPer100g: n.amountPer100g },
					update: { amountPer100g: n.amountPer100g },
				});
			}
		});
	} catch (err) {
		// A nutrientId that isn't a seeded Nutrient tag trips the FK (P2003).
		if (isForeignKeyConstraintError(err)) {
			throw new UnknownNutrientError();
		}
		throw err;
	}

	await syncAfterCommit(() => syncFoodDocument(id), id, FOOD_SYNC_RECOVERY);
	// A product's macros changed → recompute every recipe that maps an ingredient to it,
	// up the sub-recipe graph. CORRECTNESS (cached recipe nutrition): surfaced, not swallowed.
	await recomputeDependents({ productId: id });
	return prisma.foodProduct.findUnique({ where: { id } });
}

/**
 * Load a persisted product as an editable `DraftProduct` for the edit route. Reads
 * Postgres directly (NOT the Meili hit) so the draft carries `categoryId` and all four
 * image fields verbatim — the Meili doc only has `categorySlug` and would leave
 * `categoryId` null. Nutrient rows map by `nutrientId` (present values only;
 * NULL = "no data" stays absent, never 0). Returns null when the id is unknown.
 */
export async function getFoodProductDraft(id: string): Promise<DraftProduct | null> {
	const product = await prisma.foodProduct.findUnique({
		where: { id },
		include: { foodNutrients: true },
	});
	if (!product) return null;

	return {
		source: product.source as FoodSource,
		sourceId: product.sourceId,
		nameEn: product.nameEn,
		namePl: product.namePl,
		brand: product.brand,
		categoryId: product.categoryId,
		servingSizeG: product.servingSizeG,
		densityGPerMl: product.densityGPerMl,
		pieceWeightG: product.pieceWeightG,
		imageUrl: product.imageUrl,
		imageThumbUrl: product.imageThumbUrl,
		imageIngredientsUrl: product.imageIngredientsUrl,
		imageNutritionUrl: product.imageNutritionUrl,
		nutrients: product.foodNutrients
			.filter((fn) => fn.amountPer100g !== null)
			.map((fn) => ({ nutrientId: fn.nutrientId, amountPer100g: Number(fn.amountPer100g) })),
	};
}

/**
 * Delete a product (FoodNutrient cascades) and remove its Meili document. Blocked
 * (throws `FoodProductInUseError`) when any recipe maps an ingredient to it — the
 * live-FK integrity rule that keeps recipe nutrition from referencing a deleted product.
 */
export async function deleteFoodProduct(id: string): Promise<void> {
	const existing = await prisma.foodProduct.findUnique({ where: { id }, select: { id: true } });
	if (!existing) {
		throw new FoodProductNotFoundError(id);
	}
	const refs = await prisma.recipeComponent.findMany({
		where: { productId: id },
		select: { recipeId: true },
		distinct: ["recipeId"],
	});
	if (refs.length > 0) {
		throw new FoodProductInUseError(refs.map((r) => r.recipeId));
	}
	await prisma.foodProduct.delete({ where: { id } });
	await syncAfterCommit(() => removeFoodDocument(id), id, FOOD_SYNC_RECOVERY);
}

/** Per-id outcome of a batch delete: `notFound` is folded into "removed" by callers (already gone). */
export type BulkDeleteResult = { deleted: string[]; inUse: string[]; notFound: string[] };

/**
 * Delete several products in one call, best-effort: each id is attempted independently so an
 * in-use product (referenced by a recipe) is skipped and reported rather than aborting the whole
 * batch. Reuses `deleteFoodProduct`, so the per-product recipe-reference guard and Meili de-index
 * still apply. Ids are de-duplicated first. Unexpected errors propagate (→ 500).
 */
export async function deleteFoodProducts(ids: string[]): Promise<BulkDeleteResult> {
	const result: BulkDeleteResult = { deleted: [], inUse: [], notFound: [] };
	for (const id of [...new Set(ids)]) {
		try {
			await deleteFoodProduct(id);
			result.deleted.push(id);
		} catch (err) {
			if (err instanceof FoodProductNotFoundError) result.notFound.push(id);
			else if (err instanceof FoodProductInUseError) result.inUse.push(id);
			else throw err;
		}
	}
	return result;
}

// ─── Nutrient registry ────────────────────────────────────────────────────────

/**
 * Load the 74-row nutrient registry grouped by category and ordered by displayRank
 * (used by the manual form and the detail-view join). The Nutrient PK (`id`) is the
 * INFOODS tagname, so no tag→id projection is needed.
 */
type NutrientRegistry = { groups: NutrientRegistryGroup[] };

// Reference data that never changes during S-01 (the Nutrient registry is read-only; categories
// have no mutation path in this slice). `memoizeAsync` shares one in-flight promise so the
// per-navigation catalog load doesn't re-query on every facet/sort/page change, resetting on
// rejection so a failed first load can retry. Treat the cached values as read-only.
export const getNutrientRegistry = memoizeAsync(loadNutrientRegistry);

async function loadNutrientRegistry(): Promise<NutrientRegistry> {
	const rows = await prisma.nutrient.findMany({
		select: {
			id: true,
			nameEn: true,
			namePl: true,
			unit: true,
			category: true,
			displayRank: true,
		},
		orderBy: [{ displayRank: { sort: "asc", nulls: "last" } }],
	});

	const groupsMap = new Map<string, NutrientRegistryEntry[]>();
	for (const r of rows) {
		const entry: NutrientRegistryEntry = {
			id: r.id,
			nameEn: r.nameEn,
			namePl: r.namePl,
			unit: r.unit,
			category: r.category,
			displayRank: r.displayRank,
		};
		const list = groupsMap.get(r.category);
		if (list) list.push(entry);
		else groupsMap.set(r.category, [entry]);
	}

	const groups: NutrientRegistryGroup[] = [...groupsMap.entries()].map(([category, nutrients]) => ({
		category,
		nutrients,
	}));

	return { groups };
}

/**
 * Load every catalog category (slug + names) ordered by Polish name. The browse
 * facet chips need names + a stable order for ALL categories, including ones absent
 * from the current page of hits — the search facet distribution only carries
 * `slug → count`, so the names come from here.
 */
export const getFoodCategories = memoizeAsync(loadFoodCategories);

async function loadFoodCategories(): Promise<FoodCategoryMeta[]> {
	return prisma.foodCategory.findMany({
		select: { id: true, slug: true, namePl: true, nameEn: true },
		orderBy: { namePl: "asc" },
	});
}

// ─── OFF preview (no-write) ─────────────────────────────────────────────────────

/**
 * Build the OFF add-flow preview for a name or EAN barcode: fetch from Open Food Facts,
 * map nutriments through the registry, and return an editable canonical `DraftProduct`
 * per result, flagging any that already live in the catalog. Reads only — NOTHING is
 * written here (the PRD accuracy guardrail: a product lands only on an explicit Save).
 * Throws `OFFError` on an OFF transport failure (the endpoint maps 429/5xx); any other
 * error (e.g. DB) propagates as a genuine 500.
 */
export async function buildOffPreview(query: string): Promise<PreviewResult[]> {
	// Smart detection: 8–14 digits → barcode (single-product lookup); else free text.
	const offProducts = isBarcodeQuery(query)
		? await getOFFProductByBarcode(query.replace(/\s+/g, "")).then((p) => (p ? [p] : []))
		: await searchOFF(query);
	if (offProducts.length === 0) return [];

	// The category slug→id map lets OFF `categories_tags` pre-fill the form's category.
	// (Nutriment mapping no longer needs the registry — buildNutrimentRows emits the
	// INFOODS tagname directly, which IS the Nutrient PK.)
	const categories = await getFoodCategories();
	const categorySlugToId = new Map(categories.map((c) => [c.slug, c.id]));

	// Dedup metadata: which of these barcodes already exist as OFF products.
	const codes = offProducts.map((p) => p.code).filter(Boolean);
	const existing = await prisma.foodProduct.findMany({
		where: { source: "OFF", sourceId: { in: codes } },
		select: { id: true, sourceId: true },
	});
	const existingByCode = new Map(existing.map((e) => [e.sourceId, e.id]));

	const results: PreviewResult[] = [];
	for (const product of offProducts) {
		if (!product.code) continue; // malformed entry → skip
		const rows = product.nutriments ? buildNutrimentRows(product.nutriments) : [];
		const draft = offToDraft(product, rows, categorySlugToId);
		const existingId = existingByCode.get(product.code);
		results.push(existingId ? { draft, existing: { id: existingId } } : { draft });
	}
	return results;
}

// ─── Read path: search ──────────────────────────────────────────────────────────

/**
 * The single typed catalog search, used by both the SSR page load and the thin GET
 * endpoint. One `multiSearch` round-trip delivers disjunctive facets: a query per
 * facet dimension (each omitting its own filter) alongside the hits query, so a
 * selected filter narrows the OTHER facets without collapsing its own chips. The
 * query construction + result shaping are pure (`food-document.ts`); this function
 * only performs the I/O.
 */
export async function searchFoodProducts(params: SearchParams): Promise<FoodSearchResult> {
	const queries = buildFoodSearchQueries(params);
	const { results } = await meili.multiSearch<MultiSearchParams, FoodDocument>({ queries });
	return shapeFoodSearchResults(params, results);
}
