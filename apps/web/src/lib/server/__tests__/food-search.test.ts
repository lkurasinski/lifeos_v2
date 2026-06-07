// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
	buildFoodSearchQueries,
	shapeFoodSearchResults,
	FOOD_INDEX_NAME,
	FOOD_QUERY_INDEX,
} from "../food-document.js";
import { parseSearchParams, searchParamsSchema } from "../../food/schema.js";
import type { FoodDocument } from "../../food/schema.js";
import type { MultiSearchResult } from "meilisearch";

/** Build a fully-defaulted SearchParams, overriding only what a case needs. */
function params(overrides: Record<string, unknown> = {}) {
	return searchParamsSchema.parse(overrides);
}

describe("buildFoodSearchQueries", () => {
	it("emits three queries against the food index in [hits, source, category] order", () => {
		const queries = buildFoodSearchQueries(params());
		expect(queries).toHaveLength(3);
		expect(queries.every((q) => q.indexUid === FOOD_INDEX_NAME)).toBe(true);
		expect(FOOD_QUERY_INDEX).toEqual({ HITS: 0, SOURCE: 1, CATEGORY: 2 });
	});

	it("maps the sort key to the top-level macro attribute with direction", () => {
		const [hits] = buildFoodSearchQueries(params({ sort: "kcal", dir: "desc" }));
		expect(hits.sort).toEqual(["energyKcal:desc"]);

		const [byName] = buildFoodSearchQueries(params({ sort: "name", dir: "asc" }));
		expect(byName.sort).toEqual(["nameEn:asc"]);

		const [byProtein] = buildFoodSearchQueries(params({ sort: "protein", dir: "asc" }));
		expect(byProtein.sort).toEqual(["protein:asc"]);
	});

	it("translates page/limit into offset/limit on the hits query", () => {
		const [hits] = buildFoodSearchQueries(params({ page: 3, limit: 24 }));
		expect(hits.offset).toBe(48);
		expect(hits.limit).toBe(24);
	});

	it("passes the query text through to every sub-query", () => {
		const queries = buildFoodSearchQueries(params({ q: "jogurt" }));
		expect(queries.map((sub) => sub.q)).toEqual(["jogurt", "jogurt", "jogurt"]);
	});

	it("has no filter when no facets are selected", () => {
		const queries = buildFoodSearchQueries(params());
		expect(queries[FOOD_QUERY_INDEX.HITS].filter).toBeUndefined();
		expect(queries[FOOD_QUERY_INDEX.SOURCE].filter).toBeUndefined();
		expect(queries[FOOD_QUERY_INDEX.CATEGORY].filter).toBeUndefined();
	});

	it("AND-combines both dimensions on the hits query, each as a disjunctive OR group", () => {
		const queries = buildFoodSearchQueries(
			params({ sources: ["CUSTOM", "OFF"], categories: ["nabial"] }),
		);
		expect(queries[FOOD_QUERY_INDEX.HITS].filter).toEqual([
			['source = "CUSTOM"', 'source = "OFF"'],
			['categorySlug = "nabial"'],
		]);
	});

	it("source-distribution query OMITS its own (source) filter and requests the source facet", () => {
		const queries = buildFoodSearchQueries(
			params({ sources: ["CUSTOM"], categories: ["nabial"] }),
		);
		const source = queries[FOOD_QUERY_INDEX.SOURCE];
		expect(source.facets).toEqual(["source"]);
		// keeps the OTHER dimension's filter (category) but not its own (source)
		expect(source.filter).toEqual([['categorySlug = "nabial"']]);
		expect(source.limit).toBe(0);
	});

	it("category-distribution query OMITS its own (category) filter and requests the category facet", () => {
		const queries = buildFoodSearchQueries(
			params({ sources: ["CUSTOM"], categories: ["nabial"] }),
		);
		const category = queries[FOOD_QUERY_INDEX.CATEGORY];
		expect(category.facets).toEqual(["categorySlug"]);
		expect(category.filter).toEqual([['source = "CUSTOM"']]);
		expect(category.limit).toBe(0);
	});
});

