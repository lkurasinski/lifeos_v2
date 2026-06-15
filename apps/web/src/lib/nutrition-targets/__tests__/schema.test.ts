// @vitest-environment node
import { describe, it, expect } from "vitest";
import { nutritionTargetsPayloadSchema } from "../schema.js";

describe("nutritionTargetsPayloadSchema", () => {
	it("accepts a fully-populated payload", () => {
		const parsed = nutritionTargetsPayloadSchema.parse({
			caloriesKcal: 2000,
			proteinG: 150,
			carbsG: 200,
			fatG: 60,
		});
		expect(parsed).toEqual({ caloriesKcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 });
	});

	it("accepts null for every field (unset)", () => {
		const parsed = nutritionTargetsPayloadSchema.parse({
			caloriesKcal: null,
			proteinG: null,
			carbsG: null,
			fatG: null,
		});
		expect(parsed).toEqual({ caloriesKcal: null, proteinG: null, carbsG: null, fatG: null });
	});

	it("preserves NULL ≠ 0 — an explicit 0 stays 0, null stays null", () => {
		const parsed = nutritionTargetsPayloadSchema.parse({
			caloriesKcal: 0,
			proteinG: null,
			carbsG: 0,
			fatG: null,
		});
		expect(parsed.caloriesKcal).toBe(0);
		expect(parsed.proteinG).toBeNull();
		expect(parsed.carbsG).toBe(0);
		expect(parsed.fatG).toBeNull();
	});

	it("rejects negative values", () => {
		expect(() =>
			nutritionTargetsPayloadSchema.parse({
				caloriesKcal: -1,
				proteinG: null,
				carbsG: null,
				fatG: null,
			}),
		).toThrow();
	});

	it("rejects non-numeric values", () => {
		expect(() =>
			nutritionTargetsPayloadSchema.parse({
				caloriesKcal: "2000",
				proteinG: null,
				carbsG: null,
				fatG: null,
			}),
		).toThrow();
	});

	it("rejects a missing field (every key is required, value may be null)", () => {
		expect(() =>
			nutritionTargetsPayloadSchema.parse({
				caloriesKcal: 2000,
				proteinG: 150,
				carbsG: 200,
			}),
		).toThrow();
	});
});
