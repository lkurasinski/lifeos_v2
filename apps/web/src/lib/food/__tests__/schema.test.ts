// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	emptyDraft,
	draftToSavePayload,
	partitionNutrients,
	resolveSourceId,
	shouldFlagUserModified,
} from "../schema.js";

describe("emptyDraft", () => {
	it("produces a blank draft with no nutrient rows", () => {
		const d = emptyDraft("CUSTOM");
		expect(d.source).toBe("CUSTOM");
		expect(d.nameEn).toBe("");
		expect(d.nutrients).toEqual([]);
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

	it("carries through the conversion fields and defaults them to null when absent", () => {
		const withConversion = draftToSavePayload({
			source: "CUSTOM",
			nameEn: "Olive oil",
			densityGPerMl: 0.92,
			pieceWeightG: 5,
			nutrients: [],
		});
		expect(withConversion.densityGPerMl).toBe(0.92);
		expect(withConversion.pieceWeightG).toBe(5);

		const withoutConversion = draftToSavePayload({
			source: "CUSTOM",
			nameEn: "Test",
			nutrients: [],
		});
		expect(withoutConversion.densityGPerMl).toBeNull();
		expect(withoutConversion.pieceWeightG).toBeNull();
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

describe("resolveSourceId", () => {
	it("generates a sourceId for a CUSTOM product when none is supplied", () => {
		const id = resolveSourceId("CUSTOM", undefined, () => "generated-uuid");
		expect(id).toBe("generated-uuid");
	});

	it("keeps an explicitly supplied sourceId (even for CUSTOM)", () => {
		expect(resolveSourceId("CUSTOM", "barcode-123", () => "generated-uuid")).toBe("barcode-123");
		expect(resolveSourceId("OFF", "5901234123457")).toBe("5901234123457");
	});

	it("throws for a non-CUSTOM source missing its sourceId", () => {
		expect(() => resolveSourceId("OFF")).toThrow();
	});
});
