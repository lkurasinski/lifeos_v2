import { json, error } from "@sveltejs/kit";
import { parseSearchParams } from "$lib/food/schema";
import { searchFoodProducts } from "$lib/server/food-products";
import type { RequestHandler } from "./$types";

/**
 * Catalog search — the client path for incremental facet/sort/pagination without a
 * full navigation. Mirrors the SSR `+page.server.ts` load: both call the same
 * `searchFoodProducts` service, so client-driven and server-rendered results agree.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.session) {
		error(401, "Unauthorized");
	}

	let params;
	try {
		params = parseSearchParams(url.searchParams);
	} catch {
		error(400, "Nieprawidłowe parametry wyszukiwania");
	}

	const result = await searchFoodProducts(params);
	return json(result);
};
