// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
	isBaseUnit,
	normalizeUnit,
	classifyNutrient,
} from '../../../../scripts/steps/seed-nutrients.js';
import { mapCategorySlug, parseAmount } from '../../../../scripts/steps/import-usda.js';

describe('isBaseUnit', () => {
	it('accepts simple per-100g units', () => {
		expect(isBaseUnit('g')).toBe(true);
		expect(isBaseUnit('mg')).toBe(true);
		expect(isBaseUnit('µg')).toBe(true);
		expect(isBaseUnit('mcg')).toBe(true);
		expect(isBaseUnit('kJ')).toBe(true);
		expect(isBaseUnit('kcal')).toBe(true);
		expect(isBaseUnit('%')).toBe(true);
	});

	it('accepts INFOODS compound units via first part', () => {
		// "kJ; kcal" — both are base units
		expect(isBaseUnit('kJ; kcal')).toBe(true);
		// "mcg; IU" — mcg is base
		expect(isBaseUnit('mcg; IU')).toBe(true);
		// "mg; mmol" — mg is base
		expect(isBaseUnit('mg; mmol')).toBe(true);
	});

	it('accepts mcg DFE (folate equivalent)', () => {
		expect(isBaseUnit('mcg DFE')).toBe(true);
	});

	it('rejects DERIVED units (lab-relative)', () => {
		expect(isBaseUnit('mg/g nitrogen')).toBe(false);
		expect(isBaseUnit('g/100 g fatty acid')).toBe(false);
		expect(isBaseUnit('mg/100 g protein')).toBe(false);
		expect(isBaseUnit('g/100g total fatty acid')).toBe(false);
	});

	it('rejects empty or missing unit', () => {
		expect(isBaseUnit('')).toBe(false);
		expect(isBaseUnit('  ')).toBe(false);
	});

	it('rejects IU-only (not per-100g)', () => {
		expect(isBaseUnit('IU')).toBe(false);
	});
});

describe('normalizeUnit', () => {
	it('replaces mcg with µg', () => {
		expect(normalizeUnit('mcg')).toBe('µg');
	});

	it('takes first unit from compound unit string', () => {
		expect(normalizeUnit('kJ; kcal')).toBe('kJ');
		expect(normalizeUnit('mcg; IU')).toBe('µg');
	});

	it('trims whitespace', () => {
		expect(normalizeUnit('  mg  ')).toBe('mg');
	});

	it('leaves already-normalized units unchanged', () => {
		expect(normalizeUnit('g')).toBe('g');
		expect(normalizeUnit('mg')).toBe('mg');
		expect(normalizeUnit('µg')).toBe('µg');
	});
});

