/**
 * Step: export-jsonl
 *
 * Snapshots the current catalog (food_category + food_product + food_nutrient) to a
 * JSONL file. After the one-time USDA import + curation, this snapshot — not the giant
 * USDA CSV dump — becomes the canonical reseed source: it is small, committable, and
 * preserves row ids so a reset keeps recipe_component → food_product FKs valid.
 *
 * Format: one JSON object per line, discriminated by `kind`. All category lines come
 * first, then product lines (each with embedded nutrients), so import can upsert
 * categories before products that reference them. Decimal amounts are serialized as
 * strings to avoid float drift.
 *
 *   pnpm tsx scripts/seed-food-data.ts --step export-jsonl
 *
 * Counterpart: import-from-jsonl.ts (`--step import-jsonl`).
 */

import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { resolveSnapshotPath } from "../../src/lib/server/catalog-snapshot.js";

// One definition of where the snapshot lives, shared with the import side. `mustExist: false`
// because the very first export is what creates the file.
export function defaultCatalogPath(): string {
	return resolveSnapshotPath({ mustExist: false });
}

export async function exportCatalogJsonl(
	prisma: PrismaClient,
	outPath: string = defaultCatalogPath(),
): Promise<void> {
	const categories = await prisma.foodCategory.findMany({
		orderBy: { slug: "asc" },
		select: { id: true, slug: true, namePl: true, nameEn: true },
	});

	const products = await prisma.foodProduct.findMany({
		orderBy: [{ source: "asc" }, { sourceId: "asc" }],
		// Nutrient rows MUST be ordered: Postgres returns them in physical order, which shifts
		// as rows are rewritten, so an unordered export reshuffles nutrients inside product
		// lines and turns `git diff` on the snapshot into noise. The snapshot is the catalog's
		// source of truth and is reviewed as a diff — it has to be deterministic.
		include: { foodNutrients: { orderBy: { nutrientId: "asc" } } },
	});

	const lines: string[] = [];

	for (const c of categories) {
		lines.push(JSON.stringify({ kind: "category", ...c }));
	}

	for (const p of products) {
		lines.push(
			JSON.stringify({
				kind: "product",
				id: p.id,
				source: p.source,
				sourceId: p.sourceId,
				nameEn: p.nameEn,
				namePl: p.namePl,
				brand: p.brand,
				categoryId: p.categoryId,
				sourceCategory: p.sourceCategory,
				servingSizeG: p.servingSizeG,
				densityGPerMl: p.densityGPerMl,
				pieceWeightG: p.pieceWeightG,
				userModified: p.userModified,
				imageUrl: p.imageUrl,
				imageThumbUrl: p.imageThumbUrl,
				imageIngredientsUrl: p.imageIngredientsUrl,
				imageNutritionUrl: p.imageNutritionUrl,
				nutrients: p.foodNutrients.map((fn) => ({
					nutrientId: fn.nutrientId,
					// Decimal → string preserves the Decimal(10,4) value exactly.
					amountPer100g: fn.amountPer100g === null ? null : fn.amountPer100g.toString(),
				})),
			}),
		);
	}

	mkdirSync(path.dirname(outPath), { recursive: true });
	writeFileSync(outPath, lines.join("\n") + "\n", "utf-8");

	const nutrientCount = products.reduce((sum, p) => sum + p.foodNutrients.length, 0);
	console.log(
		`  Exported ${categories.length} categories, ${products.length} products, ${nutrientCount} nutrient rows → ${outPath}`,
	);
}
