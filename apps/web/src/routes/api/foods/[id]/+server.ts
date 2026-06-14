import { json } from "@sveltejs/kit";
import { patchPayloadSchema } from "$lib/food/schema";
import { updateFoodProduct, deleteFoodProduct } from "$lib/server/food-products";
import { requireUser, parseJsonBody, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * Edit a product (any source). Body is validated by `patchPayloadSchema` — the save
 * payload minus the immutable identity fields (`source`/`sourceId`); Zod strips those
 * if a client sends them, so identity can never be mutated through edit. Calls
 * `updateFoodProduct`, which flags `userModified` for non-CUSTOM sources and re-syncs
 * Meili. 404 when the id is unknown.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	requireUser(locals);
	const payload = await parseJsonBody(request, patchPayloadSchema, "Nieprawidłowe dane produktu");

	try {
		const product = await updateFoodProduct(params.id, payload);
		return json({ id: product?.id ?? params.id });
	} catch (err) {
		return mapServiceError(err);
	}
};

/**
 * Delete a product and de-index its Meili document (the UI gates this behind a confirm
 * step). FoodNutrient rows cascade. 404 when the id is unknown.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	requireUser(locals);

	try {
		await deleteFoodProduct(params.id);
	} catch (err) {
		return mapServiceError(err);
	}

	return new Response(null, { status: 204 });
};
