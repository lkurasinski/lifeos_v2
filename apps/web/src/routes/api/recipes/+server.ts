import { json } from "@sveltejs/kit";
import { parseRecipeSearchParams, recipeSavePayloadSchema } from "$lib/recipe/schema";
import { createRecipe, searchRecipes } from "$lib/server/recipes";
import {
	requireUser,
	requireUserId,
	parseJsonBody,
	parseOr400,
	mapServiceError,
} from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * Catalog search — the client path for incremental facet/sort/pagination and the authoring
 * form's sub-recipe typeahead (`ProductPicker`). Mirrors the SSR `+page.server.ts` load: both
 * call the same `searchRecipes` service threading `viewerId`, so the base visibility filter
 * (`visibility = PUBLIC OR ownerId = me`) is always applied and client-driven results agree
 * with the server-rendered catalog.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const viewerId = requireUserId(locals);
	const params = parseOr400(
		() => parseRecipeSearchParams(url.searchParams),
		"Nieprawidłowe parametry wyszukiwania",
	);
	const result = await searchRecipes(params, viewerId);
	return json(result);
};

/**
 * Create a recipe via the shared persistence service — the only path a recipe enters the
 * catalog. The owner is the authenticated user (never from the body). Returns 201 `{id}`.
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
