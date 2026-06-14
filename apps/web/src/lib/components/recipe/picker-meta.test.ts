import { describe, it, expect } from "vitest";
import { productMeta, recipeMeta } from "./picker-meta";
import { t } from "$lib/i18n";
import type { FoodDocument } from "$lib/food/schema";
import type { RecipeDocument } from "$lib/recipe/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────────

function food(over: Partial<FoodDocument>): FoodDocument {
	return {
		id: "f1",
		namePl: "Produkt",
		nameEn: "Product",
		brand: null,
		source: "USDA_SR",
		sourceId: "s1",
		userModified: false,
		categorySlug: null,
		categoryNamePl: null,
		servingSizeG: null,
		nutrients: {},
		...over,
	};
}

function recipe(over: Partial<RecipeDocument>): RecipeDocument {
	return {
		id: "r1",
		name: "Przepis",
		description: null,
		ownerId: "o1",
		status: "PUBLISHED",
		visibility: "PUBLIC",
		difficulty: null,
		mealTypeSlugs: [],
		dietSlugs: [],
		allergenSlugs: [],
		techniqueSlugs: [],
		cuisineSlug: null,
		cuisineNamePl: null,
		productNames: [],
		tips: [],
		servings: 4,
		prepTimeMin: null,
		cookTimeMin: null,
		nutritionComplete: true,
		...over,
	};
}

// ─── productMeta ──────────────────────────────────────────────────────────────────

describe("productMeta", () => {
	it("maps USDA sources to the 'USDA' badge and joins with separators", () => {
		expect(productMeta(food({ source: "USDA_SR", energyKcal: 120 }))).toBe(
			"USDA · 120 kcal / 100 g",
		);
		expect(productMeta(food({ source: "USDA_FOUNDATION", energyKcal: 90 }))).toBe(
			"USDA · 90 kcal / 100 g",
		);
	});

	it("appends the brand when present", () => {
		expect(productMeta(food({ source: "OFF", energyKcal: 50, brand: "Mlekovita" }))).toBe(
			"OFF · 50 kcal / 100 g · Mlekovita",
		);
	});

	it("omits the kcal segment when energy is unknown", () => {
		expect(productMeta(food({ source: "OFF", energyKcal: undefined }))).toBe("OFF");
	});

	it("localizes the CUSTOM source badge via i18n", () => {
		expect(productMeta(food({ source: "CUSTOM", energyKcal: 10 }))).toBe(
			`${t("catalog.sourceBadge.custom")} · 10 kcal / 100 g`,
		);
	});

	it("falls back to the raw source string for an unknown source", () => {
		expect(productMeta(food({ source: "WEIRD" }))).toBe("WEIRD");
	});
});

// ─── recipeMeta ───────────────────────────────────────────────────────────────────

describe("recipeMeta", () => {
	it("shows per-serving kcal then the serving count", () => {
		expect(recipeMeta(recipe({ energyKcalPerServing: 350, servings: 4 }))).toBe(
			`350 ${t("recipe.form.kcalPerServing")} · 4 ${t("recipe.detail.servings")}`,
		);
	});

	it("omits the kcal segment when per-serving energy is unknown", () => {
		expect(recipeMeta(recipe({ energyKcalPerServing: undefined, servings: 2 }))).toBe(
			`2 ${t("recipe.detail.servings")}`,
		);
	});
});
