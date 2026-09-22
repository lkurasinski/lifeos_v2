/**
 * Replay the committed catalog snapshot into a database.
 *
 * Shared core used by BOTH:
 *   - the tsx batch step (`scripts/steps/import-from-jsonl.ts`, via relative `.js` import), and
 *   - the deployed app's admin endpoint (`/api/admin/publish-catalog`, via `$lib`).
 *
 * Mirrors `./reindex.ts`: takes the Prisma client as an argument so it depends on neither
 * `$lib/server/db` nor `$env/*`, which keeps it loadable under tsx while the endpoint passes
 * the app's own client. On Railway that means the publish runs INSIDE the deployment, against
 * its own database over the private network, from the snapshot shipped in its own build — so
 * the catalog data and the code that reads it always come from the same commit, and no
 * production credential has to live on anyone's laptop.
 *
 * `apps/web/data/catalog-seed/catalog.jsonl` is the catalog's single source of truth; the USDA
 * import that first produced it is retired (see `scripts/legacy/README.md`).
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { PrismaClient, Prisma, FoodSource } from "../../generated/prisma/client";

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

/** Where the snapshot lives, relative to each context's working directory. */
const SNAPSHOT_CANDIDATES = [
	// tsx steps and `vite dev` run from apps/web/
	"data/catalog-seed/catalog.jsonl",
	// the Railway start command runs `node apps/web/build/index.js` from the repo root
	"apps/web/data/catalog-seed/catalog.jsonl",
];

/**
 * Resolve the snapshot path for the current process. Deliberately cwd-based rather than
 * module-relative: `import.meta.url` points into `build/server/chunks/` once SvelteKit has
 * bundled this module, which would resolve to nothing on the deployed app.
 */
export function resolveSnapshotPath(options: { mustExist?: boolean } = {}): string {
	const { mustExist = true } = options;
	const candidates = SNAPSHOT_CANDIDATES.map((c) => path.resolve(process.cwd(), c));
	const found = candidates.find((c) => existsSync(c));
	if (found) return found;
	if (!mustExist) return candidates[0];
	throw new Error(
		`Catalog snapshot not found. Tried:\n${candidates.map((c) => `  ${c}`).join("\n")}\n` +
			`Run \`--step export-jsonl\` to create it, or check the working directory.`,
	);
}

export interface ImportSnapshotResult {
	products: number;
	nutrients: number;
	deleted: number;
	/** Extra products a recipe still references — reported, never deleted. */
	skipped: Array<{ sourceId: string; nameEn: string }>;
}

/**
 * The whole replay runs in ONE transaction. Nutrient rows are replaced per product
 * (delete + recreate), which leaves a product with zero nutrients in between: committing that
 * window would publish a product whose nutrition silently reads as "no data". All-or-nothing
 * is the only safe shape for a write that lands on production.
 *
 * Idempotent: categories and products are upserted by id, so ids are never reminted and
 * `recipe_component.productId` stays valid.
 *
 * With `reset` the catalog is made to match the snapshot 1:1 by deleting products absent from
 * it. A product referenced by a recipe component is skipped and reported instead: `productId`
 * is an optional FK (onDelete SetNull), so deleting it would silently orphan the component and
 * violate its one-of-productId/subRecipeId CHECK.
 */
export async function importCatalogSnapshot(
	prisma: PrismaClient,
	options: { reset?: boolean; inPath?: string; log?: (msg: string) => void } = {},
): Promise<ImportSnapshotResult> {
	const { reset = false, log = () => {} } = options;
	const inPath = options.inPath ?? resolveSnapshotPath();

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

	log(`loaded ${categories.length} categories, ${products.length} products from ${inPath}`);

	return prisma.$transaction(
		async (tx) => replay(tx, categories, products, reset, log),
		// One commit for ~4k statements: the default 5s interactive timeout is far too short,
		// and a publish that times out halfway is exactly what the transaction is here to
		// prevent. maxWait covers contention with the app's own writes.
		{ timeout: 15 * 60 * 1000, maxWait: 30 * 1000 },
	);
}

async function replay(
	tx: Prisma.TransactionClient,
	categories: CategoryLine[],
	products: ProductLine[],
	reset: boolean,
	log: (msg: string) => void,
): Promise<ImportSnapshotResult> {
	// 1. Categories first — products reference them by id.
	for (const c of categories) {
		await tx.foodCategory.upsert({
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

		await tx.foodProduct.upsert({
			where: { id: p.id },
			create: { id: p.id, ...scalars },
			update: scalars,
		});

		await tx.foodNutrient.deleteMany({ where: { foodId: p.id } });
		if (p.nutrients.length > 0) {
			await tx.foodNutrient.createMany({
				data: p.nutrients.map((n) => ({
					foodId: p.id,
					nutrientId: n.nutrientId,
					amountPer100g: n.amountPer100g,
				})),
			});
			totalNutrients += p.nutrients.length;
		}

		imported++;
		if (imported % 500 === 0) log(`progress: ${imported}/${products.length} products`);
	}

	log(`replayed ${imported} products, ${totalNutrients} nutrient rows`);

	if (!reset) return { products: imported, nutrients: totalNutrients, deleted: 0, skipped: [] };

	const snapshotIds = new Set(products.map((p) => p.id));
	const all = await tx.foodProduct.findMany({
		select: { id: true, sourceId: true, nameEn: true },
	});
	const extras = all.filter((p) => !snapshotIds.has(p.id));

	if (extras.length === 0) {
		log("reset: catalog already matches the snapshot, nothing to delete");
		return { products: imported, nutrients: totalNutrients, deleted: 0, skipped: [] };
	}

	const referenced = await tx.recipeComponent.findMany({
		where: { productId: { in: extras.map((p) => p.id) } },
		select: { productId: true },
	});
	const referencedIds = new Set(referenced.map((r) => r.productId));
	const safe = extras.filter((p) => !referencedIds.has(p.id));
	const skipped = extras
		.filter((p) => referencedIds.has(p.id))
		.map((p) => ({ sourceId: p.sourceId, nameEn: p.nameEn }));

	for (const p of skipped) {
		log(`reset: SKIPPED ${p.sourceId} ${p.nameEn} — still referenced by a recipe`);
	}

	const del = await tx.foodProduct.deleteMany({ where: { id: { in: safe.map((p) => p.id) } } });
	log(`reset: deleted ${del.count} product(s) not in the snapshot`);

	return { products: imported, nutrients: totalNutrients, deleted: del.count, skipped };
}
