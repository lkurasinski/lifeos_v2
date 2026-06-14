/**
 * Pure Meilisearch recipe-document builder + index config.
 *
 * Dependency-free by design (mirrors `food-document.ts`): imports nothing from
 * `$lib/server/db`, `$lib/server/search`, or `$env/*`. This lets BOTH the SvelteKit app
 * (via `$lib`) and the Phase 4 tsx batch reindex step (via the relative `./recipe-document.js`
 * path) load it. The `RecipeDocument` type comes from `$lib/recipe/schema` via a TYPE-ONLY
 * import, so esbuild erases it and the batch chain pulls in no extra runtime module.
 *
 * The impure sync helpers (build-from-DB, push to Meili) live in `recipes.ts` alongside
 * the Prisma + Meili clients — exactly as `syncFoodDocument` lives in `food-products.ts`,
 * not in the pure `food-document.ts`.
 */
import type { MultiSearchQuery, MultiSearchResult } from "meilisearch";
import { orClause } from "./meili-filter";
import type {
	RecipeDocument,
	RecipeStatus,
	RecipeVisibility,
	RecipeDifficulty,
	RecipeSearchParams,
	RecipeSortKey,
	RecipeScope,
	RecipeSearchResult,
} from "../recipe/schema";

export const RECIPE_INDEX_NAME = "recipes";

/**
 * Index settings, defined once and applied by BOTH the runtime ensure-helper and the
 * batch reindex step. Per-serving macros + total time are top-level numerics so Meili
 * can sort them (it cannot sort nested fields). `visibility` + `ownerId` are filterable
 * so the base visibility filter (`visibility = PUBLIC OR ownerId = me`) can be applied —
 * a filter on a non-filterable attribute throws, so these MUST be present before the
 * first `addDocuments` (see lessons: "settings before first use").
 */
export const RECIPE_INDEX_SETTINGS = {
	searchableAttributes: ["name", "description", "productNames", "cuisineNamePl", "tips"],
	filterableAttributes: [
		"mealTypeSlugs",
		"dietSlugs",
		"allergenSlugs",
		"techniqueSlugs",
		"cuisineSlug",
		"difficulty",
		"visibility",
		"ownerId",
	],
	sortableAttributes: ["name", "energyKcalPerServing", "proteinPerServing", "totalTimeMin"],
	// Match the food index: lift Meili's default 1000-hit cap so the "N przepisów" count
	// and pagination reflect the real total as the catalog grows.
	pagination: { maxTotalHits: 50000 },
	// Meili returns at most `maxValuesPerFacet` distinct values per facet (default 100). The
	// diet/technique/allergen vocabularies are user-extensible (the `Dodaj` chip), so lift the
	// cap well above the expected slug count to keep facet-distribution counts from silently
	// truncating as the taxonomies grow.
	faceting: { maxValuesPerFacet: 200 },
};

/** A taxonomy join row reduced to what the document needs. */
interface TaxonomyRef {
	slug: string;
	namePl: string;
}

/** The already-loaded recipe shape `buildRecipeDocument` projects into the read model. */
export interface RecipeDocInput {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	status: RecipeStatus;
	visibility: RecipeVisibility;
	difficulty: RecipeDifficulty | null;
	servings: number;
	prepTimeMin: number | null;
	cookTimeMin: number | null;
	tips: string[];
	imageUrl: string | null;
	energyKcalPerServing: number | null;
	proteinPerServing: number | null;
	fatPerServing: number | null;
	carbsPerServing: number | null;
	nutritionComplete: boolean;
	mealTypes: TaxonomyRef[];
	diets: TaxonomyRef[];
	allergens: TaxonomyRef[];
	techniques: TaxonomyRef[];
	cuisine: TaxonomyRef | null;
	/** Component product display names (Polish preferred), for the searchable join field. */
	productNames: string[];
}

