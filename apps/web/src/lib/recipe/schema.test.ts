// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	recipeComponentSchema,
	recipeStepSchema,
	recipeSavePayloadSchema,
	taxonomyRefSchema,
	parseRecipeSearchParams,
	normalizeTaxonomySlug,
} from "./schema.js";

describe("recipeComponentSchema — exactly-one(productId, subRecipeId)", () => {
	const unitId = "11111111-1111-4111-8111-111111111111";
	const productId = "22222222-2222-4222-8222-222222222222";
	const subRecipeId = "33333333-3333-4333-8333-333333333333";

	it("accepts a product-only component", () => {
		const r = recipeComponentSchema.safeParse({ productId, amount: 100, unitId });
		expect(r.success).toBe(true);
	});

	it("accepts a sub-recipe-only component", () => {
		const r = recipeComponentSchema.safeParse({ subRecipeId, amount: 1, unitId });
		expect(r.success).toBe(true);
	});

	it("rejects a component with BOTH refs set", () => {
		const r = recipeComponentSchema.safeParse({ productId, subRecipeId, amount: 1, unitId });
		expect(r.success).toBe(false);
	});

	it("rejects a component with NEITHER ref set", () => {
		const r = recipeComponentSchema.safeParse({ amount: 1, unitId });
		expect(r.success).toBe(false);
	});

	it("parses a pl-PL comma-decimal amount into a number", () => {
		const r = recipeComponentSchema.parse({ productId, amount: "1,5", unitId });
		expect(r.amount).toBe(1.5);
	});

	it("rejects a non-positive amount", () => {
		expect(recipeComponentSchema.safeParse({ productId, amount: 0, unitId }).success).toBe(false);
		expect(recipeComponentSchema.safeParse({ productId, amount: -2, unitId }).success).toBe(false);
	});
});

describe("recipeStepSchema — tagged union", () => {
	it("accepts an action step with text only", () => {
		expect(recipeStepSchema.safeParse({ kind: "action", text: "Pokrój cebulę" }).success).toBe(true);
	});

	it("accepts an action step with an optional http(s) image", () => {
		const r = recipeStepSchema.safeParse({
			kind: "action",
			text: "Smaż",
			imageUrl: "https://cdn.example.com/step.jpg",
		});
		expect(r.success).toBe(true);
	});

	it("rejects a non-http(s) step image URL (stored-XSS guard)", () => {
		expect(
			recipeStepSchema.safeParse({
				kind: "action",
				text: "x",
				imageUrl: "javascript:alert(1)",
			}).success,
		).toBe(false);
	});

	it("requires durationMin on a wait step", () => {
		expect(recipeStepSchema.safeParse({ kind: "wait", text: "Wyrastanie" }).success).toBe(false);
		const ok = recipeStepSchema.safeParse({ kind: "wait", text: "Wyrastanie", durationMin: 120 });
		expect(ok.success).toBe(true);
	});

	it("rejects a non-positive or non-integer durationMin", () => {
		expect(
			recipeStepSchema.safeParse({ kind: "wait", text: "x", durationMin: 0 }).success,
		).toBe(false);
		expect(
			recipeStepSchema.safeParse({ kind: "wait", text: "x", durationMin: 1.5 }).success,
		).toBe(false);
	});

	it("rejects an unknown step kind", () => {
		expect(recipeStepSchema.safeParse({ kind: "rest", text: "x" }).success).toBe(false);
	});
});

describe("taxonomyRefSchema — id-or-name find-or-create", () => {
	const id = "44444444-4444-4444-8444-444444444444";

	it("accepts an existing id", () => {
		expect(taxonomyRefSchema.safeParse({ id }).success).toBe(true);
	});

	it("accepts a new name", () => {
		expect(taxonomyRefSchema.safeParse({ name: "Paleo" }).success).toBe(true);
	});

	it("rejects both id and name together", () => {
		expect(taxonomyRefSchema.safeParse({ id, name: "Paleo" }).success).toBe(false);
	});

	it("rejects neither", () => {
		expect(taxonomyRefSchema.safeParse({}).success).toBe(false);
	});
});

describe("recipeSavePayloadSchema", () => {
	it("accepts a name-only draft and applies defaults", () => {
		const r = recipeSavePayloadSchema.parse({ name: "Naleśniki" });
		expect(r.status).toBe("DRAFT");
		expect(r.visibility).toBe("PUBLIC");
		expect(r.servings).toBe(1);
		expect(r.components).toEqual([]);
		expect(r.steps).toEqual([]);
		expect(r.tips).toEqual([]);
	});

	it("rejects an empty name", () => {
		expect(recipeSavePayloadSchema.safeParse({ name: "" }).success).toBe(false);
	});
});

describe("normalizeTaxonomySlug", () => {
	it("lowercases, strips Polish diacritics, and hyphenates", () => {
		expect(normalizeTaxonomySlug("Wysokobiałkowa")).toBe("wysokobialkowa");
		expect(normalizeTaxonomySlug("Bez laktozy")).toBe("bez-laktozy");
		expect(normalizeTaxonomySlug("Śródziemnomorska")).toBe("srodziemnomorska");
	});

	it("collapses case/spacing/diacritic variants to the same slug (no duplicate row)", () => {
		expect(normalizeTaxonomySlug("Na Zapas")).toBe(normalizeTaxonomySlug("na zapas"));
		expect(normalizeTaxonomySlug("  keto  ")).toBe("keto");
	});

	it("trims leading/trailing hyphens from punctuation", () => {
		expect(normalizeTaxonomySlug("Wege!")).toBe("wege");
		expect(normalizeTaxonomySlug("100% roślinna")).toBe("100-roslinna");
	});
});

describe("parseRecipeSearchParams", () => {
	it("applies defaults for an empty query string", () => {
		const r = parseRecipeSearchParams(new URLSearchParams());
		expect(r).toEqual({ scope: "wszystkie", sort: "relevance", dir: "asc", page: 1, limit: 24 });
	});

	it("splits repeated and comma-separated facet values", () => {
		const sp = new URLSearchParams("mealTypes=lunch,dinner&diets=keto&diets=vegan");
		const r = parseRecipeSearchParams(sp);
		expect(r.mealTypes).toEqual(["lunch", "dinner"]);
		expect(r.diets).toEqual(["keto", "vegan"]);
	});

	it("carries the scope segment through", () => {
		expect(parseRecipeSearchParams(new URLSearchParams("scope=szkice")).scope).toBe("szkice");
		expect(parseRecipeSearchParams(new URLSearchParams("scope=moje")).scope).toBe("moje");
	});

	it("falls back to defaults for blank q and unparseable page/limit", () => {
		const r = parseRecipeSearchParams(new URLSearchParams("q=&page=abc&limit="));
		expect(r.q).toBeUndefined();
		expect(r.page).toBe(1);
		expect(r.limit).toBe(24);
	});

	it("throws on an invalid scope/sort enum (a real client error → 400 upstream)", () => {
		expect(() => parseRecipeSearchParams(new URLSearchParams("scope=bogus"))).toThrow();
		expect(() => parseRecipeSearchParams(new URLSearchParams("sort=bogus"))).toThrow();
	});
});
