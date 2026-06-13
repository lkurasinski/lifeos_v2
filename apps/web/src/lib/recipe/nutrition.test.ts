// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	rollupRecipe,
	MACRO_TAGS,
	type RollupComponent,
	type ProductNutrition,
	type SubRecipeNutrition,
} from "./nutrition.js";

const MASS = { kind: "MASS", baseFactor: 1 } as const;
const TBSP = { kind: "VOLUME", baseFactor: 15 } as const;
const PIECE = { kind: "COUNT", baseFactor: 0 } as const;

/** Build a product-component + a matching resolver entry. */
function product(
	refId: string,
	name: string,
	amount: number,
	unit: RollupComponent["unit"],
): RollupComponent {
	return { kind: "product", refId, name, amount, unit };
}
function subRecipe(
	refId: string,
	name: string,
	amount: number,
	unit: RollupComponent["unit"] = MASS,
): RollupComponent {
	return { kind: "subRecipe", refId, name, amount, unit };
}

const products: Record<string, ProductNutrition> = {
	chicken: {
		nutrientsPer100g: { ENERC_KCAL: 165, PROCNT: 31, FAT: 3.6, CHOCDF: 0 },
	},
	oil: {
		nutrientsPer100g: { ENERC_KCAL: 884, FAT: 100 },
		densityGPerMl: 0.92,
	},
	egg: {
		nutrientsPer100g: { ENERC_KCAL: 143, PROCNT: 13, FAT: 10, CHOCDF: 1 },
		pieceWeightG: 60,
	},
	// A spice that exists but carries no nutrient data (empty profile).
	nutmeg: { nutrientsPer100g: {} },
};
const resolveProduct = (id: string): ProductNutrition | null => products[id] ?? null;
const noSubRecipes = (): SubRecipeNutrition | null => null;

describe("rollupRecipe — single-level products", () => {
	it("sums per-100g × grams/100 and derives yieldWeightG + per-serving", () => {
		// 200 g chicken + 1 tbsp oil (15 ml × 0.92 = 13.8 g), 2 servings.
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 200, MASS), product("oil", "Oliwa", 1, TBSP)],
			2,
			resolveProduct,
			noSubRecipes,
		);

		expect(result.nutritionComplete).toBe(true);
		expect(result.incompleteComponents).toEqual([]);
		expect(result.yieldWeightG).toBeCloseTo(213.8, 6);

		// 884 kcal/100g × 13.8 g/100 = 121.992 → 330 + 121.992 = 451.992.
		expect(result.totals.ENERC_KCAL).toBeCloseTo(330 + 884 * 0.138, 6);
		expect(result.totals.PROCNT).toBeCloseTo(62, 6);
		expect(result.totals.FAT).toBeCloseTo(7.2 + 13.8, 4); // 21.0
		expect(result.totals.CHOCDF).toBeCloseTo(0, 6);

		// Per-serving is total / servings.
		expect(result.perServing.ENERC_KCAL).toBeCloseTo((330 + 884 * 0.138) / 2, 6);
		expect(result.perServing.PROCNT).toBeCloseTo(31, 6);
	});

	it("derives per-100g as totals × 100 / yieldWeightG", () => {
		const result = rollupRecipe([product("chicken", "Kurczak", 200, MASS)], 1, resolveProduct, noSubRecipes);
		// 200 g of chicken → per-100g must recover the source 165 kcal.
		const per100Kcal = (result.totals.ENERC_KCAL * 100) / result.yieldWeightG;
		expect(per100Kcal).toBeCloseTo(165, 6);
	});

	it("macro tagnames are the promoted macro keys", () => {
		expect(MACRO_TAGS).toEqual({
			energyKcal: "ENERC_KCAL",
			protein: "PROCNT",
			fat: "FAT",
			carbs: "CHOCDF",
		});
	});

	it("treats servings <= 0 as 1 for the per-serving projection", () => {
		const result = rollupRecipe([product("chicken", "Kurczak", 100, MASS)], 0, resolveProduct, noSubRecipes);
		expect(result.perServing.ENERC_KCAL).toBeCloseTo(result.totals.ENERC_KCAL, 6);
	});
});