/**
 * A loaded recipe ROW (Prisma `findUnique`/`findMany` with the rollup relations) reduced to
 * the structural shape the document projection needs. Both the runtime sync (`recipes.ts`
 * `toDocInput`) and the batch reindex (`reindex.ts` `reindexRecipes`) load a recipe with the
 * relations and project it through `projectRecipeToDocInput` — ONE rebuild site, so a field
 * added to `RecipeDocInput` can't be silently dropped by one path but not the other
 * (lessons: "update EVERY explicit object reconstruction").
 */
export interface RecipeRowForDoc {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	status: RecipeStatus;
	visibility: RecipeVisibility;
	difficulty: RecipeDifficulty | null;
	servings: number;
	prepTimeMin: number | null;
	cookTimeMin: number | null;
	tips: string[];
	imageUrl: string | null;
	energyKcalPerServing: number | null;
	proteinPerServing: number | null;
	fatPerServing: number | null;
	carbsPerServing: number | null;
	nutritionComplete: boolean;
	mealTypes: TaxonomyRef[];
	diets: TaxonomyRef[];
	allergens: TaxonomyRef[];
	techniques: TaxonomyRef[];
	cuisine: TaxonomyRef | null;
	/** Ordered components; only the product display names are projected (sub-recipes omitted). */
	components: { product: { namePl: string | null; nameEn: string } | null }[];
}

/**
 * Project a loaded recipe row into the pure document builder's input (`RecipeDocInput`).
 * `productNames` is the component products' display names (Polish preferred) for the
 * searchable join field; sub-recipe components contribute no name here.
 */
export function projectRecipeToDocInput(recipe: RecipeRowForDoc): RecipeDocInput {
	const productNames = recipe.components
		.filter((c) => c.product !== null)
		.map((c) => c.product!.namePl ?? c.product!.nameEn);

	return {
		id: recipe.id,
		userId: recipe.userId,
		name: recipe.name,
		description: recipe.description,
		status: recipe.status,
		visibility: recipe.visibility,
		difficulty: recipe.difficulty,
		servings: recipe.servings,
		prepTimeMin: recipe.prepTimeMin,
		cookTimeMin: recipe.cookTimeMin,
		tips: recipe.tips,
		imageUrl: recipe.imageUrl,
		energyKcalPerServing: recipe.energyKcalPerServing,
		proteinPerServing: recipe.proteinPerServing,
		fatPerServing: recipe.fatPerServing,
		carbsPerServing: recipe.carbsPerServing,
		nutritionComplete: recipe.nutritionComplete,
		mealTypes: recipe.mealTypes,
		diets: recipe.diets,
		allergens: recipe.allergens,
		techniques: recipe.techniques,
		cuisine: recipe.cuisine,
		productNames,
	};
}

/**
 * Build the catalog read model from an already-loaded recipe (pure — no DB/Meili client).
 * Per-serving macros + total time are promoted to top-level numerics and OMITTED when
 * null (never stored as 0, so a missing value never sorts as a real low number). Only
 * PUBLISHED recipes are ever passed here — the sync layer removes the doc on DRAFT.
 */
export function buildRecipeDocument(recipe: RecipeDocInput): RecipeDocument {
	const doc: RecipeDocument = {
		id: recipe.id,
		name: recipe.name,
		description: recipe.description,
		ownerId: recipe.userId,
		status: recipe.status,
		visibility: recipe.visibility,
		difficulty: recipe.difficulty,
		mealTypeSlugs: recipe.mealTypes.map((t) => t.slug),
		dietSlugs: recipe.diets.map((t) => t.slug),
		allergenSlugs: recipe.allergens.map((t) => t.slug),
		techniqueSlugs: recipe.techniques.map((t) => t.slug),
		cuisineSlug: recipe.cuisine?.slug ?? null,
		cuisineNamePl: recipe.cuisine?.namePl ?? null,
		productNames: recipe.productNames,
		tips: recipe.tips,
		servings: recipe.servings,
		prepTimeMin: recipe.prepTimeMin,
		cookTimeMin: recipe.cookTimeMin,
		nutritionComplete: recipe.nutritionComplete,
	};

	const totalTime = sumNullable(recipe.prepTimeMin, recipe.cookTimeMin);
	if (totalTime !== null) doc.totalTimeMin = totalTime;

	if (recipe.energyKcalPerServing !== null) doc.energyKcalPerServing = recipe.energyKcalPerServing;
	if (recipe.proteinPerServing !== null) doc.proteinPerServing = recipe.proteinPerServing;
	if (recipe.fatPerServing !== null) doc.fatPerServing = recipe.fatPerServing;
	if (recipe.carbsPerServing !== null) doc.carbsPerServing = recipe.carbsPerServing;

	if (recipe.imageUrl) doc.imageUrl = recipe.imageUrl;

	return doc;
}

