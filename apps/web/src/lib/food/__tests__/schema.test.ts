// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	emptyDraft,
	offToDraft,
	matchFoodCategorySlug,
	meiliNutrientsToDraft,
	draftToSavePayload,
	partitionNutrients,
	shouldFlagUserModified,
	type FoodDocument,
} from "../schema.js";

describe("emptyDraft", () => {
	it("produces a blank draft with no nutrient rows", () => {
		const d = emptyDraft("CUSTOM");
		expect(d.source).toBe("CUSTOM");
		expect(d.nameEn).toBe("");
		expect(d.nutrients).toEqual([]);
	});
});

describe("offToDraft", () => {
	it("assembles a canonical OFF draft from metadata + factor-applied rows", () => {
		const d = offToDraft(
			{
				code: "5901234123457",
				product_name: "Greek Yogurt",
				product_name_pl: "Jogurt grecki",
				brands: "Pilos, Lidl",
			},
			[
				{ nutrientId: "id-protein", amountPer100g: 9 },
				{ nutrientId: "id-sodium", amountPer100g: 50 },
			],
		);
		expect(d.source).toBe("OFF");
		expect(d.sourceId).toBe("5901234123457");
		expect(d.nameEn).toBe("Greek Yogurt");
		expect(d.namePl).toBe("Jogurt grecki");
		// `brands` is comma-separated → keep the first (primary) brand.
		expect(d.brand).toBe("Pilos");
		expect(d.nutrients).toEqual([
			{ nutrientId: "id-protein", amountPer100g: 9 },
			{ nutrientId: "id-sodium", amountPer100g: 50 },
		]);
	});

	it("falls back to the barcode for the name and yields an all-empty draft with no nutriments", () => {
		const d = offToDraft({ code: "123", product_name: "" }, []);
		expect(d.nameEn).toBe("123");
		expect(d.namePl).toBeNull();
		expect(d.nutrients).toEqual([]);
	});

	it("resolves categoryId from OFF categories_tags via the slug→id map", () => {
		const slugToId = new Map([
			["fruits", "cat-fruits"],
			["beverages", "cat-bev"],
		]);
		const d = offToDraft(
			{
				code: "123",
				product_name: "Orange Juice",
				categories_tags: ["en:beverages", "en:juices-and-nectars", "en:orange-juices"],
			},
			[],
			slugToId,
		);
		// "orange-juices" → fruits (juice beats the broad "beverages" parent).
		expect(d.categoryId).toBe("cat-fruits");
	});

	it("carries OFF image URLs into the draft, null when OFF omits them", () => {
		const d = offToDraft(
			{
				code: "1",
				product_name: "X",
				image_url: "https://images.openfoodfacts.org/a.jpg",
				image_thumb_url: "https://images.openfoodfacts.org/a.100.jpg",
				image_ingredients_url: "https://images.openfoodfacts.org/ing.jpg",
				image_nutrition_url: "https://images.openfoodfacts.org/nut.jpg",
			},
			[],
		);
		expect(d.imageUrl).toBe("https://images.openfoodfacts.org/a.jpg");
		expect(d.imageThumbUrl).toBe("https://images.openfoodfacts.org/a.100.jpg");
		expect(d.imageIngredientsUrl).toBe("https://images.openfoodfacts.org/ing.jpg");
		expect(d.imageNutritionUrl).toBe("https://images.openfoodfacts.org/nut.jpg");

		const bare = offToDraft({ code: "1", product_name: "X" }, []);
		expect(bare.imageUrl).toBeNull();
		expect(bare.imageThumbUrl).toBeNull();
	});

	it("leaves categoryId null when no tag matches or no map is supplied", () => {
		expect(offToDraft({ code: "1", categories_tags: ["en:unknown-thing"] }, [], new Map()).categoryId).toBeNull();
		expect(offToDraft({ code: "1", categories_tags: ["en:dairies"] }, []).categoryId).toBeNull();
	});
});

