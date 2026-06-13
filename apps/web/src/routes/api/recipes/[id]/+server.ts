import { error, json } from "@sveltejs/kit";
import { recipePatchPayloadSchema } from "$lib/recipe/schema";
import {
	getRecipeForView,
	updateRecipe,
	deleteRecipe,
	RecipeNotFoundError,
	RecipeForbiddenError,
	RecipeInUseError,
	RecipeCycleError,
	RecipeDepthError,
} from "$lib/server/recipes";
import type { RequestHandler } from "./$types";

/** View a recipe (cached nutrition + components from Postgres). 404 when not visible. */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, "Unauthorized");
	}

	const recipe = await getRecipeForView(locals.user.id, params.id);
	if (!recipe) {
		error(404, "Nie znaleziono przepisu");
	}
	return json(recipe);
};

/**
 * Edit a recipe (owner-only, full content replacement). `updateRecipe` recomputes the
 * cache, fans out to dependents, and re-syncs Meili. Maps the typed integrity errors:
 * 403 not-owner, 404 missing, 409 cycle/depth.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, "Unauthorized");
	}

	let payload;
	try {
		payload = recipePatchPayloadSchema.parse(await request.json());
	} catch {
		error(400, "Nieprawidłowe dane przepisu");
	}

	try {
		const recipe = await updateRecipe(locals.user.id, params.id, payload);
		return json({ id: recipe.id });
	} catch (err) {
		if (err instanceof RecipeNotFoundError) {
			error(404, "Nie znaleziono przepisu");
		}
		if (err instanceof RecipeForbiddenError) {
			error(403, "Brak uprawnień do tego przepisu");
		}
		if (err instanceof RecipeCycleError) {
			return json({ error: "cycle" }, { status: 409 });
		}
		if (err instanceof RecipeDepthError) {
			return json({ error: "depth", max: err.max }, { status: 409 });
		}
		throw err;
	}
};

/**
 * Delete a recipe (owner-only). Blocked (409 `{error:"in_use", referencingIds}`) while it
 * is used as a sub-recipe in another recipe. 204 on success.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.session || !locals.user) {
		error(401, "Unauthorized");
	}

	try {
		await deleteRecipe(locals.user.id, params.id);
	} catch (err) {
		if (err instanceof RecipeNotFoundError) {
			error(404, "Nie znaleziono przepisu");
		}
		if (err instanceof RecipeForbiddenError) {
			error(403, "Brak uprawnień do tego przepisu");
		}
		if (err instanceof RecipeInUseError) {
			return json({ error: "in_use", referencingIds: err.referencingIds }, { status: 409 });
		}
		throw err;
	}

	return new Response(null, { status: 204 });
};
