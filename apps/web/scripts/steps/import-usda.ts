/**
 * Step: usda
 *
 * 1. Seed FoodCategory table from static mapping
 * 2. Read USDA Foundation Foods CSVs (food.csv, food_nutrient.csv)
 * 3. Filter to foundation_food data_type rows only (~395 products)
 * 4. Upsert FoodProduct + FoodNutrient rows (idempotent via @@unique constraints)
 *
 * Supports two dataset layouts (auto-detected):
 *   Full USDA dataset:   apps/web/data/usda/full/FoodData_Central_csv_<date>/
 *   Foundation-only zip: apps/web/data/usda/foundation/
 *
 * Download from https://fdc.nal.usda.gov/download-datasets
 */

import path from 'path';
import { readFileSync, existsSync, readdirSync, createReadStream } from 'fs';
import { parse as parseCsvSync } from 'csv-parse/sync';
import { parse as parseCsvStream } from 'csv-parse';
import type { PrismaClient } from '../../src/generated/prisma/client.js';

// USDA food category ID (from food_category.csv) → canonical slug
export const USDA_CATEGORY_TO_SLUG: Record<string, string> = {
	'1': 'dairy',
	'2': 'spices',
	'3': 'other',
	'4': 'fats',
	'5': 'poultry',
	'6': 'soups',
	'7': 'processed-meat',
	'8': 'cereals',
	'9': 'fruits',
	'10': 'pork',
	'11': 'vegetables',
	'12': 'nuts',
	'13': 'beef',
	'14': 'beverages',
	'15': 'seafood',
	'16': 'legumes',
	'17': 'lamb-game',
	'18': 'baked',
	'19': 'sweets',
	'20': 'grains',
	'21': 'other',
	'22': 'other',
	'23': 'snacks',
	'24': 'other',
	'25': 'other',
	'26': 'other',
	'27': 'other',
	'28': 'beverages',
};

export function mapCategorySlug(usdaCategoryId: string | undefined): string {
	if (!usdaCategoryId?.trim()) return 'other';
	return USDA_CATEGORY_TO_SLUG[usdaCategoryId.trim()] ?? 'other';
}

const FOOD_CATEGORIES: Array<{ slug: string; namePl: string; nameEn: string }> = [
	{ slug: 'dairy', namePl: 'Nabiał i jaja', nameEn: 'Dairy and Egg Products' },
	{ slug: 'spices', namePl: 'Przyprawy i zioła', nameEn: 'Spices and Herbs' },
	{ slug: 'fats', namePl: 'Tłuszcze i oleje', nameEn: 'Fats and Oils' },
	{ slug: 'poultry', namePl: 'Drób', nameEn: 'Poultry Products' },
	{ slug: 'soups', namePl: 'Zupy, sosy i dipy', nameEn: 'Soups, Sauces, and Gravies' },
	{ slug: 'processed-meat', namePl: 'Wędliny i przetwory mięsne', nameEn: 'Sausages and Luncheon Meats' },
	{ slug: 'cereals', namePl: 'Płatki i musli', nameEn: 'Breakfast Cereals' },
	{ slug: 'fruits', namePl: 'Owoce i soki owocowe', nameEn: 'Fruits and Fruit Juices' },
	{ slug: 'pork', namePl: 'Wieprzowina', nameEn: 'Pork Products' },
	{ slug: 'vegetables', namePl: 'Warzywa', nameEn: 'Vegetables and Vegetable Products' },
	{ slug: 'nuts', namePl: 'Orzechy i nasiona', nameEn: 'Nut and Seed Products' },
	{ slug: 'beef', namePl: 'Wołowina', nameEn: 'Beef Products' },
	{ slug: 'beverages', namePl: 'Napoje', nameEn: 'Beverages' },
	{ slug: 'seafood', namePl: 'Ryby i owoce morza', nameEn: 'Finfish and Shellfish Products' },
	{ slug: 'legumes', namePl: 'Strączki i rośliny strączkowe', nameEn: 'Legumes and Legume Products' },
	{ slug: 'lamb-game', namePl: 'Jagnięcina i dziczyzna', nameEn: 'Lamb, Veal, and Game Products' },
	{ slug: 'baked', namePl: 'Pieczywo i wypieki', nameEn: 'Baked Products' },
	{ slug: 'sweets', namePl: 'Słodycze i desery', nameEn: 'Sweets' },
	{ slug: 'grains', namePl: 'Zboża i makarony', nameEn: 'Cereal Grains and Pasta' },
	{ slug: 'snacks', namePl: 'Przekąski', nameEn: 'Snacks' },
	{ slug: 'other', namePl: 'Inne', nameEn: 'Other' },
];

