import { describe, it, expect } from "vitest";
import { parseAmount, seedFields, buildDraftProduct } from "./product-form";
import type { DraftProduct, NutrientRegistryEntry, NutrientRegistryGroup } from "$lib/food/schema";

// ─── Fixtures ─────────────────────────────────────────────────────────────────────

function entry(id: string): NutrientRegistryEntry {
	return { id, nameEn: id, namePl: id, unit: "g", category: "macro", displayRank: null };
}

const registry: NutrientRegistryGroup[] = [
	{ category: "macro", nutrients: [entry("ENERC_KCAL"), entry("PROCNT")] },
];

function draft(over: Partial<DraftProduct>): DraftProduct {
	return { source: "OFF", nameEn: "Product", nutrients: [], ...over };
}

// ─── parseAmount ──────────────────────────────────────────────────────────────────

describe("parseAmount", () => {
	it("treats null/undefined/empty/blank as NULL (no data)", () => {
		expect(parseAmount(null)).toBeNull();
		expect(parseAmount(undefined)).toBeNull();
		expect(parseAmount("")).toBeNull();
		expect(parseAmount("   ")).toBeNull();
	});

	it("keeps a typed 0 as 0 (NULL ≠ 0)", () => {
		expect(parseAmount(0)).toBe(0);
		expect(parseAmount("0")).toBe(0);
	});

	it("passes finite numbers through and rejects non-finite", () => {
		expect(parseAmount(5)).toBe(5);
		expect(parseAmount(Infinity)).toBeNull();
		expect(parseAmount(NaN)).toBeNull();
	});

	it("parses comma and dot decimal strings; non-numeric → null", () => {
		expect(parseAmount("1,5")).toBe(1.5);
		expect(parseAmount("2.5")).toBe(2.5);
		expect(parseAmount("abc")).toBeNull();
	});
});

// ─── seedFields ───────────────────────────────────────────────────────────────────

describe("seedFields", () => {
	it("coalesces absent optional text/number fields to empty / null", () => {
		const f = seedFields(draft({ nameEn: "Milk", namePl: null, brand: null, categoryId: null }));
		expect(f).toMatchObject({
			nameEn: "Milk",
			namePl: "",
			brand: "",
			categoryId: "",
			servingSizeG: null,
		});
	});

	it("seeds only present nutrient values; a typed 0 is present, null is absent", () => {
		const f = seedFields(
			draft({
				nutrients: [
					{ nutrientId: "ENERC_KCAL", amountPer100g: 0 },
					{ nutrientId: "PROCNT", amountPer100g: null },
					{ nutrientId: "FAT", amountPer100g: 3 },
				],
			}),
		);
		expect(f.values).toEqual({ ENERC_KCAL: 0, FAT: 3 });
		expect("PROCNT" in f.values).toBe(false);
	});
});

// ─── buildDraftProduct ──────────────────────────────────────────────────────────────

const baseFields = {
	nameEn: "Milk",
	namePl: "Mleko",
	brand: "",
	categoryId: "",
	servingSizeG: null,
	densityGPerMl: null,
	pieceWeightG: null,
	values: {} as Record<string, string | number | null>,
};

describe("buildDraftProduct", () => {
	it("emits EVERY registry nutrient, mapping empties to null and keeping a typed 0 (NULL ≠ 0)", () => {
		const out = buildDraftProduct(
			{ ...baseFields, values: { ENERC_KCAL: 0 } },
			draft({}),
			registry,
		);
		expect(out.nutrients).toEqual([
			{ nutrientId: "ENERC_KCAL", amountPer100g: 0 },
			{ nutrientId: "PROCNT", amountPer100g: null },
		]);
	});

	it("falls back nameEn → Polish name when English is blank, and nulls a blank namePl", () => {
		const enOnly = buildDraftProduct(
			{ ...baseFields, nameEn: "Milk", namePl: "" },
			draft({}),
			registry,
		);
		expect(enOnly).toMatchObject({ nameEn: "Milk", namePl: null });

		const plOnly = buildDraftProduct(
			{ ...baseFields, nameEn: "", namePl: "Mleko" },
			draft({}),
			registry,
		);
		expect(plOnly).toMatchObject({ nameEn: "Mleko", namePl: "Mleko" });
	});

	it("trims brand and nulls blanks; nulls an empty category", () => {
		const out = buildDraftProduct(
			{ ...baseFields, brand: "  Łaciate  ", categoryId: "" },
			draft({}),
			registry,
		);
		expect(out.brand).toBe("Łaciate");
		expect(out.categoryId).toBeNull();
	});

	it("parses the conversion fields", () => {
		const out = buildDraftProduct(
			{ ...baseFields, servingSizeG: "250", densityGPerMl: "1,03", pieceWeightG: 0 },
			draft({}),
			registry,
		);
		expect(out).toMatchObject({ servingSizeG: 250, densityGPerMl: 1.03, pieceWeightG: 0 });
	});

	it("carries through source identity and the non-edited OFF photo URLs", () => {
		const source = draft({
			source: "OFF",
			sourceId: "12345",
			imageUrl: "u",
			imageThumbUrl: "t",
			imageIngredientsUrl: "i",
			imageNutritionUrl: "n",
		});
		const out = buildDraftProduct(baseFields, source, registry);
		expect(out).toMatchObject({
			source: "OFF",
			sourceId: "12345",
			imageUrl: "u",
			imageThumbUrl: "t",
			imageIngredientsUrl: "i",
			imageNutritionUrl: "n",
		});
	});
});
