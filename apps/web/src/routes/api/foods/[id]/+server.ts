import { error, json } from "@sveltejs/kit";
import { patchPayloadSchema } from "$lib/food/schema";
import {
	updateFoodProduct,
	deleteFoodProduct,
	FoodProductNotFoundError,
	UnknownNutrientError,
} from "$lib/server/food-products";
import type { RequestHandler } from "./$types";

/**
 * Edit a product (any source). Body is validated by `patchPayloadSchema` — the save
 * payload minus the immutable identity fields (`source`/`sourceId`); Zod strips those
 * if a client sends them, so identity can never be mutated through edit. Calls
 * `updateFoodProduct`, which flags `userModified` for non-CUSTOM sources and re-syncs
 * Meili. 404 when the id is unknown.
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.session) {
		error(401, "Unauthorized");
	}

	let payload;
	try {
		payload = patchPayloadSchema.parse(await request.json());
	} catch {
		error(400, "Nieprawidłowe dane produktu");
	}

	try {
		const product = await updateFoodProduct(params.id, payload);
		return json({ id: product?.id ?? params.id });
	} catch (err) {
		if (err instanceof FoodProductNotFoundError) {
			error(404, "Nie znaleziono produktu");
		}
		if (err instanceof UnknownNutrientError) {
			error(400, "Nieprawidłowy składnik odżywczy");
		}
		throw err;
	}
};

/**
 * Delete a product and de-index its Meili document (the UI gates this behind a confirm
 * step). FoodNutrient rows cascade. 404 when the id is unknown.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.session) {
		error(401, "Unauthorized");
	}

	try {
		await deleteFoodProduct(params.id);
	} catch (err) {
		if (err instanceof FoodProductNotFoundError) {
			error(404, "Nie znaleziono produktu");
		}
		throw err;
	}

	return new Response(null, { status: 204 });
};