describe("matchFoodCategorySlug", () => {
	it("matches whole tokens, preferring the most specific tag", () => {
		expect(matchFoodCategorySlug(["en:dairies", "en:cheeses"])).toBe("dairy");
		expect(matchFoodCategorySlug(["en:meats", "en:beef"])).toBe("beef");
		expect(matchFoodCategorySlug(["en:snacks", "en:salty-snacks", "en:chips-and-fries"])).toBe("snacks");
	});

	it("does not fire a keyword inside a larger word", () => {
		// "butternut" must NOT match the "nut" keyword (whole-token matching).
		expect(matchFoodCategorySlug(["en:butternut"])).toBeNull();
	});

	it("returns null for empty/unknown input", () => {
		expect(matchFoodCategorySlug(undefined)).toBeNull();
		expect(matchFoodCategorySlug([])).toBeNull();
		expect(matchFoodCategorySlug(["en:some-exotic-category"])).toBeNull();
	});
});

describe("meiliNutrientsToDraft", () => {
	const hit: FoodDocument = {
		id: "p1",
		namePl: "Jogurt grecki",
		nameEn: "Greek Yogurt",
		brand: "Pilos",
		source: "OFF",
		sourceId: "5901234123457",
		userModified: false,
		categorySlug: "nabial",
		categoryNamePl: "Nabiał",
		servingSizeG: 150,
		protein: 9,
		nutrients: { PROCNT: 9, NA: 36 },
	};

	it("maps tagname-keyed amounts to nutrientId-keyed draft values", () => {
		const tagToId = new Map([
			["PROCNT", "id-protein"],
			["NA", "id-sodium"],
		]);
		const d = meiliNutrientsToDraft(hit, tagToId);
		expect(d.nameEn).toBe("Greek Yogurt");
		expect(d.brand).toBe("Pilos");
		expect(d.servingSizeG).toBe(150);
		expect(d.nutrients).toEqual([
			{ nutrientId: "id-protein", amountPer100g: 9 },
			{ nutrientId: "id-sodium", amountPer100g: 36 },
		]);
	});

	it("skips tags absent from the registry map (missing stays absent, never 0)", () => {
		const tagToId = new Map([["PROCNT", "id-protein"]]);
		const d = meiliNutrientsToDraft(hit, tagToId);
		expect(d.nutrients).toEqual([{ nutrientId: "id-protein", amountPer100g: 9 }]);
	});
});

describe("draftToSavePayload", () => {
	it("preserves an explicit 0 and drops absent (null) amounts", () => {
		const payload = draftToSavePayload({
			source: "CUSTOM",
			nameEn: "Test",
			nutrients: [
				{ nutrientId: "a", amountPer100g: 0 },
				{ nutrientId: "b", amountPer100g: null },
				{ nutrientId: "c", amountPer100g: 5 },
			],
		});
		expect(payload.nutrients).toEqual([
			{ nutrientId: "a", amountPer100g: 0 },
			{ nutrientId: "c", amountPer100g: 5 },
		]);
		expect(payload.namePl).toBeNull();
		expect(payload.categoryId).toBeNull();
	});
});

describe("partitionNutrients", () => {
	it("splits into present (incl. 0) and removed (null) ids", () => {
		const { present, removed } = partitionNutrients([
			{ nutrientId: "a", amountPer100g: 0 },
			{ nutrientId: "b", amountPer100g: null },
			{ nutrientId: "c", amountPer100g: 5 },
		]);
		expect(present).toEqual([
			{ nutrientId: "a", amountPer100g: 0 },
			{ nutrientId: "c", amountPer100g: 5 },
		]);
		expect(removed).toEqual(["b"]);
	});
});

describe("shouldFlagUserModified", () => {
	it("flags non-CUSTOM sources and leaves CUSTOM alone", () => {
		expect(shouldFlagUserModified("OFF")).toBe(true);
		expect(shouldFlagUserModified("USDA_SR")).toBe(true);
		expect(shouldFlagUserModified("CUSTOM")).toBe(false);
	});
});
