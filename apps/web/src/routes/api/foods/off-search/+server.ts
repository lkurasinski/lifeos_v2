import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import { prisma } from '$lib/server/db';
import { meili } from '$lib/server/search';
import { searchOFF, buildNutrimentRows } from '$lib/server/off';
import type { RequestHandler } from './$types';

const querySchema = z.object({
	q: z.string().min(1).max(200),
});

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.session) {
		error(401, 'Unauthorized');
	}

	const parsed = querySchema.safeParse({ q: url.searchParams.get('q') });
	if (!parsed.success) {
		error(400, 'Parametr zapytania jest nieprawidłowy');
	}

	const { q } = parsed.data;

	const offProducts = await searchOFF(q);
	if (offProducts.length === 0) {
		return json({ products: [] });
	}

	// Pre-load nutrient id map: INFOODS tagname → DB UUID (one query per request)
	const allNutrients = await prisma.nutrient.findMany({
		select: { infoodsTagname: true, id: true },
	});
	const nutrientIdMap = new Map(allNutrients.map((n) => [n.infoodsTagname, n.id]));

	// Find which products are already stored
	const barcodes = offProducts.map((p) => p.code).filter(Boolean);
	const existing = await prisma.foodProduct.findMany({
		where: { source: 'OFF', sourceId: { in: barcodes } },
		select: { id: true, sourceId: true, nameEn: true, namePl: true, sourceCategory: true },
	});
	const existingBarcodes = new Set(existing.map((p) => p.sourceId));

	const newProducts = offProducts.filter((p) => p.code && !existingBarcodes.has(p.code));

	let inserted: typeof existing = [];

	if (newProducts.length > 0) {
		inserted = await prisma.$transaction(async (tx) => {
			const created: typeof existing = [];

			for (const product of newProducts) {
				if (!product.code) continue;

				const foodProduct = await tx.foodProduct.create({
					data: {
						source: 'OFF',
						sourceId: product.code,
						nameEn: product.product_name || product.code,
						namePl: product.product_name_pl ?? null,
						sourceCategory: product.categories_tags?.[0] ?? null,
					},
					select: {
						id: true,
						sourceId: true,
						nameEn: true,
						namePl: true,
						sourceCategory: true,
					},
				});

				if (product.nutriments) {
					const nutrimentRows = buildNutrimentRows(product.nutriments, nutrientIdMap);
					if (nutrimentRows.length > 0) {
						await tx.foodNutrient.createMany({
							data: nutrimentRows.map((row) => ({ foodId: foodProduct.id, ...row })),
						});
					}
				}

				created.push(foodProduct);
			}

			return created;
		});

		// Index new products in Meilisearch (outside transaction — recoverable via --step index)
		if (inserted.length > 0) {
			const docs = inserted.map((p) => ({
				id: p.id,
				namePl: p.namePl,
				nameEn: p.nameEn,
				source: 'OFF',
				sourceId: p.sourceId,
				categorySlug: null,
				categoryNamePl: null,
				servingSizeG: null,
			}));
			const index = meili.index('food_products');
			const task = await index.addDocuments(docs, { primaryKey: 'id' });
			await meili.tasks.waitForTask(task.taskUid);
		}
	}

	return json({ products: [...existing, ...inserted] });
};