describe("shapeFoodSearchResults", () => {
	const hit: FoodDocument = {
		id: "p1",
		namePl: "Jogurt",
		nameEn: "Yogurt",
		brand: null,
		source: "OFF",
		sourceId: "590",
		userModified: false,
		categorySlug: "nabial",
		categoryNamePl: "Nabiał",
		servingSizeG: null,
		nutrients: { PROCNT: 9 },
	};

	function results(): MultiSearchResult<FoodDocument>[] {
		return [
			{
				indexUid: FOOD_INDEX_NAME,
				hits: [hit],
				query: "",
				processingTimeMs: 1,
				offset: 0,
				limit: 24,
				estimatedTotalHits: 137,
			} as unknown as MultiSearchResult<FoodDocument>,
			{
				indexUid: FOOD_INDEX_NAME,
				hits: [],
				query: "",
				processingTimeMs: 1,
				facetDistribution: { source: { OFF: 100, CUSTOM: 37 } },
			} as unknown as MultiSearchResult<FoodDocument>,
			{
				indexUid: FOOD_INDEX_NAME,
				hits: [],
				query: "",
				processingTimeMs: 1,
				facetDistribution: { categorySlug: { nabial: 12, mieso: 25 } },
			} as unknown as MultiSearchResult<FoodDocument>,
		];
	}

	it("reads hits + total from the hits query and echoes page/limit", () => {
		const shaped = shapeFoodSearchResults(params({ page: 2, limit: 24 }), results());
		expect(shaped.hits).toEqual([hit]);
		expect(shaped.total).toBe(137);
		expect(shaped.page).toBe(2);
		expect(shaped.limit).toBe(24);
	});

	it("reads each facet map from ITS OWN query, not the hits query", () => {
		const shaped = shapeFoodSearchResults(params(), results());
		expect(shaped.facets.source).toEqual({ OFF: 100, CUSTOM: 37 });
		expect(shaped.facets.categorySlug).toEqual({ nabial: 12, mieso: 25 });
	});

	it("defaults to empty hits/facets when the distributions are absent", () => {
		const bare = [
			{ indexUid: FOOD_INDEX_NAME, hits: [], query: "", processingTimeMs: 1 },
			{ indexUid: FOOD_INDEX_NAME, hits: [], query: "", processingTimeMs: 1 },
			{ indexUid: FOOD_INDEX_NAME, hits: [], query: "", processingTimeMs: 1 },
		] as unknown as MultiSearchResult<FoodDocument>[];
		const shaped = shapeFoodSearchResults(params(), bare);
		expect(shaped.hits).toEqual([]);
		expect(shaped.total).toBe(0);
		expect(shaped.facets.source).toEqual({});
		expect(shaped.facets.categorySlug).toEqual({});
	});
});

describe("parseSearchParams", () => {
	it("applies schema defaults for an empty query string", () => {
		const parsed = parseSearchParams(new URLSearchParams());
		expect(parsed).toEqual({ sort: "name", dir: "asc", page: 1, limit: 24 });
	});

	it("splits repeated and comma-separated source/category values", () => {
		const sp = new URLSearchParams("sources=CUSTOM,OFF&categories=nabial&categories=mieso");
		const parsed = parseSearchParams(sp);
		expect(parsed.sources).toEqual(["CUSTOM", "OFF"]);
		expect(parsed.categories).toEqual(["nabial", "mieso"]);
	});

	it("coerces numeric page/limit and carries q through", () => {
		const parsed = parseSearchParams(new URLSearchParams("q=jogurt&page=3&limit=50"));
		expect(parsed.q).toBe("jogurt");
		expect(parsed.page).toBe(3);
		expect(parsed.limit).toBe(50);
	});

	it("falls back to defaults for blank q and unparseable page/limit", () => {
		const parsed = parseSearchParams(new URLSearchParams("q=&page=abc&limit="));
		expect(parsed.q).toBeUndefined();
		expect(parsed.page).toBe(1);
		expect(parsed.limit).toBe(24);
	});

	it("throws on an invalid sort enum (a real client error → 400 upstream)", () => {
		expect(() => parseSearchParams(new URLSearchParams("sort=bogus"))).toThrow();
	});
});
