import { describe, it, expect } from "vitest";
import { rowInfo, parseAmount } from "./component-row";
import { MACRO_TAGS } from "$lib/recipe/nutrition";
import type { DraftComponent, DraftComponentPreview, UnitOption } from "$lib/recipe/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────────

const KCAL = MACRO_TAGS.energyKcal;

const gram: UnitOption = {
	id: "u-g",
	slug: "g",
	namePl: "g",
	nameEn: "g",
	kind: "MASS",
	baseFactor: 1,
	displayRank: 1,
};
const spoon: UnitOption = {
	id: "u-spoon",
	slug: "lyzka",
	namePl: "łyżka",
	nameEn: "tbsp",
	kind: "VOLUME",
	baseFactor: 15,
	displayRank: 2,
};
const piece: UnitOption = {
	id: "u-pc",
	slug: "szt",
	namePl: "szt.",
	nameEn: "pc",
	kind: "COUNT",
	baseFactor: 1,
	displayRank: 3,
};

function component(
	over: Partial<DraftComponent> & { preview?: DraftComponentPreview },
): DraftComponent {
	return {
		key: "k1",
		productId: "p1",
		subRecipeId: null,
		name: "Test",
		categorySlug: null,
		amount: 100,
		unitId: gram.id,
		note: null,
		preview: {},
		...over,
	};
}

// ─── rowInfo ──────────────────────────────────────────────────────────────────────

describe("rowInfo", () => {
	it("returns null with no usable amount/unit", () => {
		expect(rowInfo(component({ amount: null }), gram)).toBeNull();
		expect(rowInfo(component({ amount: 0 }), gram)).toBeNull();
		expect(rowInfo(component({ amount: -5 }), gram)).toBeNull();
		expect(rowInfo(component({}), undefined)).toBeNull();
	});

	it("scales a product's kcal per 100 g; metric units are 'direct' (no gram clarifier)", () => {
		const info = rowInfo(
			component({ amount: 200, preview: { nutrientsPer100g: { [KCAL]: 50 } } }),
			gram,
		);
		expect(info).toEqual({ grams: 200, kcal: 100, partial: false, direct: true });
	});

	it("resolves household (VOLUME) grams via baseFactor and marks it non-direct", () => {
		const info = rowInfo(
			component({ amount: 1, unitId: spoon.id, preview: { nutrientsPer100g: { [KCAL]: 800 } } }),
			spoon,
		);
		// 1 łyżka = 15 ml × density 1.0 = 15 g; 15/100 × 800 = 120 kcal.
		expect(info).toEqual({ grams: 15, kcal: 120, partial: false, direct: false });
	});

	it("flags partial when a COUNT unit has no piece weight (grams unresolved)", () => {
		const info = rowInfo(
			component({ amount: 2, unitId: piece.id, preview: { nutrientsPer100g: { [KCAL]: 100 } } }),
			piece,
		);
		expect(info).toEqual({ grams: null, kcal: null, partial: true, direct: false });
	});

	it("flags partial when the product carries no nutrient data", () => {
		const info = rowInfo(component({ amount: 100, preview: {} }), gram);
		expect(info).toMatchObject({ grams: 100, kcal: null, partial: true });
	});

	it("apportions a sub-recipe's cached totals by weight share (grams ÷ yieldWeightG)", () => {
		const info = rowInfo(
			component({
				productId: null,
				subRecipeId: "s1",
				amount: 100,
				preview: { totals: { [KCAL]: 500 }, yieldWeightG: 250, nutritionComplete: true },
			}),
			gram,
		);
		// 100 g of a 250 g sub-recipe = 40% → 0.4 × 500 = 200 kcal.
		expect(info).toEqual({ grams: 100, kcal: 200, partial: false, direct: true });
	});

	it("flags a sub-recipe partial when its cached nutrition is incomplete", () => {
		const info = rowInfo(
			component({
				productId: null,
				subRecipeId: "s1",
				amount: 100,
				preview: { totals: { [KCAL]: 500 }, yieldWeightG: 250, nutritionComplete: false },
			}),
			gram,
		);
		expect(info?.partial).toBe(true);
	});

	it("flags a sub-recipe partial when yield weight is missing (can't apportion)", () => {
		const info = rowInfo(
			component({
				productId: null,
				subRecipeId: "s1",
				amount: 100,
				preview: { totals: { [KCAL]: 500 } },
			}),
			gram,
		);
		expect(info).toMatchObject({ kcal: null, partial: true });
	});
});

// ─── parseAmount ──────────────────────────────────────────────────────────────────

describe("parseAmount", () => {
	it("accepts comma and dot decimals", () => {
		expect(parseAmount("1,5")).toBe(1.5);
		expect(parseAmount("2.5")).toBe(2.5);
		expect(parseAmount("0")).toBe(0);
		expect(parseAmount(" 3 ")).toBe(3);
	});

	it("returns null for empty, blank, negative, or non-numeric input", () => {
		expect(parseAmount("")).toBeNull();
		expect(parseAmount("   ")).toBeNull();
		expect(parseAmount("-1")).toBeNull();
		expect(parseAmount("abc")).toBeNull();
	});
});
