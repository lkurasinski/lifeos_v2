/**
 * Pure Meilisearch document builder + index config.
 *
 * Dependency-free by design: imports nothing from `$lib/server/db`,
 * `$lib/server/search`, or `$env/*`. This lets BOTH the SvelteKit app (via `$lib`)
 * and the tsx batch index step (via the relative `./food-document.js` path) load it.
 * The `FoodDocument` type comes from `$lib/food/schema` via a TYPE-ONLY import, so
 * esbuild erases it and the batch chain pulls in no extra runtime module.
 */
import type { MultiSearchQuery, MultiSearchResult } from "meilisearch";
import type { FoodDocument, FoodSearchResult, SearchParams, SortKey } from "../food/schema";
import { orClause } from "./meili-filter";

export const FOOD_INDEX_NAME = "food_products";

/**
 * Index settings, defined once. The batch step and the runtime helper each apply
 * this to their own Meili client. Macros are top-level numeric so Meili can sort
 * them (it cannot sort nested fields).
 */
export const FOOD_INDEX_SETTINGS = {
	searchableAttributes: ["namePl", "nameEn", "brand", "categoryNamePl"],
	filterableAttributes: ["source", "categorySlug"],
	sortableAttributes: ["nameEn", "energyKcal", "protein", "fat", "carbs"],
	// Meili caps `estimatedTotalHits` at `maxTotalHits` (default 1000), which would
	// understate the catalog count + page count. Raise it well above the catalog size
	// so the "N produktów" header and pagination reflect the real total.
	pagination: { maxTotalHits: 50000 },
};

/** INFOODS tag → the top-level document field promoted for sorting. */
const MACRO_FIELDS: Record<string, "energyKcal" | "protein" | "fat" | "carbs"> = {
	ENERC_KCAL: "energyKcal",
	PROCNT: "protein",
	FAT: "fat",
	CHOCDF: "carbs",
};

interface ProductInput {
	id: string;
	source: string;
	sourceId: string;
	nameEn: string;
	namePl: string | null;
	brand?: string | null;
	servingSizeG: number | null;
	userModified: boolean;
	imageUrl?: string | null;
	imageThumbUrl?: string | null;
	imageIngredientsUrl?: string | null;
	imageNutritionUrl?: string | null;
}

interface NutrientInput {
	/** The Nutrient PK — the INFOODS tagname (e.g. ENERC_KCAL). */
	nutrientId: string;
	amountPer100g: number | null;
}

interface CategoryInput {
	slug: string;
	namePl: string;
}

/**
 * Build the catalog read model from already-loaded rows (pure — no DB/Meili client).
 * - `nutrients` carries only present (non-null) values, keyed by INFOODS tagname.
 * - The four macros are promoted to top-level numerics.
 * - NULL ≠ 0: a null amount is OMITTED from both the map and the macro fields; a
 *   stored `0` is preserved.
 */
export function buildFoodDocument(
	product: ProductInput,
	foodNutrients: NutrientInput[],
	category: CategoryInput | null,
): FoodDocument {
	const nutrients: Record<string, number> = {};
	const doc: FoodDocument = {
		id: product.id,
		namePl: product.namePl ?? null,
		nameEn: product.nameEn,
		brand: product.brand ?? null,
		source: product.source,
		sourceId: product.sourceId,
		userModified: product.userModified,
		categorySlug: category?.slug ?? null,
		categoryNamePl: category?.namePl ?? null,
		servingSizeG: product.servingSizeG ?? null,
		nutrients,
	};

	for (const fn of foodNutrients) {
		if (fn.amountPer100g === null || fn.amountPer100g === undefined) continue;
		nutrients[fn.nutrientId] = fn.amountPer100g;
		const macro = MACRO_FIELDS[fn.nutrientId];
		if (macro) doc[macro] = fn.amountPer100g;
	}

	// Image URLs are display metadata — included only when present (absent ⇒ omitted).
	if (product.imageUrl) doc.imageUrl = product.imageUrl;
	if (product.imageThumbUrl) doc.imageThumbUrl = product.imageThumbUrl;
	if (product.imageIngredientsUrl) doc.imageIngredientsUrl = product.imageIngredientsUrl;
	if (product.imageNutritionUrl) doc.imageNutritionUrl = product.imageNutritionUrl;

	return doc;
}

