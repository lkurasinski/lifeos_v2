/**
 * RETIRED — not reachable from seed-food-data.ts. See scripts/legacy/README.md.
 *
 * Its result is baked into `catalog.jsonl`; further curation happens in the app and is
 * captured by `--step export-jsonl`.
 *
 * Was: step `curate`.
 *
 * Slims the catalog down to a planning-grade set of staple ingredients. Two passes,
 * both idempotent and run against the LIVE database (not a USDA reseed):
 *
 * 1. MERGE — collapse the per-animal categories (beef / pork / poultry /
 *    processed-meat / lamb-game) into a single `meat` category, then drop the now-empty
 *    old categories. Mirrors the static mapping in import-usda.ts so a fresh USDA import
 *    and a curate-on-live-DB converge to the same shape.
 *
 * 2. KEEP/DELETE — for the high-duplication categories (meat / seafood / nuts) USDA
 *    explodes a handful of real ingredients into hundreds of cut × fat-trim × grade
 *    variants. We keep only the USDA_SR products whose sourceId (FDC id) appears in the
 *    hand-curated shortlist TSVs under data/catalog-curation/, and delete the rest.
 *    food_nutrient rows cascade. OFF / CUSTOM products are never touched.
 *
 * SAFETY: a product referenced by a recipe_component is never deleted (productId is an
 * optional FK → onDelete defaults to SetNull, which would silently orphan the component
 * and violate its one-of-productId/subRecipeId CHECK). Referenced products are skipped
 * and reported instead.
 *
 * After running this, run `--step index` to rebuild Meilisearch, and `--step export-jsonl`
 * to snapshot the curated catalog as the canonical reseed source.
 *
 */

import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { parse as parseCsvSync } from 'csv-parse/sync';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

// USDA category slugs merged into the single `meat` category.
const MEAT_SOURCE_SLUGS = ['beef', 'pork', 'poultry', 'processed-meat', 'lamb-game'];
const MEAT_CATEGORY = { slug: 'meat', namePl: 'Mięso', nameEn: 'Meat Products' };

// Categories curated against a shortlist TSV (filename → category slug).
const CURATED: Array<{ slug: string; file: string }> = [
	{ slug: 'meat', file: 'meat-shortlist.tsv' },
	{ slug: 'seafood', file: 'seafood-shortlist.tsv' },
	{ slug: 'nuts', file: 'nuts-shortlist.tsv' },
];

function shortlistDir(): string {
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	return path.resolve(scriptDir, '../../data/catalog-curation');
}

/** Read a shortlist TSV → the set of kept sourceIds (FDC ids). */
function readKeptSourceIds(file: string): Set<string> {
	const full = path.join(shortlistDir(), file);
	if (!existsSync(full)) {
		throw new Error(`Shortlist not found: ${full}`);
	}
	const rows = parseCsvSync(readFileSync(full, 'utf-8'), {
		columns: true,
		delimiter: '\t',
		skip_empty_lines: true,
		relax_quotes: true,
	}) as Array<{ sourceId?: string }>;
	const ids = new Set<string>();
	for (const row of rows) {
		const id = row.sourceId?.trim();
		if (id) ids.add(id);
	}
	return ids;
}

// ── Pass 1: merge meat categories ──────────────────────────────────

async function mergeMeatCategories(prisma: PrismaClient): Promise<void> {
	const meat = await prisma.foodCategory.upsert({
		where: { slug: MEAT_CATEGORY.slug },
		create: MEAT_CATEGORY,
		update: { namePl: MEAT_CATEGORY.namePl, nameEn: MEAT_CATEGORY.nameEn },
		select: { id: true },
	});

	const oldCats = await prisma.foodCategory.findMany({
		where: { slug: { in: MEAT_SOURCE_SLUGS } },
		select: { id: true, slug: true },
	});

	if (oldCats.length === 0) {
		console.log('  Merge: no legacy meat categories present (already merged)');
		return;
	}

	const moved = await prisma.foodProduct.updateMany({
		where: { categoryId: { in: oldCats.map((c) => c.id) } },
		data: { categoryId: meat.id },
	});

	// Old categories are now empty → safe to delete (no product would be orphaned).
	const deleted = await prisma.foodCategory.deleteMany({
		where: { id: { in: oldCats.map((c) => c.id) } },
	});

	console.log(
		`  Merge: moved ${moved.count} products into "meat", removed ${deleted.count} legacy categories (${oldCats.map((c) => c.slug).join(', ')})`
	);
}

// ── Pass 2: keep/delete by shortlist ───────────────────────────────

async function pruneCategory(
	prisma: PrismaClient,
	slug: string,
	keptSourceIds: Set<string>
): Promise<{ kept: number; deleted: number; skipped: number }> {
	// Candidates for deletion: USDA_SR products in this category NOT on the shortlist.
	// OFF / CUSTOM products are deliberately excluded — they are user/branded data.
	const inCategory = await prisma.foodProduct.findMany({
		where: { source: 'USDA_SR', category: { slug } },
		select: { id: true, sourceId: true, nameEn: true },
	});

	const toDelete = inCategory.filter((p) => !keptSourceIds.has(p.sourceId));
	const keptCount = inCategory.length - toDelete.length;

	if (toDelete.length === 0) {
		console.log(`  ${slug}: ${keptCount} kept, 0 to delete`);
		return { kept: keptCount, deleted: 0, skipped: 0 };
	}

	// Guard: never delete a product referenced by a recipe component.
	const referenced = await prisma.recipeComponent.findMany({
		where: { productId: { in: toDelete.map((p) => p.id) } },
		select: { productId: true },
	});
	const referencedIds = new Set(referenced.map((r) => r.productId));

	const safe = toDelete.filter((p) => !referencedIds.has(p.id));
	const skipped = toDelete.filter((p) => referencedIds.has(p.id));

	if (skipped.length > 0) {
		console.warn(
			`  ${slug}: SKIPPED ${skipped.length} product(s) referenced by a recipe — not deleted:`
		);
		for (const p of skipped) console.warn(`      ${p.sourceId}  ${p.nameEn}`);
	}

	const result = await prisma.foodProduct.deleteMany({
		where: { id: { in: safe.map((p) => p.id) } },
	});

	console.log(`  ${slug}: ${keptCount} kept, ${result.count} deleted, ${skipped.length} skipped`);
	return { kept: keptCount, deleted: result.count, skipped: skipped.length };
}

// ── Entry point ────────────────────────────────────────────────────

export async function curateCatalog(prisma: PrismaClient): Promise<void> {
	console.log('Merging meat categories...');
	await mergeMeatCategories(prisma);

	console.log('Pruning curated categories against shortlists...');
	let totalDeleted = 0;
	for (const { slug, file } of CURATED) {
		const kept = readKeptSourceIds(file);
		const r = await pruneCategory(prisma, slug, kept);
		totalDeleted += r.deleted;
	}

	const remaining = await prisma.foodProduct.count();
	console.log(`  Done: deleted ${totalDeleted} products; catalog now ${remaining} products`);
}
