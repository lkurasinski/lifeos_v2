/**
 * Full reindex of the food_products Meilisearch index from the database.
 *
 * Shared core used by BOTH:
 *   - the tsx batch step (`scripts/steps/index-meilisearch.ts`, via relative `.js` import), and
 *   - the deployed app's admin endpoint (`/api/admin/reindex`, via `$lib`).
 *
 * Takes the Prisma + Meili clients as arguments so it depends on neither `$lib/server/db`,
 * `$lib/server/search`, nor `$env/*` — that keeps it loadable under tsx (which can't resolve
 * those) while still reusing the one pure document builder. On Railway the endpoint passes the
 * app's own clients, so the index is always rebuilt from the SAME database the app reads, over
 * the private network.
 *
 * Idempotent via clear-then-load: FoodProduct UUIDs are reminted on every TRUNCATE+reseed, so
 * deleteAllDocuments() first prevents stale orphans (which is how the index once drifted to
 * ~6.7K docs against ~3K rows).
 */
import type { Meilisearch } from "meilisearch";
import type { PrismaClient } from "../../generated/prisma/client";
import { buildFoodDocument, FOOD_INDEX_NAME, FOOD_INDEX_SETTINGS } from "./food-document";

const BATCH_SIZE = 1_000;

/**
 * Await a Meili task and throw on `failed`. `waitForTask` resolves on success OR failure, so
 * without this a rejected batch (bad doc, settings mismatch) would silently look indexed — a
 * reindex failure should abort loudly.
 */
async function waitForMeiliTask(meili: Meilisearch, taskUid: number): Promise<void> {
	const task = await meili.tasks.waitForTask(taskUid);
	if (task.status === "failed") {
		throw new Error(`Meili task ${taskUid} failed: ${task.error?.message ?? "unknown error"}`);
	}
}

export interface ReindexResult {
	products: number;
	indexed: number;
}

export async function reindexFoodProducts(
	prisma: PrismaClient,
	meili: Meilisearch,
	log: (msg: string) => void = () => {},
): Promise<ReindexResult> {
	const index = meili.index(FOOD_INDEX_NAME);

	// 1. Apply index settings (shared with the runtime search helper).
	log(`Configuring Meilisearch index "${FOOD_INDEX_NAME}"...`);
	await index.updateSettings(FOOD_INDEX_SETTINGS);

	// 1b. Clear stale documents — ids are reminted on every reseed.
	log("Clearing existing documents...");
	const clearTask = await index.deleteAllDocuments();
	await waitForMeiliTask(meili, clearTask.taskUid);

	// 2. Load all products with category + nutrient amounts.
	log("Loading products from database...");
	const products = await prisma.foodProduct.findMany({
		include: {
			category: true,
			foodNutrients: true,
		},
	});
	log(`  Loaded ${products.length} products`);

	if (products.length === 0) {
		log("  No products to index.");
		return { products: 0, indexed: 0 };
	}

	// 3. Transform to the shared document shape.
	const docs = products.map((p) =>
		buildFoodDocument(
			p,
			p.foodNutrients.map((fn) => ({
				nutrientId: fn.nutrientId,
				amountPer100g: fn.amountPer100g === null ? null : Number(fn.amountPer100g),
			})),
			p.category,
		),
	);

	// 4. Bulk index in batches.
	log(`Indexing ${docs.length} documents in batches of ${BATCH_SIZE}...`);
	let indexed = 0;
	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const batch = docs.slice(i, i + BATCH_SIZE);
		const task = await index.addDocuments(batch, { primaryKey: "id" });
		await waitForMeiliTask(meili, task.taskUid);
		indexed += batch.length;
		log(`  Indexed ${indexed}/${docs.length}`);
	}

	log(`  Done: ${indexed} documents indexed in "${FOOD_INDEX_NAME}"`);
	return { products: products.length, indexed };
}