/** Sum two nullable times; null only when BOTH are null (so "30 min prep, no cook" still sorts). */
function sumNullable(a: number | null, b: number | null): number | null {
	if (a === null && b === null) return null;
	return (a ?? 0) + (b ?? 0);
}

// ─── Search query construction (pure — no Meili client) ────────────────────────

/**
 * Positional layout of the `multiSearch` queries `buildRecipeSearchQueries` emits.
 * `shapeRecipeSearchResults` reads results by these indices: hits from HITS, and each
 * facet's switchable counts from ITS OWN distribution query (the query that omits that
 * facet's own filter), so an active filter narrows the OTHER facets without collapsing its own.
 */
export const RECIPE_QUERY_INDEX = {
	HITS: 0,
	MEAL_TYPE: 1,
	DIET: 2,
	ALLERGEN: 3,
	TECHNIQUE: 4,
	CUISINE: 5,
	DIFFICULTY: 6,
} as const;

/** Catalog sort key → the top-level document attribute Meili sorts on (`null` = relevance). */
const RECIPE_SORT_FIELD: Record<RecipeSortKey, string | null> = {
	relevance: null,
	kcal: "energyKcalPerServing",
	protein: "proteinPerServing",
	time: "totalTimeMin",
	name: "name",
};

/**
 * The base visibility clause — a CROSS-attribute OR (two DIFFERENT attributes), which the
 * single-attribute `orClause` cannot express. `wszystkie` ⇒ `visibility = PUBLIC OR ownerId = me`;
 * `moje` ⇒ only my recipes; `publiczne` ⇒ only public. (`szkice` never reaches Meili — drafts
 * aren't indexed; the runner routes that scope to Postgres.) Returned as a single AND-term
 * (string) or a nested OR-group (string[]) — privacy rests on this always being applied.
 */
function scopeClause(scope: RecipeScope, viewerId: string): string | string[] {
	switch (scope) {
		case "moje":
			return `ownerId = "${viewerId}"`;
		case "publiczne":
			return `visibility = "PUBLIC"`;
		case "wszystkie":
		default:
			return [`visibility = "PUBLIC"`, `ownerId = "${viewerId}"`];
	}
}

/** Assemble a Meili filter from the always-present base clause + the non-null facet clauses. */
function buildFilter(base: string | string[], clauses: (string[] | null)[]): (string | string[])[] {
	const filter: (string | string[])[] = [base];
	for (const c of clauses) if (c !== null) filter.push(c);
	return filter;
}

/**
 * Build the seven-query `multiSearch` payload powering disjunctive faceting over recipes:
 * - HITS: base filter AND all facet clauses, sorted + paginated — supplies hits + total.
 * - one query per facet dimension: base filter AND every OTHER facet clause (omitting its own),
 *   `facets: [<dim>]`, `limit: 0` — its switchable counts.
 *
 * The base visibility/scope clause is applied to EVERY query (including facet-distribution
 * queries), so another user's PRIVATE rows never leak into hits OR counts. `viewerId` is
 * threaded in (foods carry no viewer context). Never call this for `scope === "szkice"`.
 */