describe("rollupRecipe — COUNT units", () => {
	it("resolves a piece unit via pieceWeightG", () => {
		const result = rollupRecipe([product("egg", "Jajko", 2, PIECE)], 1, resolveProduct, noSubRecipes);
		expect(result.yieldWeightG).toBe(120);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(143 * 1.2, 4);
		expect(result.nutritionComplete).toBe(true);
	});

	it("flags nutritionComplete=false (not 0) when piece-weight is missing", () => {
		const result = rollupRecipe([product("chicken", "Kurczak", 2, PIECE)], 1, resolveProduct, noSubRecipes);
		// Chicken has no pieceWeightG → unresolved → contributes nothing, not zero.
		expect(result.nutritionComplete).toBe(false);
		expect(result.totals.ENERC_KCAL).toBeUndefined();
		expect(result.yieldWeightG).toBe(0);
		expect(result.incompleteComponents).toEqual([
			{ kind: "product", refId: "chicken", name: "Kurczak" },
		]);
	});
});

describe("rollupRecipe — incompleteness provenance", () => {
	it("names an unmapped product and still rolls up the resolvable rest", () => {
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 100, MASS), product("ghost", "Tajemniczy składnik", 50, MASS)],
			1,
			resolveProduct,
			noSubRecipes,
		);
		expect(result.nutritionComplete).toBe(false);
		expect(result.incompleteComponents).toEqual([
			{ kind: "product", refId: "ghost", name: "Tajemniczy składnik" },
		]);
		// The chicken still contributed.
		expect(result.totals.ENERC_KCAL).toBeCloseTo(165, 6);
	});

	it("flags a mapped product with an empty nutrient profile but still counts its weight", () => {
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 100, MASS), product("nutmeg", "Gałka muszkatołowa", 5, MASS)],
			1,
			resolveProduct,
			noSubRecipes,
		);
		expect(result.nutritionComplete).toBe(false);
		expect(result.incompleteComponents).toEqual([
			{ kind: "product", refId: "nutmeg", name: "Gałka muszkatołowa" },
		]);
		// Empty profile contributes no nutrients, but its 5 g still count toward yield.
		expect(result.yieldWeightG).toBe(105);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(165, 6);
	});
});

describe("rollupRecipe — bad input flagged, never a confident wrong total", () => {
	it("flags a negative-amount component instead of subtracting from totals", () => {
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 100, MASS), product("oil", "Oliwa", -5, MASS)],
			1,
			resolveProduct,
			noSubRecipes,
		);
		expect(result.nutritionComplete).toBe(false);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(165, 6); // oil did NOT subtract
		expect(result.yieldWeightG).toBe(100); // negative grams not added
		expect(result.incompleteComponents).toEqual([{ kind: "product", refId: "oil", name: "Oliwa" }]);
	});

	it("flags a NaN-amount component rather than poisoning totals with NaN", () => {
		const result = rollupRecipe([product("chicken", "Kurczak", NaN, MASS)], 1, resolveProduct, noSubRecipes);
		expect(result.nutritionComplete).toBe(false);
		expect(result.totals.ENERC_KCAL).toBeUndefined();
		expect(result.yieldWeightG).toBe(0);
	});

	it("adds the same product listed twice (both resolvable)", () => {
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 100, MASS), product("chicken", "Kurczak", 50, MASS)],
			1,
			resolveProduct,
			noSubRecipes,
		);
		expect(result.nutritionComplete).toBe(true);
		expect(result.yieldWeightG).toBe(150);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(165 * 1.5, 4);
	});

	it("names a duplicated unresolvable component only once", () => {
		const result = rollupRecipe(
			[product("ghost", "Widmo", 10, MASS), product("ghost", "Widmo", 20, MASS)],
			1,
			resolveProduct,
			noSubRecipes,
		);
		expect(result.nutritionComplete).toBe(false);
		expect(result.incompleteComponents).toEqual([{ kind: "product", refId: "ghost", name: "Widmo" }]);
	});
});

