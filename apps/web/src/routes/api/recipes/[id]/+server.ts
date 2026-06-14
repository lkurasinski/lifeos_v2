import { error, json } from "@sveltejs/kit";
import { recipePatchPayloadSchema } from "$lib/recipe/schema";
import { getRecipeForView, updateRecipe, deleteRecipe } from "$lib/server/recipes";
import { requireUser, parseJsonBody, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/** View a recipe (cached nutrition + components from Postgres). 404 when not visible. */
export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);

	const recipe = await getRecipeForView(user.id, params.id);
	if (!recipe) {
		error(404, "Nie znaleziono przepisu");
	}
	return json(recipe);
};

/**
 * Edit a recipe (owner-only, full content replacement). `updateRecipe` recomputes the
 * cache, fans out to dependents, and re-syncs Meili. The typed integrity errors map to
 * 403 not-owner, 404 missing, 409 cycle/depth (see `mapServiceError`).
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const user = requireUser(locals);
	const payload = await parseJsonBody(
		request,
		recipePatchPayloadSchema,
		"Nieprawidłowe dane przepisu",
	);

	try {
		const recipe = await updateRecipe(user.id, params.id, payload);
		return json({ id: recipe.id });
	} catch (err) {
		return mapServiceError(err);
	}
};

/**
 * Delete a recipe (owner-only). Blocked (409 `{error:"in_use", referencingIds}`) while it
 * is used as a sub-recipe in another recipe. 204 on success.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);

	try {
		await deleteRecipe(user.id, params.id);
	} catch (err) {
		return mapServiceError(err);
	}

	return new Response(null, { status: 204 });
};
