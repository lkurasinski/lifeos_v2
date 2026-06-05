import { parseSearchParams } from "$lib/food/schema";
import {
	getFoodCategories,
	getNutrientRegistry,
	searchFoodProducts,
} from "$lib/server/food-products";
import type { PageServerLoad } from "./$types";

/**
 * Server-render the initial (and shareable) catalog state from the URL search params.
 * The `(app)` layout already gates auth (anonymous → /login), so this load assumes a
 * session. Facet/sort/page/search changes re-run this load via URL navigation, so the
 * rendered state always matches the address bar.
 *
 * The nutrient registry (for detail grouping) and the category list (for facet-chip
 * names) are loaded alongside the search result; all three feed the page in one trip.
 */
export const load: PageServerLoad = async ({ url }) => {
	const params = parseSearchParams(url.searchParams);
	const [result, registry, categories] = await Promise.all([
		searchFoodProducts(params),
		getNutrientRegistry(),
		getFoodCategories(),
	]);

	return {
		result,
		registry: registry.groups,
		categories,
		params,
	};
};
