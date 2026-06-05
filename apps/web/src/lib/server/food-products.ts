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
import {
	buildFoodDocument,
	buildFoodSearchQueries,
	shapeFoodSearchResults,
	FOOD_INDEX_NAME,
	FOOD_INDEX_SETTINGS,
} from "./food-document";
import {
	partitionNutrients,
	shouldFlagUserModified,
	type SavePayload,
	type PatchPayload,
	type SearchParams,
	type FoodDocument,
	type FoodSearchResult,
	type FoodCategoryMeta,
	type NutrientRegistryEntry,
	type NutrientRegistryGroup,
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

// ─── Meili single-doc sync helpers ────────────────────────────────────────────

/**
 * Await a Meili task and throw if it ended in a `failed` state. `waitForTask`
 * resolves on ANY terminal status (succeeded OR failed), so without this check a
 * task that Meili rejected (bad doc, settings mismatch) would look like success.
 */
async function waitForMeiliTask(taskUid: number): Promise<void> {
	const task = await meili.tasks.waitForTask(taskUid);
	if (task.status === "failed") {
		throw new Error(`Meili task ${taskUid} failed: ${task.error?.message ?? "unknown error"}`);
	}
}

/** Rebuild and push the single Meili document for a product (no-op if it vanished). */
export async function syncFoodDocument(id: string): Promise<void> {
	const product = await prisma.foodProduct.findUnique({
		where: { id },
		include: {
			category: true,
			foodNutrients: { include: { nutrient: { select: { infoodsTagname: true } } } },
		},
	});
	if (!product) return;

	const doc = buildFoodDocument(
		product,
		product.foodNutrients.map((fn) => ({
			infoodsTagname: fn.nutrient.infoodsTagname,
			amountPer100g: fn.amountPer100g === null ? null : Number(fn.amountPer100g),
		})),
		product.category,
	);

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

/**
 * Run a Meili sync side-effect AFTER a committed DB write. The DB row is the
 * authoritative record, so an index failure must never mask a successful write:
 * log it (the recoverable-drift signal) and swallow. The catalog index reconverges
 * on the next mutation or a `search:reindex` (`--step index`) run.
 */
async function syncAfterCommit(op: () => Promise<void>, id: string): Promise<void> {
	try {
		await op();
	} catch (err) {
		console.error(
			`[food-products] Meili sync failed for ${id} after a committed DB write — ` +
				"the catalog index is stale for this product until the next mutation or `search:reindex`.",
			err,
		);
	}
}

// ─── Write paths ──────────────────────────────────────────────────────────────

/**
 * Create a product + its non-null nutrient rows, then sync the Meili doc.
 * For CUSTOM sources, generates a `sourceId` when none is supplied. Throws
 * `FoodProductConflictError` when `(source, sourceId)` already exists.
 */
export async function saveFoodProduct(input: SavePayload) {
	const sourceId =
		input.sourceId ?? (input.source === "CUSTOM" ? crypto.randomUUID() : undefined);
	if (!sourceId) {
		throw new Error("sourceId is required for non-CUSTOM products");
	}

	const existing = await prisma.foodProduct.findUnique({
		where: { source_sourceId: { source: input.source, sourceId } },
		select: { id: true },
	});
	if (existing) {
		throw new FoodProductConflictError(existing.id);
	}

	const product = await prisma.$transaction(async (tx) => {
		const created = await tx.foodProduct.create({
			data: {
				source: input.source,
				sourceId,
				nameEn: input.nameEn,
				namePl: input.namePl ?? null,
				categoryId: input.categoryId ?? null,
				servingSizeG: input.servingSizeG ?? null,
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

	await syncAfterCommit(() => syncFoodDocument(product.id), product.id);
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

	await prisma.$transaction(async (tx) => {
		await tx.foodProduct.update({
			where: { id },
			data: {
				nameEn: input.nameEn,
				namePl: input.namePl ?? null,
				categoryId: input.categoryId ?? null,
				servingSizeG: input.servingSizeG ?? null,
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

	await syncAfterCommit(() => syncFoodDocument(id), id);
	return prisma.foodProduct.findUnique({ where: { id } });
}

/** Delete a product (FoodNutrient cascades) and remove its Meili document. */
export async function deleteFoodProduct(id: string): Promise<void> {
	const existing = await prisma.foodProduct.findUnique({ where: { id }, select: { id: true } });
	if (!existing) {
		throw new FoodProductNotFoundError(id);
	}
	await prisma.foodProduct.delete({ where: { id } });
	await syncAfterCommit(() => removeFoodDocument(id), id);
}

// ─── Nutrient registry ────────────────────────────────────────────────────────

/**
 * Load the 74-row nutrient registry grouped by category and ordered by displayRank
 * (used by the manual form, the detail-view join, and tag→id resolution on save).
 * Returns the grouped registry plus the `infoodsTagname → id` map.
 */
export async function getNutrientRegistry(): Promise<{
	groups: NutrientRegistryGroup[];
	tagToId: Map<string, string>;
}> {
	const rows = await prisma.nutrient.findMany({
		select: {
			id: true,
			infoodsTagname: true,
			nameEn: true,
			namePl: true,
			unit: true,
			category: true,
			displayRank: true,
		},
		orderBy: [{ displayRank: { sort: "asc", nulls: "last" } }],
	});

	const tagToId = new Map<string, string>(rows.map((r) => [r.infoodsTagname, r.id]));

	const groupsMap = new Map<string, NutrientRegistryEntry[]>();
	for (const r of rows) {
		const entry: NutrientRegistryEntry = {
			id: r.id,
			infoodsTagname: r.infoodsTagname,
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

	return { groups, tagToId };
}

/**
 * Load every catalog category (slug + names) ordered by Polish name. The browse
 * facet chips need names + a stable order for ALL categories, including ones absent
 * from the current page of hits — the search facet distribution only carries
 * `slug → count`, so the names come from here.
 */
export async function getFoodCategories(): Promise<FoodCategoryMeta[]> {
	return prisma.foodCategory.findMany({
		select: { slug: true, namePl: true, nameEn: true },
		orderBy: { namePl: "asc" },
	});
}

// ─── Read path: index config + search ──────────────────────────────────────────

/**
 * Apply the shared `FOOD_INDEX_SETTINGS` to the runtime singleton index. Mirrors the
 * batch step's `updateSettings` (which applies the SAME constant to its own injected
 * client) so search/facet/sort behavior is identical whether the index was last
 * touched by a reseed or a live mutation. Idempotent.
 */
export async function configureFoodIndex(): Promise<void> {
	const index = meili.index(FOOD_INDEX_NAME);
	const task = await index.updateSettings(FOOD_INDEX_SETTINGS);
	await waitForMeiliTask(task.taskUid);
}

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
