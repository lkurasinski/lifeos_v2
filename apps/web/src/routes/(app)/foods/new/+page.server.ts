import { getFoodCategories, getNutrientRegistry } from "$lib/server/food-products";
import type { PageServerLoad } from "./$types";

/**
 * The add-product screen (`/foods/new`) needs the grouped nutrient registry (for the full
 * editable profile) and the category list (for the category select). The `(app)` layout
 * already gates auth (anonymous → /login), so this load assumes a session. No search here —
 * the OFF finder runs client-side against `POST /api/foods/off-preview`.
 */
export const load: PageServerLoad = async () => {
	const [registry, categories] = await Promise.all([getNutrientRegistry(), getFoodCategories()]);
	return {
		registry: registry.groups,
		categories,
	};
};
