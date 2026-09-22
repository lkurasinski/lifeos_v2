/**
 * Step: import-jsonl
 *
 * Reseeds the catalog from a JSONL snapshot produced by export-catalog-jsonl.ts. This is
 * the canonical reset path after the one-time USDA import + curation: it is fast, needs
 * no USDA CSV dump, and upserts by id so existing recipe_component → food_product FKs
 * stay valid (ids are NOT reminted, unlike the USDA import).
 *
 * Idempotent: categories and products are upserted by id; each product's nutrient rows
 * are fully replaced (delete + recreate). By default it does NOT delete products absent
 * from the snapshot — it reconciles the snapshot's rows back into place.
 *
 * With `--reset` it additionally makes the catalog match the snapshot 1:1 by deleting
 * products whose id is not in the snapshot. A full wipe-then-load is avoided on purpose:
 * deleting a product referenced by a recipe_component would SetNull the optional FK and
 * orphan the component, so referenced extras are skipped and reported instead.
 *
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl
 *   pnpm tsx scripts/seed-food-data.ts --step import-jsonl --reset
 *
 * Counterpart: export-catalog-jsonl.ts (`--step export-jsonl`).
 */

import { readFileSync, existsSync } from "fs";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { FoodSource } from "../../src/generated/prisma/client.js";
import { defaultCatalogPath } from "./export-catalog-jsonl.js";

interface CategoryLine {
	kind: "category";
	id: string;
	slug: string;
	namePl: string;
	nameEn: string;
}

interface ProductLine {
	kind: "product";
	id: string;
	source: FoodSource;
	sourceId: string;
	nameEn: string;
	namePl: string | null;
	brand: string | null;
	categoryId: string | null;
	sourceCategory: string | null;
	servingSizeG: number | null;
	densityGPerMl: number | null;
	pieceWeightG: number | null;
	userModified: boolean;
	imageUrl: string | null;
	imageThumbUrl: string | null;
	imageIngredientsUrl: string | null;
	imageNutritionUrl: string | null;
	nutrients: Array<{ nutrientId: string; amountPer100g: string | null }>;
}

export async function importFromJsonl(
	prisma: PrismaClient,
	options: { reset?: boolean; inPath?: string } = {},
): Promise<void> {
	const { reset = false, inPath = defaultCatalogPath() } = options;
	if (!existsSync(inPath)) {
		throw new Error(
			`Catalog snapshot not found: ${inPath}\nRun \`--step export-jsonl\` first to create it.`,
		);
	}

	const lines = readFileSync(inPath, "utf-8")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	const categories: CategoryLine[] = [];
	const products: ProductLine[] = [];
	for (const line of lines) {
		const rec = JSON.parse(line) as CategoryLine | ProductLine;
		if (rec.kind === "category") categories.push(rec);
		else if (rec.kind === "product") products.push(rec);
	}

	console.log(
		`  Loaded ${categories.length} categories, ${products.length} products from ${inPath}`,
	);

	// 1. Categories first — products reference them by id.
	for (const c of categories) {
		await prisma.foodCategory.upsert({
			where: { id: c.id },
			create: { id: c.id, slug: c.slug, namePl: c.namePl, nameEn: c.nameEn },
			update: { slug: c.slug, namePl: c.namePl, nameEn: c.nameEn },
		});
	}

	// 2. Products (upsert by id) + full nutrient replacement.
	let imported = 0;
	let totalNutrients = 0;
	for (const p of products) {
		const scalars = {
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
		};

		await prisma.foodProduct.upsert({
			where: { id: p.id },
			create: { id: p.id, ...scalars },
			update: scalars,
		});

		// Replace nutrient rows wholesale — keeps the snapshot authoritative.
		await prisma.foodNutrient.deleteMany({ where: { foodId: p.id } });
		if (p.nutrients.length > 0) {
			await prisma.foodNutrient.createMany({
				data: p.nutrients.map((n) => ({
					foodId: p.id,
					nutrientId: n.nutrientId,
					amountPer100g: n.amountPer100g,
				})),
				skipDuplicates: true,
			});
			totalNutrients += p.nutrients.length;
		}

		imported++;
		if (imported % 500 === 0) {
			console.log(`  Progress: ${imported}/${products.length} products`);
		}
	}

	console.log(`  Done: ${imported} products, ${totalNutrients} nutrient rows`);

	// --reset: prune products not present in the snapshot so the catalog matches it 1:1.
	if (reset) {
		const snapshotIds = new Set(products.map((p) => p.id));
		const all = await prisma.foodProduct.findMany({
			select: { id: true, sourceId: true, nameEn: true },
		});
		const extras = all.filter((p) => !snapshotIds.has(p.id));

		if (extras.length === 0) {
			console.log("  --reset: no extra products to delete (catalog already matches snapshot)");
			return;
		}

		// Never delete a product referenced by a recipe component (productId is an optional
		// FK → onDelete SetNull would silently orphan the component and violate its CHECK).
		const referenced = await prisma.recipeComponent.findMany({
			where: { productId: { in: extras.map((p) => p.id) } },
			select: { productId: true },
		});
		const referencedIds = new Set(referenced.map((r) => r.productId));
		const safe = extras.filter((p) => !referencedIds.has(p.id));
		const skipped = extras.filter((p) => referencedIds.has(p.id));

		if (skipped.length > 0) {
			console.warn(
				`  --reset: SKIPPED ${skipped.length} extra product(s) referenced by a recipe — not deleted:`,
			);
			for (const p of skipped) console.warn(`      ${p.sourceId}  ${p.nameEn}`);
		}

		const del = await prisma.foodProduct.deleteMany({
			where: { id: { in: safe.map((p) => p.id) } },
		});
		console.log(`  --reset: deleted ${del.count} product(s) not in snapshot`);
	}
}
