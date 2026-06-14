import { json } from "@sveltejs/kit";
import { recipeSavePayloadSchema } from "$lib/recipe/schema";
import { createRecipe } from "$lib/server/recipes";
import { requireUser, parseJsonBody, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * Create a recipe via the shared persistence service — the only path a recipe enters the
 * catalog. The owner is the authenticated user (never from the body). Returns 201 `{id}`.
 *
 * NOTE: recipe SEARCH (`GET`) is wired in Phase 4 (it needs `searchRecipes` + the viewer
 * visibility filter); this collection route ships `POST` in Phase 3.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const payload = await parseJsonBody(
		request,
		recipeSavePayloadSchema,
		"Nieprawidłowe dane przepisu",
	);

	try {
		const recipe = await createRecipe(user.id, payload);
		return json({ id: recipe.id }, { status: 201 });
	} catch (err) {
		return mapServiceError(err);
	}
};
