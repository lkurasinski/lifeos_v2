import { error } from "@sveltejs/kit";
import { getFoodProductDraft } from "$lib/server/food-products";
import type { PageServerLoad } from "./$types";

/**
 * The edit screen (`/foods/[id]/edit`) loads the product as an editable `DraftProduct`
 * (from Postgres, so `categoryId` + image fields are present). The grouped nutrient
 * registry + category list the shared `ProductForm` needs come from the foods
 * `+layout.server.ts`. The `(app)` layout gates auth. Unknown id → 404.
 */
export const load: PageServerLoad = async ({ params }) => {
	const draft = await getFoodProductDraft(params.id);
	if (!draft) {
		error(404, "Nie znaleziono produktu");
	}
	return {
		id: params.id,
		draft,
	};
};
