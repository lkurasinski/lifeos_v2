import { getFoodCategories } from "$lib/server/food-products";
import { listUnits } from "$lib/server/recipes";
import type { PageServerLoad } from "./$types";

/**
 * The create form needs the seeded units (per-row unit select + client gram resolution) and the
 * food categories (the embedded inline create-product form). Taxonomies + the nutrient registry
 * come from the recipes `+layout.server.ts` (loaded once for the whole section). The `(app)`
 * layout gates auth.
 */
export const load: PageServerLoad = async () => {
	const [units, categories] = await Promise.all([listUnits(), getFoodCategories()]);
	return { units, categories };
};