describe('classifyNutrient', () => {
	it('classifies energy nutrients', () => {
		expect(classifyNutrient('ENERC')).toBe('ENERGY');
		expect(classifyNutrient('ENERC_KCAL')).toBe('ENERGY');
		expect(classifyNutrient('ENERCAWG')).toBe('ENERGY');
	});

	it('classifies vitamins', () => {
		expect(classifyNutrient('VITC')).toBe('VITAMIN');
		expect(classifyNutrient('VITB12')).toBe('VITAMIN');
		expect(classifyNutrient('VITA_RAE')).toBe('VITAMIN');
		expect(classifyNutrient('VITD')).toBe('VITAMIN');
		expect(classifyNutrient('THIA')).toBe('VITAMIN');
		expect(classifyNutrient('RIBF')).toBe('VITAMIN');
		expect(classifyNutrient('NIAC')).toBe('VITAMIN');
		expect(classifyNutrient('FOLAC')).toBe('VITAMIN');
		expect(classifyNutrient('BIOT')).toBe('VITAMIN');
		expect(classifyNutrient('CHOLN')).toBe('VITAMIN');
	});

	it('classifies proximate nutrients', () => {
		expect(classifyNutrient('PROCNT')).toBe('PROXIMATE');
		expect(classifyNutrient('FAT')).toBe('PROXIMATE');
		expect(classifyNutrient('WATER')).toBe('PROXIMATE');
		expect(classifyNutrient('ASH')).toBe('PROXIMATE');
		expect(classifyNutrient('ALCO')).toBe('PROXIMATE');
		expect(classifyNutrient('CHOCDF')).toBe('PROXIMATE');
		expect(classifyNutrient('FIBTG')).toBe('PROXIMATE');
		expect(classifyNutrient('SUGAR')).toBe('PROXIMATE');
		expect(classifyNutrient('STARCH')).toBe('PROXIMATE');
		expect(classifyNutrient('FATNLEA')).toBe('PROXIMATE');
	});

	it('classifies minerals', () => {
		expect(classifyNutrient('CA')).toBe('MINERAL');
		expect(classifyNutrient('FE')).toBe('MINERAL');
		expect(classifyNutrient('MG')).toBe('MINERAL');
		expect(classifyNutrient('NA')).toBe('MINERAL');
		expect(classifyNutrient('ZN')).toBe('MINERAL');
		expect(classifyNutrient('K')).toBe('MINERAL');
		expect(classifyNutrient('P')).toBe('MINERAL');
		expect(classifyNutrient('SE')).toBe('MINERAL');
	});

	it('classifies amino acids', () => {
		expect(classifyNutrient('ALA')).toBe('AMINO_ACID');
		expect(classifyNutrient('LEU')).toBe('AMINO_ACID');
		expect(classifyNutrient('LYS')).toBe('AMINO_ACID');
		expect(classifyNutrient('TRP')).toBe('AMINO_ACID');
		expect(classifyNutrient('VAL')).toBe('AMINO_ACID');
		expect(classifyNutrient('PRO')).toBe('AMINO_ACID');
	});

	it('does NOT misclassify PROCNT as amino acid', () => {
		// PROCNT starts with PRO but is protein (proximate)
		expect(classifyNutrient('PROCNT')).toBe('PROXIMATE');
	});

	it('classifies lipids', () => {
		expect(classifyNutrient('FASAT')).toBe('LIPID');
		expect(classifyNutrient('FAMS')).toBe('LIPID');
		expect(classifyNutrient('FAPU')).toBe('LIPID');
		expect(classifyNutrient('CHOL')).toBe('LIPID');
		// Individual fatty acids: F<digit> pattern
		expect(classifyNutrient('F18D2')).toBe('LIPID');
		expect(classifyNutrient('F20D5')).toBe('LIPID');
	});

	it('does NOT misclassify total FAT as lipid', () => {
		// FAT (total fat) is proximate, not a fatty acid
		expect(classifyNutrient('FAT')).toBe('PROXIMATE');
	});

	it('classifies carotenoids', () => {
		expect(classifyNutrient('CARTA')).toBe('CAROTENOID');
		expect(classifyNutrient('CARTB')).toBe('CAROTENOID');
		expect(classifyNutrient('LYCO')).toBe('CAROTENOID');
		expect(classifyNutrient('LUTN')).toBe('CAROTENOID');
		expect(classifyNutrient('CRYPX')).toBe('CAROTENOID');
	});

	it('falls back to OTHER for unknown tagnames', () => {
		expect(classifyNutrient('CAFFN')).toBe('OTHER');
		expect(classifyNutrient('THEBRN')).toBe('OTHER');
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
		// 21 (Fast Foods), 22 (Meals), 24 (Native Foods), 27 (QC) all → "other"
		expect(mapCategorySlug('21')).toBe('other');
		expect(mapCategorySlug('22')).toBe('other');
		expect(mapCategorySlug('27')).toBe('other');
	});

	it('maps both beverage categories to "beverages"', () => {
		expect(mapCategorySlug('14')).toBe('beverages'); // Beverages
		expect(mapCategorySlug('28')).toBe('beverages'); // Alcoholic Beverages
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
