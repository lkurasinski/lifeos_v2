// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NUTRIENT_REGISTRY } from '../../../../scripts/data/nutrient-registry.js';
import { mapCategorySlug, parseAmount } from '../../../../scripts/steps/import-usda.js';

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
