// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NUTRIENT_REGISTRY } from '../../../../scripts/data/nutrient-registry.js';
import type { NutrientEntry } from '../../../../scripts/data/nutrient-registry.js';
import {
	mapCategorySlug,
	parseAmount,
	buildUsdaMap,
	buildFoodNutrientRows,
	resolveEnergyKcal,
	shouldKeepProduct,
	hasBrandToken,
	DROP_CATEGORY_IDS,
} from '../../../../scripts/steps/import-usda.js';

describe('nutrient registry integrity', () => {
	it('has no duplicate tags', () => {
		const tags = NUTRIENT_REGISTRY.map((e) => e.tag);
		expect(new Set(tags).size).toBe(tags.length);
	});

	it('has no duplicate USDA IDs', () => {
		const ids = NUTRIENT_REGISTRY.filter((e) => e.usda && typeof e.usda.id === 'number').map(
			(e) => e.usda!.id
		);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('has no duplicate OFF slugs', () => {
		const slugs = NUTRIENT_REGISTRY.filter((e) => e.off).map((e) => e.off!.id);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it('has no duplicate displayRank values', () => {
		const ranks = NUTRIENT_REGISTRY.map((e) => e.displayRank);
		expect(new Set(ranks).size).toBe(ranks.length);
	});

	it('every entry has non-empty tag, nameEn, namePl, unit, category', () => {
		for (const entry of NUTRIENT_REGISTRY) {
			expect(entry.tag, `tag empty for ${entry.nameEn}`).toBeTruthy();
			expect(entry.nameEn, `nameEn empty for ${entry.tag}`).toBeTruthy();
			expect(entry.namePl, `namePl empty for ${entry.tag}`).toBeTruthy();
			expect(entry.unit, `unit empty for ${entry.tag}`).toBeTruthy();
			expect(entry.category, `category empty for ${entry.tag}`).toBeTruthy();
		}
	});

	it('units are from allowed set', () => {
		const allowed = new Set(['g', 'mg', 'µg', 'kcal', 'kJ']);
		for (const entry of NUTRIENT_REGISTRY) {
			expect(allowed.has(entry.unit), `${entry.tag} has invalid unit "${entry.unit}"`).toBe(true);
		}
	});

	it('conversion factors are > 0 where specified', () => {
		for (const entry of NUTRIENT_REGISTRY) {
			if (entry.usda?.factor !== undefined) {
				expect(entry.usda.factor, `${entry.tag} USDA factor`).toBeGreaterThan(0);
			}
			if (entry.off?.factor !== undefined) {
				expect(entry.off.factor, `${entry.tag} OFF factor`).toBeGreaterThan(0);
			}
		}
	});

	it('ENERC_KCAL has energyFallback with non-empty usdaIds', () => {
		const kcal = NUTRIENT_REGISTRY.find((e) => e.tag === 'ENERC_KCAL');
		expect(kcal).toBeDefined();
		expect(kcal!.energyFallback).toBeDefined();
		expect(kcal!.energyFallback!.usdaIds.length).toBeGreaterThan(0);
	});

	it('spot-check USDA IDs: PROCNT→1003, VITC→1162, CA→1087, FE→1089', () => {
		const byTag = new Map(NUTRIENT_REGISTRY.map((e) => [e.tag, e]));
		expect(byTag.get('PROCNT')!.usda!.id).toBe(1003);
		expect(byTag.get('VITC')!.usda!.id).toBe(1162);
		expect(byTag.get('CA')!.usda!.id).toBe(1087);
		expect(byTag.get('FE')!.usda!.id).toBe(1089);
	});

	it('sodium OFF mapping has factor 1000 (g→mg conversion)', () => {
		const na = NUTRIENT_REGISTRY.find((e) => e.tag === 'NA');
		expect(na!.off!.factor).toBe(1000);
	});

	it('salt OFF mapping has factor 1000 (g→mg conversion)', () => {
		const nacl = NUTRIENT_REGISTRY.find((e) => e.tag === 'NACL');
		expect(nacl!.off!.factor).toBe(1000);
	});

	it('FAPUN3 has computeFromSum with expected components', () => {
		const omega3 = NUTRIENT_REGISTRY.find((e) => e.tag === 'FAPUN3');
		expect(omega3!.computeFromSum).toBeDefined();
		expect(omega3!.computeFromSum).toContain('F18D3CN3');
		expect(omega3!.computeFromSum).toContain('F20D5N3');
		expect(omega3!.computeFromSum).toContain('F22D6N3');
	});
});

describe('mapCategorySlug', () => {
	it('maps known USDA category IDs to correct slugs', () => {
		expect(mapCategorySlug('5')).toBe('poultry');
		expect(mapCategorySlug('11')).toBe('vegetables');
		expect(mapCategorySlug('13')).toBe('beef');
		expect(mapCategorySlug('15')).toBe('seafood');
		expect(mapCategorySlug('20')).toBe('grains');
		expect(mapCategorySlug('1')).toBe('dairy');
		expect(mapCategorySlug('9')).toBe('fruits');
	});

	it('falls back to "other" for unknown category IDs', () => {
		expect(mapCategorySlug('99')).toBe('other');
		expect(mapCategorySlug('999')).toBe('other');
	});

	it('falls back to "other" for empty or missing category', () => {
		expect(mapCategorySlug('')).toBe('other');
		expect(mapCategorySlug(undefined)).toBe('other');
	});

	it('maps multiple USDA categories to the same slug', () => {
		expect(mapCategorySlug('21')).toBe('other');
		expect(mapCategorySlug('22')).toBe('other');
		expect(mapCategorySlug('27')).toBe('other');
	});

	it('maps both beverage categories to "beverages"', () => {
		expect(mapCategorySlug('14')).toBe('beverages');
		expect(mapCategorySlug('28')).toBe('beverages');
	});
});

describe('parseAmount', () => {
	it('parses valid numeric strings', () => {
		expect(parseAmount('1.5')).toBe(1.5);
		expect(parseAmount('100')).toBe(100);
		expect(parseAmount('3.14')).toBeCloseTo(3.14);
	});

	it('returns null for empty/missing amount (no data available)', () => {
		expect(parseAmount('')).toBeNull();
		expect(parseAmount('  ')).toBeNull();
	});

	it('returns 0 for "0" — zero means absent, not missing data', () => {
		expect(parseAmount('0')).toBe(0);
	});

	it('handles whitespace-padded values', () => {
		expect(parseAmount('  3.14  ')).toBeCloseTo(3.14);
	});
});

// ── Raw-only catalog filter (SR Legacy) ────────────────────────────

describe('shouldKeepProduct — raw-only catalog filter', () => {
	// category '11' = Vegetables (a kept category)
	const KEEP_CAT = '11';

	it('keeps raw products', () => {
		expect(shouldKeepProduct(KEEP_CAT, 'Carrots, raw')).toBe(true);
		expect(shouldKeepProduct(KEEP_CAT, 'Chicken, broilers or fryers, breast, raw')).toBe(true);
	});

	it('keeps stateless as-is staples (oil, flour, milk, sugar)', () => {
		expect(shouldKeepProduct('4', 'Oil, olive, salad or cooking')).toBe(true);
		expect(shouldKeepProduct('20', 'Flour, wheat, all-purpose, enriched, bleached')).toBe(true);
		expect(shouldKeepProduct('1', 'Milk, whole, 3.25% milkfat')).toBe(true);
	});

	it('keeps canned / smoked / cured as-purchased staples', () => {
		expect(shouldKeepProduct(KEEP_CAT, 'Tomatoes, red, ripe, canned, packed in tomato juice')).toBe(true);
		expect(shouldKeepProduct('15', 'Fish, salmon, smoked (lox), regular')).toBe(true);
		expect(shouldKeepProduct('7', 'Ham, cured, boneless')).toBe(true);
	});

	it('drops cooked-state variants', () => {
		expect(shouldKeepProduct(KEEP_CAT, 'Carrots, cooked, boiled, drained')).toBe(false);
		expect(shouldKeepProduct('5', 'Chicken, breast, roasted')).toBe(false);
		expect(shouldKeepProduct('13', 'Beef, ground, pan-fried')).toBe(false);
		expect(shouldKeepProduct('18', 'Bread, white, toasted')).toBe(false);
	});

	it('drops less-obvious cooked forms (heated, pan-broil, parboil, blanched, prepared)', () => {
		expect(shouldKeepProduct('7', 'Pork, cured, ham, slice, separable lean only, heated, pan-broil')).toBe(false);
		expect(shouldKeepProduct('9', 'Apples, canned, sweetened, sliced, drained, heated')).toBe(false);
		expect(shouldKeepProduct('20', 'Rice, white, parboiled, enriched')).toBe(false);
		expect(shouldKeepProduct(KEEP_CAT, 'Spinach, blanched, frozen')).toBe(false);
		expect(shouldKeepProduct('18', 'Pie, apple, commercially prepared')).toBe(false);
	});

	it('keeps "unprepared" items — \\b does not match inside the word', () => {
		expect(shouldKeepProduct(KEEP_CAT, 'Potatoes, hash brown, refrigerated, unprepared')).toBe(true);
		expect(shouldKeepProduct('7', 'Pork, cured, bacon, unprepared')).toBe(true);
	});

	it('keeps "broilers or fryers" — chicken TYPE, not the cooking verb', () => {
		expect(shouldKeepProduct('5', 'Chicken, broilers or fryers, breast, meat only, raw')).toBe(true);
		// but still drops the genuinely broiled variant
		expect(shouldKeepProduct('5', 'Chicken, broilers or fryers, breast, broiled')).toBe(false);
		expect(shouldKeepProduct('7', 'Ham, slice, separable lean only, heated, pan-broiled')).toBe(false);
	});

	it('drops excluded categories regardless of description', () => {
		expect(shouldKeepProduct('3', 'Babyfood, fruit, raw apple')).toBe(false); // Baby Foods
		expect(shouldKeepProduct('21', 'Fast food, raw vegetable side')).toBe(false); // Fast Foods
		expect(shouldKeepProduct('14', 'Beverage, raw fruit blend')).toBe(false); // Beverages
	});

	it('drops branded products', () => {
		expect(shouldKeepProduct(KEEP_CAT, 'Fruit juice smoothie, NAKED JUICE, MIGHTY MANGO')).toBe(false);
		expect(shouldKeepProduct('18', 'George Weston Bakeries, Thomas English Muffins')).toBe(false);
	});

	it('DROP_CATEGORY_IDS contains the 10 agreed categories', () => {
		expect(DROP_CATEGORY_IDS.size).toBe(10);
		for (const id of ['3', '6', '8', '14', '19', '21', '22', '23', '24', '25']) {
			expect(DROP_CATEGORY_IDS.has(id), `missing category ${id}`).toBe(true);
		}
	});
});

describe('hasBrandToken', () => {
	it('flags ALL-CAPS brand tokens', () => {
		expect(hasBrandToken('Cranberry sauce, whole, canned, OCEAN SPRAY')).toBe(true);
		expect(hasBrandToken('Lemon juice from concentrate, bottled, REAL LEMON')).toBe(true);
	});

	it('flags known Title-Case brands', () => {
		expect(hasBrandToken('Pillsbury, Cinnamon Rolls with Icing, refrigerated dough')).toBe(true);
		expect(hasBrandToken('Kraft Foods, Shake N Bake Original Recipe')).toBe(true);
	});

	it('does not flag generic descriptions or known acronyms', () => {
		expect(hasBrandToken('Carrots, raw')).toBe(false);
		expect(hasBrandToken('Oil, olive, salad or cooking')).toBe(false);
		expect(hasBrandToken('Cheese, pasteurized process, American, NFS')).toBe(false);
		expect(hasBrandToken('Milk, whole, UHT')).toBe(false);
	});
});

// ── Import unit conversion ─────────────────────────────────────────

describe('import unit conversion (raw × factor)', () => {
	// Synthetic registry: one entry with an explicit factor, one without
	const syntheticRegistry: NutrientEntry[] = [
		{
			tag: 'NA',
			nameEn: 'Sodium',
			namePl: 'Sód',
			unit: 'mg',
			category: 'MINERAL',
			displayRank: 1,
			usda: { id: 1093, unit: 'G', factor: 1000 },
			off: null,
		},
		{
			tag: 'PROCNT',
			nameEn: 'Protein',
			namePl: 'Białko',
			unit: 'g',
			category: 'PROXIMATE',
			displayRank: 2,
			usda: { id: 1003, unit: 'G' },
			off: null,
		},
	];
	// The Nutrient PK (`id`) IS the INFOODS tagname — buildUsdaMap takes { id } only.
	const dbNutrients = [{ id: 'NA' }, { id: 'PROCNT' }];
	const maps = buildUsdaMap(dbNutrients, syntheticRegistry);

	it('applies factor 1000: raw 0.5 g → stored 500 mg', () => {
		const { rows } = buildFoodNutrientRows([{ nutrient_id: '1093', amount: '0.5' }], maps);
		const na = rows.find((r) => r.nutrientId === 'NA');
		expect(na!.amountPer100g).toBe(500);
	});

	it('defaults to factor 1 when no factor specified', () => {
		const { rows } = buildFoodNutrientRows([{ nutrient_id: '1003', amount: '21.5' }], maps);
		const procnt = rows.find((r) => r.nutrientId === 'PROCNT');
		expect(procnt!.amountPer100g).toBe(21.5);
	});

	it('keeps null amounts null (no conversion of missing data)', () => {
		const { rows } = buildFoodNutrientRows([{ nutrient_id: '1093', amount: '' }], maps);
		const na = rows.find((r) => r.nutrientId === 'NA');
		expect(na!.amountPer100g).toBeNull();
	});

	it('skips USDA nutrient IDs absent from the registry', () => {
		const { rows } = buildFoodNutrientRows([{ nutrient_id: '9999', amount: '1.0' }], maps);
		expect(rows).toHaveLength(0);
	});
});

// ── Energy kcal fallback chain ─────────────────────────────────────

describe('energy kcal fallback chain', () => {
	// Real registry + synthetic DB ids for every tag → exercises the real
	// ENERC_KCAL fallback config (usdaIds: [2048, 2047, 1008] → compute)
	// id IS the tag (natural key), so seed the synthetic DB id set straight from the tags.
	const dbNutrients = NUTRIENT_REGISTRY.map((e) => ({ id: e.tag }));
	const maps = buildUsdaMap(dbNutrients);

	function energyRow(fnRows: Array<{ nutrient_id: string; amount: string }>) {
		const { rows, energySource } = buildFoodNutrientRows(fnRows, maps);
		const energy = rows.find((r) => r.nutrientId === 'ENERC_KCAL');
		return { energy, energySource };
	}

	it('uses Atwater General (2047) when it is the only energy value', () => {
		const { energy, energySource } = energyRow([{ nutrient_id: '2047', amount: '165' }]);
		expect(energy!.amountPer100g).toBe(165);
		expect(energySource).toBe('Atwater General');
	});

	it('prefers Atwater Specific (2048) over General (2047)', () => {
		const { energy, energySource } = energyRow([
			{ nutrient_id: '2047', amount: '170' },
			{ nutrient_id: '2048', amount: '165' },
		]);
		expect(energy!.amountPer100g).toBe(165);
		expect(energySource).toBe('Atwater Specific');
	});

	it('falls back to basic Energy (1008) when Atwater values are absent', () => {
		const { energy, energySource } = energyRow([{ nutrient_id: '1008', amount: '61' }]);
		expect(energy!.amountPer100g).toBe(61);
		expect(energySource).toBe('basic Energy');
	});

	it('computes from macros (4p + 9f + 4c) when no energy IDs are present', () => {
		const { energy, energySource } = energyRow([
			{ nutrient_id: '1003', amount: '10' }, // PROCNT
			{ nutrient_id: '1004', amount: '5' }, // FAT
			{ nutrient_id: '1005', amount: '20' }, // CHOCDF
		]);
		// 10×4 + 5×9 + 20×4 = 165
		expect(energy!.amountPer100g).toBe(165);
		expect(energySource).toBe('computed from macros');
	});

	it('includes alcohol (×7) in the macro computation when present', () => {
		// ALC has no USDA mapping (usda: null), so exercise resolveEnergyKcal directly
		const energyEntry = NUTRIENT_REGISTRY.find((e) => e.tag === 'ENERC_KCAL')!;
		const importedValues = new Map<string, number | null>([
			['PROCNT', 10],
			['FAT', 5],
			['CHOCDF', 20],
			['ALC', 2],
		]);
		const { value, source } = resolveEnergyKcal(new Map(), importedValues, energyEntry);
		// 10×4 + 5×9 + 20×4 + 2×7 = 179
		expect(value).toBe(179);
		expect(source).toBe('computed from macros');
	});

	it('returns null energy when neither energy IDs nor full macros exist', () => {
		const { energy, energySource } = energyRow([
			{ nutrient_id: '1003', amount: '10' }, // protein only — fat & carbs missing
		]);
		expect(energy!.amountPer100g).toBeNull();
		expect(energySource).toBe('no data');
	});
});
