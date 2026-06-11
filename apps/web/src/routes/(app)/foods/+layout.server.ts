import { getFoodCategories, getNutrientRegistry } from "$lib/server/food-products";
import type { LayoutServerLoad } from "./$types";

/**
 * Reference data shared by every foods route (catalog, new, edit): the grouped nutrient
 * registry and the category list. Loaded here — NOT in each page load — so it's serialized
 * once on entering the foods section and reused across search/facet/sort/page navigations
 * within /foods. This load reads no `url`, so SvelteKit won't re-run it (nor re-send the
 * payload) on those param-only navigations; the catalog page load then re-serializes only
 * the search result per keystroke. The `(app)` layout already gates auth.
 */
export const load: LayoutServerLoad = async () => {
	const [registry, categories] = await Promise.all([getNutrientRegistry(), getFoodCategories()]);
	return {
		registry: registry.groups,
		categories,
	};
};
