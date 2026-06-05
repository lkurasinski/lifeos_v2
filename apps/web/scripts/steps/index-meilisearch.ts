/**
 * Step: index
 *
 * Configure the food_products Meilisearch index and bulk-index all FoodProduct rows.
 * Idempotent via a full clear-then-load: the index is emptied with
 * deleteAllDocuments() before re-adding, because FoodProduct UUIDs are reminted
 * on every TRUNCATE+reseed — so addDocuments alone would leave stale documents
 * from prior runs (which is how the index drifted to ~6.7K against ~3K rows).
 *
 * The document shape + index settings come from the PURE module
 * `src/lib/server/food-document.ts` (imported by relative `.js` path — the `$lib`
 * alias and `$env` virtual modules don't resolve under tsx). Sharing the builder
 * keeps the batch index and the live mutation sync in lockstep.
 */

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { Meilisearch } from "meilisearch";
import {
	buildFoodDocument,
	FOOD_INDEX_NAME,
	FOOD_INDEX_SETTINGS,
} from "../../src/lib/server/food-document.js";

const BATCH_SIZE = 1_000;

export async function indexMeilisearch(prisma: PrismaClient, meili: Meilisearch) {
	// 1. Configure index settings (shared with the runtime helper)
	console.log(`Configuring Meilisearch index "${FOOD_INDEX_NAME}"...`);
	const index = meili.index(FOOD_INDEX_NAME);

	await index.updateSettings(FOOD_INDEX_SETTINGS);

	// 1b. Clear stale documents — FoodProduct ids are reminted on every reseed,
	// so without this the index accumulates orphaned docs across runs.
	console.log("Clearing existing documents...");
	const clearTask = await index.deleteAllDocuments();
	await meili.tasks.waitForTask(clearTask.taskUid);

	// 2. Load all products with category + nutrient amounts
	console.log("Loading products from database...");
	const products = await prisma.foodProduct.findMany({
		include: {
			category: true,
			foodNutrients: { include: { nutrient: { select: { infoodsTagname: true } } } },
		},
	});
	console.log(`  Loaded ${products.length} products`);

	if (products.length === 0) {
		console.log("  No products to index.");
		return;
	}

	// 3. Transform to the shared document shape
	const docs = products.map((p) =>
		buildFoodDocument(
			p,
			p.foodNutrients.map((fn) => ({
				infoodsTagname: fn.nutrient.infoodsTagname,
				amountPer100g: fn.amountPer100g === null ? null : Number(fn.amountPer100g),
			})),
			p.category,
		),
	);

	// 4. Bulk index in batches of 1,000
	console.log(`Indexing ${docs.length} documents in batches of ${BATCH_SIZE}...`);
	let indexed = 0;

	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const batch = docs.slice(i, i + BATCH_SIZE);
		const batchNum = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
		console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);

		const task = await index.addDocuments(batch, { primaryKey: "id" });
		await meili.tasks.waitForTask(task.taskUid);
		indexed += batch.length;
	}

	console.log(`  Done: ${indexed} documents indexed in "${FOOD_INDEX_NAME}"`);
}
