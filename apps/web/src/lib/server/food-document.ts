/**
 * Pure Meilisearch document builder + index config.
 *
 * Dependency-free by design: imports nothing from `$lib/server/db`,
 * `$lib/server/search`, or `$env/*`. This lets BOTH the SvelteKit app (via `$lib`)
 * and the tsx batch index step (via the relative `./food-document.js` path) load it.
 * The `FoodDocument` type comes from `$lib/food/schema` via a TYPE-ONLY import, so
 * esbuild erases it and the batch chain pulls in no extra runtime module.
 */
import type { FoodDocument } from "../food/schema";

export const FOOD_INDEX_NAME = "food_products";

/**
 * Index settings, defined once. The batch step and the runtime helper each apply
 * this to their own Meili client. Macros are top-level numeric so Meili can sort
 * them (it cannot sort nested fields).
 */
export const FOOD_INDEX_SETTINGS = {
	searchableAttributes: ["namePl", "nameEn", "categoryNamePl"],
	filterableAttributes: ["source", "categorySlug"],
	sortableAttributes: ["nameEn", "energyKcal", "protein", "fat", "carbs"],
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
	servingSizeG: number | null;
	userModified: boolean;
}

interface NutrientInput {
	infoodsTagname: string;
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
		nutrients[fn.infoodsTagname] = fn.amountPer100g;
		const macro = MACRO_FIELDS[fn.infoodsTagname];
		if (macro) doc[macro] = fn.amountPer100g;
	}

	return doc;
}