interface FoodRow {
	fdc_id: string;
	data_type: string;
	description: string;
	food_category_id: string;
	publication_date: string;
}

interface FoodNutrientRow {
	id: string;
	fdc_id: string;
	nutrient_id: string;
	amount: string;
}

// Returns null for empty/missing values; 0 for explicit zero (absent ≠ no data)
export function parseAmount(raw: string): number | null {
	if (!raw?.trim()) return null;
	const val = parseFloat(raw.trim());
	return isNaN(val) ? null : val;
}

/** Find the best available USDA CSV directory. Returns the path and whether it's the full dataset. */
function resolveDatasetDir(dataDir: string): { dir: string; isFullDataset: boolean } {
	const fullBase = path.join(dataDir, 'usda', 'full');
	if (existsSync(fullBase)) {
		const entries = readdirSync(fullBase);
		const match = entries.find((e) => e.startsWith('FoodData_Central_csv_'));
		if (match) {
			const dir = path.join(fullBase, match);
			if (existsSync(path.join(dir, 'food.csv'))) {
				return { dir, isFullDataset: true };
			}
		}
	}
	const foundationDir = path.join(dataDir, 'usda', 'foundation');
	if (existsSync(path.join(foundationDir, 'food.csv'))) {
		return { dir: foundationDir, isFullDataset: false };
	}
	throw new Error(
		`USDA CSV files not found. Place either:\n` +
			`  Full dataset: ${path.join(dataDir, 'usda', 'full', 'FoodData_Central_csv_<date>', 'food.csv')}\n` +
			`  Foundation:   ${path.join(dataDir, 'usda', 'foundation', 'food.csv')}\n` +
			`Download from: https://fdc.nal.usda.gov/download-datasets`
	);
}

/** Stream a CSV file, yielding each parsed row. */
async function* streamCsv<T>(csvPath: string): AsyncGenerator<T> {
	const parser = createReadStream(csvPath).pipe(
		parseCsvStream({ columns: true, skip_empty_lines: true })
	);
	for await (const row of parser as AsyncIterable<T>) {
		yield row;
	}
}

/** Load Foundation Food FDC IDs: from foundation_food.csv if present, else filter food.csv. */
async function loadFoundationFdcIds(csvDir: string): Promise<Set<string>> {
	const foundationFile = path.join(csvDir, 'foundation_food.csv');
	if (existsSync(foundationFile)) {
		const rows = parseCsvSync(readFileSync(foundationFile, 'utf-8'), {
			columns: true,
			skip_empty_lines: true,
		}) as Array<{ fdc_id: string }>;
		return new Set(rows.map((r) => r.fdc_id));
	}
	// Foundation-only dataset: all rows in food.csv are foundation foods
	const ids = new Set<string>();
	for await (const row of streamCsv<FoodRow>(path.join(csvDir, 'food.csv'))) {
		ids.add(row.fdc_id);
	}
	return ids;
}

/** Stream food.csv, returning only foundation food rows. */
async function loadFoundationFoods(csvDir: string, fdcIds: Set<string>): Promise<FoodRow[]> {
	const result: FoodRow[] = [];
	for await (const row of streamCsv<FoodRow>(path.join(csvDir, 'food.csv'))) {
		if (fdcIds.has(row.fdc_id)) result.push(row);
	}
	return result;
}

/** Stream food_nutrient.csv, collecting rows for the given FDC IDs. Logs progress for large files. */
async function loadFoodNutrients(
	csvPath: string,
	fdcIds: Set<string>
): Promise<Map<string, FoodNutrientRow[]>> {
	const result = new Map<string, FoodNutrientRow[]>();
	let scanned = 0;
	let matched = 0;
	for await (const row of streamCsv<FoodNutrientRow>(csvPath)) {
		scanned++;
		if (scanned % 1_000_000 === 0) {
			process.stdout.write(`\r  Scanning food_nutrient.csv: ${scanned / 1_000_000}M rows, ${matched} matched...`);
		}
		if (!fdcIds.has(row.fdc_id)) continue;
		matched++;
		let arr = result.get(row.fdc_id);
		if (!arr) {
			arr = [];
			result.set(row.fdc_id, arr);
		}
		arr.push(row);
	}
	if (scanned > 500_000) process.stdout.write('\n');
	return result;
}

