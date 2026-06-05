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
import { prisma } from "$lib/server/db";
import { meili } from "$lib/server/search";
import { buildFoodDocument, FOOD_INDEX_NAME } from "./food-document";
import {
	partitionNutrients,
	shouldFlagUserModified,
	type SavePayload,
	type PatchPayload,
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
	await meili.tasks.waitForTask(task.taskUid);
}

/** Remove a product's Meili document. */
export async function removeFoodDocument(id: string): Promise<void> {
	const index = meili.index(FOOD_INDEX_NAME);
	const task = await index.deleteDocument(id);
	await meili.tasks.waitForTask(task.taskUid);
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

	await syncFoodDocument(product.id);
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

	await syncFoodDocument(id);
	return prisma.foodProduct.findUnique({ where: { id } });
}

/** Delete a product (FoodNutrient cascades) and remove its Meili document. */
export async function deleteFoodProduct(id: string): Promise<void> {
	const existing = await prisma.foodProduct.findUnique({ where: { id }, select: { id: true } });
	if (!existing) {
		throw new FoodProductNotFoundError(id);
	}
	await prisma.foodProduct.delete({ where: { id } });
	await removeFoodDocument(id);
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
