import { json } from "@sveltejs/kit";
import { parseSearchParams, savePayloadSchema, bulkDeletePayloadSchema } from "$lib/food/schema";
import { searchFoodProducts, saveFoodProduct, deleteFoodProducts } from "$lib/server/food-products";
import { requireUser, parseJsonBody, parseOr400, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * Catalog search — the client path for incremental facet/sort/pagination without a
 * full navigation. Mirrors the SSR `+page.server.ts` load: both call the same
 * `searchFoodProducts` service, so client-driven and server-rendered results agree.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	requireUser(locals);
	const params = parseOr400(
		() => parseSearchParams(url.searchParams),
		"Nieprawidłowe parametry wyszukiwania",
	);
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
	requireUser(locals);
	const payload = await parseJsonBody(request, savePayloadSchema, "Nieprawidłowe dane produktu");

	try {
		const product = await saveFoodProduct(payload);
		return json({ id: product.id }, { status: 201 });
	} catch (err) {
		return mapServiceError(err);
	}
};

/**
 * Batch-delete products selected in the catalog. Best-effort by design: in-use products
 * (referenced by a recipe) are skipped, not fatal, so the response is a 200 summary the UI
 * reports against — `{ deleted, inUse, notFound }` — rather than a single-status verb. Each
 * deleted product de-indexes its Meili doc. Empty/oversized id lists 400 via the schema.
 */
export const DELETE: RequestHandler = async ({ request, locals }) => {
	requireUser(locals);
	const { ids } = await parseJsonBody(request, bulkDeletePayloadSchema, "Nieprawidłowa lista produktów");

	try {
		const result = await deleteFoodProducts(ids);
		return json(result);
	} catch (err) {
		return mapServiceError(err);
	}
};