async function seedFoodCategories(prisma: PrismaClient) {
	for (const cat of FOOD_CATEGORIES) {
		await prisma.foodCategory.upsert({
			where: { slug: cat.slug },
			create: cat,
			update: { namePl: cat.namePl, nameEn: cat.nameEn },
		});
	}
	console.log(`  Seeded ${FOOD_CATEGORIES.length} food categories`);
}

export async function importUsda(prisma: PrismaClient) {
	const scriptDir = path.dirname(new URL(import.meta.url).pathname);
	const dataDir = path.resolve(scriptDir, '../../data');

	const { dir: csvDir, isFullDataset } = resolveDatasetDir(dataDir);
	console.log(`  Dataset: ${isFullDataset ? 'full' : 'foundation-only'} (${csvDir})`);

	// 1. Seed categories
	console.log('Seeding food categories...');
	await seedFoodCategories(prisma);

	// 2. Load category slug → DB ID
	const dbCategories = await prisma.foodCategory.findMany({ select: { id: true, slug: true } });
	const categoryBySlug = new Map(dbCategories.map((c) => [c.slug, c.id]));

	// 3. Load nutrient registry (usdaNutrientId → DB UUID)
	console.log('Loading nutrient registry...');
	const nutrients = await prisma.nutrient.findMany({
		where: { usdaNutrientId: { not: null } },
		select: { id: true, usdaNutrientId: true },
	});
	const nutrientByUsdaId = new Map<number, string>();
	for (const n of nutrients) {
		if (n.usdaNutrientId !== null) nutrientByUsdaId.set(n.usdaNutrientId, n.id);
	}
	console.log(`  ${nutrientByUsdaId.size} nutrients with USDA ID mapping`);

	// 4. Load foundation FDC IDs
	console.log('Loading foundation food FDC IDs...');
	const foundationFdcIds = await loadFoundationFdcIds(csvDir);
	console.log(`  Foundation FDC IDs: ${foundationFdcIds.size}`);

	// 5. Stream food.csv → foundation food rows
	console.log('Streaming food.csv...');
	const foundationFoods = await loadFoundationFoods(csvDir, foundationFdcIds);
	console.log(`  Foundation foods: ${foundationFoods.length}`);

	// 6. Stream food_nutrient.csv → group by FDC ID (foundation only)
	console.log('Streaming food_nutrient.csv (this may take a minute for the full dataset)...');
	const nutrientsByFdcId = await loadFoodNutrients(
		path.join(csvDir, 'food_nutrient.csv'),
		foundationFdcIds
	);
	let fnTotal = 0;
	for (const rows of nutrientsByFdcId.values()) fnTotal += rows.length;
	console.log(`  Foundation nutrient rows: ${fnTotal}`);

	// 7. Import each foundation food
	console.log('Importing foundation foods...');
	let imported = 0;
	let totalNutrients = 0;

	for (const food of foundationFoods) {
		const slug = mapCategorySlug(food.food_category_id);
		const categoryId = categoryBySlug.get(slug) ?? null;

		const product = await prisma.foodProduct.upsert({
			where: { source_sourceId: { source: 'USDA_FOUNDATION', sourceId: food.fdc_id } },
			create: {
				source: 'USDA_FOUNDATION',
				sourceId: food.fdc_id,
				nameEn: food.description,
				namePl: null,
				categoryId,
				sourceCategory: food.food_category_id || null,
			},
			update: {
				nameEn: food.description,
				categoryId,
				sourceCategory: food.food_category_id || null,
			},
			select: { id: true },
		});

		const fnRows = nutrientsByFdcId.get(food.fdc_id) ?? [];
		const nutrientData = fnRows
			.map((row) => {
				const nutrientId = nutrientByUsdaId.get(parseInt(row.nutrient_id, 10));
				if (!nutrientId) return null;
				return {
					foodId: product.id,
					nutrientId,
					amountPer100g: parseAmount(row.amount),
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		if (nutrientData.length > 0) {
			await prisma.foodNutrient.createMany({ data: nutrientData, skipDuplicates: true });
			totalNutrients += nutrientData.length;
		}

		imported++;
		if (imported % 100 === 0) {
			console.log(
				`  Progress: ${imported}/${foundationFoods.length} foods, ${totalNutrients} nutrient rows`
			);
		}
	}

	console.log(`  Done: ${imported} foods, ${totalNutrients} nutrient rows`);
}
