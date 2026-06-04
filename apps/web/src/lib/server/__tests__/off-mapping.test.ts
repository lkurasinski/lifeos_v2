// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { OFF_NUTRIENT_MAP, buildNutrimentRows } from '../off.js';

describe('OFF_NUTRIENT_MAP', () => {
	it('maps energy-kcal to ENERC_KCAL with factor 1', () => {
		const entry = OFF_NUTRIENT_MAP.get('energy-kcal');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('ENERC_KCAL');
		expect(entry!.factor).toBe(1);
	});

	it('maps proteins to PROCNT with factor 1', () => {
		const entry = OFF_NUTRIENT_MAP.get('proteins');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('PROCNT');
		expect(entry!.factor).toBe(1);
	});

	it('maps sodium with factor 1000 (g→mg)', () => {
		const entry = OFF_NUTRIENT_MAP.get('sodium');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('NA');
		expect(entry!.factor).toBe(1000);
	});

	it('maps salt with factor 1000 (g→mg)', () => {
		const entry = OFF_NUTRIENT_MAP.get('salt');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('NACL');
		expect(entry!.factor).toBe(1000);
	});

	it('maps vitamin-c to VITC', () => {
		const entry = OFF_NUTRIENT_MAP.get('vitamin-c');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('VITC');
	});

	it('maps selenium to SE', () => {
		const entry = OFF_NUTRIENT_MAP.get('selenium');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('SE');
	});

	it('maps vitamin-pp alias to NIAC', () => {
		const entry = OFF_NUTRIENT_MAP.get('vitamin-pp');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('NIAC');
	});

	it('maps folates alias to FOL', () => {
		const entry = OFF_NUTRIENT_MAP.get('folates');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('FOL');
	});

	it('maps pantothenic-acid alias to PANTAC', () => {
		const entry = OFF_NUTRIENT_MAP.get('pantothenic-acid');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('PANTAC');
	});

	it('maps biotin alias to BIOT', () => {
		const entry = OFF_NUTRIENT_MAP.get('biotin');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('BIOT');
	});

	it('maps niacin alias to NIAC', () => {
		const entry = OFF_NUTRIENT_MAP.get('niacin');
		expect(entry).toBeDefined();
		expect(entry!.tag).toBe('NIAC');
	});

	it('does not contain unknown OFF keys', () => {
		expect(OFF_NUTRIENT_MAP.get('some-unknown-nutrient')).toBeUndefined();
	});
});

describe('buildNutrimentRows', () => {
	const mockNutrientIdMap = new Map([
		['ENERC_KCAL', 'uuid-kcal'],
		['PROCNT', 'uuid-protein'],
		['FAT', 'uuid-fat'],
		['NA', 'uuid-sodium'],
		['NACL', 'uuid-salt'],
		['VITC', 'uuid-vitc'],
		['FASAT', 'uuid-fasat'],
		['CHOCDF', 'uuid-carbs'],
		['SUGAR', 'uuid-sugar'],
	]);

	it('processes _100g suffix keys and maps to canonical values', () => {
		const rows = buildNutrimentRows(
			{ 'energy-kcal_100g': 200, proteins_100g: 10 },
			mockNutrientIdMap
		);
		expect(rows).toHaveLength(2);
		const kcal = rows.find((r) => r.nutrientId === 'uuid-kcal');
		expect(kcal!.amountPer100g).toBe(200);
		const protein = rows.find((r) => r.nutrientId === 'uuid-protein');
		expect(protein!.amountPer100g).toBe(10);
	});

	it('applies factor 1000 for sodium (g→mg)', () => {
		const rows = buildNutrimentRows({ sodium_100g: 0.05 }, mockNutrientIdMap);
		const sodium = rows.find((r) => r.nutrientId === 'uuid-sodium');
		expect(sodium!.amountPer100g).toBeCloseTo(50);
	});

	it('applies factor 1000 for salt (g→mg)', () => {
		const rows = buildNutrimentRows({ salt_100g: 0.12 }, mockNutrientIdMap);
		const salt = rows.find((r) => r.nutrientId === 'uuid-salt');
		expect(salt!.amountPer100g).toBeCloseTo(120);
	});

	it('silently skips unknown OFF keys', () => {
		const rows = buildNutrimentRows(
			{ unknown_nutrient_100g: 5, proteins_100g: 20 },
			mockNutrientIdMap
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].nutrientId).toBe('uuid-protein');
	});

	it('silently skips keys without _100g suffix', () => {
		const rows = buildNutrimentRows(
			{ proteins: 10, proteins_100g: 20 },
			mockNutrientIdMap
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].amountPer100g).toBe(20);
	});

	it('silently skips tags not present in nutrientIdMap', () => {
		const limitedMap = new Map([['PROCNT', 'uuid-protein']]);
		const rows = buildNutrimentRows(
			{ proteins_100g: 15, fat_100g: 8 },
			limitedMap
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].nutrientId).toBe('uuid-protein');
	});

	it('produces correct subset for EU-7 mandatory nutrients', () => {
		const rows = buildNutrimentRows(
			{
				'energy-kcal_100g': 250,
				fat_100g: 10,
				'saturated-fat_100g': 4,
				carbohydrates_100g: 30,
				sugars_100g: 8,
				proteins_100g: 15,
				salt_100g: 0.5,
			},
			mockNutrientIdMap
		);
		expect(rows).toHaveLength(7);
		const salt = rows.find((r) => r.nutrientId === 'uuid-salt');
		expect(salt!.amountPer100g).toBeCloseTo(500);
	});
});