export function buildRecipeSearchQueries(
	params: RecipeSearchParams,
	viewerId: string,
): MultiSearchQuery[] {
	const q = params.q ?? "";
	const base = scopeClause(params.scope, viewerId);

	const mealClause = orClause("mealTypeSlugs", params.mealTypes);
	const dietClause = orClause("dietSlugs", params.diets);
	const allergenClause = orClause("allergenSlugs", params.allergens);
	const techniqueClause = orClause("techniqueSlugs", params.techniques);
	const cuisineClause = orClause("cuisineSlug", params.cuisines);
	const difficultyClause = orClause("difficulty", params.difficulties);
	const all = [
		mealClause,
		dietClause,
		allergenClause,
		techniqueClause,
		cuisineClause,
		difficultyClause,
	];

	const sortField = RECIPE_SORT_FIELD[params.sort];
	const hits: MultiSearchQuery = {
		indexUid: RECIPE_INDEX_NAME,
		q,
		filter: buildFilter(base, all),
		offset: (params.page - 1) * params.limit,
		limit: params.limit,
	};
	if (sortField !== null) hits.sort = [`${sortField}:${params.dir}`];

	// Each facet query omits ONLY its own clause (so its chips stay switchable) and requests
	// just that facet's distribution. `c !== omit` is by REFERENCE: each non-null clause is a
	// distinct array (orClause returns a fresh `.map`), and `omit` is that dimension's own
	// clause object, so exactly one element is dropped when it's non-null. When the omitted
	// facet is unselected, `omit === null` and the predicate strips EVERY null clause — but
	// that's a no-op: buildFilter already skips nulls, so the resulting filter is identical.
	const facetQuery = (facet: string, omit: string[] | null): MultiSearchQuery => ({
		indexUid: RECIPE_INDEX_NAME,
		q,
		filter: buildFilter(
			base,
			all.filter((c) => c !== omit),
		),
		facets: [facet],
		limit: 0,
	});

	return [
		hits,
		facetQuery("mealTypeSlugs", mealClause),
		facetQuery("dietSlugs", dietClause),
		facetQuery("allergenSlugs", allergenClause),
		facetQuery("techniqueSlugs", techniqueClause),
		facetQuery("cuisineSlug", cuisineClause),
		facetQuery("difficulty", difficultyClause),
	];
}

/**
 * Shape the `multiSearch` results (in `buildRecipeSearchQueries` order) into the catalog read
 * model. `total` is the hits query's estimate; each facet map is read from its OWN distribution
 * query (the one that omitted that facet's filter) so it reflects switchable disjunctive counts.
 */
export function shapeRecipeSearchResults(
	params: RecipeSearchParams,
	results: MultiSearchResult<RecipeDocument>[],
): RecipeSearchResult {
	const hitsResult = results[RECIPE_QUERY_INDEX.HITS];
	const facet = (i: number, attr: string): Record<string, number> =>
		results[i]?.facetDistribution?.[attr] ?? {};

	return {
		hits: (hitsResult?.hits ?? []) as RecipeDocument[],
		total: hitsResult?.estimatedTotalHits ?? hitsResult?.totalHits ?? 0,
		page: params.page,
		limit: params.limit,
		facets: {
			mealTypeSlugs: facet(RECIPE_QUERY_INDEX.MEAL_TYPE, "mealTypeSlugs"),
			dietSlugs: facet(RECIPE_QUERY_INDEX.DIET, "dietSlugs"),
			allergenSlugs: facet(RECIPE_QUERY_INDEX.ALLERGEN, "allergenSlugs"),
			techniqueSlugs: facet(RECIPE_QUERY_INDEX.TECHNIQUE, "techniqueSlugs"),
			cuisineSlug: facet(RECIPE_QUERY_INDEX.CUISINE, "cuisineSlug"),
			difficulty: facet(RECIPE_QUERY_INDEX.DIFFICULTY, "difficulty"),
		},
	};
}
