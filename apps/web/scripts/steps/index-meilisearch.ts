/**
 * Step: index
 *
 * Configure the food_products Meilisearch index and bulk-index all FoodProduct rows.
 * Idempotent: addDocuments with same id overwrites existing documents.
 */

import type { PrismaClient } from '../../src/generated/prisma/client.js';
import type { Meilisearch } from 'meilisearch';

const INDEX_NAME = 'food_products';
const BATCH_SIZE = 1_000;

interface FoodDocument {
	id: string;
	namePl: string | null;
	nameEn: string;
	source: string;
	sourceId: string;
	categorySlug: string | null;
	categoryNamePl: string | null;
	servingSizeG: number | null;
}

export async function indexMeilisearch(prisma: PrismaClient, meili: Meilisearch) {
	// 1. Configure index settings
	console.log(`Configuring Meilisearch index "${INDEX_NAME}"...`);
	const index = meili.index(INDEX_NAME);

	await index.updateSettings({
		searchableAttributes: ['namePl', 'nameEn', 'categoryNamePl'],
		filterableAttributes: ['source', 'categorySlug'],
		sortableAttributes: ['nameEn'],
	});

	// 2. Load all products with category
	console.log('Loading products from database...');
	const products = await prisma.foodProduct.findMany({
		include: { category: true },
	});
	console.log(`  Loaded ${products.length} products`);

	if (products.length === 0) {
		console.log('  No products to index.');
		return;
	}

	// 3. Transform to document shape
	const docs: FoodDocument[] = products.map((p) => ({
		id: p.id,
		namePl: p.namePl ?? null,
		nameEn: p.nameEn,
		source: p.source,
		sourceId: p.sourceId,
		categorySlug: p.category?.slug ?? null,
		categoryNamePl: p.category?.namePl ?? null,
		servingSizeG: p.servingSizeG ?? null,
	}));

	// 4. Bulk index in batches of 1,000
	console.log(`Indexing ${docs.length} documents in batches of ${BATCH_SIZE}...`);
	let indexed = 0;

	for (let i = 0; i < docs.length; i += BATCH_SIZE) {
		const batch = docs.slice(i, i + BATCH_SIZE);
		const batchNum = Math.floor(i / BATCH_SIZE) + 1;
		const totalBatches = Math.ceil(docs.length / BATCH_SIZE);
		console.log(`  Batch ${batchNum}/${totalBatches} (${batch.length} documents)...`);

		const task = await index.addDocuments(batch, { primaryKey: 'id' });
		await meili.tasks.waitForTask(task.taskUid);
		indexed += batch.length;
	}

	console.log(`  Done: ${indexed} documents indexed in "${INDEX_NAME}"`);
}
