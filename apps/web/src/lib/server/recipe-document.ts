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
import type { RecipeDocument, RecipeVisibility, RecipeDifficulty } from "../recipe/schema";

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
