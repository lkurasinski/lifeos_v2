import { error } from "@sveltejs/kit";
import { getNutrientRegistry } from "$lib/server/food-products";
import { getRecipeTaxonomies, countOwnDrafts } from "$lib/server/recipes";
import type { LayoutServerLoad } from "./$types";

/**
 * Reference data shared by every recipes route (catalog, new, edit): the recipe taxonomy
 * vocabularies (facet labels + detail chips), the grouped nutrient registry (the detail
 * full-profile expander + Phase 6's embedded product form), and the viewer's live draft count
 * (the `Szkice N` scope badge). Loaded here — NOT in each page load — so it's serialized once
 * on entering the recipes section and reused across search/facet/sort/page navigations (this
 * load reads no `url`, so SvelteKit won't re-run it on those param-only navigations; the draft
 * count is invariant across them and refreshes on `invalidateAll`, e.g. after deleting a
 * draft). The `(app)` layout already gates auth.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const viewerId = locals.user?.id;
	if (!viewerId) error(401, "Unauthorized");

	const [taxonomies, registry, draftCount] = await Promise.all([
		getRecipeTaxonomies(),
		getNutrientRegistry(),
		countOwnDrafts(viewerId),
	]);
	return { taxonomies, registry: registry.groups, draftCount };
};
