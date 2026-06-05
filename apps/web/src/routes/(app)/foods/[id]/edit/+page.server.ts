import { error } from "@sveltejs/kit";
import {
	getFoodCategories,
	getFoodProductDraft,
	getNutrientRegistry,
} from "$lib/server/food-products";
import type { PageServerLoad } from "./$types";

/**
 * The edit screen (`/foods/[id]/edit`) loads the product as an editable `DraftProduct`
 * (from Postgres, so `categoryId` + image fields are present), plus the grouped nutrient
 * registry and category list the shared `ProductForm` needs. The `(app)` layout gates
 * auth. Unknown id → 404. Mirrors `/foods/new` so browser back/forward work cleanly.
 */
export const load: PageServerLoad = async ({ params }) => {
	const [draft, registry, categories] = await Promise.all([
		getFoodProductDraft(params.id),
		getNutrientRegistry(),
		getFoodCategories(),
	]);
	if (!draft) {
		error(404, "Nie znaleziono produktu");
	}
	return {
		id: params.id,
		draft,
		registry: registry.groups,
		categories,
	};
};
