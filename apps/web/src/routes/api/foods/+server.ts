import { error, json } from "@sveltejs/kit";
import { parseSearchParams, savePayloadSchema } from "$lib/food/schema";
import {
	searchFoodProducts,
	saveFoodProduct,
	FoodProductConflictError,
} from "$lib/server/food-products";
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

/**
 * Save a confirmed/edited draft (manual CUSTOM or OFF-preview confirmation) via the
 * shared persistence service — the ONLY path a product enters the catalog. On a
 * `(source, sourceId)` collision returns 409 with the existing id so the UI can route
 * to that product instead of creating a duplicate.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) {
		error(401, "Unauthorized");
	}

	let payload;
	try {
		payload = savePayloadSchema.parse(await request.json());
	} catch {
		error(400, "Nieprawidłowe dane produktu");
	}

	try {
		const product = await saveFoodProduct(payload);
		return json({ id: product.id }, { status: 201 });
	} catch (err) {
		if (err instanceof FoodProductConflictError) {
			return json({ error: "conflict", existingId: err.existingId }, { status: 409 });
		}
		throw err;
	}
};
