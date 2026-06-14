import { parseRecipeSearchParams } from "$lib/recipe/schema";
import { searchRecipes } from "$lib/server/recipes";
import { requireUserId } from "$lib/server/http";
import type { PageServerLoad } from "./$types";

/**
 * Server-render the initial (and shareable) recipe catalog from the URL search params. The
 * `(app)` layout gates auth and the recipes `+layout.server.ts` supplies taxonomies + the
 * nutrient registry + the live draft count (loaded once, reused across param-only
 * navigations). This load returns only the search result, so a facet/sort/page/scope change
 * re-runs and re-serializes just that — not the reference data.
 *
 * `searchRecipes` threads `viewerId` so the base visibility filter (`visibility = PUBLIC OR
 * ownerId = me`) is always applied; the `szkice` scope is served from Postgres (drafts aren't
 * indexed).
 */
export const load: PageServerLoad = async ({ url, locals }) => {
	const viewerId = requireUserId(locals);

	const params = parseRecipeSearchParams(url.searchParams);
	const result = await searchRecipes(params, viewerId);
	return { result, params };
};
