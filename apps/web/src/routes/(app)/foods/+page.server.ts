import { parseSearchParams } from "$lib/food/schema";
import { searchFoodProducts } from "$lib/server/food-products";
import type { PageServerLoad } from "./$types";

/**
 * Server-render the initial (and shareable) catalog state from the URL search params.
 * The `(app)` layout gates auth (anonymous → /login); the foods `+layout.server.ts`
 * supplies the nutrient registry + category list (loaded once, reused across param-only
 * navigations). This load returns only the search result, so a facet/sort/page/search
 * change re-runs and re-serializes just the hits — not the reference data.
 */
export const load: PageServerLoad = async ({ url }) => {
	const params = parseSearchParams(url.searchParams);
	const result = await searchFoodProducts(params);
	return { result, params };
};