// ─── Search query construction (pure — no Meili client) ────────────────────────

/** Catalog sort key → the top-level document attribute Meili sorts on. */
const SORT_FIELD: Record<SortKey, "nameEn" | "energyKcal" | "protein" | "fat" | "carbs"> = {
	name: "nameEn",
	kcal: "energyKcal",
	protein: "protein",
	fat: "fat",
	carbs: "carbs",
};

/**
 * Positional layout of the `multiSearch` queries `buildFoodSearchQueries` emits.
 * `shapeFoodSearchResults` reads results by these indices: hits come from HITS, and
 * each facet's switchable counts come from ITS OWN distribution query (not HITS), so
 * an active filter narrows the *other* facets without collapsing its own.
 */
export const FOOD_QUERY_INDEX = { HITS: 0, SOURCE: 1, CATEGORY: 2 } as const;

/**
 * Build the three-query `multiSearch` payload that powers disjunctive faceting:
 * - HITS: filtered by BOTH dimensions, sorted + paginated — supplies hits + total.
 * - SOURCE: omits the source filter, requests the `source` facet — switchable source counts.
 * - CATEGORY: omits the category filter, requests the `categorySlug` facet — switchable category counts.
 *
 * Each facet distribution is therefore computed over a result set that does NOT
 * filter on that facet, keeping its chips switchable while the other narrows.
 */
export function buildFoodSearchQueries(params: SearchParams): MultiSearchQuery[] {
	const q = params.q ?? "";
	const sourceClause = orClause("source", params.sources);
	const categoryClause = orClause("categorySlug", params.categories);

	const hitsFilter = [sourceClause, categoryClause].filter((c): c is string[] => c !== null);
	const sourceQueryFilter = [categoryClause].filter((c): c is string[] => c !== null);
	const categoryQueryFilter = [sourceClause].filter((c): c is string[] => c !== null);

	const page = params.page;
	const limit = params.limit;

	const hits: MultiSearchQuery = {
		indexUid: FOOD_INDEX_NAME,
		q,
		sort: [`${SORT_FIELD[params.sort]}:${params.dir}`],
		offset: (page - 1) * limit,
		limit,
	};
	if (hitsFilter.length > 0) hits.filter = hitsFilter;

	const sourceFacets: MultiSearchQuery = {
		indexUid: FOOD_INDEX_NAME,
		q,
		facets: ["source"],
		limit: 0,
	};
	if (sourceQueryFilter.length > 0) sourceFacets.filter = sourceQueryFilter;

	const categoryFacets: MultiSearchQuery = {
		indexUid: FOOD_INDEX_NAME,
		q,
		facets: ["categorySlug"],
		limit: 0,
	};
	if (categoryQueryFilter.length > 0) categoryFacets.filter = categoryQueryFilter;

	return [hits, sourceFacets, categoryFacets];
}

/**
 * Shape the `multiSearch` results (in the `buildFoodSearchQueries` order) into the
 * catalog read model. `total` is the hits query's estimate; each facet map is read
 * from its OWN distribution query so it reflects the switchable (disjunctive) counts.
 */
export function shapeFoodSearchResults(
	params: SearchParams,
	results: MultiSearchResult<FoodDocument>[],
): FoodSearchResult {
	const hitsResult = results[FOOD_QUERY_INDEX.HITS];
	const sourceResult = results[FOOD_QUERY_INDEX.SOURCE];
	const categoryResult = results[FOOD_QUERY_INDEX.CATEGORY];

	return {
		hits: (hitsResult?.hits ?? []) as FoodDocument[],
		total: hitsResult?.estimatedTotalHits ?? hitsResult?.totalHits ?? 0,
		page: params.page,
		limit: params.limit,
		facets: {
			source: sourceResult?.facetDistribution?.source ?? {},
			categorySlug: categoryResult?.facetDistribution?.categorySlug ?? {},
		},
	};
}
