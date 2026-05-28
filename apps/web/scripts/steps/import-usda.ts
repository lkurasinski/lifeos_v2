/**
 * Step: usda
 *
 * 1. Seed FoodCategory table from static mapping
 * 2. Read USDA Foundation Foods CSVs (food.csv, food_nutrient.csv)
 * 3. Filter to foundation_food data_type rows only (~395 products)
 * 4. Upsert FoodProduct + FoodNutrient rows with:
 *    - Unit conversion factors from nutrient registry
 *    - Energy kcal fallback chain (Atwater Specific → General → basic → computed)
 *    - Computed-from-sum nutrients (FAPUN3 = ALA + EPA + DPA + DHA)
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
import { NUTRIENT_REGISTRY, DPA_USDA_ID } from '../data/nutrient-registry.js';
import type { NutrientEntry } from '../data/nutrient-registry.js';

// ── Category mapping ───────────────────────────────────────────────

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

// ── CSV types ──────────────────────────────────────────────────────

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

export function parseAmount(raw: string): number | null {
	if (!raw?.trim()) return null;
	const val = parseFloat(raw.trim());
	return isNaN(val) ? null : val;
}

// ── Registry-derived lookup maps ───────────────────────────────────

interface UsdaNutrientMapping {
	nutrientDbId: string;
	factor: number;
	tag: string;
}

function buildUsdaMap(nutrients: Array<{ id: string; infoodsTagname: string }>): {
	standardMap: Map<number, UsdaNutrientMapping>;
	energyEntry: NutrientEntry | undefined;
	energyDbId: string | undefined;
	computeEntries: Array<{ entry: NutrientEntry; dbId: string }>;
	macroTagToDbId: Map<string, string>;
} {
	const tagToDbId = new Map(nutrients.map((n) => [n.infoodsTagname, n.id]));
	const standardMap = new Map<number, UsdaNutrientMapping>();

	let energyEntry: NutrientEntry | undefined;
	let energyDbId: string | undefined;
	const computeEntries: Array<{ entry: NutrientEntry; dbId: string }> = [];

	for (const entry of NUTRIENT_REGISTRY) {
		const dbId = tagToDbId.get(entry.tag);
		if (!dbId) continue;

		if (entry.energyFallback) {
			energyEntry = entry;
			energyDbId = dbId;
			continue;
		}

		if (entry.computeFromSum) {
			computeEntries.push({ entry, dbId });
			continue;
		}

		if (entry.usda && typeof entry.usda.id === 'number') {
			standardMap.set(entry.usda.id, {
				nutrientDbId: dbId,
				factor: entry.usda.factor ?? 1,
				tag: entry.tag,
			});
		}
	}

	return { standardMap, energyEntry, energyDbId, computeEntries, macroTagToDbId: tagToDbId };
}

// ── Dataset resolution ─────────────────────────────────────────────

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

// ── CSV streaming ──────────────────────────────────────────────────

async function* streamCsv<T>(csvPath: string): AsyncGenerator<T> {
	const parser = createReadStream(csvPath).pipe(
		parseCsvStream({ columns: true, skip_empty_lines: true })
	);
	for await (const row of parser as AsyncIterable<T>) {
		yield row;
	}
}

async function loadFoundationFdcIds(csvDir: string): Promise<Set<string>> {
	const foundationFile = path.join(csvDir, 'foundation_food.csv');
	if (existsSync(foundationFile)) {
		const rows = parseCsvSync(readFileSync(foundationFile, 'utf-8'), {
			columns: true,
			skip_empty_lines: true,
		}) as Array<{ fdc_id: string }>;
		return new Set(rows.map((r) => r.fdc_id));
	}
	const ids = new Set<string>();
	for await (const row of streamCsv<FoodRow>(path.join(csvDir, 'food.csv'))) {
		ids.add(row.fdc_id);
	}
	return ids;
}

async function loadFoundationFoods(csvDir: string, fdcIds: Set<string>): Promise<FoodRow[]> {
	const result: FoodRow[] = [];
	for await (const row of streamCsv<FoodRow>(path.join(csvDir, 'food.csv'))) {
		if (fdcIds.has(row.fdc_id)) result.push(row);
	}
	return result;
}

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

// ── Category seeding ───────────────────────────────────────────────

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

// ── Energy fallback ────────────────────────────────────────────────

const ENERGY_FALLBACK_LABELS: Record<number, string> = {
	2048: 'Atwater Specific',
	2047: 'Atwater General',
	1008: 'basic Energy',
};

function resolveEnergyKcal(
	rawNutrientsByUsdaId: Map<number, number | null>,
	importedValues: Map<string, number | null>,
	energyEntry: NutrientEntry
): { value: number | null; source: string } {
	const fallback = energyEntry.energyFallback!;

	for (const usdaId of fallback.usdaIds) {
		const val = rawNutrientsByUsdaId.get(usdaId);
		if (val !== undefined && val !== null) {
			return { value: val, source: ENERGY_FALLBACK_LABELS[usdaId] ?? `USDA:${usdaId}` };
		}
	}

	const c = fallback.compute;
	const protein = importedValues.get(c.proteinTag);
	const fat = importedValues.get(c.fatTag);
	const carb = importedValues.get(c.carbTag);
	const alcohol = importedValues.get(c.alcoholTag) ?? 0;

	if (protein !== null && protein !== undefined && fat !== null && fat !== undefined && carb !== null && carb !== undefined) {
		const computed =
			protein * c.factors.protein +
			fat * c.factors.fat +
			carb * c.factors.carb +
			alcohol * c.factors.alcohol;
		return { value: Math.round(computed * 10000) / 10000, source: 'computed from macros' };
	}

	return { value: null, source: 'no data' };
}

// ── Main import ────────────────────────────────────────────────────

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

	// 3. Build registry-driven lookup maps
	console.log('Loading nutrient registry...');
	const allNutrients = await prisma.nutrient.findMany({
		select: { id: true, infoodsTagname: true },
	});
	const { standardMap, energyEntry, energyDbId, computeEntries, macroTagToDbId } =
		buildUsdaMap(allNutrients);
	console.log(`  ${standardMap.size} standard USDA nutrient mappings`);
	if (energyEntry) console.log(`  Energy fallback chain: [${energyEntry.energyFallback!.usdaIds.join(', ')}] → compute`);
	if (computeEntries.length > 0) console.log(`  ${computeEntries.length} computed-from-sum nutrients`);

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
	const energyFallbackStats: Record<string, number> = {};

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

		// Build raw USDA nutrient ID → amount map for energy fallback
		const rawByUsdaId = new Map<number, number | null>();
		for (const row of fnRows) {
			const usdaId = parseInt(row.nutrient_id, 10);
			if (!isNaN(usdaId)) {
				rawByUsdaId.set(usdaId, parseAmount(row.amount));
			}
		}

		// Import standard nutrients with unit conversion
		const nutrientData: Array<{ foodId: string; nutrientId: string; amountPer100g: number | null }> = [];
		const importedValues = new Map<string, number | null>();

		for (const row of fnRows) {
			const usdaId = parseInt(row.nutrient_id, 10);
			const mapping = standardMap.get(usdaId);
			if (!mapping) continue;

			const raw = parseAmount(row.amount);
			const converted = raw !== null ? raw * mapping.factor : null;
			nutrientData.push({
				foodId: product.id,
				nutrientId: mapping.nutrientDbId,
				amountPer100g: converted,
			});
			importedValues.set(mapping.tag, converted);
		}

		// Energy kcal via fallback chain
		if (energyEntry && energyDbId) {
			const { value, source } = resolveEnergyKcal(rawByUsdaId, importedValues, energyEntry);
			nutrientData.push({
				foodId: product.id,
				nutrientId: energyDbId,
				amountPer100g: value,
			});
			energyFallbackStats[source] = (energyFallbackStats[source] ?? 0) + 1;
		}

		// Computed-from-sum nutrients (FAPUN3 = ALA + EPA + DPA + DHA)
		for (const { entry, dbId } of computeEntries) {
			let sum: number | null = null;

			for (const componentTag of entry.computeFromSum!) {
				let val = importedValues.get(componentTag);

				// DPA (F22D5N3, USDA:1280) is not a standalone registry entry
				if (val === undefined && componentTag === 'F22D5N3') {
					val = rawByUsdaId.get(DPA_USDA_ID) ?? null;
				}

				if (val !== null && val !== undefined) {
					sum = (sum ?? 0) + val;
				}
			}

			nutrientData.push({
				foodId: product.id,
				nutrientId: dbId,
				amountPer100g: sum,
			});
		}

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

	// Energy fallback audit log
	if (Object.keys(energyFallbackStats).length > 0) {
		console.log('  Energy kcal fallback stats:');
		for (const [source, count] of Object.entries(energyFallbackStats).sort((a, b) => b[1] - a[1])) {
			console.log(`    ${source}: ${count} products`);
		}
	}
}
