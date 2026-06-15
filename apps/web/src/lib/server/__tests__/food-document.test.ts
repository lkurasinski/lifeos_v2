// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildFoodDocument, FOOD_INDEX_SETTINGS, FOOD_INDEX_NAME } from "../food-document.js";

const product = {
	id: "p1",
	source: "OFF",
	sourceId: "5901234123457",
	nameEn: "Greek Yogurt",
	namePl: "Jogurt grecki",
	servingSizeG: 150,
	userModified: false,
};

describe("buildFoodDocument", () => {
	it("maps present nutrients into the tagname-keyed map", () => {
		const doc = buildFoodDocument(
			product,
			[
				{ nutrientId: "PROCNT", amountPer100g: 9 },
				{ nutrientId: "NA", amountPer100g: 36 },
			],
			{ slug: "nabial", namePl: "Nabiał" },
		);
		expect(doc.nutrients).toEqual({ PROCNT: 9, NA: 36 });
		expect(doc.categorySlug).toBe("nabial");
		expect(doc.categoryNamePl).toBe("Nabiał");
		expect(doc.userModified).toBe(false);
		expect(doc.servingSizeG).toBe(150);
	});

	it("promotes the four macros to top-level numeric fields", () => {
		const doc = buildFoodDocument(
			product,
			[
				{ nutrientId: "ENERC_KCAL", amountPer100g: 59 },
				{ nutrientId: "PROCNT", amountPer100g: 10 },
				{ nutrientId: "FAT", amountPer100g: 0.4 },
				{ nutrientId: "CHOCDF", amountPer100g: 3.6 },
			],
			null,
		);
		expect(doc.energyKcal).toBe(59);
		expect(doc.protein).toBe(10);
		expect(doc.fat).toBe(0.4);
		expect(doc.carbs).toBe(3.6);
	});

	it("omits null amounts from both the map and the macro fields (NULL ≠ 0)", () => {
		const doc = buildFoodDocument(
			product,
			[
				{ nutrientId: "ENERC_KCAL", amountPer100g: null },
				{ nutrientId: "PROCNT", amountPer100g: 10 },
			],
			null,
		);
		expect("ENERC_KCAL" in doc.nutrients).toBe(false);
		expect(doc.energyKcal).toBeUndefined();
		expect(doc.nutrients.PROCNT).toBe(10);
	});

	it("preserves a stored 0 as a real value (distinct from absent)", () => {
		const doc = buildFoodDocument(
			product,
			[
				{ nutrientId: "FAT", amountPer100g: 0 },
				{ nutrientId: "PROCNT", amountPer100g: null },
			],
			null,
		);
		expect(doc.nutrients.FAT).toBe(0);
		expect(doc.fat).toBe(0);
		expect("PROCNT" in doc.nutrients).toBe(false);
		expect(doc.protein).toBeUndefined();
	});

	it("includes OFF image URLs when present, omits them when absent (lean doc)", () => {
		const withImg = buildFoodDocument(
			{ ...product, imageUrl: "https://img/a.jpg", imageThumbUrl: "https://img/a.100.jpg" },
			[],
			null,
		);
		expect(withImg.imageUrl).toBe("https://img/a.jpg");
		expect(withImg.imageThumbUrl).toBe("https://img/a.100.jpg");

		const without = buildFoodDocument(product, [], null);
		expect("imageUrl" in without).toBe(false);
		expect("imageThumbUrl" in without).toBe(false);
	});

	it("carries conversion inputs when present, omits them when null/absent (NULL ≠ 0)", () => {
		// Present → the search-picked component resolves grams with the same density/piece-weight
		// the server caches on save (no density-1.0 divergence for VOLUME units).
		const withConv = buildFoodDocument(
			{ ...product, densityGPerMl: 0.91, pieceWeightG: 50 },
			[],
			null,
		);
		expect(withConv.densityGPerMl).toBe(0.91);
		expect(withConv.pieceWeightG).toBe(50);

		// Absent/null → omitted, so the client preview's `?? 1` fallback matches the server resolve.
		const without = buildFoodDocument(product, [], null);
		expect("densityGPerMl" in without).toBe(false);
		expect("pieceWeightG" in without).toBe(false);
		const nulled = buildFoodDocument(
			{ ...product, densityGPerMl: null, pieceWeightG: null },
			[],
			null,
		);
		expect("densityGPerMl" in nulled).toBe(false);
		expect("pieceWeightG" in nulled).toBe(false);

		// A stored 0 is a real value, not absent.
		const zero = buildFoodDocument({ ...product, densityGPerMl: 0, pieceWeightG: 0 }, [], null);
		expect(zero.densityGPerMl).toBe(0);
		expect(zero.pieceWeightG).toBe(0);
	});

	it("nulls category fields when no category is given", () => {
		const doc = buildFoodDocument(product, [], null);
		expect(doc.categorySlug).toBeNull();
		expect(doc.categoryNamePl).toBeNull();
		expect(doc.nutrients).toEqual({});
	});

	it("exposes the shared index name + sortable macro settings", () => {
		expect(FOOD_INDEX_NAME).toBe("food_products");
		expect(FOOD_INDEX_SETTINGS.sortableAttributes).toEqual([
			"nameEn",
			"energyKcal",
			"protein",
			"fat",
			"carbs",
		]);
		expect(FOOD_INDEX_SETTINGS.filterableAttributes).toEqual(["source", "categorySlug"]);
	});
});
