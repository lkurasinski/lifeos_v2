import { json } from "@sveltejs/kit";
import { nutritionTargetsPayloadSchema } from "$lib/nutrition-targets/schema";
import { getNutritionTargets, upsertNutritionTargets } from "$lib/server/nutrition-targets";
import { requireUser, parseJsonBody, mapServiceError } from "$lib/server/http";
import type { RequestHandler } from "./$types";

/**
 * Read the authenticated user's daily nutritional targets, or `null` if never set. Auth
 * follows the `/api/foods` pattern: `requireUser` 401s anonymous callers (the `(app)` layout
 * already redirects browser navs to `/login`; this guards the JSON route).
 */
export const GET: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	return json(await getNutritionTargets(user.id));
};

/**
 * Create-or-replace the user's targets — `PUT` because it is an idempotent full-replace of
 * the singleton record (no separate create/update paths). The body is validated at the
 * boundary; nulls are persisted as nulls (NULL ≠ 0).
 */
export const PUT: RequestHandler = async ({ request, locals }) => {
	const user = requireUser(locals);
	const payload = await parseJsonBody(
		request,
		nutritionTargetsPayloadSchema,
		"Nieprawidłowe cele żywieniowe",
	);

	try {
		const result = await upsertNutritionTargets(user.id, payload);
		return json(result);
	} catch (err) {
		return mapServiceError(err);
	}
};
