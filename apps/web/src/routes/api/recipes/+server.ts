import { error, json } from "@sveltejs/kit";
import { recipeSavePayloadSchema } from "$lib/recipe/schema";
import { createRecipe, RecipeCycleError, RecipeDepthError } from "$lib/server/recipes";
import type { RequestHandler } from "./$types";

/**
 * Create a recipe via the shared persistence service — the only path a recipe enters the
 * catalog. The owner is the authenticated user (never from the body). Returns 201 `{id}`.
 *
 * NOTE: recipe SEARCH (`GET`) is wired in Phase 4 (it needs `searchRecipes` + the viewer
 * visibility filter); this collection route ships `POST` in Phase 3.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, "Unauthorized");
	}

	let payload;
	try {
		payload = recipeSavePayloadSchema.parse(await request.json());
	} catch {
		error(400, "Nieprawidłowe dane przepisu");
	}

	try {
		const recipe = await createRecipe(locals.user.id, payload);
		return json({ id: recipe.id }, { status: 201 });
	} catch (err) {
		if (err instanceof RecipeCycleError) {
			return json({ error: "cycle" }, { status: 409 });
		}
		if (err instanceof RecipeDepthError) {
			return json({ error: "depth", max: err.max }, { status: 409 });
		}
		throw err;
	}
};
