import { error } from "@sveltejs/kit";
import { getFoodCategories } from "$lib/server/food-products";
import {
	listUnits,
	getRecipeDraftForEdit,
	RecipeNotFoundError,
	RecipeForbiddenError,
} from "$lib/server/recipes";
import { requireUserId } from "$lib/server/http";
import type { PageServerLoad } from "./$types";

/**
 * The edit form loads the recipe as an editable `RecipeDraft` (owner-only — `getRecipeDraftForEdit`
 * throws not-found / forbidden), plus the seeded units + food categories the shared `RecipeForm`
 * and its embedded create-product flow need. Taxonomies + nutrient registry come from the recipes
 * `+layout.server.ts`. Unknown id → 404; not the owner → 403.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = requireUserId(locals);

	try {
		const [draft, units, categories] = await Promise.all([
			getRecipeDraftForEdit(userId, params.id),
			listUnits(),
			getFoodCategories(),
		]);
		return { id: params.id, draft, units, categories };
	} catch (err) {
		if (err instanceof RecipeNotFoundError) error(404, "Nie znaleziono przepisu");
		if (err instanceof RecipeForbiddenError) error(403, "Brak uprawnień do tego przepisu");
		throw err;
	}
};
