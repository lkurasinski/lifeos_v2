// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	emptyDraft,
	offToDraft,
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
			{ code: "5901234123457", product_name: "Greek Yogurt", product_name_pl: "Jogurt grecki" },
			[
				{ nutrientId: "id-protein", amountPer100g: 9 },
				{ nutrientId: "id-sodium", amountPer100g: 50 },
			],
		);
		expect(d.source).toBe("OFF");
		expect(d.sourceId).toBe("5901234123457");
		expect(d.nameEn).toBe("Greek Yogurt");
		expect(d.namePl).toBe("Jogurt grecki");
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
});

describe("meiliNutrientsToDraft", () => {
	const hit: FoodDocument = {
		id: "p1",
		namePl: "Jogurt grecki",
		nameEn: "Greek Yogurt",
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