describe("rollupRecipe — sub-recipes (weight-share)", () => {
	const sauce: SubRecipeNutrition = {
		totals: { ENERC_KCAL: 400, PROCNT: 20, FAT: 30 },
		yieldWeightG: 500,
		nutritionComplete: true,
	};
	const resolveSub = (id: string): SubRecipeNutrition | null => (id === "sauce" ? sauce : null);

	it("apportions the sub-recipe's totals by grams / cached yieldWeightG", () => {
		// Use 250 g of a 500 g sauce → exactly half its totals.
		const result = rollupRecipe([subRecipe("sauce", "Sos bolognese", 250)], 1, resolveProduct, resolveSub);
		expect(result.nutritionComplete).toBe(true);
		expect(result.yieldWeightG).toBe(250);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(200, 6);
		expect(result.totals.PROCNT).toBeCloseTo(10, 6);
		expect(result.totals.FAT).toBeCloseTo(15, 6);
	});

	it("combines a product and a sub-recipe", () => {
		const result = rollupRecipe(
			[product("chicken", "Kurczak", 100, MASS), subRecipe("sauce", "Sos bolognese", 500)],
			1,
			resolveProduct,
			resolveSub,
		);
		expect(result.yieldWeightG).toBe(600);
		// Full sauce (500/500 = 1×) + 100 g chicken.
		expect(result.totals.ENERC_KCAL).toBeCloseTo(400 + 165, 4);
		expect(result.totals.PROCNT).toBeCloseTo(20 + 31, 4);
	});

	it("flags a missing sub-recipe", () => {
		const result = rollupRecipe([subRecipe("gone", "Nieznany sos", 100)], 1, resolveProduct, resolveSub);
		expect(result.nutritionComplete).toBe(false);
		expect(result.incompleteComponents).toEqual([{ kind: "subRecipe", refId: "gone", name: "Nieznany sos" }]);
	});

	it("propagates an incomplete sub-recipe upward, naming it, while still apportioning", () => {
		const partialSub: SubRecipeNutrition = {
			totals: { ENERC_KCAL: 100 },
			yieldWeightG: 200,
			nutritionComplete: false,
		};
		const resolve = (id: string): SubRecipeNutrition | null => (id === "partial" ? partialSub : null);
		const result = rollupRecipe([subRecipe("partial", "Beszamel", 100)], 1, resolveProduct, resolve);
		expect(result.totals.ENERC_KCAL).toBeCloseTo(50, 6); // 100/200 × 100
		expect(result.nutritionComplete).toBe(false);
		expect(result.incompleteComponents).toEqual([{ kind: "subRecipe", refId: "partial", name: "Beszamel" }]);
	});

	it("flags a sub-recipe with no usable yieldWeightG denominator", () => {
		const noYield: SubRecipeNutrition = { totals: { ENERC_KCAL: 100 }, yieldWeightG: null, nutritionComplete: true };
		const resolve = (id: string): SubRecipeNutrition | null => (id === "ny" ? noYield : null);
		const result = rollupRecipe([subRecipe("ny", "Bez wagi", 100)], 1, resolveProduct, resolve);
		expect(result.nutritionComplete).toBe(false);
		expect(result.totals.ENERC_KCAL).toBeUndefined();
		// Grams still resolved (MASS) so weight counts.
		expect(result.yieldWeightG).toBe(100);
		expect(result.incompleteComponents).toEqual([{ kind: "subRecipe", refId: "ny", name: "Bez wagi" }]);
	});

	it("rejects a NaN cached sub-recipe yield (would slip past the <= 0 guard)", () => {
		const nanYield: SubRecipeNutrition = {
			totals: { ENERC_KCAL: 100 },
			yieldWeightG: NaN,
			nutritionComplete: true,
		};
		const resolve = (id: string): SubRecipeNutrition | null => (id === "nan" ? nanYield : null);
		const result = rollupRecipe([subRecipe("nan", "Zepsuta waga", 100)], 1, resolveProduct, resolve);
		expect(result.nutritionComplete).toBe(false);
		expect(result.totals.ENERC_KCAL).toBeUndefined(); // no NaN share leaked in
		expect(result.incompleteComponents).toEqual([{ kind: "subRecipe", refId: "nan", name: "Zepsuta waga" }]);
	});
});

describe("rollupRecipe — empty", () => {
	it("returns an empty, complete rollup for no components", () => {
		const result = rollupRecipe([], 4, resolveProduct, noSubRecipes);
		expect(result).toEqual({
			totals: {},
			perServing: {},
			nutritionComplete: true,
			incompleteComponents: [],
			yieldWeightG: 0,
		});
	});
});
